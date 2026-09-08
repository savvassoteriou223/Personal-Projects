/**
 * researchScan.mjs — finds new published research relevant to each training
 * goal and reports it for review. It does NOT write anything into
 * studiesLibrary.js.
 *
 * That split is deliberate. The app's whole claim is that every number traces
 * to curated evidence, and new papers are not automatically good, relevant, or
 * consistent with the 74 findings already in the library — plenty of published
 * work contradicts other published work. Auto-ingesting would quietly let a
 * single weak study move a volume target. So: discovery is automated, judgement
 * stays human.
 *
 * Source is PubMed E-utilities (free, no key needed at this volume; set
 * NCBI_API_KEY to raise the rate limit from 3 to 10 requests/sec).
 *
 * Run:  node scripts/researchScan.mjs [--days 30] [--max 8]
 */
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const DAYS = Number(argOf('--days', 30));
const MAX_PER_TOPIC = Number(argOf('--max', 8));
const API_KEY = process.env.NCBI_API_KEY || '';
const SEEN_PATH = path.join(process.cwd(), 'docs', 'analysis', 'research-seen.json');

// One query per goal the app actually programs for. Restricted to the study
// types worth changing a recommendation over — a single small trial should not
// move a target, so observational and case work is excluded at the source.
const STUDY_TYPES = '(meta-analysis[pt] OR systematic review[pt] OR randomized controlled trial[pt])';

// Without this the scan fills with clinical rehabilitation work — a first run
// returned coronary heart disease, knee arthroplasty, knee osteoarthritis and
// air-pistol shooters under "strength". Those are real studies, just not about
// the population this app programs for, and they crowd out the ones that are.
const EXCLUDE_CLINICAL = 'NOT (patients[ti] OR rehabilitation[ti] OR arthroplasty[ti] OR osteoarthritis[ti] OR ' +
  '"heart disease"[ti] OR cardiac[ti] OR stroke[ti] OR cancer[ti] OR dialysis[ti] OR COPD[ti] OR ' +
  'Parkinson[ti] OR dementia[ti] OR surgery[ti] OR "cerebral palsy"[ti] OR sclerosis[ti] OR ' +
  'diabetes[ti] OR fibromyalgia[ti] OR "low back pain"[ti])';
const TOPICS = {
  hypertrophy: '(resistance training OR strength training) AND (hypertrophy OR "muscle growth" OR "muscle thickness" OR "cross-sectional area")',
  strength:    '(resistance training) AND (strength OR "1RM" OR "maximal strength")',
  volume_freq: '(resistance training) AND ("training volume" OR "training frequency" OR "sets per week")',
  technique:   '(resistance training) AND ("range of motion" OR "muscle length" OR "time under tension" OR "repetition duration")',
  fat_loss:    '(exercise OR "resistance training") AND ("fat loss" OR "body composition" OR "energy deficit" OR "weight loss")',
  endurance:   '("endurance training" OR "aerobic training") AND ("VO2max" OR "endurance performance" OR "concurrent training")',
  recovery:    '(sleep OR recovery OR "rest interval" OR deload) AND ("resistance training" OR "athletic performance")',
  nutrition:   '("protein intake" OR creatine OR "caffeine" OR "energy availability") AND (muscle OR strength OR performance)',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const eutils = (endpoint, params) => {
  const qs = new URLSearchParams({ db: 'pubmed', retmode: 'json', ...params });
  if (API_KEY) qs.set('api_key', API_KEY);
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${endpoint}.fcgi?${qs}`;
};

const dateStr = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
const since = new Date(Date.now() - DAYS * 864e5);

async function searchTopic(topic, query) {
  const url = eutils('esearch', {
    term: `(${query}) AND ${STUDY_TYPES} ${EXCLUDE_CLINICAL}`,
    retmax: String(MAX_PER_TOPIC),
    sort: 'date',
    datetype: 'pdat',
    mindate: dateStr(since),
    maxdate: dateStr(new Date()),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`esearch ${topic}: HTTP ${res.status}`);
  const j = await res.json();
  return j?.esearchresult?.idlist ?? [];
}

async function summarise(ids) {
  if (!ids.length) return [];
  const res = await fetch(eutils('esummary', { id: ids.join(',') }));
  if (!res.ok) throw new Error(`esummary: HTTP ${res.status}`);
  const j = await res.json();
  const r = j?.result ?? {};
  return (r.uids ?? []).map(uid => {
    const d = r[uid] ?? {};
    return {
      pmid: uid,
      title: d.title ?? '',
      journal: d.fulljournalname || d.source || '',
      date: d.pubdate ?? '',
      authors: (d.authors ?? []).slice(0, 3).map(a => a.name).join(', ') + ((d.authors ?? []).length > 3 ? ' et al.' : ''),
      type: (d.pubtype ?? []).join(', '),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    };
  });
}

const seen = fs.existsSync(SEEN_PATH) ? JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')) : { pmids: [] };
const seenSet = new Set(seen.pmids);

const digest = {};
let total = 0, skipped = 0;

for (const [topic, query] of Object.entries(TOPICS)) {
  try {
    const ids = await searchTopic(topic, query);
    const fresh = ids.filter(id => !seenSet.has(id));
    skipped += ids.length - fresh.length;
    const papers = await summarise(fresh);
    if (papers.length) digest[topic] = papers;
    total += papers.length;
    papers.forEach(p => seenSet.add(p.pmid));
    // NCBI asks for <=3 req/sec without a key; two calls per topic already.
    await sleep(API_KEY ? 120 : 400);
  } catch (e) {
    console.error(`  ! ${topic}: ${e.message}`);
  }
}

console.log(`\nPubMed scan — last ${DAYS} days, meta-analyses / systematic reviews / RCTs only`);
console.log(`${total} new papers across ${Object.keys(digest).length} topics (${skipped} already seen)\n`);

for (const [topic, papers] of Object.entries(digest)) {
  console.log(`\n══ ${topic.toUpperCase().replace(/_/g, ' ')} ${'═'.repeat(Math.max(0, 56 - topic.length))}`);
  papers.forEach(p => {
    console.log(`\n  ${p.title}`);
    console.log(`    ${p.journal} · ${p.date} · ${p.authors}`);
    console.log(`    ${p.type}`);
    console.log(`    ${p.url}`);
  });
}

if (args.includes('--commit-seen')) {
  fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
  fs.writeFileSync(SEEN_PATH, JSON.stringify({ updated: new Date().toISOString(), pmids: [...seenSet] }, null, 2));
  console.log(`\nMarked ${seenSet.size} PMIDs as seen → ${path.relative(process.cwd(), SEEN_PATH)}`);
} else {
  console.log(`\n(dry run — pass --commit-seen to record these so the next scan skips them)`);
}
