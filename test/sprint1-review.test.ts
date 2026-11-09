// Sprint 1 independent review findings, S1 to S13 (docs/refinement/sprint-1.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refresh, type ProjectConfig, type Summary } from '../scripts/refresh.ts';
import { toCard, type ProjectRow } from '../src/card.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const base = JSON.parse(readFileSync(new URL('./fixtures/sprint-project.json', import.meta.url), 'utf8'));
base.lastActivity = '2026-11-01'; base.sprint.stageSince = '2026-11-01'; base.waiting[0].askedOn = '2026-11-01';
base.history[0].refined = '2026-10-28'; base.history[0].closed = '2026-10-30';
const rec = (o: Record<string, unknown> = {}, id = 'lantern') => JSON.stringify({ ...structuredClone(base), project: { id, name: 'L', kind: 'sprint' }, ...o });
const tmp = () => mkdtempSync(join(tmpdir(), 'po-s1-'));
function git(dir: string, args: string[], when = '2026-11-08T12:00:00Z') {
  return execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e.com' }, encoding: 'utf8' });
}
function repoAt(dir: string, branches: Record<string, { record?: string; at: string }>) {
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']); writeFileSync(join(dir, 'R'), 'x'); git(dir, ['add', '.']); git(dir, ['commit', '-qm', 's'], '2026-10-01T09:00:00Z');
  for (const [name, b] of Object.entries(branches)) {
    if (name !== 'main') git(dir, ['checkout', '-q', '-b', name, 'main']); else git(dir, ['checkout', '-q', 'main']);
    mkdirSync(join(dir, 'docs'), { recursive: true });
    if (b.record !== undefined) writeFileSync(join(dir, 'docs/status.json'), b.record); else writeFileSync(join(dir, `f-${name}`), name);
    git(dir, ['add', '.']); git(dir, ['commit', '-qm', name], b.at);
  }
  return dir;
}
const repo = (b: Record<string, { record?: string; at: string }>) => repoAt(tmp(), b);
const P = (sources: ProjectConfig['sources'], id = 'lantern'): ProjectConfig => ({ id, name: id, kind: 'sprint', sources });
const run = (projects: ProjectConfig[], o: { folders?: Record<string, string>; firstRecords?: string; previous?: Summary; cacheDir?: string } = {}) =>
  refresh({ projects, folders: o.folders ?? {}, firstRecords: o.firstRecords, previous: o.previous, now: NOW, cacheDir: o.cacheDir ?? tmp() });

test('S1 (high): an odd file in a connected folder affects only that project, never the whole refresh', () => {
  const good = repo({ main: { record: rec({}, 'other'), at: '2026-11-08T17:30:00Z' } });
  // A broken link in docs, and a status.json that is a folder.
  const a = tmp(); mkdirSync(join(a, 'docs'), { recursive: true }); writeFileSync(join(a, 'docs/status.json'), rec());
  symlinkSync('/nonexistent/target', join(a, 'docs/broken-link'));
  const b = tmp(); mkdirSync(join(b, 'docs/status.json'), { recursive: true });
  const s = run([P([{ folder: 'a' }]), P([{ folder: 'b' }], 'bee'), P([{ git: good }], 'other')], { folders: { a, b } });
  assert.equal(s.projects.find((p) => p.id === 'lantern')!.noRecord, false);
  assert.equal(s.projects.find((p) => p.id === 'bee')!.noRecord, true);
  assert.equal(s.projects.find((p) => p.id === 'other')!.refreshedOk, true);
});

