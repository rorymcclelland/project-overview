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

## Sprint 0: foundations and the status record (refined 9 November 2026; built 9 November 2026, awaiting Rory's sign-off)

Refinement: `docs/refinement/sprint-0.md`. Demo: `docs/testing/sprint-0-demo.md`. O0-4's skill changes wait on Rory saving them.

| ID | Story | Acceptance criteria (summary) | Size | Status |
|---|---|---|---|---|
| O0-1 | Repository and working setup | GitHub repo, README, agent context, decision log, CI running checks on every push | S | Built, Sprint 0: awaiting sign-off |
| O0-2 | The status record | One written, versioned format every project uses for its status; a checker that accepts good records and explains bad ones | M | Built, Sprint 0: awaiting sign-off |
| O0-3 | First records for all five projects | A checked status record for each project, written from its current backlog and refinement files | M | Built, Sprint 0: awaiting sign-off |
| O0-4 | Projects keep their records up to date | sprint-refine and sprint-close write the record; the website gets a lighter equivalent; proposed to Rory as skill changes | S | Built, Sprint 0: awaiting sign-off |

## Found during refinement

| ID | Item | Now |
|---|---|---|
| F-1 | Job Scout's work since 17 October is not committed to git (162 changed files) | Raised with Rory; Job Scout's own work |
| F-2 | Current status sits on sprint branches, not `main`: RFI Respond's on `sprint-26`, Studio's on `sprint-9-close`. A refresh that reads `main` would show stale states | Found writing the first records (O0-3); Sprint 1, for the refresh's refinement |
| F-3 | Some current sources are not on GitHub at all: Job Scout's private folder, and possibly the task app's local copy (`C:\Data\code\task-manager`, not read) | Found in O0-3; Sprint 1, for the refresh's refinement |
| F-4 | Waiting items include test packs only Rory can run; added a `hand-check` type to the format | Done, Sprint 0 (O0-3) |

## Later sprints (one line each; refined just in time)

| Sprint | Goal |
|---|---|
| 1 | One view I can trust: every project on one page (sprint, stage, last activity, links), website as a lighter card; a refresh that gathers the records into the page |
| 2 | What is waiting on me: one inbox of open questions, demos awaiting sign-off and live deploys awaiting approval, oldest first |
| 3 | Answer in place: answer a question here; the project's next session records it in its refinement file |
| 4 | Progress charts: stories done per sprint, items carried over, burn-up towards each goal |
| 5 | Spend, running costs: AI API usage and hosting per project, monthly forecast |
| 6 | Spend, build cost and budgets: Claude plan split by sessions, cost per sprint, budgets with warnings |
| 7 | Hardening and hand-over: adding a project quickly, user guide, independent QA and security reviews |
