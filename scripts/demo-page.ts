// Builds the Sprint 0 demo page from a real test run and the checker's real output.
// node scripts/demo-page.ts --tap <file> --records <folder> --commit <sha> --ci <url> --out <file>
// Every "Passed" comes from the TAP output of a run; nothing is typed in by hand.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { checkRecord } from '../src/checkStatus.ts';

const { values: a } = parseArgs({
  options: { tap: { type: 'string' }, records: { type: 'string' }, commit: { type: 'string' }, ci: { type: 'string' }, out: { type: 'string' } },
});
if (!a.tap || !a.records || !a.commit || !a.ci || !a.out) throw new Error('missing argument');

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeHref = (u: string) => (/^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]*)?$/.test(u) ? esc(u) : '#');

// Test results, from the TAP file of the run.
const tap = readFileSync(a.tap, 'utf8');
const results = new Map<string, boolean>();
for (const m of tap.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)) results.set(m[2].trim(), m[1] === 'ok');
const passed = [...results.values()].filter(Boolean).length;
const resultFor = (prefix: string) => {
  const hits = [...results].filter(([n]) => n.startsWith(prefix));
  if (!hits.length) return '<span class="tag none">No test</span>';
  const ok = hits.every(([, v]) => v);
  return `<span class="tag ${ok ? 'pass' : 'fail'}">${ok ? 'Passed' : 'Failed'}</span> <span class="muted">${hits.length} test${hits.length > 1 ? 's' : ''}</span>`;
};

const cases: [string, string, string][] = [
  ['O0-1 case 1', 'CI passes on a clean push', `CI on GitHub: <a href="${safeHref(a.ci)}">the run for this build</a>`],
  ['O0-1 case 2', 'A failing test fails CI', 'CI on GitHub: run 42597400937 on throwaway branch <code>ci-must-fail</code> failed on its deliberate test'],
  ['O0-1 case 3', 'The secrets check finds keys and passes clean text', resultFor('O0-1 case 3') + ' ' + resultFor('R5')],
  ['O0-2 case 1', 'A complete sprint record passes', resultFor('O0-2 case 1')],
  ['O0-2 case 2', 'A complete kanban record passes; sprint fields refused on kanban', resultFor('O0-2 case 2')],
  ['O0-2 case 3', 'A missing field fails, naming it', resultFor('O0-2 case 3')],
  ['O0-2 case 4', 'An unknown stage or type fails, listing the allowed ones', resultFor('O0-2 case 4')],
  ['O0-2 case 5', 'Dates in the future, or after the record was written, fail', resultFor('O0-2 case 5')],
  ['O0-2 case 6', 'A waiting question with no text fails', resultFor('O0-2 case 6')],
  ['O0-2 case 7', 'Markup passes but is flagged as plain text', resultFor('O0-2 case 7')],
  ['O0-2 case 8', 'Hostile input refused: over 1 MB, not JSON, bad links, extra fields', resultFor('O0-2 case 8')],
  ['O0-2 case 9', 'An unknown version is refused clearly', resultFor('O0-2 case 9')],
  ['O0-3 case 1', 'All five real records pass the checker', 'By hand (records are private): shown below'],
  ['O0-3 cases 2, 3', 'Each record matches its source; open questions appear, answered ones do not', 'By hand: the table below, also checked by the independent reviewer'],
  ['O0-3 case 4', 'The website record has no sprint fields and passes', 'By hand: shown below'],
  ['O0-4 case 1', 'The guide\'s worked example passes', resultFor('O0-4 case 1')],
  ['O0-4 case 2', 'Rory reviews and saves the skill changes', 'Waiting on you: the three review cards in the chat'],
];
const review = [...results].filter(([n]) => /^(R|C)\d/.test(n));

