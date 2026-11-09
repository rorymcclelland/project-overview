# Agent context: Project Overview

Read `docs/BACKLOG.md` (rules, decisions, sprints) and the current sprint's `docs/refinement/sprint-N.md` before changing anything.

## How Rory works on this

- The working agreement for all of Rory's build projects is the `build-working-agreement` skill; read it first. Rory is product manager; Claude is lead engineer, QA, UX and researcher.
- Sprints are refined first (agreed test cases), built only after Rory says go, and closed with a demo page. Undelivered items go back to the backlog.
- Agreed test cases are written first and named after their case (`O0-2 case 3`).
- Commit per story, under Rory's name with Claude as co-author. British spelling, no em dashes.

## Rules that are easy to break

- Real status records never go in this repo: it is public, and Job Scout is private. They live in `private/` (ignored) on Rory's PC and in the page's private store.
- The overview reads; it never deploys, merges or edits another project (project rule 3).
- No secrets anywhere; `npm run check:secrets` runs in CI.
- Every text from a record is shown as plain text in the page, never as HTML.

## Where projects keep their records

RFI Respond, Studio and the task app: their GitHub repos (public). Job Scout: Rory's private folder `C:\Data\Sync\My files\Projects\Job Scout`, ahead of its GitHub repo. The website: its repo.
