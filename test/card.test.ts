// Sprint 1, O1-2 and O1-3: what a card says (docs/refinement/sprint-1.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCard, orderCards, type ProjectRow, type WaitingRow } from '../src/card.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const row = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'lantern', name: 'Lantern', kind: 'sprint', sprint: '4', sprintTitle: 'Search', stage: 'awaiting-signoff',
  stageSince: '2026-11-08', stories: 2, lastActivity: '2026-11-08', waiting: 3, writtenAt: '2026-11-08T17:30:00Z',
  source: 'branch sprint-4', activityAt: '2026-11-08T17:31:00Z', activityWhere: 'branch sprint-4', movedOn: false,
  refreshedOk: true, refreshedAt: '2026-11-09T11:55:00Z', lastRefreshedOk: '2026-11-09T11:55:00Z', refused: null,
  noRecord: false, notes: null, repo: 'https://github.com/example/lantern', demo: null, live: null, backlog: null, ...o,
});
const w = (type: string, id = type): WaitingRow => ({ projectId: 'lantern', id, type, text: `Do ${id}`, recommendation: null, askedOn: '2026-11-08', source: null });
const items = [w('demo-signoff', 'D4'), w('hand-check', 'H1'), w('hand-check', 'H2')];

test('O1-2 case 1: a sprint record becomes a card with each field, stage in plain words', () => {
  const c = toCard(row(), items, NOW);
  assert.equal(c.name, 'Lantern');
  assert.equal(c.sprintLine, 'Sprint 4: Search');
  assert.equal(c.stageText, 'Waiting for your sign-off');
  assert.equal(c.stageSince, 'since 8 Nov 2026');
  assert.equal(c.storiesText, '2 stories');
  assert.equal(c.lastActivityText, 'Last activity 8 Nov 2026');
  assert.deepEqual(c.links, [{ label: 'Repo', href: 'https://github.com/example/lantern', text: 'Repo' }]);
  assert.equal(c.items.length, 3);
  for (const [stage, words] of [['refining', 'Refining'], ['awaiting-answers', 'Waiting for your answers'], ['ready', 'Ready, waiting for your go'], ['building', 'Building'], ['closed', 'Closed']])
    assert.equal(toCard(row({ stage }), [], NOW).stageText, words);
});

test('O1-2 case 2: a kanban card has no sprint, stage or stories', () => {
  const c = toCard(row({ kind: 'kanban', sprint: null, sprintTitle: null, stage: null, stageSince: null, stories: null }), [], NOW);
  assert.equal(c.sprintLine, null); assert.equal(c.stageText, null); assert.equal(c.storiesText, null); assert.equal(c.stageSince, null);
});

test('O1-2 case 3: waiting items are counted by type in words, singular and plural right', () => {
  assert.equal(toCard(row(), items, NOW).waitingSummary, '1 demo sign-off, 2 hand checks');
  assert.equal(toCard(row({ waiting: 0 }), [], NOW).waitingSummary, 'Nothing waiting on you');
  assert.equal(toCard(row({ waiting: 5 }), [w('question'), w('question', 'q2'), w('deploy-approval'), w('account-step'), w('account-step', 'a2')], NOW).waitingSummary,
    '2 questions, 1 live deploy to approve, 2 account steps');
  assert.equal(toCard(row({ stories: 1 }), [], NOW).storiesText, '1 story');
});

test('O1-2 case 4: text with markup comes through as the same characters (the page sets it as text)', () => {
  const evil = w('question'); evil.text = '<b>bold</b> <img src=x onerror=alert(1)>';
  assert.equal(toCard(row(), [evil], NOW).items[0].text, '<b>bold</b> <img src=x onerror=alert(1)>');
});

test('O1-2 case 5: only safe https links become links; anything else is text', () => {
  const c = toCard(row({ repo: 'javascript:alert(1)', demo: 'https://example.com/demo', live: 'https://x.com/"onmouseover="a', backlog: null }), [], NOW);
  assert.deepEqual(c.links, [
    { label: 'Repo', href: null, text: 'javascript:alert(1)' },
    { label: 'Demo', href: 'https://example.com/demo', text: 'Demo' },
    { label: 'Live', href: null, text: 'https://x.com/"onmouseover="a' },
  ]);
});