// The checker refusing real mistakes, run now.
const base = JSON.parse(readFileSync('test/fixtures/sprint-project.json', 'utf8'));
const demoBad: [string, (r: Record<string, unknown>) => void][] = [
  ['A stage that does not exist', (r) => ((r.sprint as Record<string, unknown>).stage = 'nearly done')],
  ['A record written next month', (r) => (r.writtenAt = '2026-12-01T00:00:00Z')],
  ['A question with no text', (r) => ((r.waiting as Record<string, unknown>[])[0].text = '')],
  ['A link that runs code', (r) => ((r.links as Record<string, unknown>).demo = 'javascript:alert(1)')],
  ['A link with a user name in front of the host', (r) => ((r.links as Record<string, unknown>).repo = 'https://github.com@evil.example/')],
];
const NOW = new Date('2026-11-09T09:00:00Z');
const demos = demoBad.map(([label, f]) => {
  const r = structuredClone(base); f(r);
  const out = checkRecord(JSON.stringify(r), { now: NOW });
  return `<tr><td>${esc(label)}</td><td>${out.ok ? '<span class="tag fail">Accepted</span>' : '<span class="tag pass">Refused</span>'}</td><td>${out.errors.map(esc).join('<br>')}</td></tr>`;
}).join('');

// The five records, checked now.
const stageWords: Record<string, string> = {
  refining: 'Refining', 'awaiting-answers': 'Waiting for your answers', ready: 'Ready, waiting for your go',
  building: 'Building', 'awaiting-signoff': 'Waiting for your sign-off', closed: 'Closed',
};
const typeWords: Record<string, string> = {
  question: 'Question', 'demo-signoff': 'Demo sign-off', 'deploy-approval': 'Live deploy', 'hand-check': 'Hand check', 'account-step': 'Account step',
};
const files = readdirSync(a.records).filter((f) => f.endsWith('.json')).sort();
let recordsPass = 0;
const cards = files.map((f) => {
  const text = readFileSync(join(a.records!, f), 'utf8');
  const chk = checkRecord(text);
  if (chk.ok) recordsPass++;
  const r = JSON.parse(text);
  const s = r.sprint;
  const waiting = (r.waiting as { type: string; text: string; recommendation?: string; askedOn: string; source?: string }[])
    .map((w) => `<li><span class="tag t">${esc(typeWords[w.type] ?? w.type)}</span> ${esc(w.text)}${w.recommendation ? `<div class="rec">Recommended: ${esc(w.recommendation)}</div>` : ''}<div class="muted">Asked ${esc(w.askedOn)}${w.source ? ` · ${esc(w.source)}` : ''}</div></li>`)
    .join('');
  return `<section class="card">
    <header><h3>${esc(r.project.name)}</h3><span class="tag ${chk.ok ? 'pass' : 'fail'}">${chk.ok ? 'Record passes' : 'Record refused'}</span></header>
    ${s ? `<p class="stage">Sprint ${esc(s.number)}: ${esc(s.title)}<br><strong>${esc(stageWords[s.stage] ?? s.stage)}</strong> since ${esc(s.stageSince)} · ${s.stories.length} stor${s.stories.length === 1 ? 'y' : 'ies'}</p>` : `<p class="stage"><strong>Kanban</strong>: no sprints</p>`}
    <p class="muted">Last activity ${esc(r.lastActivity)} · record written ${esc(r.writtenAt)}</p>
    ${waiting ? `<h4>Waiting on you (${r.waiting.length})</h4><ul>${waiting}</ul>` : '<p class="muted">Nothing waiting on you recorded.</p>'}
    ${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}
    ${chk.errors.map((e) => `<p class="err">${esc(e)}</p>`).join('')}
  </section>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project Overview: Sprint 0 demo</title>
<style>
:root{--bg:#f7f6f2;--ink:#1d1d1b;--muted:#6b6a64;--line:#dedcd3;--card:#fff;--pass:#1f7a4d;--passbg:#e3f3ea;--fail:#a3282b;--failbg:#f8e3e3;--acc:#3b4cca}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--ink:#ecebe6;--muted:#a3a29b;--line:#34332f;--card:#1f1f1c;--passbg:#183a29;--pass:#7fd6a6;--failbg:#3d1d1e;--fail:#f19a9c;--acc:#9aa5ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1060px;margin:0 auto;padding:32px 20px 64px}h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:40px 0 10px}h3{margin:0;font-size:17px}h4{margin:14px 0 6px;font-size:14px}
.muted{color:var(--muted);font-size:13px}a{color:var(--acc)}code{font-size:13px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:22px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.stat b{display:block;font-size:24px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}.pass{background:var(--passbg);color:var(--pass)}.fail{background:var(--failbg);color:var(--fail)}.none{background:var(--line)}.t{background:var(--line);color:var(--ink);font-weight:500}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.card header{display:flex;justify-content:space-between;gap:8px;align-items:center}.stage{margin:10px 0 4px}ul{margin:0;padding-left:18px}li{margin-bottom:8px}.rec{font-size:13px}.note{font-size:13px;border-left:3px solid var(--line);padding-left:10px;color:var(--muted)}.err{color:var(--fail)}
.ask{background:var(--card);border:2px solid var(--acc);border-radius:12px;padding:16px 20px;margin-top:28px}
</style></head><body><main>
<p class="muted">Project Overview · Sprint 0 review · build <code>${esc(a.commit.slice(0, 7))}</code> · <a href="${safeHref(a.ci)}">CI run</a></p>
<h1>Sprint 0: foundations and the status record</h1>
<p>A standard record that says where each project stands and what is waiting on you, a checker that refuses anything it cannot trust, and the first records for all five projects. The page that shows them comes in Sprint 1.</p>
<div class="summary">
<div class="stat"><b>${passed} of ${results.size}</b><span class="muted">automated tests passed in this build</span></div>
<div class="stat"><b>${recordsPass} of ${files.length}</b><span class="muted">real records pass the checker</span></div>
<div class="stat"><b>20 of 21</b><span class="muted">findings from two independent reviews fixed; 1 logged for Sprint 1</span></div>
<div class="stat"><b>3</b><span class="muted">skill changes for you to save</span></div>
</div>

<h2>The agreed cases</h2>
<table><tr><th>Case</th><th>What it checks</th><th>Result</th></tr>
${cases.map(([c, w, r]) => `<tr><td><b>${esc(c)}</b></td><td>${esc(w)}</td><td>${r}</td></tr>`).join('')}
</table>

<h2>Where your projects stand today</h2>
<p class="muted">Each record was written from the project's own files on 9 November and checked just now. This is a preview of the information, not of the Sprint 1 page.</p>
<div class="cards">${cards}</div>

<h2>The checker refusing real mistakes</h2>
<p class="muted">Run as this page was built. The messages are exactly what a project session will see.</p>
<table><tr><th>Mistake</th><th>Result</th><th>Message</th></tr>${demos}</table>

<h2>The independent review</h2>
<p>An agent that did not build this checked the tests against the agreed cases, attacked the checker with hostile records, and checked every record against its sources. It found 1 high, 8 medium and 4 low problems, including a crash on deeply nested input and two inaccurate records. Twelve were fixed, each with a test written first; the thirteenth (a record ages as soon as its project moves on) is logged for Sprint 1's refresh. A second agent then attacked the fixes themselves and found eight more gaps (C1 to C8), including hidden characters that could carry instructions to an AI; all are fixed and tested.</p>
<table><tr><th>Test</th><th>Result</th></tr>${review.map(([n, ok]) => `<tr><td>${esc(n)}</td><td><span class="tag ${ok ? 'pass' : 'fail'}">${ok ? 'Passed' : 'Failed'}</span></td></tr>`).join('')}</table>

<div class="ask"><h3>What I need from you</h3>
<p>1. <b>Sign off Sprint 0</b>, or raise any point.<br>2. <b>Save the three skill changes</b> from the review cards in the chat, so each project keeps its own record current from its next sprint.</p></div>
</main></body></html>`;
writeFileSync(a.out, html);
console.log(`Wrote ${a.out}: ${passed}/${results.size} tests, ${recordsPass}/${files.length} records.`);
