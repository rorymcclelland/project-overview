# Project Overview: backlog

Started 9 November 2026. One private page in Claude where Rory sees, for every build project, where it stands at sprint level, what is waiting on him, progress over time and what it costs, and answers sprint planning questions in one place.

Way of working: the `build-working-agreement` skill. Rory is product manager; Claude is lead engineer, QA, UX and researcher. Each sprint is refined before it starts (`docs/refinement/sprint-N.md`) and closed with a demo; anything not delivered comes back here and the backlog is re-ranked.

## Project rules (checked against every story)

1. **Honesty.** The overview shows only what a project's own records say, with when they were last updated. It never invents a status, figure or forecast basis, and says plainly when a record is missing or stale.
2. **Projects own their status.** Each project's status comes from that project's own records, written as part of its own sprint work. The overview reads; it does not decide a project's state.
3. **Nothing changes a live project from here.** The overview never deploys, merges or edits another project's code. Answers given here reach a project only through that project's own next session.
4. **No secrets.** No keys or credentials in the page, its data store or this repo. Spend figures come through connectors Rory has already authorised.
5. **Private stays private.** Job Scout's repo is private; its details appear only in the private page, never in this repo's fixtures or docs.

## Decisions (Rory, 9 November 2026)

Projects: RFI Respond, the task app, Job Scout, Studio (all on sprints) and the website (kanban, lighter card). Spend: AI API usage, hosting plans, and Claude build time as the plan fee split by share of sessions; monthly forecast, budget per project with warnings, cost per sprint. Separate from the task app. Delivered as a Claude artifact with its own data store. Sprints close with a demo page. Hosting split rule settled at Sprint 5 refinement; budgets asked at Sprint 6 refinement.

## Sprint 0: foundations and the status record (closed 9 November 2026, signed off by Rory)

Refinement: `docs/refinement/sprint-0.md`. Demo: `docs/testing/sprint-0-demo.md`.

| ID | Story | Acceptance criteria (summary) | Size | Status |
|---|---|---|---|---|
| O0-1 | Repository and working setup | GitHub repo, README, agent context, decision log, CI running checks on every push | S | Done, Sprint 0 |
| O0-2 | The status record | One written, versioned format every project uses for its status; a checker that accepts good records and explains bad ones | M | Done, Sprint 0 |
| O0-3 | First records for all five projects | A checked status record for each project, written from its current backlog and refinement files | M | Done, Sprint 0 |
| O0-4 | Projects keep their records up to date | sprint-refine and sprint-close write the record; the website gets a lighter equivalent; proposed to Rory as skill changes | S | Done, Sprint 0. Residual: the three skill changes take effect once Rory saves them from their review cards |

### Sprint 0 review (9 November 2026)

**Checks, with evidence.** CI green on GitHub (run 42599918641, build `470e232`); 45 automated tests; a deliberately failing test failed CI (run 42597400937). All five first records pass the checker, by hand (they are private). Two independent reviews: 21 findings, 20 fixed with a test each, R12 logged (records age; Sprint 1). Demo page published as a private artifact; Rory signed off on 9 November and deleted the throwaway branch.

**All four stories Done, Sprint 0.** O0-4 carries a residual: the skill changes work once Rory saves them. Nothing returned.

**Proposed for Sprint 1** (re-ranked at the close): the refresh (handles F-2, F-3 and R12), the page, and showing missing, refused and out-of-date records plainly. Spend, charts and answering stay in their planned sprints.

## Found during refinement

| ID | Item | Now |
|---|---|---|
| F-1 | Job Scout's work since 17 October is not committed to git (162 changed files) | Raised with Rory; Job Scout's own work |
| F-2 | Current status sits on sprint branches, not `main`: RFI Respond's on `sprint-26`, Studio's on `sprint-9-close`. A refresh that reads `main` would show stale states | Found writing the first records (O0-3); folded into O1-1, Sprint 1 |
| F-3 | Some current sources are not on GitHub at all: Job Scout's private folder, and possibly the task app's local copy (`C:\Data\code\task-manager`, not read) | Found in O0-3; folded into O1-1, Sprint 1 |
| R12 | A record ages as soon as its project moves on | Sprint 0 review; folded into O1-3, Sprint 1 |
| F-4 | Waiting items include test packs only Rory can run; added a `hand-check` type to the format | Done, Sprint 0 (O0-3) |

## Sprint 1: one view I can trust (refined and built 9 November 2026, awaiting Rory's sign-off)

Refinement: `docs/refinement/sprint-1.md`. Demo: `docs/testing/sprint-1-demo.md`. Dashboard: the private artifact "Project overview"; refresh: `docs/refresh.md`.

| ID | Story | Acceptance criteria (summary) | Size | Status |
|---|---|---|---|---|
| O1-1 | The refresh | Gathers each project's newest record from wherever it lives (any branch, Rory's PC, or the first records), checks it, and puts it in the page; folds in F-2 and F-3 | M | Built, Sprint 1: awaiting sign-off |
| O1-2 | The page | A private dashboard with one card per project: sprint, stage and since when, last activity, links, how many things wait on Rory; the website as a lighter card | M | Built, Sprint 1: awaiting sign-off |
| O1-3 | Nothing stale passes as current | Every card says how old its record is and flags a project that has moved on since; a missing or refused record is shown as such, with the reason; folds in R12 | S | Built, Sprint 1: awaiting sign-off |
| O1-4 | Refresh without asking | The refresh runs on a schedule as well as on request | S | Built, Sprint 1: awaiting sign-off |

## Later sprints (one line each; refined just in time)

| Sprint | Goal |
|---|---|
| 2 | What is waiting on me: one inbox of open questions, demos awaiting sign-off and live deploys awaiting approval, oldest first |
| 3 | Answer in place: answer a question here; the project's next session records it in its refinement file |
| 4 | Progress charts: stories done per sprint, items carried over, burn-up towards each goal |
| 5 | Spend, running costs: AI API usage and hosting per project, monthly forecast |
| 6 | Spend, build cost and budgets: Claude plan split by sessions, cost per sprint, budgets with warnings |
| 7 | Hardening and hand-over: adding a project quickly, user guide, independent QA and security reviews |
