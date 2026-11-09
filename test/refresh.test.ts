// Sprint 1, O1-1 and O1-3: the refresh (docs/refinement/sprint-1.md).
// Projects are stood in for by local git repos and folders made here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refresh, type ProjectConfig, type Summary } from '../scripts/refresh.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const base = JSON.parse(readFileSync(new URL('./fixtures/sprint-project.json', import.meta.url), 'utf8'));
// The fixture's own dates are moved to 1 November, so a record dated any time after is consistent.
const early = (() => {
  const b = structuredClone(base);
  b.lastActivity = '2026-11-01'; b.sprint.stageSince = '2026-11-01'; b.waiting[0].askedOn = '2026-11-01';
  b.history[0].refined = '2026-10-28'; b.history[0].closed = '2026-10-30';
  return b;
})();
const rec = (o: Record<string, unknown> = {}, id = 'lantern') => JSON.stringify({ ...structuredClone(early), project: { id, name: 'Lantern', kind: 'sprint' }, ...o }, null, 2);
const tmp = () => mkdtempSync(join(tmpdir(), 'po-refresh-'));

function git(dir: string, args: string[], when = '2026-11-08T12:00:00Z') {
  return execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' }, encoding: 'utf8' });
}
/** A repo whose branches each hold the given record text (or none), committed at the given time. */
function repo(branches: Record<string, { record?: string; at: string; extra?: { at: string } }>): string {
  const dir = tmp();
  git(dir, ['init', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'README.md'), 'x');
  git(dir, ['add', '.']); git(dir, ['commit', '-qm', 'start'], '2026-11-01T09:00:00Z');
  for (const [name, b] of Object.entries(branches)) {
    if (name !== 'main') git(dir, ['checkout', '-q', '-b', name, 'main']); else git(dir, ['checkout', '-q', 'main']);
    if (b.record !== undefined) { mkdirSync(join(dir, 'docs'), { recursive: true }); writeFileSync(join(dir, 'docs/status.json'), b.record); }
    else writeFileSync(join(dir, `${name.replace(/\W/g, '_')}.txt`), name);
    git(dir, ['add', '.']); git(dir, ['commit', '-qm', `on ${name}`], b.at);
    if (b.extra) { writeFileSync(join(dir, 'later.txt'), 'later'); git(dir, ['add', '.']); git(dir, ['commit', '-qm', 'later'], b.extra.at); }
  }
  return dir;
}
const project = (sources: ProjectConfig['sources'], id = 'lantern', kind: 'sprint' | 'kanban' = 'sprint'): ProjectConfig => ({ id, name: 'Lantern', kind, sources });
const run = (projects: ProjectConfig[], o: { folders?: Record<string, string>; firstRecords?: string; previous?: Summary } = {}) =>
  refresh({ projects, folders: o.folders ?? {}, firstRecords: o.firstRecords, previous: o.previous, now: NOW, cacheDir: tmp() });

test('O1-1 case 1: a record on a sprint branch newer than main\'s is chosen', () => {
  const r = repo({
    main: { record: rec({ writtenAt: '2026-11-05T10:00:00Z' }), at: '2026-11-05T10:00:00Z' },
    'sprint-4': { record: rec({ writtenAt: '2026-11-08T17:30:00Z' }), at: '2026-11-08T17:30:00Z' },
  });
  const s = run([project([{ git: r }])]);
  assert.equal(s.projects[0].writtenAt, '2026-11-08T17:30:00Z');
  assert.equal(s.projects[0].source, 'branch sprint-4');
  assert.equal(s.projects[0].waiting, 1);
  assert.equal(s.waiting[0].projectId, 'lantern');
});

test('O1-1 case 2: a refused record is skipped for an older valid one, and the refusal reported', () => {
  const r = repo({
    main: { record: rec({ writtenAt: '2026-11-05T10:00:00Z' }), at: '2026-11-05T10:00:00Z' },
    'sprint-4': { record: rec({ writtenAt: '2026-11-08T17:30:00Z', lastActivity: 'yesterday' }), at: '2026-11-08T17:30:00Z' },
  });
  const s = run([project([{ git: r }])]);
  assert.equal(s.projects[0].writtenAt, '2026-11-05T10:00:00Z');
  assert.match(s.projects[0].refused ?? '', /lastActivity/);
  assert.equal(s.projects[0].noRecord, false);
  assert.match(s.report.join('\n'), /refused.*lastActivity/i);
});

