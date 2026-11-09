// Sprint 2, O2-2: the inbox (docs/refinement/sprint-2.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toInbox, filterInbox, OVERDUE_DAYS } from '../src/inbox.ts';
import type { ProjectRow, WaitingRow } from '../src/card.ts';

const NOW = new Date('2026-11-09T17:00:00Z');
const p = (id: string, name: string, waiting: number, lastActivity = '2026-11-08'): ProjectRow => ({
  id, name, kind: 'sprint', sprint: '1', sprintTitle: 'T', stage: 'building', stageSince: '2026-11-01', stories: 1, lastActivity, waiting,
  writtenAt: '2026-11-08T10:00:00Z', source: 'branch main', activityAt: null, activityWhere: null, movedOn: false, refreshedOk: true,
  refreshedAt: '2026-11-09T11:00:00Z', lastRefreshedOk: '2026-11-09T11:00:00Z', refused: null, noRecord: false, notes: null,
  repo: null, demo: null, live: null, backlog: null,
});
const w = (projectId: string, id: string, askedOn: string, type = 'question', text = `do ${id}`): WaitingRow =>
  ({ projectId, id, type, text, recommendation: id === 'A1' ? 'Yes.' : null, askedOn, source: 'docs/x.md' });
const projects = [p('a', 'Alpha', 2), p('b', 'Beta', 3, '2026-11-01')];
const waiting = [
  w('a', 'A1', '2026-11-09'), w('a', 'A2', '2026-10-17', 'hand-check'),
  w('b', 'B1', '2026-11-08', 'demo-signoff'), w('b', 'B2', '2026-11-01'), w('b', 'B3', '2026-11-09', 'question'),
];

test('O2-2 case 1: every item appears once with its project; one for an unknown project is left out and counted', () => {
  const box = toInbox(projects, [...waiting, w('ghost', 'G1', '2026-11-01')], NOW);
  assert.equal(box.items.length, 5);
  assert.deepEqual(new Set(box.items.map((i) => `${i.projectId}/${i.id}`)).size, 5);
  assert.equal(box.items.find((i) => i.id === 'A1')!.projectName, 'Alpha');
  assert.equal(box.notShown, 1);
});

test('O2-2 case 2: oldest first; on the same day, by the order of the cards, then by id', () => {
  const ids = toInbox(projects, waiting, NOW).items.map((i) => i.id);
  // Cards order: Beta (3 waiting) before Alpha (2), so on 9 Nov B3 comes before A1.
  assert.deepEqual(ids, ['A2', 'B2', 'B1', 'B3', 'A1']);
});

test('O2-2 case 3: how long each has waited, in UK days', () => {
  const box = toInbox(projects, waiting, NOW);
  const by = (id: string) => box.items.find((i) => i.id === id)!;
  assert.equal(by('A1').waitedText, 'today');
  assert.equal(by('B1').waitedText, '1 day');
  assert.equal(by('A2').waitedText, '23 days');
  // 00:30 on 10 Nov in UK time is still 9 Nov in UTC terms only in summer; in November UK is UTC.
  const late = toInbox(projects, [w('a', 'L', '2026-07-01')], new Date('2026-07-01T23:30:00Z')).items[0];
  assert.equal(late.waitedText, '1 day', '00:30 BST on 2 July is the next UK day');
});

test('O2-2 case 4: items waiting more than 7 days are marked, and none other', () => {
  assert.equal(OVERDUE_DAYS, 7);
  const box = toInbox(projects, [...waiting, w('a', 'E7', '2026-11-02'), w('a', 'E8', '2026-11-01')], NOW);
  const marked = box.items.filter((i) => i.overdue).map((i) => i.id).sort();
  assert.deepEqual(marked, ['A2', 'B2', 'E8']); // 23, 8 and 8 days; 7 days is not over 7
  assert.equal(box.overdue, 3);
});

test('O2-2 case 5: the type filter shows only that type and says how many are hidden', () => {
  const box = toInbox(projects, waiting, NOW);
  assert.deepEqual(box.types.map((t) => [t.type, t.count]), [['question', 3], ['demo-signoff', 1], ['hand-check', 1]]);
  const q = filterInbox(box, 'question');
  assert.deepEqual(q.shown.map((i) => i.id), ['B2', 'B3', 'A1']);
  assert.equal(q.hidden, 2);
  const all = filterInbox(box, null);
  assert.equal(all.shown.length, 5); assert.equal(all.hidden, 0);
  const unknown = filterInbox(box, 'toString');
  assert.equal(unknown.shown.length, 5, 'a kind no item has falls back to all');
  assert.equal(unknown.type, null);
});

test('O2-2 case 7: markup in an item stays as the same characters', () => {
  const box = toInbox(projects, [w('a', 'X', '2026-11-09', 'question', '<img src=x onerror=alert(1)>')], NOW);
  assert.equal(box.items[0].text, '<img src=x onerror=alert(1)>');
});

test('O2-2: a bad date from an old table never breaks the list', () => {
  const box = toInbox(projects, [w('a', 'X', 'never')], NOW);
  assert.equal(box.items[0].waitedText, 'an unknown time');
  assert.equal(box.items[0].overdue, false);
});
