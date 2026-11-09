# Decision log

## 0001 Status records, not live reads of GitHub (9 November 2026)

**Context.** The overview must show five projects whose sprint records sit in four slightly different shapes, one only on Rory's PC, one in a private repo.

**Decision.** Each project keeps a small standard status record (`schema/status.v1.json`), written by its own sprint-refine and sprint-close steps. The overview gathers records into the page's private store; it never reads GitHub from the page.

**Why.** One format instead of four fragile parsers; each project states its own status; no credentials in the page; private projects stay private. The cost: a record is only as fresh as the project's last session, which is when status changes anyway, and every record carries when it was written.

**Agreed by** Rory, Sprint 0 refinement.

## 0002 First records kept here until each project's next close (9 November 2026)

**Decision.** The first record for each project is written by this project and kept privately (Rory's PC and the page's store). Each project takes over its own record at its next sprint close. Adding a file to a project now would redeploy it, which needs Rory's approval each time.

**Agreed by** Rory, Sprint 0, Q2.
