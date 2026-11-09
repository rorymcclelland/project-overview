// What one project's card says, worked out from the refresh's rows.
// This file is bundled unchanged into the dashboard page (scripts/build-page.ts),
// so the page says exactly what the tests check. It must import nothing.

/** One project, as the refresh writes it (the "projects" table). */
export interface ProjectRow {
  id: string;
  name: string;
  kind: 'sprint' | 'kanban';
  sprint: string | null;
  sprintTitle: string | null;
  stage: string | null;
  stageSince: string | null;
  stories: number | null;
  lastActivity: string | null;
  waiting: number;
  writtenAt: string | null;
  source: string | null;
  activityAt: string | null;
  activityWhere: string | null;
  movedOn: boolean;
  refreshedOk: boolean;
  refreshedAt: string;
  lastRefreshedOk: string | null;
  refused: string | null;
  noRecord: boolean;
  notes: string | null;
  repo: string | null;
  demo: string | null;
  live: string | null;
  backlog: string | null;
}

/** One thing waiting on Rory (the "waiting" table). */
export interface WaitingRow {
  projectId: string;
  id: string;
  type: string;
  text: string;
  recommendation: string | null;
  askedOn: string;
  source: string | null;
}

export interface Flag {
  kind: 'no-record' | 'moved-on' | 'not-refreshed' | 'newer-refused';
  text: string;
}

export interface Card {
  id: string;
  name: string;
  kind: 'sprint' | 'kanban';
  sprintLine: string | null;
  stageText: string | null;
  stageSince: string | null;
  storiesText: string | null;
  lastActivityText: string | null;
  waitingCount: number;
  waitingSummary: string;
  items: { id: string; typeLabel: string; text: string; recommendation: string | null; askedText: string; source: string | null }[];
  links: { label: string; href: string | null; text: string }[];
  ageText: string | null;
  flags: Flag[];
  notes: string | null;
  lastActivity: string | null;
}

const STAGE_WORDS: Record<string, string> = {
  refining: 'Refining',
  'awaiting-answers': 'Waiting for your answers',
  ready: 'Ready, waiting for your go',
  building: 'Building',
  'awaiting-signoff': 'Waiting for your sign-off',
  closed: 'Closed',
};

/** Singular and plural for each kind of waiting item, in the order they are summarised. */
const TYPE_WORDS: [string, string, string][] = [
  ['question', 'question', 'questions'],
  ['demo-signoff', 'demo sign-off', 'demo sign-offs'],
  ['deploy-approval', 'live deploy to approve', 'live deploys to approve'],
  ['hand-check', 'hand check', 'hand checks'],
  ['account-step', 'account step', 'account steps'],
];
const TYPE_LABELS: Record<string, string> = {
  question: 'Question',
  'demo-signoff': 'Demo sign-off',
  'deploy-approval': 'Live deploy',
  'hand-check': 'Hand check',
  'account-step': 'Account step',
};

/** The same rule as the checker's: a plain https link, nothing that could run. */
const SAFE_LINK = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?(\/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]*)?$/;