test('O1-2 case 8: cards are ordered by most waiting, then most recent activity, then name', () => {
  const cards = [
    toCard(row({ id: 'a', name: 'A', waiting: 1, lastActivity: '2026-11-01' }), [], NOW),
    toCard(row({ id: 'b', name: 'B', waiting: 3, lastActivity: '2026-10-01' }), [], NOW),
    toCard(row({ id: 'c', name: 'C', waiting: 1, lastActivity: '2026-11-05' }), [], NOW),
    toCard(row({ id: 'd', name: 'D', waiting: 1, lastActivity: '2026-11-05' }), [], NOW),
  ];
  assert.deepEqual(orderCards(cards).map((c) => c.id), ['b', 'c', 'd', 'a']);
});

test('O1-3 case 1: the record age is always given', () => {
  assert.equal(toCard(row(), [], NOW).ageText, 'Record from 8 Nov 2026, 17:30, 1 day ago');
  assert.equal(toCard(row({ writtenAt: '2026-11-09T09:00:00Z' }), [], NOW).ageText, 'Record from 9 Nov 2026, 09:00, today');
  assert.equal(toCard(row({ writtenAt: '2026-11-01T09:00:00Z' }), [], NOW).ageText, 'Record from 1 Nov 2026, 09:00, 8 days ago');
  // Times are UK time: 1 July 00:30 BST is 30 June 23:30 UTC.
  assert.equal(toCard(row({ writtenAt: '2026-06-30T23:30:00Z' }), [], new Date('2026-07-01T12:00:00Z')).ageText, 'Record from 1 Jul 2026, 00:30, today');
});

test('O1-3 case 1: each warning appears in exactly its case, never otherwise', () => {
  assert.deepEqual(toCard(row(), [], NOW).flags, []);
  const moved = toCard(row({ movedOn: true, activityAt: '2026-11-09T10:01:00Z', activityWhere: 'branch sprint-26' }), [], NOW).flags;
  assert.deepEqual(moved.map((f) => f.kind), ['moved-on']);
  assert.equal(moved[0].text, 'This project has moved on since this record: branch sprint-26 changed at 10:01 on 9 Nov 2026.');
  const none = toCard(row({ noRecord: true, refused: 'sprint.stage is "nearly done", which is not allowed.', writtenAt: null, sprint: null, stage: null }), [], NOW).flags;
  assert.deepEqual(none.map((f) => f.kind), ['no-record']);
  assert.equal(none[0].text, 'No current record. The newest one was refused: sprint.stage is "nearly done", which is not allowed.');
  const oldShown = toCard(row({ noRecord: true, refused: null }), [], NOW).flags;
  assert.equal(oldShown[0].text, 'No current record. Showing the last valid record, from 8 Nov 2026, 17:30.');
  const stale = toCard(row({ refreshedOk: false, refreshedAt: '2026-11-09T11:55:00Z', lastRefreshedOk: '2026-11-08T07:40:00Z' }), [], NOW).flags;
  assert.deepEqual(stale.map((f) => f.kind), ['not-refreshed']);
  assert.equal(stale[0].text, 'Not refreshed at 11:55 on 9 Nov 2026: its source could not be reached. Last refreshed at 07:40 on 8 Nov 2026.');
  const newerRefused = toCard(row({ refused: 'waiting[0].text is empty.' }), [], NOW).flags;
  assert.deepEqual(newerRefused.map((f) => f.kind), ['newer-refused']);
  assert.equal(newerRefused[0].text, 'A newer record was refused, so this one is shown: waiting[0].text is empty.');
});

test('O1-3 case 1: a card with no record at all says so and shows no age', () => {
  const c = toCard(row({ noRecord: true, writtenAt: null, refused: null, sprint: null, stage: null, sprintTitle: null, stories: null, waiting: 0, lastActivity: null }), [], NOW);
  assert.equal(c.ageText, null);
  assert.equal(c.flags[0].text, 'No current record.');
  assert.equal(c.lastActivityText, null);
});
