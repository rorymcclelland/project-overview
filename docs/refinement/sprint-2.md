# Sprint 2 refinement: what is waiting on me

Refined 9 November 2026. Status: Ready, all questions answered 9 November 2026. O2-1 depends on Rory saving the skill changes.

## What we know

- **The dashboard is refreshed by a scheduled task** ("Project overview refresh", weekdays 07:41 and 13:19) that follows `docs/refresh.md` on Rory's PC. Any session on Rory's account can also fire that task on demand. It ran by itself twice on 9 November and worked both times.
- **Projects write their own status records only once Rory saves the three skill changes** proposed in Sprint 0 (sprint-refine, sprint-close, build-working-agreement). On 9 November they did not yet show as saved. Until they are, every card shows the first records, and update on change has nothing to react to.
- **The 14 items waiting on Rory today** are spread over five cards; the oldest dates from 17 October.
- **Saving an answer in the page** (Sprint 3) is not tried yet. The Dashboard type allows a write when the reader presses a control that says so; where it stores it, and how a project's session reads it back, is the spike's question.

## O2-1 Update on change (S)

**The job.** The dashboard changes when a project changes, not hours later.

**Before and after.** Today: a change in a project shows at the next scheduled run (up to about 18 hours over a weekday night, longer at weekends). After: within minutes of a session writing its status record.

**What changes.** One step added to the three skill changes Rory has yet to save (they become one review card per skill, replacing the Sprint 0 versions): after writing and checking `docs/status.json`, fire the "Project overview refresh" scheduled task (Q1). `docs/refresh.md` gains: if a dataset changed since it was read (a version conflict, as when two refreshes overlap), read again and retry once.

**Test cases.**
1. A session that writes a record fires the refresh, and the dashboard shows the new record within 10 minutes (by hand: done on one real project in the demo, with times).
2. Two refreshes fired a few seconds apart both finish, and the dashboard holds the newer one (by hand: fired twice in the demo; the refresh's report shows it).
3. If firing the refresh fails, the project's own work is unaffected and the session says so in one line (by hand: the skill step reads so; checked in review).
4. The refresh run by update on change follows the same procedure as the scheduled one (CI: a check that the skill text names the same task and procedure as `docs/refresh.md`).

**Out of scope.** Reading GitHub live (O-L1). Refreshing only the one project that changed: the refresh takes about 6 seconds for all five, so it always does all five.

**Boundaries.** Rule 3: firing the refresh only reads projects and writes the dashboard. No new credentials.

**Risks.** Each fired refresh is a short Claude run on Rory's account; a busy day might fire ten (Q1 says what each costs in time). If Rory's PC is off, the fired run uses the cloud fallback and Job Scout's card says it was not refreshed.

**Dependency.** Rory saves the skill changes. Without that, O2-1 is built but has nothing to react to.

## O2-2 The inbox (M)

**The job.** One place that answers "what is waiting on me, and what has waited longest?"

**Before and after.** Today: 14 items across five cards. After: one list at the top of the dashboard (Q2), oldest first, each with its project, type, text, Claude's recommendation, how long it has waited, and a link that jumps to its project's card.

**What changes.** A new section in the page; the logic that turns the waiting table into the list lives in `src/inbox.ts`, tested and bundled like the card logic. Counts by type come from a calculation the page marks as its source. No change to the refresh or the records.

**Test cases** (CI on `src/inbox.ts` and on the page in a test browser, unless said).
1. Every waiting item appears exactly once, with its project's name; one for a project the overview does not know is left out and counted as "1 not shown".
2. Items are oldest first; on the same day, by project order on the page, then by id.
3. "Waited" reads "today", "1 day", "17 days", counted in UK days.
4. Items waiting longer than the agreed limit are marked (Q3); none other are.
5. The type filter (Q4) shows only the chosen type and says how many are hidden; "All" shows everything.
6. Each item's link jumps to its project's card on the same page.
7. Markup in an item's text is shown as text.
8. The heading counts match the cards: the inbox total equals the sum of the cards' counts (a check in the test, and the dashboard's own check of its marks).
9. Readable at full width and at about 400 px (by hand: screenshots).

**Out of scope.** Answering items (Sprint 3), dismissing or snoozing them, notifications.

**Boundaries.** Rule 1: the inbox shows only what records say, with their dates.