const UK = 'Europe/London';
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK, day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ukDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: UK, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "8 Nov 2026" for a date (YYYY-MM-DD, read as that calendar day) or a moment (in UK time). */
function moment(value: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** A value that is not a date (only possible in an old table) reads as such, never breaks the page. */
function day(value: string): string {
  const d = moment(value);
  return d ? dayFmt.format(d).replace('Sept', 'Sep') : 'an unknown date';
}
function time(value: string): string {
  const d = moment(value);
  return d ? timeFmt.format(d) : 'an unknown time';
}
/** Looks up only the table's own words, never built-in names such as "constructor". */
function own(table: Record<string, string>, key: string): string {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
}
/** Whole UK calendar days from a date or moment to now; null if it is not a date. */
export function ukDaysSince(from: string, now: Date): number | null {
  const d = moment(from);
  return d ? daysBetween(d.toISOString(), now) : null;
}
function daysBetween(from: string, now: Date): number {
  const a = Date.parse(`${ukDayKey.format(new Date(from))}T00:00:00Z`);
  const b = Date.parse(`${ukDayKey.format(now)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function toCard(p: ProjectRow, waiting: WaitingRow[], now: Date): Card {
  const mine = waiting.filter((x) => x.projectId === p.id);
  const sprintProject = p.kind === 'sprint';

  const counts = TYPE_WORDS.map(([type, one, many]) => {
    const n = mine.filter((x) => x.type === type).length;
    return n === 0 ? '' : `${n} ${n === 1 ? one : many}`;
  }).filter(Boolean);
  const unknown = mine.filter((x) => !TYPE_WORDS.some(([t]) => t === x.type)).length;
  if (unknown) counts.push(`${unknown} other`);

  const links: Card['links'] = [];
  for (const [label, value] of [['Repo', p.repo], ['Demo', p.demo], ['Live', p.live], ['Backlog', p.backlog]] as const) {
    if (!value) continue;
    links.push(SAFE_LINK.test(value) ? { label, href: value, text: label } : { label, href: null, text: value });
  }

  const flags: Flag[] = [];
  if (p.noRecord) {
    let text = 'No current record.';
    if (p.refused) text += ` The newest one was refused: ${p.refused}`;
    if (p.writtenAt) text += ` Showing the last valid record, from ${day(p.writtenAt)}, ${time(p.writtenAt)}.`;
    flags.push({ kind: 'no-record', text });
  } else if (p.refused) {
    flags.push({ kind: 'newer-refused', text: `A newer record was refused, so this one is shown: ${p.refused}` });
  }
  if (p.movedOn && p.activityAt && p.activityWhere)
    flags.push({
      kind: 'moved-on',
      text: `This project has moved on since this record: ${p.activityWhere} changed at ${time(p.activityAt)} on ${day(p.activityAt)}.`,
    });
  if (!p.refreshedOk)
    flags.push({
      kind: 'not-refreshed',
      text:
        `Not refreshed at ${time(p.refreshedAt)} on ${day(p.refreshedAt)}: its source could not be reached.` +
        (p.lastRefreshedOk ? ` Last refreshed at ${time(p.lastRefreshedOk)} on ${day(p.lastRefreshedOk)}.` : ' It has never been refreshed.'),
    });

  let ageText: string | null = null;
  if (p.writtenAt && !moment(p.writtenAt)) ageText = 'Record from an unknown date';
  else if (p.writtenAt) {
    const n = daysBetween(p.writtenAt, now);
    ageText = `Record from ${day(p.writtenAt)}, ${time(p.writtenAt)}, ${n <= 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`}`;
  }

  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    sprintLine: sprintProject && p.sprint ? `Sprint ${p.sprint}${p.sprintTitle ? `: ${p.sprintTitle}` : ''}` : null,
    stageText: sprintProject && p.stage ? own(STAGE_WORDS, String(p.stage)) : null,
    stageSince: sprintProject && p.stageSince ? `since ${day(p.stageSince)}` : null,
    storiesText: sprintProject && p.stories !== null && p.stories !== undefined ? `${p.stories} ${Number(p.stories) === 1 ? 'story' : 'stories'}` : null,
    lastActivityText: p.lastActivity ? `Last activity ${day(p.lastActivity)}` : null,
    waitingCount: Number(p.waiting) || 0,
    waitingSummary: counts.length ? counts.join(', ') : 'Nothing waiting on you',
    items: mine.map((x) => ({
      id: x.id,
      typeLabel: own(TYPE_LABELS, String(x.type)),
      text: x.text,
      recommendation: x.recommendation,
      askedText: `Asked ${day(x.askedOn)}`,
      source: x.source,
    })),
    links,
    ageText,
    flags,
    notes: p.notes,
    lastActivity: p.lastActivity,
  };
}

/** Most things waiting on Rory first, then most recent activity, then by name. */
export function orderCards(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      b.waitingCount - a.waitingCount ||
      (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '') ||
      a.name.localeCompare(b.name),
  );
}
