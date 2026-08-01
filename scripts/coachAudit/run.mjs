// Behavioral test suite for the AI coach's system prompt (ai-coach/index.ts).
// Fires real conversations at the real Anthropic API using the coach's actual
// SYSTEM_PROMPT/TOOLS (extracted live from source, never hand-copied) and checks
// the responses against the prompt's own rules — the code-level review this
// complements can't catch a model failing to follow its own instructions.
//
// Needs real API billing. Run:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/coachAudit/run.mjs
//
// Re-run this whenever SYSTEM_PROMPT changes — several rules here exist because
// an earlier prompt version passed code review but failed in conversation
// (the empty-text bug, the decline-press cross-group bug are both named in
// ai-coach/index.ts's own comments).
import { SYSTEM_PROMPT, TOOLS } from './extractPrompt.mjs';
import { FIXTURE_CONTEXT, FIXTURE_CONTEXT_LIVE } from './fixture.mjs';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

async function ask(context, question) {
  const messages = [
    { role: 'user', content: `My training data:\n${context}` },
    { role: 'user', content: `Question: ${question}` },
  ];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: [{ type: 'text', text: SYSTEM_PROMPT }],
      messages,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json.content?.find(b => b.type === 'text')?.text || '';
  const toolCalls = (json.content ?? []).filter(b => b.type === 'tool_use');
  return { text, toolCalls, raw: json };
}

function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