## S2-A Spike: saving answers in the page (S, time-boxed to half a day)

**The question.** Can the dashboard save what Rory types into it when he presses a button, keep it private to him, and can a project's session then read it back reliably? If not, what is the next best way (for example, the page drafting the answer for Rory to paste into a chat)?

**Method.** On a throwaway copy of the dashboard, never the real one: a page with one text box and a Save button; save, reload, read it back from a session; check who else could read it; check what happens with two answers to the same question.

**Output.** A decision record, `docs/DECISIONS.md` 0003, with what ran and what was seen; Sprint 3 is refined against it. Nothing from the spike ships.

**Spike rule.** No Sprint 2 story depends on it; Sprint 3's stories do, so they stay unrefined until it is done.

## The sprint as a whole

Order: O2-1 first (small, and every later refresh benefits), then O2-2, then S2-A. About two and a half days.

**Demo.** The dashboard with the inbox; one real project writing its record and the dashboard updating on its own, with times; the spike's decision record.

## Questions for Rory

- **Q1 How update on change triggers a refresh.** (a) The project's session fires the existing scheduled refresh task, so every refresh runs the same tested way, on your PC (recommended; each run takes a few minutes of Claude in the background); (b) the project's session runs the refresh itself, which is quicker but means each project carries the refresh steps and needs your PC's folders connected.
- **Q2 Where the inbox goes.** (a) At the top of the dashboard, above the cards (recommended: the first thing you see is what needs you); (b) in its own tab, beside the cards.
- **Q3 When an item counts as waiting too long.** (a) More than 7 days (recommended: 5 of today's 14 items would be marked, all from October, so the oldest stand out without marking everything); (b) more than 3 days (8 of 14 marked); (c) never mark.
- **Q4 How the inbox is arranged.** (a) One list, oldest first, with a filter by type (recommended); (b) grouped by type, each group oldest first.

## Rory's answers (9 November 2026)

- **Q1:** (a). The project's session fires the existing scheduled refresh task.
- **Q2:** (a). The inbox goes at the top of the dashboard, above the cards.
- **Q3:** (a). Items waiting more than 7 days are marked.
- **Q4:** (a). One list, oldest first, with a filter by type.

## Built (9 November 2026)

- **O2-1.** A refresh task just for projects to start, "Project overview refresh (on change)" (`trig_0198hB2JNRJQ4ReGzb8Uu7id`), no schedule of its own, on Rory's PC with both folders, approval automatic, no notifications. The overview now keeps its own status record (`docs/status.json`) and appears on its own dashboard, so update on change could be tried on a real project without touching any other. The three skill changes are re-proposed as one card per skill, combining the Sprint 0 status-record step with starting the refresh.
- **O2-1 case 1 (by hand).** The overview's record was committed at 17:34 and the refresh started at 17:35; the dashboard showed it at 17:41 (7 minutes). Passed.
- **O2-1 case 2 (by hand).** Two refreshes started about a minute apart; both finished and the dashboard held one consistent set of tables at 18:35. Passed.
- **O2-2.** The inbox above the cards, built from `src/inbox.ts`, bundled with the card logic.

## Found while building

- **F-5 Refreshes started from a task did not use Rory's PC while this session was using it.** The 13:30 scheduled run used the PC; the three on-change runs (17:35, about 17:52 twice) all fell back to the cloud and marked Job Scout "not refreshed", although the PC was on. The procedure and all three tasks now load the PC tools before deciding (that alone did not fix it). Likely cause: one session at a time can use the PC. To confirm with the 07:41 run on 10 November. If confirmed, a project session that is using the PC (Job Scout's, most of all) should run the refresh itself rather than start the task: Q1's option (b), for that case only.
- **F-6 The live dashboard ran the Sprint 0 card script after Sprint 1's review fixes.** The page was updated after Sprint 1's review but its card script was not re-uploaded, so the S7 to S9 card fixes reached the dashboard only on 9 November at 17:50. No real data was affected. A check that the live files match the build is needed (proposed for this sprint's review).
- **S2-A needs Rory for one minute.** The built-in browser on Rory's PC is not signed in to Claude, so Claude cannot open the spike page. A throwaway page, "Overview spike: saving answers (throwaway)", is ready: Rory opens it, types anything and presses Save, and Claude reads what it saved.
