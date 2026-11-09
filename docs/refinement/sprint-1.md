# Sprint 1 refinement: one view I can trust

Refined 9 November 2026. Status: Ready, all questions answered 9 November 2026.

## What we know

- **The page.** Claude's Dashboard type is made for this: a private page whose every figure is marked with the source it came from, with a Sources panel showing how fresh each source is. Its data comes from datasets, which are either live connector queries or attached files. There is no GitHub connector, and Job Scout is only on Rory's PC, so each project's record becomes an attached file, replaced at each refresh and stamped with when and by whom. Text from records is shown with `textContent` only (the type drops `innerHTML`-style event attributes anyway). Later sprints fit it too: spend from the Vercel, Supabase and Neon connectors can be live queries (Sprint 5), and charts are its core (Sprint 4).
- **One unknown for later.** Answering questions in the page (Sprint 3) needs the page to save what Rory types. The type allows a write when the reader presses a control that says so, but how and where it stores that is not yet tried. A spike goes in Sprint 2, so Sprint 3 is refined against a real answer (spike rule).
- **Where records live today.** RFI Respond's and Studio's current state is on sprint branches, ahead of `main` (F-2). Job Scout's is only in Rory's private folder (F-3). Until each project's next sprint close, the newest record for each is the first record in `private/records/` on Rory's PC.
- **How the refresh can reach them.** This Project's sessions can read the public repos (git, read only), Job Scout's folder and the private records (the link to Rory's PC, read only), and can write the dashboard's files. A scheduled task can do the same if it is allowed to use Rory's PC, which must then be on with the Claude app open.

## O1-1 The refresh (M)

**The job.** Put each project's newest trustworthy record into the page, wherever it lives, so Rory never sees a stale state because a record sat on a branch or a PC.

**Before and after.** Today: records exist but nothing gathers them. After: "refresh the overview" in this Project (and on a schedule, O1-4) finds every project's records, keeps the newest that passes the checker, and replaces that project's file in the dashboard, with a short report of what changed.

**What changes.** `scripts/refresh.ts`: given the folders it can see (a shallow fetch of every branch's `docs/status.json` for each repo, Job Scout's `docs/status.json`, `private/records/`), it checks every candidate, picks the newest valid one per project by `writtenAt`, works out the "moved on" facts for O1-3, and writes one file per project plus `summary.json`. A procedure in `docs/refresh.md` says how a session runs it and uploads the files. The project list (`projects.json`: id, name, kind, where its records live) is public; private locations are named by placeholder, filled from the session's own folders.

**Test cases** (CI unless said; git and folders are local fixtures).
1. A record on a sprint branch newer than `main`'s is chosen.
2. A refused record is skipped and an older valid one used; the refusal is reported with the checker's message.
3. With no valid record anywhere, the project is reported as "no record" (the page shows that; O1-3).
4. A first record in `private/records/` is used until the project writes its own, then the project's own wins when newer.
5. Two candidates with the same `writtenAt`: the project's own repo wins over the first record.
6. A record whose `project.id` does not match the project it was found in is refused (a copy-paste slip cannot show one project as another).
7. A repo that cannot be reached leaves that project's last file in place, marked as not refreshed, and the others still refresh.
8. Hostile: a branch name or file path with shell characters is never run as a command (arguments only).
9. The report lists each project: the source used, its `writtenAt`, and what changed since the last refresh.
10. A real refresh over the five projects puts five files in the dashboard (by hand: the demo shows the report and the Sources panel).

**Out of scope.** Writing to any project (rule 3). Spend and history.

**Boundaries.** Rule 2: records are taken as written; the refresh never edits one. Rule 5: Job Scout's file goes only into the private dashboard, never the repo. Read-only access to every project.

**Size.** M.

## O1-2 The page (M)

**The job.** One glance answers "where is everything, and is anything waiting on me?"

**Before and after.** Today: five repos, a private folder and two Claude docs. After: a private dashboard, one card per project.

**What each card shows.** Project name; for sprint projects, the sprint number and title, the stage in plain words ("Waiting for your sign-off") and since when, the number of stories; last activity; how many things wait on Rory, by type ("1 demo sign-off, 2 hand checks"), with the items listed underneath (text, recommendation, date asked); links to repo, demo, live site and backlog that open in a new tab; how old the record is (O1-3). The website's card has no sprint, stage or stories. The page heading gives the total waiting on Rory across projects.

**What changes.** A Dashboard artifact (private), its datasets (one file per project), and its page. The logic that turns a record into what a card says lives in `src/card.ts`, tested in CI, and is bundled into the page's script, so the page shows exactly what the tests checked.

**Test cases.**
1. A sprint record becomes a card with each field above, stage in plain words (CI, `src/card.ts`).
2. A kanban record has no sprint, stage or stories on its card (CI).
3. Waiting items are counted by type, in words, singular and plural right ("1 hand check", "2 hand checks") (CI).
4. Text containing markup is shown as the same characters, never as markup: the page uses text only (CI on the model; by the type's own check that no code threw; the demo shows a record with `<b>` in a question).
5. Links open only if they pass the checker; any other is shown as text (CI).
6. The page reads at full width and at about 400 px beside a chat, with no sideways scroll (by hand: screenshots at both widths in the demo).
7. Every figure on the page is marked with its source, so the Sources panel can show where it came from (the type's own check reports any mark that matches nothing; by hand, in the demo).
8. Cards are ordered as Rory chooses (Q4) (CI).

**Out of scope.** Answering questions (Sprint 3), charts (Sprint 4), spend (Sprints 5 and 6), an inbox across projects (Sprint 2: this sprint lists waiting items per card only).

**Boundaries.** Rule 1: the page shows only what records say. Rule 4: no secrets in the page or its store.

**Size.** M.

## O1-3 Nothing stale passes as current (S)

**The job.** A record says what was true when it was written. The page must never let an old record look current (R12).

**What the card says.**
- Always: "Record from <date and time>, <n> days ago."
- "This project has moved on since this record" when the project has newer activity than its record (Q3), with what and when ("commits on sprint-26 at 10:01").
- "No current record" when none passes the checker, with the checker's first message (shortened and made safe by the checker), and the project's last valid record, if any, marked as older.
- "Not refreshed" when its source could not be reached at the last refresh, with when it last was.

**Test cases** (CI on `src/card.ts` and `scripts/refresh.ts`).
1. Each of the four messages appears in exactly its case, and never otherwise.
2. A project with commits after its record shows "moved on" with the branch and time; one with none does not.
3. Activity within an hour after the record (the commit that wrote it) does not count as moving on.
4. Job Scout: a file in its `docs` folder changed after its record counts as activity.
5. A refused record's message on the card is the checker's shortened version, with no markup.

**Size.** S.

## O1-4 Refresh without asking (S)

**The job.** The page is current when Rory opens it, without his asking.

**What changes.** A scheduled task that runs, on weekdays at about 07:40 and 13:20 UK time (Q2; 13:20 rather than mid-afternoon because runs between 14:00 and 17:00 UK time can be delayed), the refresh procedure, allowed to use Rory's PC for Job Scout and the first records. If the PC cannot be reached, the GitHub projects still refresh and Job Scout's card says "Not refreshed" (O1-3).

**Test cases.**
1. The task exists with the agreed schedule and its approval setting is reported (by hand: the task list).
2. One scheduled run completes and its report matches a refresh on request (by hand: fired once, report in the demo).
3. With the PC unreachable, the other projects still refresh (CI, O1-1 case 7, on the same code).

**Boundaries.** Scheduled runs only read projects and write the dashboard; they never change a project or ask Rory to approve anything.

**Size.** S.

## The sprint as a whole

Order: O1-1 and `src/card.ts` first (tests first), then O1-2's page, then O1-3, then O1-4. About three days. No spike in this sprint: the page type is known, and the refresh only reads. The Sprint 3 unknown (saving answers in the page) becomes a spike in Sprint 2.

**Demo.** The live dashboard itself, plus a demo page with the test results, the refresh report, screenshots at both widths, and one record of each kind of trouble (moved on, refused, missing, not refreshed) shown on a copy, never on the real one.

## Questions for Rory

- **Q1 The page.** (a) Claude's Dashboard type: every figure shows where it came from and how fresh it is, and spend and charts fit it later (recommended); (b) a page built by hand, with more freedom in layout and more for Claude to build and check.
- **Q2 When the refresh runs.** (a) On request ("refresh the overview" in this Project) and on a schedule every weekday at about 07:40, using your PC for Job Scout (recommended: the page is current when you start the day; if the PC is off, the others still refresh); (b) on request only; (c) on request and twice a day.
- **Q3 "Moved on".** (a) Flag a project whose repo or folder has changes more than an hour newer than its record (recommended: it says exactly what it means); (b) flag any record more than three days old, whatever happened.
- **Q4 Card order.** (a) Most things waiting on you first, then most recent activity (recommended: what needs you is at the top); (b) a fixed order you choose.

## Rory's answers (9 November 2026)

- **Q1:** (a). Claude's Dashboard type.
- **Q2:** (c). On request, and on a schedule twice each weekday: about 07:40 and 13:20 UK time.
- **Q3:** (a). "Moved on" when the project's repo or folder has changes more than an hour newer than its record.
- **Q4:** (a). Most things waiting on Rory first, then most recent activity.
