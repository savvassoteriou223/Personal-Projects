// Behavioral test harness for supabase/functions/ai-coach/index.ts.
// Extracts the REAL SYSTEM_PROMPT / TOOLS constants from the source file (so
// tests run against exactly what's deployed, not a hand-copied approximation),
// then fires realistic conversations at the real Anthropic API and checks the
// responses against the rules in the system prompt.

import fs from 'fs';

const SRC = fs.readFileSync('C:/Users/user/fitpulse/supabase/functions/ai-coach/index.ts', 'utf8');

function extractConst(name, src) {
  const startMarker = `const ${name} = `;
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`can't find ${name}`);
  let i = start + startMarker.length;
  // find the matching end: template literal (`...`) or array/object literal
  const opener = src[i];
  let depth = 0, inStr = null, end = -1;
  if (opener === '`') {
    i++;
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '`') { end = i + 1; break; }
      i++;
    }
  } else {
    // array or object literal — bracket-depth scan, skipping strings
    const open = opener, close = opener === '[' ? ']' : '{';
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) { end = i + 1; break; } }
    }
  }
  const literal = src.slice(start + startMarker.length, end);
  // eslint-disable-next-line no-eval
  return (0, eval)(`(${literal})`);
}

// SYSTEM_PROMPT interpolates ${SCIENCE_REFERENCE} — extract that first and put
// it in global scope so the SYSTEM_PROMPT template literal resolves correctly.
globalThis.SCIENCE_REFERENCE = extractConst('SCIENCE_REFERENCE', SRC);
export const SYSTEM_PROMPT = extractConst('SYSTEM_PROMPT', SRC);
export const TOOLS = extractConst('TOOLS', SRC);

console.error(`extracted SYSTEM_PROMPT (${SYSTEM_PROMPT.length} chars) and TOOLS (${TOOLS.length} tools) from source`);
