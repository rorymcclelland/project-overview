// The refresh (Sprint 1, O1-1 and O1-3): finds each project's newest trustworthy
// status record, wherever it lives, and turns the results into the two tables the
// dashboard reads: one row per project, one row per item waiting on Rory.
// It only reads projects (rule 3). Git is run with argument lists, never a shell.
//
// node scripts/refresh.ts --projects projects.json --out <dir> [--previous <summary.json>]
//   [--first private/records] [--folder job-scout=<path>] [--cache <dir>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkRecord } from '../src/checkStatus.ts';
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

interface Candidate {
  label: string;
  text: string;
  first: boolean;
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
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 20_000_000,
  });
}

/** Every branch's status record and newest commit, from a shallow copy kept in the cache. */
function gatherGit(url: string, cache: string): Gathered {
  // A source that looks like an option would be read by git as one.
  if (url.startsWith('-')) return { candidates: [], activity: [], reachable: false };
  const dir = join(cache, Buffer.from(url).toString('base64url').slice(0, 80));
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
      .filter((b): b is string => !!b && BRANCH.test(b) && !b.includes('..') && !IGNORED_BRANCH.test(b));
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
    try {
      const at = gitRun(['-C', dir, 'log', '-1', '--format=%cI', ref, '--']).trim();
      if (at) activity.push({ at: new Date(at).toISOString().replace('.000Z', 'Z'), where: `branch ${b}` });
    } catch {
      /* a branch with no readable commit adds no activity */
    }
    try {
      candidates.push({ label: `branch ${b}`, text: gitRun(['-C', dir, 'show', `${ref}:docs/status.json`]), first: false });
    } catch {
      /* no record on this branch */
    }
  }
  return { candidates, activity, reachable: true };
}

function newestFile(root: string): Activity | null {
  let best: Activity | null = null;
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p, depth + 1);
      else if (s.isFile() && (!best || s.mtime.toISOString() > best.at))
        best = { at: s.mtime.toISOString().replace('.000Z', 'Z'), where: relative(join(root, '..'), p).split('\\').join('/') };
    }
  };
  walk(root, 0);
  return best;
}

/** A connected folder's record, and the newest change in its docs folder. */
function gatherFolder(path: string | undefined): Gathered {
  if (!path || !existsSync(path)) return { candidates: [], activity: [], reachable: false };
  const candidates: Candidate[] = [];
  const file = join(path, 'docs', 'status.json');
  if (existsSync(file)) candidates.push({ label: 'folder', text: readFileSync(file, 'utf8'), first: false });
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

export function refresh(o: Options): Summary {
  const now = o.now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const projects: ProjectRow[] = [];
  const waiting: WaitingRow[] = [];
  const report: string[] = [];

  for (const cfg of o.projects) {
    const prevRow = o.previous?.projects.find((p) => p.id === cfg.id);
    const prevWaiting = o.previous?.waiting.filter((w) => w.projectId === cfg.id) ?? [];
    const gathered = cfg.sources.map((s) => ('git' in s ? gatherGit(s.git, o.cacheDir) : gatherFolder(o.folders[s.folder])));
    const reachable = gathered.every((g) => g.reachable);
    const candidates = gathered.flatMap((g) => g.candidates);
    const activity = gathered.flatMap((g) => g.activity);
    const firstFile = o.firstRecords ? join(o.firstRecords, `${cfg.id}.json`) : null;
    if (firstFile && existsSync(firstFile)) candidates.push({ label: 'first record', text: readFileSync(firstFile, 'utf8'), first: true });

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
      const at = typeof parsed?.writtenAt === 'string' ? parsed.writtenAt : '';
      if (!res.ok) refusals.push({ c, at, msg: res.errors[0] });
      else if (parsed?.project?.id !== cfg.id)
        refusals.push({ c, at, msg: `the record is for another project ("${String(parsed?.project?.id).replace(/[^a-z0-9-]/g, '?')}"), not ${cfg.id}.` });
      else valid.push({ c, r: parsed as Rec });
    }
    valid.sort((a, b) => Date.parse(b.r.writtenAt) - Date.parse(a.r.writtenAt) || Number(a.c.first) - Number(b.c.first));
    const best = valid[0];
    // The newest refusal newer than what is shown (or any, if nothing is shown).
    const newerRefusal = refusals
      .filter((x) => !best || !x.at || Date.parse(x.at) > Date.parse(best.r.writtenAt))
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
  return { at: now, projects, waiting, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: a } = parseArgs({
    options: {
      projects: { type: 'string' }, out: { type: 'string' }, previous: { type: 'string' }, first: { type: 'string' },
      folder: { type: 'string', multiple: true }, cache: { type: 'string' },
    },
  });
  if (!a.projects || !a.out) throw new Error('--projects and --out are required');
  const folders = Object.fromEntries((a.folder ?? []).map((f) => f.split(/=(.*)/s).slice(0, 2)));
  const previous = a.previous && existsSync(a.previous) ? (JSON.parse(readFileSync(a.previous, 'utf8')) as Summary) : undefined;
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
