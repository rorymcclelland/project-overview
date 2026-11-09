// The inbox (Sprint 2, O2-2): everything waiting on Rory across projects, oldest first.
// Bundled into the dashboard page with src/card.ts (scripts/build-page.ts), so the page
// shows exactly what the tests check. Imports only from card.ts.
import { toCard, orderCards, ukDaysSince, type ProjectRow, type WaitingRow } from './card.ts';

/** Items waiting longer than this many days are marked (Rory, Sprint 2, Q3). */
export const OVERDUE_DAYS = 7;

const TYPE_ORDER: [string, string][] = [
  ['question', 'Question'],
  ['demo-signoff', 'Demo sign-off'],
  ['deploy-approval', 'Live deploy'],
  ['hand-check', 'Hand check'],
  ['account-step', 'Account step'],
];

export interface InboxItem {
  projectId: string;
  projectName: string;
  id: string;
  type: string;
  typeLabel: string;
  text: string;
  recommendation: string | null;
  askedOn: string;
  waitedText: string;
  overdue: boolean;
}
export interface Inbox {
  items: InboxItem[];
  /** Items for a project the overview does not know, left out. */
  notShown: number;
  overdue: number;
  /** What the cards add up to; differs from items.length only if a record and its table disagree. */
  cardTotal: number;
  mismatch: boolean;
  types: { type: string; label: string; count: number }[];
}

export function toInbox(projects: ProjectRow[], waiting: WaitingRow[], now: Date): Inbox {
  // Same-day items follow the order of the cards on the page.
  const order = orderCards(projects.map((p) => toCard(p, [], now))).map((c) => c.id);
  const rank = new Map(order.map((id, i) => [id, i]));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const known = waiting.filter((w) => rank.has(w.projectId));
  const items = known
    .map((w): InboxItem & { dated: boolean } => {
      const days = ukDaysSince(w.askedOn, now);
      const label = TYPE_ORDER.find(([t]) => t === w.type)?.[1] ?? w.type;
      return {
        projectId: w.projectId,
        projectName: names.get(w.projectId) ?? w.projectId,
        id: w.id,
        type: w.type,
        typeLabel: label,
        text: w.text,
        recommendation: w.recommendation,
        askedOn: w.askedOn,
        waitedText: days === null ? 'an unknown time' : days < 0 ? 'a future date' : days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`,
        overdue: days !== null && days > OVERDUE_DAYS,
        dated: days !== null,
      };
    })
    .sort(
      (a, b) =>
        // Items with an unreadable date go last, so they never push real ones down.
        Number(!a.dated) - Number(!b.dated) ||
        (a.dated && b.dated ? a.askedOn.localeCompare(b.askedOn) : 0) ||
        (rank.get(a.projectId) ?? 0) - (rank.get(b.projectId) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const types = TYPE_ORDER.map(([type, label]) => ({ type, label, count: items.filter((i) => i.type === type).length })).filter((t) => t.count);
  const other = items.filter((i) => !TYPE_ORDER.some(([t]) => t === i.type)).length;
  if (other) types.push({ type: 'other', label: 'Other', count: other });
  const cardTotal = projects.reduce((n, p) => n + (Number(p.waiting) || 0), 0);
  return {
    items: items.map((i) => {
      const { dated, ...rest } = i; // internal to the sort only
      void dated;
      return rest;
    }),
    notShown: waiting.length - known.length,
    overdue: items.filter((i) => i.overdue).length,
    types,
    cardTotal,
    mismatch: cardTotal !== items.length,
  };
}

/**
 * The items of one type (null for all), how many the filter hides, and the type in force:
 * a type no item has any more falls back to all, so a stale filter never empties the list.
 */
export function filterInbox(box: Inbox, type: string | null): { shown: InboxItem[]; hidden: number; type: string | null } {
  const known = (t: string) => TYPE_ORDER.some(([k]) => k === t);
  const inForce = type !== null && box.types.some((t) => t.type === type) ? type : null;
  const shown = inForce === null ? box.items : box.items.filter((i) => (inForce === 'other' ? !known(i.type) : i.type === inForce));
  return { shown, hidden: box.items.length - shown.length, type: inForce };
}
