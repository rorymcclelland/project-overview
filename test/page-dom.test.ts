// Sprint 1 review finding S5: the page itself is run in a browser-like DOM with
// a stand-in for the dashboard, so its wiring is checked by behaviour, not by text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildCardScript } from '../scripts/build-page.ts';
import type { ProjectRow, WaitingRow } from '../src/card.ts';

const row = (o: Partial<ProjectRow>): ProjectRow => ({
  id: 'p', name: 'P', kind: 'sprint', sprint: '1', sprintTitle: 'T', stage: 'building', stageSince: '2026-11-08', stories: 1,
  lastActivity: '2026-11-08', waiting: 0, writtenAt: '2026-11-08T10:00:00Z', source: 'branch main', activityAt: null, activityWhere: null,
  movedOn: false, refreshedOk: true, refreshedAt: '2026-11-09T11:00:00Z', lastRefreshedOk: '2026-11-09T11:00:00Z', refused: null,
  noRecord: false, notes: null, repo: null, demo: null, live: null, backlog: null, ...o,
});

function render(projects: ProjectRow[], waiting: WaitingRow[]) {
  const page = readFileSync(new URL('../page/index.html', import.meta.url), 'utf8').replace('<script src="card.js"></script>', '');
  const dom = new JSDOM(`<!DOCTYPE html><div id="dash-root">${page}</div>`, { runScripts: 'outside-only' });
  const w = dom.window as unknown as Record<string, unknown> & { eval: (s: string) => unknown; document: Document };
  const calcs: Record<string, { inputs: string[]; fn: (...a: unknown[]) => unknown }> = {};
  const draws: [string, (el: Element) => void][] = [];
  const data: Record<string, unknown[]> = { projects, waiting };
  w.dash = {
    data: (id: string) => data[id] ? { status: 'ok', data: data[id] } : calcs[id] ? { status: 'ok', data: calcs[id].fn(...calcs[id].inputs.map((i) => data[i])) } : { status: 'missing', data: [] },
    calc: (id: string, c: { inputs: string[]; fn: (...a: unknown[]) => unknown }) => { calcs[id] = c; },
    draw: (name: string, fn?: (el: Element) => void) => {
      if (fn) draws.push([name, fn]);
      else for (const [n, f] of draws) if (n === name) w.document.querySelectorAll(`[data-draw="${n}"]`).forEach((el) => f(el));
    },
  };
  w.eval(buildCardScript());
  for (const s of w.document.querySelectorAll('script')) w.eval(s.textContent ?? '');
  for (const [name, fn] of draws) w.document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => fn(el));
  return w.document;
}

test('S5: cards are drawn in the agreed order, each with only its own waiting items', () => {
  const doc = render(
    [row({ id: 'a', name: 'A', waiting: 1 }), row({ id: 'b', name: 'B', waiting: 2, lastActivity: '2026-11-01' }), row({ id: 'c', name: 'C', waiting: 0 })],
    [
      { projectId: 'a', id: 'A1', type: 'question', text: 'for A', recommendation: null, askedOn: '2026-11-08', source: null },
      { projectId: 'b', id: 'B1', type: 'hand-check', text: 'for B', recommendation: null, askedOn: '2026-11-08', source: null },
      { projectId: 'b', id: 'B2', type: 'hand-check', text: 'for B too', recommendation: null, askedOn: '2026-11-08', source: null },
      { projectId: 'zz', id: 'Z', type: 'question', text: 'orphan', recommendation: null, askedOn: '2026-11-08', source: null },
    ],
  );
  const cards = [...doc.querySelectorAll('.po-card')];
  assert.deepEqual(cards.map((c) => c.querySelector('h2')!.textContent), ['B', 'A', 'C']);
  assert.equal(cards[0].querySelectorAll('.po-items li').length, 2);
  assert.equal(cards[1].querySelectorAll('.po-items li').length, 1);
  assert.doesNotMatch(doc.body.textContent ?? '', /orphan/);
  assert.equal(doc.querySelector('[data-draw="total"]')!.textContent, '3');
});

