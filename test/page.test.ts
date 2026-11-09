// Sprint 1, O1-2: the page runs the tested card logic, and writes text only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildCardScript } from '../scripts/build-page.ts';
import { toCard, orderCards, type ProjectRow, type WaitingRow } from '../src/card.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const row: ProjectRow = {
  id: 'x', name: 'X <b>', kind: 'sprint', sprint: '2', sprintTitle: 'T', stage: 'building', stageSince: '2026-11-08', stories: 1,
  lastActivity: '2026-11-08', waiting: 1, writtenAt: '2026-11-08T10:00:00Z', source: 'branch main', activityAt: '2026-11-09T11:00:00Z',
  activityWhere: 'branch main', movedOn: true, refreshedOk: false, refreshedAt: '2026-11-09T11:55:00Z', lastRefreshedOk: null,
  refused: 'x', noRecord: false, notes: 'n', repo: 'https://github.com/a/b', demo: 'javascript:1', live: null, backlog: null,
};
const waiting: WaitingRow[] = [{ projectId: 'x', id: 'Q', type: 'question', text: '<img src=x onerror=1>', recommendation: 'r', askedOn: '2026-11-08', source: 's' }];

test('O1-2: the bundled card script gives exactly what the tested source gives', () => {
  const sandbox: { window: { OverviewCard?: { toCard: typeof toCard; orderCards: typeof orderCards } }; Intl: typeof Intl; Date: typeof Date } = { window: {}, Intl, Date };
  vm.runInNewContext(buildCardScript(), sandbox);
  const bundled = sandbox.window.OverviewCard!;
  assert.deepEqual(JSON.parse(JSON.stringify(bundled.toCard(row, waiting, NOW))), JSON.parse(JSON.stringify(toCard(row, waiting, NOW))));
  const cards = [toCard(row, waiting, NOW), toCard({ ...row, id: 'y', waiting: 3 }, [], NOW)];
  assert.deepEqual(JSON.parse(JSON.stringify(bundled.orderCards(cards).map((c) => c.id))), orderCards(cards).map((c) => c.id));
});

test('O1-2 case 4: the page writes record text only as text, never as HTML', () => {
  const html = readFileSync(new URL('../page/index.html', import.meta.url), 'utf8');
  const script = html.slice(html.lastIndexOf('<script>'));
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.html\(/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no inline event handlers');
});

test('O1-2 case 5: the page makes a link only from a checked href, opening in a new tab without access back', () => {
  const html = readFileSync(new URL('../page/index.html', import.meta.url), 'utf8');
  assert.match(html, /if \(l\.href\)/);
  assert.match(html, /rel = 'noopener noreferrer'/);
});
