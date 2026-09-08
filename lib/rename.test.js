const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LOCALES = ['en','de','es','fr','it','pt','ru','zh'];
const AI_TERMS = /AI Coach|AI coach|AI coaching|KI-Coach|KI-Coaching|Coach IA|coaching IA|Entrenador IA|coach con IA|entrenador con IA|coaching con IA|Coach de IA|coach de IA|coaching com IA|ИИ-коуч|ИИ-коучинг|AI 教练/;
const COACH_KEYS = [['coach','title'], ['welcome','tagline'], ['onboarding','step5','sub'], ['profile','whatTrainSub']];
const get = (o,p) => p.reduce((a,k)=>a&&a[k], o);

test('coach copy contains no AI qualifier in any locale', () => {
  for (const loc of LOCALES) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname,'..','locales',loc+'.json'),'utf8'));
    for (const key of COACH_KEYS) {
      const v = get(j, key);
      if (v == null) continue;
      assert.ok(!AI_TERMS.test(v), `${loc} ${key.join('.')} still has AI term: ${v}`);
    }
  }
});

test('PremiumPaywall has no hardcoded "AI Coach" copy', () => {
  const src = fs.readFileSync(path.join(__dirname,'..','screens','PremiumPaywall.jsx'),'utf8');
  assert.ok(!/AI Coach/.test(src), 'screens/PremiumPaywall.jsx still has hardcoded "AI Coach" copy');
});
