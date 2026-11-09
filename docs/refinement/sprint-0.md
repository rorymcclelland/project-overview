# Sprint 0 refinement: foundations and the status record

Refined 9 November 2026. Status: Ready, all questions answered 9 November 2026.

## What we know

- All four sprint projects already keep sprints in their repos, in similar but not identical shapes. RFI Respond (Sprint 26): `docs/BACKLOG.md` with a section per sprint, `docs/refinement/sprint-N.md` with "Questions for Rory" and "Rory's answers", demo pages in `docs/testing/`. Studio (Sprint 9 of 11): the same pattern, with its roadmap in a Claude doc. The task app: `BACKLOG.md` in phases plus `docs/refinement/sprint-1.md`. Job Scout: a Claude doc mirrored in `docs/BACKLOG.md` (private repo).
- Reading these files directly would mean four slightly different parsers that break whenever a backlog's wording changes. A small, standard status record per project is more reliable and lets each project say its own state (project rule 2).
- The page's data store (`db`) can be written by Claude from any session that has the artifact tools, and read by the page. So the page does not need to reach GitHub itself, which keeps private repos and credentials out of it.

## O0-1 Repository and working setup (S)

**The job.** Give this project the same footing as the others, so every later sprint has somewhere to live, be checked and be reviewed.

**Before and after.** Today: an empty folder. After: a GitHub repo with README, `CLAUDE.md`, `docs/BACKLOG.md`, `docs/DECISIONS.md` (decision 0001: status records, not live GitHub reads), and CI running type check, lint and tests on every push.

**Test cases.**
1. CI passes on a clean push (CI).
2. A deliberate failing test fails CI on a throwaway branch (CI, once, recorded in the review).
3. The secrets check finds nothing in the repo (CI).

**Out of scope.** The page itself (Sprint 1). Hosting: there is none.

**Boundaries.** Rule 4: no secrets; rule 5: fixtures use invented projects only.

**Questions.** Q1.

## O0-2 The status record (M)

**The job.** One small, written format that says where a project stands, so the overview can show every project the same way and refuse anything it cannot trust.