const TESTS = [
  {
    name: '1. Off-topic rejection',
    context: FIXTURE_CONTEXT,
    question: "What's a good recipe for banana bread?",
    check: (r) => {
      const issues = [];
      if (r.toolCalls.length) issues.push(`called tool(s) on an off-topic question: ${r.toolCalls.map(t => t.name).join(', ')}`);
      if (!/only help with training, nutrition, and recovery/i.test(r.text)) issues.push(`did not use the fixed refusal text — got: "${r.text}"`);
      return issues;
    },
  },
  {
    name: '2. Swap without naming replacement (suggest_exercise_alternatives)',
    context: FIXTURE_CONTEXT,
    question: "Can you change my decline bench press? Not a fan of it.",
    check: (r) => {
      const issues = [];
      const alt = r.toolCalls.find(t => t.name === 'suggest_exercise_alternatives');
      if (!alt) { issues.push(`expected suggest_exercise_alternatives, got: ${r.toolCalls.map(t=>t.name).join(', ') || 'no tool call'}`); return issues; }
      const inp = alt.input;
      if (inp.day_id !== 'push') issues.push(`day_id: expected 'push', got '${inp.day_id}'`);
      if (inp.exercise_index !== 1) issues.push(`exercise_index: expected 1, got ${inp.exercise_index}`);
      if (inp.current_exercise !== 'Decline barbell press') issues.push(`current_exercise: expected 'Decline barbell press', got '${inp.current_exercise}'`);
      if (!/Decline.*Lower Chest/i.test(inp.pattern_label || '')) issues.push(`pattern_label: expected the decline/lower-chest group, got '${inp.pattern_label}'`);
      const DECLINE_GROUP = ['Decline barbell press', 'Decline dumbbell press', 'Cable crossover (lower chest)', 'Standing cable fly (lower chest / multi-angle)', 'Dips (chest focus, lean forward)'];
      (inp.alternatives || []).forEach(a => {
        if (!DECLINE_GROUP.includes(a.exercise_name)) issues.push(`alternative "${a.exercise_name}" is NOT in the decline/lower-chest group (cross-group leak)`);
      });
      if ((inp.alternatives || []).length < 2) issues.push(`only ${(inp.alternatives||[]).length} alternatives offered, expected 2-3`);
      if (wordCount(r.text) === 0) issues.push('no text reply naming the options (rule 7 last paragraph)');
      return issues;
    },
  },
  {
    name: '3. Named replacement, same group',
    context: FIXTURE_CONTEXT,
    question: "Swap my decline barbell press for decline dumbbell press",
    check: (r) => {
      const issues = [];
      const p = r.toolCalls.find(t => t.name === 'propose_program_change');
      if (!p) { issues.push(`expected propose_program_change, got: ${r.toolCalls.map(t=>t.name).join(', ') || 'none'}`); return issues; }
      const inp = p.input;
      if (inp.day_id !== 'push') issues.push(`day_id: expected 'push', got '${inp.day_id}'`);
      if (inp.exercise_index !== 1) issues.push(`exercise_index: expected 1, got ${inp.exercise_index}`);
      if (inp.current_exercise !== 'Decline barbell press') issues.push(`current_exercise: expected 'Decline barbell press', got '${inp.current_exercise}'`);
      if (inp.exercise_name !== 'Decline dumbbell press') issues.push(`exercise_name: expected 'Decline dumbbell press', got '${inp.exercise_name}'`);
      if (inp.type !== 'permanent_edit') issues.push(`type: expected 'permanent_edit' (default, scope not mentioned by user), got '${inp.type}'`);
      if (inp.pattern_change_reason) issues.push(`set pattern_change_reason for an IN-GROUP swap — should be absent`);
      return issues;
    },
  },
  {
    name: '4. THE DECLINE-PRESS BUG — named cross-group replacement of a SOLE slot',
    context: FIXTURE_CONTEXT,
    question: "Replace my decline bench press with an incline dumbbell press",
    // Decline barbell press is a SOLE slot (see fixture) — rule 7b's narrow
    // exception sanctions a confirming question here specifically. Either a
    // confirming question OR an immediate propose_program_change (with
    // pattern_change_reason set, since it crosses groups) is acceptable; what's
    // NOT acceptable is silently proposing the cross without declaring it
    // (the app's own validation would reject that with no explanation), or
    // asking MORE than one question, or asking about something unrelated.
    check: (r) => {
      const issues = [];
      const p = r.toolCalls.find(t => t.name === 'propose_program_change');
      if (p) {
        if (p.input.exercise_name === 'Incline dumbbell press' && !p.input.pattern_change_reason) {
          issues.push(`CROSS-GROUP SWAP WITHOUT pattern_change_reason SET — the app's own validation (CoachScreen.jsx replacementPatternCheck) REJECTS this silently.`);
        }
      } else {
        const qMarks = (r.text.match(/\?/g) || []).length;
        if (qMarks === 0) issues.push(`neither proposed the change nor asked a confirming question — text: "${r.text}"`);
        if (qMarks > 1) issues.push(`asked more than one question`);
        if (!/lower chest|decline/i.test(r.text)) issues.push(`didn't mention the actual tradeoff (losing lower-chest work) — text: "${r.text}"`);
      }
      return issues;
    },
  },
  {
    name: '5. "this exercise" WITH live session (rule 7a — must not ask which)',
    context: FIXTURE_CONTEXT_LIVE,
    question: "swap this for something else",
    check: (r) => {
      const issues = [];
      const alt = r.toolCalls.find(t => t.name === 'suggest_exercise_alternatives');
      const p = r.toolCalls.find(t => t.name === 'propose_program_change');
      const acted = alt || p;
      if (!acted) { issues.push(`asked a clarifying question instead of acting on the live "current exercise" — got text: "${r.text}"`); return issues; }
      const inp = acted.input;
      if (inp.exercise_index !== 3) issues.push(`exercise_index: expected 3 (the live current exercise), got ${inp.exercise_index}`);
      if ((inp.current_exercise || '') !== 'Dumbbell lateral raise') issues.push(`current_exercise: expected 'Dumbbell lateral raise', got '${inp.current_exercise}'`);
      return issues;
    },
  },
  {
    name: '6. "change this one" with NO live session, NO exercise named (only allowed clarifying question)',
    context: FIXTURE_CONTEXT,
    question: "change this one",
    check: (r) => {
      const issues = [];
      if (r.toolCalls.length) {
        issues.push(`called a tool (${r.toolCalls.map(t=>t.name).join(', ')}) with no way to know which exercise — should have asked instead, risk of a hallucinated index`);
      }
      const qMarks = (r.text.match(/\?/g) || []).length;
      if (qMarks === 0) issues.push(`did not ask a clarifying question despite genuine ambiguity — text: "${r.text}"`);
      if (qMarks > 1) issues.push(`asked more than one question (rule 8 caps at one)`);
      return issues;
    },
  },
  {
    name: '7. SOLE slot removal — must state the consequence',
    context: FIXTURE_CONTEXT,
    question: "Remove my lateral raise, I don't want to do it anymore",
    check: (r) => {
      const issues = [];
      const p = r.toolCalls.find(t => t.name === 'propose_program_change');
      if (!p) { issues.push(`expected propose_program_change (remove_exercise), got: ${r.toolCalls.map(t=>t.name).join(', ') || 'none'}`); return issues; }
      if (p.input.edit_type !== 'remove_exercise') issues.push(`edit_type: expected 'remove_exercise', got '${p.input.edit_type}'`);
      if (!/side delt|lateral|only|lose|entirely|no more/i.test(r.text)) {
        issues.push(`did NOT state the SOLE-slot consequence (losing all direct side-delt work) in the text reply — text: "${r.text}"`);
      }
      return issues;
    },
  },
  {
    name: '8. 120-word cap on an expansive question',
    context: FIXTURE_CONTEXT,
    question: "Can you explain why progressive overload matters and how I should think about my training over the next 3 months, including how volume and intensity should change?",
    check: (r) => {
      const issues = [];
      const wc = wordCount(r.text);
      if (wc > 120) issues.push(`text reply is ${wc} words, over the 120-word cap`);
      // Line-start markers only — a bare hyphen or asterisk inside prose (em
      // dashes, "session-to-session") is normal writing, not markdown.
      if (/^\s*[-*•]\s|^\s{0,3}#{1,6}\s|^\s*\d+\.\s/m.test(r.text)) issues.push(`reply contains markdown/bullet formatting (rule 5 says plain text only)`);
      return issues;
    },
  },
  {
    name: '9. remember_fact trigger on a stated dislike/mild injury',
    context: FIXTURE_CONTEXT,
    question: "By the way, I really hate doing bicep curls, they hurt my elbow a bit. Can we avoid programming direct bicep isolation for now?",
    check: (r) => {
      const issues = [];
      const fact = r.toolCalls.find(t => t.name === 'remember_fact');
      if (!fact) issues.push(`no remember_fact call for a stated dislike + injury signal`);
      else if (!['dislike', 'injury'].includes(fact.input.category)) issues.push(`remember_fact category: expected dislike or injury, got '${fact.input.category}'`);
      return issues;
    },
  },
];

const results = [];
for (const t of TESTS) {
  process.stdout.write(`Running: ${t.name} ... `);
  try {
    const r = await ask(t.context, t.question);
    const issues = t.check(r);
    results.push({ name: t.name, issues, text: r.text, toolCalls: r.toolCalls.map(tc => ({ name: tc.name, input: tc.input })) });
    console.log(issues.length ? `FAIL (${issues.length})` : 'PASS');
  } catch (e) {
    results.push({ name: t.name, issues: [`EXCEPTION: ${e.message}`] });
    console.log('ERROR');
  }
}

console.log('\n\n════════════════════ DETAIL ════════════════════');
for (const r of results) {
  console.log(`\n--- ${r.name} ---`);
  if (r.text !== undefined) console.log('TEXT:', JSON.stringify(r.text));
  if (r.toolCalls?.length) console.log('TOOL CALLS:', JSON.stringify(r.toolCalls, null, 2));
  if (r.issues.length) {
    console.log('ISSUES:');
    r.issues.forEach(i => console.log('  -', i));
  } else {
    console.log('OK');
  }
}

const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
console.log(`\n\nTOTAL: ${results.length} tests, ${totalIssues} issues found`);
