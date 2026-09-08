/**
 * Holds migrated screens to the type scale, and reports the rest as debt.
 *
 * The app had 29 distinct font sizes with 79% of every text style crammed
 * between 11px and 17px — which is why nothing ever looked more important than
 * anything else. `lib/theme.js` has defined a type scale the whole time; it was
 * used exactly once, against 1,565 uses of `colors`. A design system nobody is
 * held to is a document, not a system.
 *
 * MIGRATED files must use only scale values. Everything else is listed as debt
 * so the size of the job stays visible instead of being rediscovered later. A
 * test that failed on all 30 screens at once would just get skipped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SCALE } from './theme.js';

// Screens converted to the scale. Add a file here when you migrate it — never
// remove one, that is the ratchet.
const MIGRATED = [
  'screens/TodayScreen.jsx',
  'screens/WorkoutExecutionScreen.jsx',
];

const SEARCH = ['screens', 'components'];

function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files(full, out);
    else if (e.name.endsWith('.jsx')) out.push(full.split(path.sep).join('/'));
  }
  return out;
}

const readSizes = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/fontSize:\s*([\d.]+)/g)].map(m => Number(m[1]));

test('the scale itself is a real scale', () => {
  // Steps must be far enough apart to be visible. Anything under ~1.2x reads as
  // a mistake rather than a level, which is the trap the app fell into.
  const s = SCALE.fontSize;
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i] / s[i - 1] >= 1.15,
      `${s[i - 1]} -> ${s[i]} is only ${(s[i] / s[i - 1]).toFixed(2)}x — too close to read as a level`);
  }
});

test('migrated screens use only scale font sizes', () => {
  const bad = [];
  for (const file of MIGRATED) {
    assert.ok(fs.existsSync(file), `${file} is listed as migrated but does not exist`);
    const off = [...new Set(readSizes(file))].filter(v => !SCALE.fontSize.includes(v));
    if (off.length) bad.push(`${file}: ${off.join(', ')}`);
  }
  assert.deepEqual(bad, [], `off-scale font sizes:\n  ${bad.join('\n  ')}`);
});

test('reports how much of the app is still off-scale', () => {
  // Informational — never fails. Its job is to keep the number in front of
  // whoever runs the suite, so the debt does not quietly become permanent.
  const rows = [];
  for (const file of SEARCH.flatMap(d => files(d))) {
    if (MIGRATED.includes(file)) continue;
    const sizes = readSizes(file);
    const off = sizes.filter(v => !SCALE.fontSize.includes(v)).length;
    if (off) rows.push([file, off, sizes.length]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, r) => n + r[1], 0);
  console.log(`\n  design-scale debt: ${total} off-scale font sizes across ${rows.length} files`);
  rows.slice(0, 8).forEach(([f, off, all]) => console.log(`    ${off}/${all}  ${f}`));
  console.log(`    migrated: ${MIGRATED.join(', ')}`);
  assert.ok(true);
});
