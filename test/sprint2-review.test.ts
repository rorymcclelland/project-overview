// Sprint 2 independent review findings, T1 to T11 (docs/refinement/sprint-2.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildCardScript, buildStamp } from '../scripts/build-page.ts';
import { toInbox, filterInbox } from '../src/inbox.ts';
import type { ProjectRow, WaitingRow } from '../src/card.ts';

const NOW = new Date('2026-11-09T17:00:00Z');
const p = (id: string, waiting: number, lastActivity = '2026-11-08'): ProjectRow => ({
  id, name: id.toUpperCase(), kind: 'sprint', sprint: '1', sprintTitle: 'T', stage: 'building', stageSince: '2026-11-01', stories: 1,
  lastActivity, waiting, writtenAt: '2026-11-08T10:00:00Z', source: 'branch main', activityAt: null, activityWhere: null, movedOn: false,
  refreshedOk: true, refreshedAt: '2026-11-09T11:00:00Z', lastRefreshedOk: '2026-11-09T11:00:00Z', refused: null, noRecord: false,
  notes: null, repo: null, demo: null, live: null, backlog: null,
});
const w = (projectId: string, id: string, askedOn: string, type = 'question'): WaitingRow =>
  ({ projectId, id, type, text: `t ${id}`, recommendation: null, askedOn, source: null });

test('T2: the page runs exactly the tested inbox logic, including the 7-day boundary and every tie-break', () => {
  const sandbox: { window: Record<string, never> & { OverviewInbox?: { toInbox: typeof toInbox; filterInbox: typeof filterInbox } }; Intl: typeof Intl; Date: typeof Date; Map: typeof Map; Set: typeof Set } =
    { window: {} as never, Intl, Date, Map, Set };
  vm.runInNewContext(buildCardScript(), sandbox);
  const bundled = sandbox.window.OverviewInbox!;
  const projects = [p('a', 3), p('b', 3, '2026-11-01')];
  const waiting = [w('a', 'Z', '2026-11-02'), w('a', 'A', '2026-11-02'), w('b', 'M', '2026-11-01'), w('b', 'B', '2026-11-02', 'hand-check'),
    w('a', 'X', '2026-11-09', 'mystery'), w('ghost', 'G', '2026-11-03')];
  const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(bundled.toInbox(projects, waiting, NOW)), plain(toInbox(projects, waiting, NOW)));
  for (const t of [null, 'question', 'other', 'hand-check'])
    assert.deepEqual(plain(bundled.filterInbox(bundled.toInbox(projects, waiting, NOW), t)), plain(filterInbox(toInbox(projects, waiting, NOW), t)));
});

test('T2: the id is the last tie-break (same day, same project)', () => {
  const ids = toInbox([p('a', 2)], [w('a', 'Z', '2026-11-02'), w('a', 'A', '2026-11-02')], NOW).items.map((i) => i.id);
  assert.deepEqual(ids, ['A', 'Z']);
});

test('T1: when the cards and the waiting table disagree, the inbox says so', () => {
  const box = toInbox([p('a', 3)], [w('a', 'A', '2026-11-08')], NOW);
  assert.equal(box.cardTotal, 3);
  assert.equal(box.items.length, 1);
  assert.equal(box.mismatch, true);
  assert.equal(toInbox([p('a', 1)], [w('a', 'A', '2026-11-08')], NOW).mismatch, false);
});

test('T7: a date in the future is said plainly and never marked as waiting too long', () => {
  const it = toInbox([p('a', 1)], [w('a', 'F', '2026-11-20')], NOW).items[0];
  assert.equal(it.waitedText, 'a future date');
  assert.equal(it.overdue, false);
});

test('T9: an item with an unreadable date goes to the end, after every dated item', () => {
  const ids = toInbox([p('a', 3)], [w('a', 'Bad', 'garbage'), w('a', 'Empty', ''), w('a', 'Old', '2026-10-01')], NOW).items.map((i) => i.id);
  assert.deepEqual(ids, ['Old', 'Bad', 'Empty']);
});

test('T8: a filter whose kind has gone shows everything again', () => {
  const box = toInbox([p('a', 1)], [w('a', 'A', '2026-11-08')], NOW);
  const r = filterInbox(box, 'hand-check');
  assert.equal(r.type, null);
  assert.equal(r.shown.length, 1);
  assert.equal(r.hidden, 0);
});

test('F-6: the build carries a stamp of exactly what it contains', () => {
  const s = buildStamp();
  assert.match(s, /^[0-9a-f]{12}$/);
  assert.equal(s, buildStamp(), 'stable for the same sources');
});
