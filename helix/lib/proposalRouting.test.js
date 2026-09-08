import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAddProposal } from './proposalRouting.js';

// The reported bug: user asked the coach to ADD a back exercise on an Upper
// day (1 back, 2 chest, 2 shoulders, 1 bicep, 1 tricep already on it). The
// model's natural, schema-correct call for a lasting addition is
// type:'permanent_edit' (it lasts) + edit_type:'add_exercise' (what it does).
test('the exact reported call is recognised as an addition', () => {
  const call = {
    type: 'permanent_edit',
    edit_type: 'add_exercise',
    day_id: 'upper_a',
    exercise_index: 3,        // required by the schema, meaningless for an add
    exercise_name: 'Barbell row',
    slot_pattern_label: 'Back — Horizontal Pull (Back Thickness + Inner Back)',
    rationale: 'Adds a second weekly back exercise to balance chest volume.',
    scope_label: 'Permanent change',
  };
  assert.equal(isAddProposal(call), true);
});

test('every combination that should mean "addition" is recognised', () => {
  assert.equal(isAddProposal({ type: 'add_exercise', edit_type: 'replace_exercise' }), true);
  assert.equal(isAddProposal({ type: 'permanent_edit', edit_type: 'add_exercise' }), true);
  assert.equal(isAddProposal({ type: 'session_swap', edit_type: 'add_exercise' }), true);
  assert.equal(isAddProposal({ type: 'add_exercise', edit_type: 'add_exercise' }), true);
});

test('a genuine replace is never mistaken for an addition', () => {
  assert.equal(isAddProposal({ type: 'permanent_edit', edit_type: 'replace_exercise' }), false);
  assert.equal(isAddProposal({ type: 'session_swap', edit_type: 'adjust_sets' }), false);
  assert.equal(isAddProposal({ type: 'permanent_edit', edit_type: 'remove_exercise' }), false);
});

test('missing fields never accidentally read as an addition', () => {
  assert.equal(isAddProposal({}), false);
  assert.equal(isAddProposal({ type: 'permanent_edit' }), false);
  assert.equal(isAddProposal(null), false);
  assert.equal(isAddProposal(undefined), false);
});