test('S5: only checked addresses become links; markup in records stays text', () => {
  const doc = render(
    [row({ id: 'a', name: '<img src=x onerror=alert(1)>', repo: 'https://github.com/a/b', demo: 'javascript:alert(1)', live: 'https://x.com/"onmouseover="y' })],
    [{ projectId: 'a', id: 'Q', type: 'question', text: '<b>bold</b>', recommendation: null, askedOn: '2026-11-08', source: null }],
  );
  const links = [...doc.querySelectorAll('.po-links a')];
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['https://github.com/a/b']);
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(doc.querySelectorAll('img, b:not([data-draw])').length, 0);
  assert.match(doc.querySelector('.po-card h2')!.textContent ?? '', /<img/);
});

test('Demo finding: a card with no record has no empty line where its age would be', () => {
  const doc = render([row({ id: 'n', name: 'N', noRecord: true, writtenAt: null, lastActivity: null, sprint: null, stage: null, stories: null })], []);
  const empty = [...doc.querySelectorAll('.po-card p')].filter((p) => !(p.textContent ?? '').trim());
  assert.equal(empty.length, 0);
});

// Dates relative to today, so the test means the same whatever day it runs.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const inboxProjects = [row({ id: 'a', name: 'Alpha', waiting: 2 }), row({ id: 'b', name: 'Beta', waiting: 1 })];
const inboxWaiting: WaitingRow[] = [
  { projectId: 'a', id: 'A1', type: 'question', text: 'old one', recommendation: 'Do it.', askedOn: daysAgo(30), source: null },
  { projectId: 'a', id: 'A2', type: 'hand-check', text: '<b>new</b> one', recommendation: null, askedOn: daysAgo(0), source: null },
  { projectId: 'b', id: 'B1', type: 'question', text: 'middle', recommendation: null, askedOn: daysAgo(4), source: null },
];

test('O2-2 cases 1, 2, 4 and 8: the inbox sits above the cards, oldest first, old items marked, totals match the cards', () => {
  const doc = render(inboxProjects, inboxWaiting);
  const inbox = doc.querySelector('#inbox')!;
  const cards = doc.querySelector('#projects')!;
  assert.ok(inbox.compareDocumentPosition(cards) & 4, 'inbox comes before the cards');
  const items = [...inbox.querySelectorAll('.po-inbox-item')];
  assert.deepEqual(items.map((i) => i.querySelector('.po-inbox-text')!.textContent), ['old one', 'middle', '<b>new</b> one']);
  assert.equal(items.filter((i) => i.classList.contains('po-overdue')).length, 1, 'only the 30-day-old item');
  const cardSum = [...doc.querySelectorAll('.po-card .po-count')].reduce((n, e) => n + Number(e.textContent), 0);
  assert.equal(items.length, cardSum);
  assert.equal(doc.querySelectorAll('#inbox b, #inbox img').length, 0, 'markup is text');
});

test('O2-2 case 5: pressing a type shows only that type and says how many are hidden; All shows everything', () => {
  const doc = render(inboxProjects, inboxWaiting);
  const button = (label: RegExp) => [...doc.querySelectorAll('#inbox .po-filter button')].find((b) => label.test(b.textContent ?? '')) as HTMLButtonElement;
  button(/^Question/).click();
  assert.deepEqual([...doc.querySelectorAll('.po-inbox-item .po-inbox-text')].map((e) => e.textContent), ['old one', 'middle']);
  assert.match(doc.querySelector('#inbox .po-inbox-note')!.textContent ?? '', /1 hidden/);
  assert.equal(button(/^Question/).getAttribute('aria-pressed'), 'true');
  button(/^All/).click();
  assert.equal(doc.querySelectorAll('.po-inbox-item').length, 3);
});

test('O2-2 case 6: each item links to its project\'s card on the same page', () => {
  const doc = render(inboxProjects, inboxWaiting);
  const links = [...doc.querySelectorAll('.po-inbox-item a.po-inbox-project')];
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['#project-a', '#project-b', '#project-a']);
  for (const a of links) assert.ok(doc.getElementById(a.getAttribute('href')!.slice(1)), 'the card exists');
});
