// The refresh (Sprint 1, O1-1 and O1-3): finds each project's newest trustworthy
// status record, wherever it lives, and turns the results into the two tables the
// dashboard reads: one row per project, one row per item waiting on Rory.
// It only reads projects (rule 3). Git is run with argument lists, never a shell.
//
// node scripts/refresh.ts --projects projects.json --out <dir> [--previous <summary.json>]
//   [--previous-projects <projects.json> --previous-waiting <waiting.json>]
//   [--first private/records] [--folder job-scout=<path>] [--cache <dir>]
// The previous refresh is either its summary.json (on Rory's PC) or the two tables
// the dashboard holds (when his PC is not connected; docs/refresh.md).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkRecord, MAX_RECORD_BYTES } from '../src/checkStatus.ts';
import type { ProjectRow, WaitingRow } from '../src/card.ts';

export type Source = { git: string } | { folder: string };
export interface ProjectConfig {
  id: string;
  name: string;
  kind: 'sprint' | 'kanban';
  sources: Source[];
}
export interface Summary {
  at: string;
  projects: ProjectRow[];
  waiting: WaitingRow[];
  report: string[];
}
interface Options {
  projects: ProjectConfig[];
  /** Connected folders, by the key a project's folder source names. */
  folders: Record<string, string>;
  /** Folder of first records, `<project id>.json` (Sprint 0, decision 0002). */
  firstRecords?: string;
  previous?: Summary;
  now: Date;
  cacheDir: string;
}

/** Activity within this long after a record is the work that wrote it, not moving on. */
const MOVED_ON_AFTER_MS = 60 * 60 * 1000;
const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
/** Branches that hold CI output (test results and recordings), not project work. */
const IGNORED_BRANCH = /^e2e-results\//;
/** More branches than any real project has; beyond it a repo is read only in part. */
const MAX_BRANCHES = 200;
/** Only these are fetched: https, or a local folder (the tests' stand-in repos). */
const ALLOWED_SOURCE = /^(https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._/-]+|\/[^\0]*)$/;

interface Candidate {
  label: string;
  text: string;
  first: boolean;
  /** When the place it was found last changed: a refusal with no readable date is dated by this. */
  changedAt: string | null;
}
interface Activity {
  at: string;
  where: string;
}
interface Gathered {
  candidates: Candidate[];
  activity: Activity[];
  reachable: boolean;
}

function gitRun(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    // No settings from Rory's own git setup (such as address rewrites) reach these calls.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_ALLOW_PROTOCOL: 'https:file' },
    maxBuffer: 20_000_000,
  });
}

