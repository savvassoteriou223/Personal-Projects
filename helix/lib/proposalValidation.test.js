import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isApplicableProposal,
  filterApplicableProposals,
  dedupeProposalsBySlot,
  sanitizeProposals,
} from './proposalValidation.js';

// The malformed shapes below are not hypothetical — a propose_program_change
// with day_id undefined was produced by the real model on two separate live
// runs of a multi-slot equipment sweep.

// ── isApplicableProposal ─────────────────────────────────────────────────────

test('a fully specified replace proposal is applicable', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'replace_exercise', exercise_index: 2,
    exercise_name: 'Dumbbell bench press',
  }), true);
});

test('a replace naming no replacement exercise is rejected', () => {
  // Live shape: "EZ-bar skullcrusher -> undefined" on a 6-day sweep.
  assert.equal(isApplicableProposal({
    day_id: 'push_b', edit_type: 'replace_exercise', exercise_index: 4,
    current_exercise: 'EZ-bar skullcrusher', exercise_name: undefined,
  }), false);
});

test('a removal needs no exercise_name — there is nothing to name', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'remove_exercise', exercise_index: 3,
  }), true);
});

test('adjust_sets needs no exercise_name', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_b', edit_type: 'adjust_sets', exercise_index: 4, sets: 4,
  }), true);
});

test('add_exercise without a name is rejected', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'add_exercise',
  }), false);
});

test('a proposal with no day_id is rejected', () => {
  assert.equal(isApplicableProposal({
    edit_type: 'replace_exercise', exercise_index: 2,
  }), false);
});

test('a non-add proposal with no exercise_index is rejected', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'replace_exercise',
  }), false);
});

test('exercise_index 0 is valid — falsy but a real slot', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'replace_exercise', exercise_index: 0,
    exercise_name: 'Goblet squat',
  }), true);
});

test('a non-integer exercise_index is rejected', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'replace_exercise', exercise_index: '2',
  }), false);
});

test('add_exercise needs no exercise_index — it creates a new slot', () => {
  assert.equal(isApplicableProposal({
    day_id: 'full_body_a', edit_type: 'add_exercise', exercise_name: 'Cable crunch',
  }), true);
});

test('a proposal with no edit_type is rejected', () => {
  assert.equal(isApplicableProposal({ day_id: 'full_body_a', exercise_index: 1 }), false);
});

test('null and undefined are rejected rather than throwing', () => {
  assert.equal(isApplicableProposal(null), false);
  assert.equal(isApplicableProposal(undefined), false);
});

// ── filterApplicableProposals ────────────────────────────────────────────────

test('filtering keeps the good proposals and drops the malformed one', () => {
  const kept = filterApplicableProposals([
    { day_id: 'a', edit_type: 'replace_exercise', exercise_index: 0, exercise_name: 'X' },
    { edit_type: 'replace_exercise', exercise_index: 1, exercise_name: 'Y' }, // no day_id
    { day_id: 'b', edit_type: 'replace_exercise', exercise_index: 3, exercise_name: 'Z' },
  ]);
  assert.equal(kept.length, 2);
  assert.deepEqual(kept.map(p => p.day_id), ['a', 'b']);
});

test('filtering an empty or missing list yields an empty list', () => {
  assert.deepEqual(filterApplicableProposals([]), []);
  assert.deepEqual(filterApplicableProposals(undefined), []);
});

// ── dedupeProposalsBySlot ────────────────────────────────────────────────────

test('a slot re-proposed by a continuation turn is dropped, keeping the first', () => {
  const deduped = dedupeProposalsBySlot([
    { day_id: 'a', exercise_index: 0, exercise_name: 'Goblet squat' },
    { day_id: 'a', exercise_index: 1, exercise_name: 'Dumbbell bench press' },
    { day_id: 'a', exercise_index: 0, exercise_name: 'Leg press' }, // repeat of slot a#0
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].exercise_name, 'Goblet squat');
});

test('the same index on different days is not a duplicate', () => {
  const deduped = dedupeProposalsBySlot([
    { day_id: 'a', exercise_index: 0 },
    { day_id: 'b', exercise_index: 0 },
  ]);
  assert.equal(deduped.length, 2);
});

// ── sanitizeProposals ────────────────────────────────────────────────────────

test('sanitize drops malformed and duplicate proposals together', () => {
  const clean = sanitizeProposals([
    { day_id: 'a', edit_type: 'replace_exercise', exercise_index: 0, exercise_name: 'X' },
    { edit_type: 'replace_exercise', exercise_index: 9, exercise_name: 'Y' },              // malformed
    { day_id: 'a', edit_type: 'replace_exercise', exercise_index: 0, exercise_name: 'Z' }, // duplicate
    { day_id: 'b', edit_type: 'replace_exercise', exercise_index: 2, exercise_name: 'W' },
  ]);
  assert.equal(clean.length, 2);
  assert.deepEqual(clean.map(p => `${p.day_id}#${p.exercise_index}`), ['a#0', 'b#2']);
});

test('a real 9-proposal sweep with one malformed entry yields 8 usable cards', () => {
  // Shape taken from the live BEG-7b run: 3 days covered plus one call that
  // came back with every field undefined.
  const r = (day_id, exercise_index) => ({
    day_id, edit_type: 'replace_exercise', exercise_index, exercise_name: 'Dumbbell variant',
  });
  const raw = [
    r('full_body_a', 0), r('full_body_a', 1), r('full_body_a', 2), r('full_body_a', 5),
    r('full_body_b', 0), r('full_body_b', 1),
    r('full_body_c', 0), r('full_body_c', 4),
    { day_id: undefined, edit_type: undefined, exercise_index: undefined },
  ];
  const clean = sanitizeProposals(raw);
  assert.equal(clean.length, 8);
  assert.equal(clean.every(p => !!p.day_id), true);
});
