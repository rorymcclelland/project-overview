# Decision log

## 0001 Status records, not live reads of GitHub (9 November 2026)

**Context.** The overview must show five projects whose sprint records sit in four slightly different shapes, one only on Rory's PC, one in a private repo.

**Decision.** Each project keeps a small standard status record (`schema/status.v1.json`), written by its own sprint-refine and sprint-close steps. The overview gathers records into the page's private store; it never reads GitHub from the page.

**Why.** One format instead of four fragile parsers; each project states its own status; no credentials in the page; private projects stay private. The cost: a record is only as fresh as the project's last session, which is when status changes anyway, and every record carries when it was written.

**Agreed by** Rory, Sprint 0 refinement.

## 0002 First records kept here until each project's next close (9 November 2026)

**Decision.** The first record for each project is written by this project and kept privately (Rory's PC and the page's store). Each project takes over its own record at its next sprint close. Adding a file to a project now would redeploy it, which needs Rory's approval each time.

**Agreed by** Rory, Sprint 0, Q2.

## 0003 Answers are saved in the page, privately to Rory (9 November 2026)

**Context.** Sprint 3 ("answer in place") needs the dashboard to keep what Rory types and a project's session to read it back. Spike S2-A tried this on a throwaway copy of the dashboard, never the real one.

**What ran.** Rory opened the spike page, typed a test answer and pressed Save at 19:55. The page wrote it twice: once to a shared document (`answers/shared-test`) and once to a document under Rory's own user (`data/users/<id>/answer-test`). This session then read both back.

**What was seen.**
- Both saves succeeded first time, and a session read both back exactly as typed.
- The page can use: the store (read, write, update, watch), who is signed in, comments (including sending a comment to Claude), and Rory's connectors (`claude.use("mcp")`). It cannot change the artifact itself.
- The shared document is readable by anyone the dashboard is shared with. The per-user document belongs to Rory.
- Each save raises the document's version number; a second save to the same document replaces the first.

**Decision.** In Sprint 3, each answer is saved as its own document under Rory's user, one per question, holding the answer, when it was given and the question's id and project. A project's session reads answers for its own project at the start of its next session, records them in its refinement file, and marks them "taken". A second answer to the same question replaces the first until it is taken; after that it is shown as a new answer. Answers are never written to a shared document.

**Not tried.** Two people answering (only Rory uses it); answers while offline. Neither is needed for Sprint 3.

**Also found.** The page can call Rory's connectors itself. That makes O-L1 (live from GitHub) simpler: once the GitHub connector is connected, the page could read records directly, without a refresh.

**Agreed by** Rory, at the Sprint 2 review (pending).
