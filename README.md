# Project Overview

One private page in Claude where Rory sees, for each of his build projects, where it stands at sprint level, what is waiting on him, how it is progressing and what it costs, and answers sprint planning questions in one place.

**Status: Sprint 0 of 8 (foundations and the status record).** What works today: the status record format every project will use (`schema/status.v1.json`, explained in `docs/status-record.md`) and a checker that accepts good records and explains bad ones. The page itself arrives in Sprint 1.

## How it works

Each project keeps a small status record, written by its own sprint sessions. The overview gathers those records into the page's private store and shows them; it never reads GitHub live and never changes a project (decision 0001).

## Running the checks

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run check:records -- path/to/status.json   # check a record
npm run check:secrets
```

Node 22.18 or later (TypeScript runs directly).

## Where things are

- `docs/BACKLOG.md`: project rules, decisions and sprints
- `docs/refinement/`: each sprint's stories, agreed test cases and answers
- `docs/DECISIONS.md`: decision log
- `docs/status-record.md`: the status record, field by field
- `schema/`, `src/`, `scripts/`, `test/`: the format, the checker and its tests