test('O1-1 case 3: with no valid record anywhere, the project is "no record"', () => {
  const r = repo({ main: { at: '2026-11-05T10:00:00Z' } });
  const s = run([project([{ git: r }])]);
  assert.equal(s.projects[0].noRecord, true);
  assert.equal(s.projects[0].writtenAt, null);
  assert.equal(s.projects[0].name, 'Lantern');
  assert.equal(s.waiting.length, 0);
});

test('O1-1 case 4: a first record is used until the project writes its own, then the newer wins', () => {
  const first = tmp(); writeFileSync(join(first, 'lantern.json'), rec({ writtenAt: '2026-11-06T10:00:00Z' }));
  const r1 = repo({ main: { at: '2026-11-05T10:00:00Z' } });
  assert.equal(run([project([{ git: r1 }])], { firstRecords: first }).projects[0].source, 'first record');
  const r2 = repo({ main: { record: rec({ writtenAt: '2026-11-08T10:00:00Z' }), at: '2026-11-08T10:00:00Z' } });
  assert.equal(run([project([{ git: r2 }])], { firstRecords: first }).projects[0].source, 'branch main');
});

test('O1-1 case 5: on a tie the project\'s own record wins over the first record', () => {
  const first = tmp(); writeFileSync(join(first, 'lantern.json'), rec({ writtenAt: '2026-11-08T10:00:00Z' }));
  const r = repo({ main: { record: rec({ writtenAt: '2026-11-08T10:00:00Z' }), at: '2026-11-08T10:00:00Z' } });
  assert.equal(run([project([{ git: r }])], { firstRecords: first }).projects[0].source, 'branch main');
});

test('O1-1 case 6: a record for another project is refused', () => {
  const r = repo({ main: { record: rec({}, 'someone-else'), at: '2026-11-08T17:30:00Z' } });
  const s = run([project([{ git: r }])]);
  assert.equal(s.projects[0].noRecord, true);
  assert.match(s.projects[0].refused ?? '', /someone-else.*lantern|another project/);
});