test('S1: an unexpected error in one project keeps its last refresh and the others still refresh', () => {
  const good = repo({ main: { record: rec({}, 'other'), at: '2026-11-08T17:30:00Z' } });
  const previous = run([P([{ git: repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' } }) }])]);
  const s = run([P([{ folder: 'x' }]), P([{ git: good }], 'other')], { folders: { x: '\u0000bad' }, previous });
  assert.equal(s.projects.find((p) => p.id === 'lantern')!.refreshedOk, false);
  assert.equal(s.projects.find((p) => p.id === 'other')!.refreshedOk, true);
});

test('S2: two repos whose addresses share a long beginning never share a copy', () => {
  const root = tmp(); const long = 'x'.repeat(70);
  const alpha = repoAt(join(root, long, 'alpha'), { main: { record: rec({}, 'alpha'), at: '2026-11-08T10:00:00Z' } });
  const beta = repoAt(join(root, long, 'beta'), { main: { record: rec({}, 'beta'), at: '2026-11-08T11:00:00Z' } });
  const cacheDir = tmp();
  const s = run([P([{ git: alpha }], 'alpha'), P([{ git: beta }], 'beta')], { cacheDir });
  assert.equal(s.projects[1].noRecord, false);
  assert.equal(s.projects[1].activityAt, '2026-11-08T11:00:00Z');
});

test('S3: a broken record on an old branch is not reported as newer than what is shown', () => {
  const r = repo({ main: { record: rec({ writtenAt: '2026-11-08T17:30:00Z' }), at: '2026-11-08T17:30:00Z' }, old: { record: '{ not json', at: '2026-10-02T09:00:00Z' } });
  const p = run([P([{ git: r }])]).projects[0];
  assert.equal(p.refused, null);
  const r2 = repo({ main: { record: rec({ writtenAt: '2026-11-05T10:00:00Z' }), at: '2026-11-05T10:00:00Z' }, newer: { record: '{ not json', at: '2026-11-08T09:00:00Z' } });
  assert.match(run([P([{ git: r2 }])]).projects[0].refused ?? '', /not valid JSON/);
});

test('S6: a record too large to read is refused with the checker\'s reason, not skipped', () => {
  const r = repo({ main: { record: rec({ notes: 'x'.repeat(1_100_000) }), at: '2026-11-08T17:30:00Z' } });
  const p = run([P([{ git: r }])]).projects[0];
  assert.equal(p.noRecord, true);
  assert.match(p.refused ?? '', /too large/);
});

test('S7 and S8: a card copes with bad values from an old table without blanking the page', () => {
  const row = { id: 'x', name: 'X', kind: 'sprint', sprint: '1', sprintTitle: 't', stage: 'constructor', stageSince: 'not a date', stories: '1' as unknown as number,
    lastActivity: 'yesterday', waiting: 0, writtenAt: 'garbage', source: null, activityAt: null, activityWhere: null, movedOn: false, refreshedOk: true,
    refreshedAt: '2026-11-09T11:00:00Z', lastRefreshedOk: null, refused: null, noRecord: false, notes: null, repo: null, demo: null, live: null, backlog: null } as ProjectRow;
  const c = toCard(row, [{ projectId: 'x', id: 'a', type: 'toString', text: 't', recommendation: null, askedOn: 'never', source: null }], NOW);
  assert.equal(c.stageText, 'constructor');
  assert.equal(c.items[0].typeLabel, 'toString');
  assert.equal(c.storiesText, '1 story');
  assert.match(c.ageText ?? '', /unknown date/);
});

test('S7: rows taken back from the dashboard are checked, and a bad one dropped', () => {
  const r = repo({ main: { at: '2026-11-05T10:00:00Z' } });
  const previous: Summary = { at: '2026-11-09T07:41:00Z', report: [], waiting: [], projects: [{ id: 'lantern', name: 'L', kind: 'sprint', stage: '<b>', waiting: 'lots' } as unknown as ProjectRow] };
  const p = run([P([{ git: r }])], { previous }).projects[0];
  assert.equal(p.noRecord, true);
  assert.equal(p.writtenAt, null);
});

test('S9: no current record, a refusal and an older record: the card says all three', () => {
  const row = { id: 'x', name: 'X', kind: 'sprint', noRecord: true, refused: 'it broke.', writtenAt: '2026-11-08T17:30:00Z', waiting: 0, refreshedOk: true, refreshedAt: '2026-11-09T11:00:00Z' } as ProjectRow;
  assert.equal(toCard(row, [], NOW).flags[0].text, 'No current record. The newest one was refused: it broke. Showing the last valid record, from 8 Nov 2026, 17:30.');
});

test('S10: without your PC, a first record still carries over when a newer record is refused', () => {
  const first = tmp(); writeFileSync(join(first, 'lantern.json'), rec({ writtenAt: '2026-11-06T10:00:00Z' }));
  const r = repo({ main: { at: '2026-11-05T10:00:00Z' } });
  const onPc = run([P([{ git: r }])], { firstRecords: first });
  git(r, ['checkout', '-q', 'main']); writeFileSync(join(r, 'docs/status.json'), '{ not json'); git(r, ['add', '.']); git(r, ['commit', '-qm', 'bad'], '2026-11-09T09:00:00Z');
  const cloud = run([P([{ git: r }])], { previous: onPc }).projects[0];
  assert.equal(cloud.source, 'first record');
  assert.equal(cloud.noRecord, false);
  assert.match(cloud.refused ?? '', /not valid JSON/);
});

test('S11 and S13: only https addresses and local folders are fetched, with no outside git settings', () => {
  for (const url of ['file:///tmp', 'ext::sh -c touch% /tmp/po-ext', 'ssh://x@y/z', 'git://example.com/r', 'http://example.com/r'])
    assert.equal(run([P([{ git: url }])]).projects[0].refreshedOk, false, url);
});

test('S12: a status.json that is a link to elsewhere is not followed', () => {
  const outside = tmp(); writeFileSync(join(outside, 'secret.json'), rec());
  const f = tmp(); mkdirSync(join(f, 'docs'), { recursive: true }); symlinkSync(join(outside, 'secret.json'), join(f, 'docs/status.json'));
  assert.equal(run([P([{ folder: 'f' }])], { folders: { f } }).projects[0].noRecord, true);
});

test('Review: the moved-on boundary is one hour', () => {
  const at = (mins: number) => new Date(Date.parse('2026-11-08T17:30:00Z') + mins * 60_000).toISOString().replace('.000Z', 'Z');
  for (const [mins, moved] of [[59, false], [61, true]] as const) {
    const f = tmp(); mkdirSync(join(f, 'docs'), { recursive: true });
    writeFileSync(join(f, 'docs/status.json'), rec({ writtenAt: '2026-11-08T17:30:00Z' }));
    utimesSync(join(f, 'docs/status.json'), new Date(at(mins)), new Date(at(mins)));
    assert.equal(run([P([{ folder: 'f' }])], { folders: { f } }).projects[0].movedOn, moved, `${mins} minutes`);
  }
});

test('Review: the report says "changed" when a newer record arrives', () => {
  const r = repo({ main: { record: rec({ writtenAt: '2026-11-08T10:00:00Z' }), at: '2026-11-08T10:00:00Z' } });
  const s1 = run([P([{ git: r }])]);
  git(r, ['checkout', '-q', 'main']); writeFileSync(join(r, 'docs/status.json'), rec({ writtenAt: '2026-11-08T17:30:00Z' })); git(r, ['add', '.']); git(r, ['commit', '-qm', 'n'], '2026-11-08T17:30:00Z');
  assert.match(run([P([{ git: r }])], { previous: s1 }).report.join('\n'), /record of 2026-11-08T17:30:00Z \(changed\)/);
});

test('Review: "never been refreshed", and "showing the last valid record" from the refresh', () => {
  const row = { id: 'x', name: 'X', kind: 'kanban', noRecord: false, refused: null, writtenAt: null, waiting: 0, refreshedOk: false, refreshedAt: '2026-11-09T11:55:00Z', lastRefreshedOk: null } as ProjectRow;
  assert.match(toCard(row, [], NOW).flags[0].text, /It has never been refreshed\.$/);
  const r = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' } });
  const s1 = run([P([{ git: r }])]);
  git(r, ['checkout', '-q', 'main']); writeFileSync(join(r, 'docs/status.json'), '{ broken'); git(r, ['add', '.']); git(r, ['commit', '-qm', 'b'], '2026-11-09T09:00:00Z');
  const p = run([P([{ git: r }])], { previous: s1 }).projects[0];
  assert.equal(p.noRecord, true); assert.equal(p.writtenAt, '2026-11-08T17:30:00Z');
  assert.match(toCard(p, [], NOW).flags[0].text, /Showing the last valid record/);
});