/** Every branch's status record and newest commit, from a shallow copy kept in the cache. */
function gatherGit(url: string, cache: string): Gathered {
  // Only https addresses or local folders; anything else (an option, ssh, ext::) is not fetched.
  if (!ALLOWED_SOURCE.test(url)) return { candidates: [], activity: [], reachable: false };
  const dir = join(cache, createHash('sha256').update(url).digest('hex'));
  let heads: string[];
  try {
    if (!existsSync(join(dir, 'HEAD'))) {
      mkdirSync(dir, { recursive: true });
      gitRun(['init', '-q', '--bare', dir]);
      // A partial copy: commits and folder listings now, each file only when it is read.
      gitRun(['-C', dir, 'config', 'remote.origin.url', url]);
      gitRun(['-C', dir, 'config', 'remote.origin.promisor', 'true']);
      gitRun(['-C', dir, 'config', 'remote.origin.partialclonefilter', 'blob:none']);
    }
    heads = gitRun(['-C', dir, 'ls-remote', '--heads', 'origin'])
      .split('\n')
      .map((l) => l.split('\t')[1]?.replace(/^refs\/heads\//, ''))
      .filter((b): b is string => !!b && BRANCH.test(b) && !b.includes('..') && !IGNORED_BRANCH.test(b))
      .slice(0, MAX_BRANCHES);
    if (heads.length)
      gitRun(['-C', dir, 'fetch', '-q', '--depth', '1', '--no-tags', '--force', '--filter=blob:none', 'origin',
        ...heads.map((b) => `+refs/heads/${b}:refs/heads/${b}`)]);
  } catch {
    return { candidates: [], activity: [], reachable: false };
  }
  // Only branches that exist now: one deleted since the last refresh is dropped from the copy.
  const local = gitRun(['-C', dir, 'for-each-ref', '--format=%(refname:strip=2)', 'refs/heads/']).split('\n').filter(Boolean);
  for (const b of local) if (!heads.includes(b)) gitRun(['-C', dir, 'update-ref', '-d', `refs/heads/${b}`]);
  const branches = heads;
  const candidates: Candidate[] = [];
  const activity: Activity[] = [];
  for (const b of branches) {
    const ref = `refs/heads/${b}`;
    let changedAt: string | null = null;
    try {
      const at = gitRun(['-C', dir, 'log', '-1', '--format=%cI', ref, '--']).trim();
      if (at) {
        changedAt = new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z');
        activity.push({ at: changedAt, where: `branch ${b}` });
      }
    } catch {
      /* a branch with no readable commit adds no activity */
    }
    let size = -1;
    try {
      size = Number(gitRun(['-C', dir, 'cat-file', '-s', `${ref}:docs/status.json`]).trim());
    } catch {
      /* no record on this branch */
    }
    if (size > MAX_RECORD_BYTES) {
      // Too large to read: let the checker refuse it, with its own words.
      candidates.push({ label: `branch ${b}`, text: ' '.repeat(MAX_RECORD_BYTES + 1), first: false, changedAt });
    } else if (size >= 0) {
      try {
        candidates.push({ label: `branch ${b}`, text: gitRun(['-C', dir, 'show', `${ref}:docs/status.json`]), first: false, changedAt });
      } catch {
        /* unreadable: treated as no record */
      }
    }
  }
  return { candidates, activity, reachable: true };
}

function newestFile(root: string): Activity | null {
  let best: Activity | null = null;
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const p = join(dir, name);
      let s;
      try {
        s = lstatSync(p); // a link is not followed, and a broken one is skipped
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(p, depth + 1);
      else if (s.isFile() && (!best || s.mtime.toISOString() > best.at))
        best = { at: s.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z'), where: relative(join(root, '..'), p).split('\\').join('/') };
    }
  };
  walk(root, 0);
  return best;
}

/** A connected folder's record, and the newest change in its docs folder. */
function gatherFolder(path: string | undefined): Gathered {
  if (!path || path.includes('\0') || !existsSync(path)) return { candidates: [], activity: [], reachable: false };
  const candidates: Candidate[] = [];
  const file = join(path, 'docs', 'status.json');
  let st;
  try {
    st = lstatSync(file);
  } catch {
    st = null;
  }
  // Only a plain file: a folder or a link (which could point anywhere) is not read.
  if (st?.isFile()) {
    const changedAt = st.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const text = st.size > MAX_RECORD_BYTES ? ' '.repeat(MAX_RECORD_BYTES + 1) : readFileSync(file, 'utf8');
    candidates.push({ label: 'folder', text, first: false, changedAt });
  }
  const docs = join(path, 'docs');
  const newest = existsSync(docs) ? newestFile(docs) : null;
  return { candidates, activity: newest ? [newest] : [], reachable: true };
}

type Rec = {
  project: { id: string };
  writtenAt: string;
  lastActivity: string;
  links: Record<string, string>;
  sprint?: { number: string; title: string; stage: string; stageSince: string; stories: unknown[] };
  waiting: { id: string; type: string; text: string; recommendation?: string; askedOn: string; source?: string }[];
  notes?: string;
};

function rowFrom(cfg: ProjectConfig, r: Rec, label: string, now: string): ProjectRow {
  return {
    id: cfg.id,
    name: cfg.name,
    kind: cfg.kind,
    sprint: r.sprint?.number ?? null,
    sprintTitle: r.sprint?.title ?? null,
    stage: r.sprint?.stage ?? null,
    stageSince: r.sprint?.stageSince ?? null,
    stories: r.sprint ? r.sprint.stories.length : null,
    lastActivity: r.lastActivity,
    waiting: r.waiting.length,
    writtenAt: r.writtenAt,
    source: label,
    activityAt: null,
    activityWhere: null,
    movedOn: false,
    refreshedOk: true,
    refreshedAt: now,
    lastRefreshedOk: now,
    refused: null,
    noRecord: false,
    notes: r.notes ?? null,
    repo: r.links.repo ?? null,
    demo: r.links.demo ?? null,
    live: r.links.live ?? null,
    backlog: r.links.backlog ?? null,
  };
}

function emptyRow(cfg: ProjectConfig, now: string): ProjectRow {
  return {
    id: cfg.id, name: cfg.name, kind: cfg.kind, sprint: null, sprintTitle: null, stage: null, stageSince: null,
    stories: null, lastActivity: null, waiting: 0, writtenAt: null, source: null, activityAt: null, activityWhere: null,
    movedOn: false, refreshedOk: true, refreshedAt: now, lastRefreshedOk: now, refused: null, noRecord: true,
    notes: null, repo: null, demo: null, live: null, backlog: null,
  };
}

const STAGES = new Set(['refining', 'awaiting-answers', 'ready', 'building', 'awaiting-signoff', 'closed']);
const TYPES = new Set(['question', 'demo-signoff', 'deploy-approval', 'hand-check', 'account-step']);
const isDate = (v: unknown) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const textOrNull = (v: unknown) => v === null || (typeof v === 'string' && v.length <= 4000);

/** Rows from a previous refresh may come back from the dashboard, so each is checked before use. */
export function validProjectRow(r: unknown): r is ProjectRow {
  const x = r as Record<string, unknown>;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' &&
    (x.kind === 'sprint' || x.kind === 'kanban') && Number.isInteger(x.waiting) && (x.waiting as number) >= 0 &&
    (x.stage === null || STAGES.has(x.stage as string)) && (x.writtenAt === null || isDate(x.writtenAt)) &&
    isDate(x.refreshedAt) && (x.lastRefreshedOk === null || isDate(x.lastRefreshedOk)) &&
    (x.stories === null || Number.isInteger(x.stories)) && typeof x.noRecord === 'boolean' &&
    typeof x.refreshedOk === 'boolean' && typeof x.movedOn === 'boolean' &&
    ['sprint', 'sprintTitle', 'stageSince', 'lastActivity', 'source', 'activityAt', 'activityWhere', 'refused', 'notes', 'repo', 'demo', 'live', 'backlog'].every((k) => textOrNull(x[k]));
}
export function validWaitingRow(r: unknown): r is WaitingRow {
  const x = r as Record<string, unknown>;
  return !!x && typeof x === 'object' && typeof x.projectId === 'string' && typeof x.id === 'string' && TYPES.has(x.type as string) &&
    typeof x.text === 'string' && x.text.length <= 4000 && isDate(x.askedOn) && textOrNull(x.recommendation) && textOrNull(x.source);
}

export function refresh(o: Options): Summary {
  const previous = o.previous && {
    ...o.previous,
    projects: (Array.isArray(o.previous.projects) ? o.previous.projects : []).filter(validProjectRow),
    waiting: (Array.isArray(o.previous.waiting) ? o.previous.waiting : []).filter(validWaitingRow),
  };
  o = { ...o, previous };
  const now = o.now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const projects: ProjectRow[] = [];
  const waiting: WaitingRow[] = [];
  const report: string[] = [];

  for (const cfg of o.projects) {
    try {
      refreshOne(cfg);
    } catch (e) {
      // Whatever went wrong stays with this project: keep its last refresh, say so, go on.
      const prevRow = o.previous?.projects.find((p) => p.id === cfg.id);
      projects.push(prevRow ? { ...prevRow, refreshedOk: false, refreshedAt: now } : { ...emptyRow(cfg, now), refreshedOk: false, lastRefreshedOk: null });
      waiting.push(...(prevRow ? (o.previous?.waiting.filter((w) => w.projectId === cfg.id) ?? []) : []));
      report.push(`${cfg.name}: not refreshed, an error stopped it (${String((e as Error)?.message ?? e).split('\n')[0].slice(0, 200)}).`);
    }
  }
  return { at: now, projects, waiting, report };

  function refreshOne(cfg: ProjectConfig) {
    const prevRow = o.previous?.projects.find((p) => p.id === cfg.id);
    const prevWaiting = o.previous?.waiting.filter((w) => w.projectId === cfg.id) ?? [];
    const gathered = cfg.sources.map((s) => ('git' in s ? gatherGit(s.git, o.cacheDir) : gatherFolder(o.folders[s.folder])));
    const reachable = gathered.every((g) => g.reachable);
    const candidates = gathered.flatMap((g) => g.candidates);
    const activity = gathered.flatMap((g) => g.activity);
    const firstFile = o.firstRecords ? join(o.firstRecords, `${cfg.id}.json`) : null;
    if (firstFile && existsSync(firstFile)) candidates.push({ label: 'first record', text: readFileSync(firstFile, 'utf8'), first: true, changedAt: null });

    // Check every candidate; keep the valid ones for this project.
    const valid: { c: Candidate; r: Rec }[] = [];
    const refusals: { c: Candidate; at: string; msg: string }[] = [];
    for (const c of candidates) {
      const res = checkRecord(c.text, { now: o.now });
      let parsed: Partial<Rec> | null = null;
      try {
        parsed = JSON.parse(c.text.replace(/^\uFEFF/, ''));
      } catch {
        /* reported by the checker */
      }
      const at = typeof parsed?.writtenAt === 'string' && !Number.isNaN(Date.parse(parsed.writtenAt)) ? parsed.writtenAt : (c.changedAt ?? '');
      if (!res.ok) refusals.push({ c, at, msg: res.errors[0] });
      else if (parsed?.project?.id !== cfg.id)
        refusals.push({ c, at, msg: `the record is for another project ("${String(parsed?.project?.id).replace(/[^a-z0-9-]/g, '?')}"), not ${cfg.id}.` });
      else valid.push({ c, r: parsed as Rec });
    }
    valid.sort((a, b) => Date.parse(b.r.writtenAt) - Date.parse(a.r.writtenAt) || Number(a.c.first) - Number(b.c.first));
    const best = valid[0];
    // The newest refusal newer than what is shown (or any, if nothing is shown).
    const newerRefusal = refusals
      .filter((x) => !best || (!!x.at && Date.parse(x.at) > Date.parse(best.r.writtenAt)))
      .sort((a, b) => b.at.localeCompare(a.at))[0];

    let row: ProjectRow;
    let rows: WaitingRow[];
    if (!reachable && !best && prevRow) {
      // Could not look: keep what the last refresh found, and say so.
      row = { ...prevRow, refreshedOk: false, refreshedAt: now };
      rows = prevWaiting;
      report.push(`${cfg.name}: not refreshed, its source could not be reached; kept the last refresh.`);
    } else if (best) {
      row = rowFrom(cfg, best.r, best.c.label, now);
      rows = best.r.waiting.map((w) => ({
        projectId: cfg.id, id: w.id, type: w.type, text: w.text,
        recommendation: w.recommendation ?? null, askedOn: w.askedOn, source: w.source ?? null,
      }));
      if (newerRefusal) row.refused = newerRefusal.msg;
      if (!reachable) {
        row.refreshedOk = false;
        row.lastRefreshedOk = prevRow?.lastRefreshedOk ?? null;
      }
      const changed = !prevRow ? 'new' : prevRow.writtenAt === row.writtenAt && prevRow.source === row.source ? 'unchanged' : 'changed';
      report.push(`${cfg.name}: ${row.source}, record of ${row.writtenAt} (${changed})${reachable ? '' : '; part of its source could not be reached'}.`);
    } else if (!o.firstRecords && prevRow?.source === 'first record') {
      // The first records are on Rory's PC; when it is not connected, a first record
      // (which never changes) carries over from the last refresh as it was.
      row = { ...prevRow, refreshedOk: reachable, refreshedAt: now, lastRefreshedOk: reachable ? now : prevRow.lastRefreshedOk, refused: newerRefusal?.msg ?? null };
      rows = prevWaiting;
      report.push(`${cfg.name}: first record, record of ${row.writtenAt} (unchanged; carried over).`);
    } else if (prevRow && prevRow.writtenAt) {
      row = { ...prevRow, noRecord: true, refused: newerRefusal?.msg ?? null, refreshedAt: now, refreshedOk: reachable };
      if (reachable) row.lastRefreshedOk = now;
      rows = prevWaiting;
      report.push(`${cfg.name}: no valid record now; showing the last valid one.`);
    } else {
      row = { ...emptyRow(cfg, now), refused: newerRefusal?.msg ?? null, refreshedOk: reachable, lastRefreshedOk: reachable ? now : null };
      rows = [];
      report.push(`${cfg.name}: no record found.`);
    }
    for (const r of refusals) report.push(`  ${cfg.name}: refused the record on ${r.c.label}: ${r.msg}`);

    const newest = activity.sort((a, b) => b.at.localeCompare(a.at))[0];
    if (newest) {
      row.activityAt = newest.at;
      row.activityWhere = newest.where;
      row.movedOn = !!row.writtenAt && Date.parse(newest.at) > Date.parse(row.writtenAt) + MOVED_ON_AFTER_MS;
    }
    projects.push(row);
    waiting.push(...rows);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: a } = parseArgs({
    options: {
      projects: { type: 'string' }, out: { type: 'string' }, previous: { type: 'string' }, first: { type: 'string' },
      folder: { type: 'string', multiple: true }, cache: { type: 'string' },
      'previous-projects': { type: 'string' }, 'previous-waiting': { type: 'string' },
    },
  });
  if (!a.projects || !a.out) throw new Error('--projects and --out are required');
  const folders = Object.fromEntries((a.folder ?? []).map((f) => f.split(/=(.*)/s).slice(0, 2)));
  let previous = a.previous && existsSync(a.previous) ? (JSON.parse(readFileSync(a.previous, 'utf8')) as Summary) : undefined;
  if (!previous && a['previous-projects'] && a['previous-waiting']) {
    const rows = JSON.parse(readFileSync(a['previous-projects'], 'utf8')) as ProjectRow[];
    previous = {
      at: rows.reduce((m, r) => (r.refreshedAt > m ? r.refreshedAt : m), ''),
      projects: rows,
      waiting: JSON.parse(readFileSync(a['previous-waiting'], 'utf8')) as WaitingRow[],
      report: [],
    };
  }
  const s = refresh({
    projects: JSON.parse(readFileSync(a.projects, 'utf8')),
    folders,
    firstRecords: a.first,
    previous,
    now: new Date(),
    cacheDir: a.cache ?? join(a.out, '.cache'),
  });
  mkdirSync(a.out, { recursive: true });
  writeFileSync(join(a.out, 'summary.json'), JSON.stringify(s, null, 2));
  writeFileSync(join(a.out, 'projects.json'), JSON.stringify(s.projects, null, 2));
  writeFileSync(join(a.out, 'waiting.json'), JSON.stringify(s.waiting, null, 2));
  console.log(s.report.join('\n'));
}
