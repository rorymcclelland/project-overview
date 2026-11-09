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
  types: { type: string; label: string; count: number }[];
}

export function toInbox(projects: ProjectRow[], waiting: WaitingRow[], now: Date): Inbox {
  // Same-day items follow the order of the cards on the page.
  const order = orderCards(projects.map((p) => toCard(p, [], now))).map((c) => c.id);
  const rank = new Map(order.map((id, i) => [id, i]));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const known = waiting.filter((w) => rank.has(w.projectId));
  const items = known
    .map((w): InboxItem => {
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
        waitedText: days === null ? 'an unknown time' : days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`,
        overdue: days !== null && days > OVERDUE_DAYS,
      };
    })
    .sort(
      (a, b) =>
        a.askedOn.localeCompare(b.askedOn) ||
        (rank.get(a.projectId) ?? 0) - (rank.get(b.projectId) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const types = TYPE_ORDER.map(([type, label]) => ({ type, label, count: items.filter((i) => i.type === type).length })).filter((t) => t.count);
  const other = items.filter((i) => !TYPE_ORDER.some(([t]) => t === i.type)).length;
  if (other) types.push({ type: 'other', label: 'Other', count: other });
  return { items, notShown: waiting.length - known.length, overdue: items.filter((i) => i.overdue).length, types };
}

/** The items of one type (null for all), and how many the filter hides. */
export function filterInbox(box: Inbox, type: string | null): { shown: InboxItem[]; hidden: number } {
  const known = (t: string) => TYPE_ORDER.some(([k]) => k === t);
  const shown = type === null ? box.items : box.items.filter((i) => (type === 'other' ? !known(i.type) : i.type === type));
  return { shown, hidden: box.items.length - shown.length };
}