test('O1-1 case 7: an unreachable repo keeps the last refresh, marked not refreshed; others still refresh', () => {
  const good = repo({ main: { record: rec({}, 'other'), at: '2026-11-08T17:30:00Z' } });
  const previous = run([project([{ git: repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' } }) }])]);
  const s = run([project([{ git: '/nonexistent/repo' }]), project([{ git: good }], 'other')], { previous });
  const lantern = s.projects.find((p) => p.id === 'lantern')!;
  assert.equal(lantern.refreshedOk, false);
  assert.equal(lantern.writtenAt, '2026-11-08T17:30:00Z');
  assert.equal(lantern.lastRefreshedOk, previous.at);
  assert.equal(lantern.noRecord, false, 'kept as it was, not "no current record"');
  assert.equal(lantern.source, 'branch main');
  assert.equal(s.waiting.filter((x) => x.projectId === 'lantern').length, 1);
  assert.equal(s.projects.find((p) => p.id === 'other')!.refreshedOk, true);
});

test('O1-1 case 8 (hostile): branch names and paths are never run as commands', () => {
  const r = repo({ main: { at: '2026-11-05T10:00:00Z' }, 'x;touch${IFS}PWNED': { record: rec(), at: '2026-11-08T17:30:00Z' } });
  const s = run([project([{ git: r }])]);
  assert.equal(existsSync(join(process.cwd(), 'PWNED')), false);
  assert.equal(existsSync(join(r, 'PWNED')), false);
  assert.ok(s.projects.length === 1);
  const evilPath = run([project([{ git: '--upload-pack=touch /tmp/po-pwned' }])]);
  assert.equal(existsSync('/tmp/po-pwned'), false);
  assert.equal(evilPath.projects[0].refreshedOk, false);
});

test('O1-1 case 9: the report says, for each project, the source used, its time and what changed', () => {
  const r = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' } });
  const s1 = run([project([{ git: r }])]);
  assert.match(s1.report.join('\n'), /Lantern: branch main, record of 2026-11-08T17:30:00Z \(new\)/);
  const s2 = run([project([{ git: r }])], { previous: s1 });
  assert.match(s2.report.join('\n'), /Lantern: branch main, record of 2026-11-08T17:30:00Z \(unchanged\)/);
});

test('O1-3 cases 2 and 3: commits after the record mean "moved on", but not within the hour', () => {
  const later = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z', extra: { at: '2026-11-09T10:01:00Z' } } });
  const s = run([project([{ git: later }])]);
  assert.equal(s.projects[0].movedOn, true);
  assert.equal(s.projects[0].activityWhere, 'branch main');
  assert.equal(s.projects[0].activityAt, '2026-11-09T10:01:00Z');
  const soon = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z', extra: { at: '2026-11-08T18:15:00Z' } } });
  assert.equal(run([project([{ git: soon }])]).projects[0].movedOn, false);
  const other = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' }, 'sprint-5': { at: '2026-11-09T11:00:00Z' } });
  const o = run([project([{ git: other }])]).projects[0];
  assert.equal(o.movedOn, true); assert.equal(o.activityWhere, 'branch sprint-5');
});

test('O1-3 case 4: a folder project counts a changed file in its docs folder as activity', () => {
  const f = tmp(); mkdirSync(join(f, 'docs/refinement'), { recursive: true });
  writeFileSync(join(f, 'docs/status.json'), rec());
  utimesSync(join(f, 'docs/status.json'), new Date('2026-11-08T17:30:00Z'), new Date('2026-11-08T17:30:00Z'));
  writeFileSync(join(f, 'docs/refinement/sprint-5.md'), 'new');
  utimesSync(join(f, 'docs/refinement/sprint-5.md'), new Date('2026-11-09T09:00:00Z'), new Date('2026-11-09T09:00:00Z'));
  const s = run([project([{ folder: 'lantern' }])], { folders: { lantern: f } });
  assert.equal(s.projects[0].source, 'folder');
  assert.equal(s.projects[0].movedOn, true);
  assert.equal(s.projects[0].activityWhere, 'docs/refinement/sprint-5.md');
});

test('O1-3: a folder that is not connected leaves the project not refreshed', () => {
  const s = run([project([{ folder: 'lantern' }])]);
  assert.equal(s.projects[0].refreshedOk, false);
});

test('O1-1: the rows carry links, notes and a kanban project\'s empty sprint fields', () => {
  const k = JSON.parse(readFileSync(new URL('./fixtures/kanban-project.json', import.meta.url), 'utf8'));
  const r = repo({ main: { record: JSON.stringify(k), at: '2026-11-08T12:00:00Z' } });
  const s = run([{ id: 'brochure', name: 'Brochure', kind: 'kanban', sources: [{ git: r }] }]);
  const p = s.projects[0];
  assert.equal(p.kind, 'kanban'); assert.equal(p.sprint, null); assert.equal(p.stage, null); assert.equal(p.stories, null);
  assert.equal(p.live, 'https://example.com'); assert.equal(p.waiting, 1);
  assert.equal(s.waiting[0].type, 'deploy-approval');
});

test('O1-3: commits on CI results branches (e2e-results/...) are not the project moving on', () => {
  const r = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' }, 'e2e-results/ci/main': { at: '2026-11-09T11:00:00Z' } });
  const p = run([project([{ git: r }])]).projects[0];
  assert.equal(p.movedOn, false);
  assert.equal(p.activityWhere, 'branch main');
});

test('O1-1: a branch deleted since the last refresh no longer counts', () => {
  const r = repo({ main: { record: rec(), at: '2026-11-08T17:30:00Z' }, 'sprint-5': { at: '2026-11-09T11:00:00Z' } });
  const cacheDir = tmp();
  const go = () => refresh({ projects: [project([{ git: r }])], folders: {}, now: NOW, cacheDir }).projects[0];
  assert.equal(go().activityWhere, 'branch sprint-5');
  git(r, ['checkout', '-q', 'main']); git(r, ['branch', '-q', '-D', 'sprint-5']);
  assert.equal(go().activityWhere, 'branch main');
});

test('O1-4 case 3: without your PC, a first record carries over from the last refresh, and the folder project is marked not refreshed', () => {
  const first = tmp(); writeFileSync(join(first, 'lantern.json'), rec({ writtenAt: '2026-11-06T10:00:00Z' }));
  const folder = tmp(); mkdirSync(join(folder, 'docs'), { recursive: true });
  const r = repo({ main: { at: '2026-11-05T10:00:00Z' } });
  const projects = [project([{ git: r }]), project([{ folder: 'scout' }], 'scout')];
  writeFileSync(join(first, 'scout.json'), rec({ writtenAt: '2026-11-06T10:00:00Z' }, 'scout'));
  const onPc = run(projects, { firstRecords: first, folders: { scout: folder } });
  const cloud = run(projects, { previous: onPc });
  const l = cloud.projects.find((p) => p.id === 'lantern')!;
  assert.equal(l.source, 'first record');
  assert.equal(l.noRecord, false);
  assert.equal(l.refreshedOk, true);
  assert.equal(cloud.waiting.filter((w) => w.projectId === 'lantern').length, 1);
  const s = cloud.projects.find((p) => p.id === 'scout')!;
  assert.equal(s.refreshedOk, false);
  assert.equal(s.writtenAt, '2026-11-06T10:00:00Z');
});
