/**
 * Parses every source file in the app.
 *
 * `node --check` cannot read JSX, so a broken component file passes every
 * command-line check and only fails when Metro bundles it — or, if the dev
 * server is already running with a stale bundle, not until a build. An unmatched
 * parenthesis in a ternary chain reached that point once; this makes it fail in
 * under a second instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transformFileSync } from '@babel/core';

const ROOTS = ['screens', 'components', 'lib', 'plugins'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'android', 'ios', '.expo']);

function sources(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

const FILES = [...ROOTS.flatMap(r => sources(r)), 'App.js', 'supabase.js'].filter(f => fs.existsSync(f));

test('every source file parses', () => {
  assert.ok(FILES.length > 20, `expected the app's sources, found ${FILES.length}`);
  const broken = [];
  for (const file of FILES) {
    try {
      transformFileSync(file, {
        presets: ['babel-preset-expo'],
        babelrc: false,
        configFile: false,
        code: false,
      });
    } catch (e) {
      broken.push(`${file}: ${String(e.message).split('\n')[0]}`);
    }
  }
  assert.deepEqual(broken, [], `files failed to parse:\n  ${broken.join('\n  ')}`);
});
