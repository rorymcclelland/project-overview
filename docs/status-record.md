# The status record

Every project keeps one small file that says where it stands. The overview shows only records that pass the checker, always with when they were written, so a stale record is visible as stale.

Format: `schema/status.v1.json`. Checker: `node scripts/check-status.ts <file>`.

## Where it lives

In each project's repo at `docs/status.json`, written by that project's own sessions (project rule 2). Until a project's next sprint close, its first record is kept on Rory's PC in this repo's ignored `private/records/` folder and in the page's private store, never committed here (Sprint 0, Q2; project rule 5).

## The fields

| Field | What it means | Required |
|---|---|---|
| `version` | Always `1` for this format | Yes |
| `project.id` | Short lower-case name, such as `rfi-respond` | Yes |
| `project.name` | The name Rory knows it by | Yes |
| `project.kind` | `sprint`, or `kanban` for work that goes live item by item (the website) | Yes |
| `writtenAt` | When the record was written, with time zone | Yes |
| `writtenBy` | Which step or session wrote it, such as "sprint-close, RFI Respond session" | Yes |
| `lastActivity` | The last day anything happened on the project | Yes |
| `links` | `repo`, `demo`, `live` and `backlog` links, each https only | Yes (may be empty) |
| `sprint.number` | The current sprint, as the project names it ("26", "N1", "5c") | Sprint projects only |
| `sprint.title` | The sprint's goal in a few words | Sprint projects only |
| `sprint.stage` | One of: `refining`, `awaiting-answers` (questions to Rory open), `ready` (waiting for Rory's go), `building`, `awaiting-signoff` (demo ready), `closed` | Sprint projects only |
| `sprint.stageSince` | The day the sprint reached that stage | Sprint projects only |
| `sprint.stories` | Each story's `id`, `title`, `size` (S, M or L) and `status` as the backlog words it | Sprint projects only |
| `waiting` | Everything waiting on Rory: each with `id`, `type` (`question`, `demo-signoff`, `deploy-approval`, `hand-check` (a test pack only Rory can run) or `account-step` (an account, setting or credential step that only Rory can take)), `text`, Claude's `recommendation` where there is one, `askedOn`, and `source` (the file it came from) | Yes (may be empty) |
| `history` | Past sprints: `sprint`, `title`, `refined`, `closed`, and how many stories were `planned`, `done` and `returned` to the backlog | No |
| `notes` | Anything else worth saying in a sentence | No |

## What the checker refuses

A missing field (named in the message); an unknown stage or type (the allowed ones are listed); a date that is not real, a record written in the future, or any date after the record was written; a waiting item with no text; a link that is not https; any field not in the list above; done plus returned adding up to more than planned; a sprint section on a kanban project, or none on a sprint project; anything that is not a JSON object, or over 1 MB; any version but 1.

It lets through text containing markup, with a warning: the page must always show text as plain text, never run it.

## Writing a record

At each of these moments, the project's session writes `docs/status.json` and runs the checker on it before committing:

1. **Sprint refined:** stage `awaiting-answers` if questions are open, otherwise `ready`; each open question becomes a waiting item with Claude's recommendation.
2. **Rory answers:** answered questions leave `waiting`; stage becomes `ready`.
3. **Rory says go:** stage `building`.
4. **Demo published:** stage `awaiting-signoff`, with a `demo-signoff` waiting item and the demo link.
5. **Sprint closed:** stage `closed`, a history line added, and any live deploy awaiting approval as a `deploy-approval` item.

For a kanban project, update the record when a change goes live or something starts waiting on Rory.

**Then update the dashboard (agreed 9 November 2026, Sprint 2).** After committing a record, start the on-change refresh: fire the scheduled task "Project overview refresh (on change)", `trig_0198hB2JNRJQ4ReGzb8Uu7id`, with `fire_trigger`. It runs the same procedure as the daily refreshes (`docs/refresh.md`) on Rory's PC, and the dashboard shows the new record within minutes. If firing fails, say so in one line and carry on: the project's own work does not depend on it.

Worked example (checked by the tests, so it stays correct):

<!-- example:start -->
```json
{
  "version": 1,
  "project": { "id": "lantern", "name": "Lantern (invented)", "kind": "sprint" },
  "writtenAt": "2026-11-08T17:30:00Z",
  "writtenBy": "sprint-close, Lantern session",
  "lastActivity": "2026-11-08",
  "links": { "repo": "https://github.com/example/lantern", "demo": "https://example.com/lantern/sprint-3-demo" },
  "sprint": {
    "number": "3",
    "title": "Sign-in",
    "stage": "closed",
    "stageSince": "2026-11-08",
    "stories": [
      { "id": "S3-1", "title": "Email sign-in", "size": "M", "status": "Done, Sprint 3" },
      { "id": "S3-2", "title": "Password reset", "size": "S", "status": "Returned to backlog" }
    ]
  },
  "waiting": [
    { "id": "D3", "type": "deploy-approval", "text": "Sprint 3 is signed off and ready to go live.", "recommendation": "Approve: all agreed cases passed.", "askedOn": "2026-11-08" }
  ],
  "history": [
    { "sprint": "3", "title": "Sign-in", "refined": "2026-11-05", "closed": "2026-11-08", "planned": 2, "done": 1, "returned": 1 }
  ]
}
```
<!-- example:end -->