**What it holds (version 1).** Project name and kind (sprint or kanban); current sprint number and title; stage (refining, awaiting Rory's answers, ready, building, awaiting demo sign-off, closed); when that stage began; links (repo, demo, live); items waiting on Rory, each with its type (question, demo sign-off, live deploy approval, account or credential step), text, Claude's recommended answer where there is one, and the date asked; the sprint's stories with size and status; a short history of past sprints (planned, done, returned); when the record was written and by which session. Fields for spend and session counts are left to Sprints 5 and 6, which will add them as version 2.

**What changes.** `schema/status.v1.json`, a checker script, unit tests, and `docs/status-record.md` explaining each field in plain English.

**Test cases.**
1. A complete record for an invented sprint project passes (CI).
2. A complete record for an invented kanban project, with no sprint fields, passes (CI).
3. A missing required field fails, and the message names the field (CI).
4. An unknown stage ("nearly done") fails, listing the allowed stages (CI).
5. A date in the future, or a stage that began after the record was written, fails (CI).
6. A waiting item of type question with no text fails (CI).
7. Text containing HTML or script passes the checker but is marked to be shown as plain text, never run (CI; the page's half is tested in Sprint 1).
8. A record far larger than any real one (over 1 MB) is refused (CI: hostile input).
9. A record of an unknown version is refused with a clear message (CI).

**Out of scope.** Spend and sessions (version 2). Reading the records into the page (Sprint 1).

**Boundaries.** Rule 1: every record carries when it was written, so staleness can always be shown. Rule 2: the record is written by the project's own session.

**Size.** M.

## O0-3 First records for all five projects (M)

**The job.** Give Sprint 1 real data from day one, rather than waiting for each project's next sprint close.

**Before and after.** Today: status is spread across five repos and two Claude docs. After: a checked record for each of RFI Respond, the task app, Job Scout, Studio and the website, written from their current files, each listing what is waiting on Rory today.

**Test cases.**
1. All five records pass the checker (CI).
2. Each record's current sprint and stage match the project's backlog on the day (by hand: a table in the demo comparing record against source, line by line, for Rory to glance at).
3. Every open "Questions for Rory" item without a recorded answer appears as a waiting item, and none that has been answered does (by hand, same table).
4. The website record has no sprint fields and still passes (CI).

**Out of scope.** Keeping them current (O0-4).

**Boundaries.** Rule 3: writing these must not deploy any project (see Q2). Rule 5: Job Scout's record never enters this repo if it is public.

**Risks.** Job Scout's current records are only on Rory's PC, in `C:\Data\Sync\My files\Projects\Job Scout` (Q3): neither GitHub repo nor the backlog Claude doc is up to date. Its first record is written from that folder's `docs/BACKLOG.md` (including its "Waiting on the user" section) and `docs/refinement/`. Until Job Scout commits and pushes again, the overview can refresh it only from a session with that folder connected; Sprint 1's refresh must allow for this.

**Questions.** Q2, Q3.

## O0-4 Projects keep their records up to date (S)

**The job.** Make updating the record part of work that already happens, so it costs Rory nothing and never drifts.

**What changes.** A step added to `sprint-refine` (write the record when a sprint is refined, and again when Rory answers) and to `sprint-close` (write it at close, with the history line). For the website, a line in its agent context: update the record when a change goes live or something waits on Rory. Skill changes are proposed to Rory for review, as the working agreement requires.

**Test cases.**
1. Following the updated sprint-close steps on an invented project produces a record that passes the checker (CI, using a fixture).
2. Rory reviews and saves both skill changes (by hand: Rory, from the review card).

**Out of scope.** Gathering records into the page (Sprint 1).

**Boundaries.** Rule 2.

## The sprint as a whole

Order: O0-1, then O0-2, then O0-3 and O0-4 in either order. Total about two and a half days. No spike: the one real unknown (where records live and how they reach the page) is answered by the research above and by Q2, and nothing here waits on a measurement.

**Demo.** A demo page showing CI results, the checker accepting and refusing the agreed cases, and the five real records side by side with their sources.

**Moved.** The refresh that gathers records into the page moves to Sprint 1, where the page is built, so Sprint 0 stays small.

## Questions for Rory

- **Q1 The repo.** (a) You create an empty public repo `project-overview` on GitHub and give this session push access; your local folder becomes its working copy (recommended: public like your other portfolio projects, and nothing private ever goes in it); (b) the same, but private.
- **Q2 Where the first records live.** Committing a file to RFI Respond, Studio or the website redeploys them, and live changes need your approval each time. (a) The first records are kept here in the overview's private data store, and each project takes over its own record in its repo at its next sprint close, with no extra deploys (recommended); (b) a small change in each repo now, each deploy approved by you; (c) wait for each project's next sprint close, so Sprint 1 starts with gaps.
- **Q3 Job Scout access.** (a) Give this session read access to the private `job-scout` repo (recommended); (b) leave Job Scout out until Sprint 1 and I work from the Claude doc only.

## Rory's answers (9 November 2026)

- **Q1:** (a). A public repo `project-overview`, which Rory creates empty; nothing private goes in it.
- **Q2:** (a). The first records are kept in the overview's private store; each project takes over its own record in its repo at its next sprint close, with no extra deploys.
- **Q3:** Rory asked whether the public `job-scout-demo` repo could be used instead. Checked: it is a release snapshot (0.16.0, 23 October, Sprints 10 and 11) with no backlog or refinement files, so it cannot show the current sprint. The backlog Claude doc can be read from this session but was last updated 14 October (up to the Sprint 9 review), behind the code. Re-asked with new options.
- **Q3 (re-asked):** Job Scout is active. Its private repo was granted read access, but it was last pushed at 0.9.0 on 17 October; the current work is in Rory's private folder `C:\Data\Sync\My files\Projects\Job Scout` (backlog updated 2 November, refinement up to Sprint 11 and an N1 spike), which Rory connected to this session, read only. The record is written from that folder.

## Found during refinement

- **F-1 Job Scout has about three weeks of work not committed to git.** 162 changed files since the 0.9.0 commit of 17 October, so none of Sprints 6 to 11 is in GitHub history. Raised with Rory; fixing it is Job Scout's work, not this project's.
