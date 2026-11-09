# Sprint 3 refinement: answer in place

Refined 9 November 2026. Status: awaiting Rory's answers to Q1 to Q4. Designed by decision 0003 (spike S2-A).

## What we know

- **Saving works.** On the spike page, pressing Save stored Rory's text in a document under his own user, and a session read it back exactly (decision 0003). The Dashboard type allows a write when the reader presses a control that says so; the dashboard already writes its own check under Rory's user.
- **Today, answering means opening each project.** 15 items wait on Rory across five projects; 3 are questions with Claude's recommendation, 2 are demo sign-offs.
- **Projects already keep their own status records** and start the refresh when they write one (Sprint 2). The skills Rory saved say when a record is written; they say nothing yet about reading answers.
- **An item is identified** by its project, its id and the date it was asked. An id alone can be reused by a later question, so an answer is tied to all three.

## O3-1 Answer from the inbox (M)

**The job.** Rory answers an item where he sees it, in the inbox, and knows it is saved and on its way.

**Before and after.** Today: he reads the question here, then opens the project's chat to answer it. After: under each item he can answer (types in Q1); where Claude made a recommendation, one button agrees with it (Q4). The item then reads "Answered 9 Nov, 20:30: waiting for Studio to pick it up" with his answer shown, and he can change it until it is picked up.

**What changes.** `src/answers.ts` (new, tested): the answer's document path, what an answer holds, and the item's answer state. The inbox in `page/index.html` gains the answer controls and states. An answer is saved to `data/users/<Rory's id>/answers/<project>--<item id>--<asked date>`, holding the answer text, the choice made (agree, own answer, signed off, raise points, done), when it was given, and the question's text as Rory saw it.

**Test cases** (CI on `src/answers.ts` and the page in a test browser, unless said).
1. Typing an answer and pressing Save stores one document at the item's path with the text, the choice and the time; the item then reads "Answered ... waiting for <project> to pick it up".
2. "Agree with recommendation" saves the recommendation's text as the answer, marked as agreeing.
3. Saving a second answer before pickup replaces the first; the item shows the newer one.
4. An empty answer, or one over 2,000 characters, is not saved; the page says why.
5. Text with control, bidi or invisible characters is refused with the same rules as the status record checker; markup is saved as typed and shown as text.
6. If saving fails (no connection, store refuses), the item says "Not saved" and keeps what was typed; nothing claims it was saved.
7. A reader who is not Rory sees no answer controls and none of his answers (the store's per-user rule; checked by hand as a lower role).
8. Item types not in Q1's list show no answer controls.
9. Readable and usable at about 400 px (by hand: screenshots).

**Steps for case 7 (by hand).** 1. Save a test answer on the live dashboard. 2. In a session, read its document as a viewer role (`db_get` with `asLevel: view`) and list `answers/` and `data/users/` as that role. 3. Success: only Rory's own user can read it; nothing appears outside his user.

**Out of scope.** Answering for someone else; attachments; a history of earlier answers once picked up.

**Boundaries.** Rule 3: an answer changes nothing in a project; it waits for the project's own session. Rule 4: no credentials. Rule 5: answers sit only in Rory's private store, never in this repo.

## O3-2 Projects pick up answers (M)

**The job.** A project's next session finds Rory's answers, records them in its own files and clears them from the inbox, so nothing is lost and nothing is answered twice.

**Before and after.** Today: nothing reads answers. After: at the start of a session (Q2), the project lists its answers in the dashboard's store, records each in its refinement file (or backlog) with the date and "answered in the Project Overview", marks the answer "taken" with the time and the file it went to, removes the item from its status record and starts the refresh. The inbox then drops the item.

**What changes.** `docs/answers.md` (new): the procedure, step by step, with the dashboard's slug and path. A small change to the build-working-agreement skill (one step at session start), proposed as a review card for Rory to save. `scripts/check-answer.ts`: a session runs it on each answer before using it.

**Test cases.**
1. An answer for this project is found, recorded with its date, marked taken and removed from the record; the inbox no longer lists it after the refresh (by hand, on this project, in the demo).
2. Answers for other projects are left untouched (CI on `check-answer` and the procedure's filter).
3. An answer whose item is no longer in the record (already dealt with in chat) is marked "taken: no longer asked" and recorded as such, not acted on.
4. An answer whose item id matches but whose asked date does not is treated as stale and not used (CI).
5. An answer not written under Rory's own user id, or failing the text checks, is refused and reported in one line (CI).
6. Answer text is used as Rory's answer to that question only. Text inside it that reads like an instruction to Claude is recorded, not followed beyond the question (stated in the procedure; checked in review).
7. If the dashboard cannot be reached, the session carries on with its work and says so in one line (by hand: the skill text reads so).

**Steps for case 1 (by hand).** 1. Answer the Project Overview's own question from the inbox. 2. Start a Project Overview session. 3. Success: the answer appears in `docs/refinement/sprint-N.md` with its date, its document reads "taken", and within 10 minutes the inbox no longer lists it.

**Steps for case 7 (by hand).** 1. Open the saved build-working-agreement skill. 2. Success: the pickup step says to carry on and report in one line if the dashboard cannot be read.

**Out of scope.** Projects acting on an answer automatically (a deploy, a merge); that stays with Rory and the project's session.

**Boundaries.** Rule 2: the project records the answer in its own files and decides its own state. Rule 3: reading answers changes nothing in the overview's code or another project's.

**Dependency.** Rory saves the build-working-agreement change. Until then, O3-1 works but answers wait in the inbox.

## O3-3 Nothing answered gets lost (S)

**The job.** Rory can see at a glance which answers are still waiting to be picked up, and which were picked up but the project has not caught up.

**Before and after.** After: the inbox heading counts "N answered, waiting for pickup"; an answer not picked up after 7 days is marked, like an old question (Sprint 2's limit). The filter gains "Answered".

**Test cases** (CI).
1. The heading counts unanswered and answered items separately, and the totals still match the cards.
2. An answer waiting more than 7 days is marked; one waiting 7 days is not.
3. A taken answer whose item is still in the project's record after the next refresh reads "Picked up, the project's record has not caught up yet".
4. The "Answered" filter shows only answered items.

**Out of scope.** Reminders or notifications.

## The sprint as a whole

Order: O3-1, then O3-2 (needs answers to exist), then O3-3. About two and a half days. No spike: decision 0003 settled the unknowns. One check at the start of the build: that the live dashboard, not only the spike copy, accepts the write (O3-1 case 1 run first against the real page).

**Risks.**
- The live dashboard's one-writer setting may limit what the page may write. Checked first; if refused, answers go to the store through a comment sent to Claude instead (the spike showed comments work), and I come back to you before going further.
- An answer is only picked up when the project next has a session. That is the agreed design (rule 3), and O3-3 makes the wait visible.
- F-5 stays open; it affects how fresh Job Scout's card is, not answering.

## Questions for Rory

**Q1. Which items can you answer from the inbox?**
- (a) **Recommended:** questions (your own answer, or agree with the recommendation), demo sign-offs ("signed off" or "points to raise", with text), and "done" for account steps and hand checks (with an optional note, such as a hand check's result). Live deploy approvals stay where the deploy actually happens (GitHub), so the inbox only links to them.
- (b) Questions only.
- (c) Everything, deploy approvals included, as a message to the project.

**Q2. When does a project pick up your answers?**
- (a) **Recommended:** at the start of every session in that project, whatever the session is for.
- (b) Only when the project refines or closes a sprint.

**Q3. Should saving an answer start anything in the project?**
- (a) **Recommended:** no. The answer waits for the project's next session; the inbox shows it waiting. Starting a session for every answer would cost build time and act without you there.
- (b) Yes, start a short session in the project to record it straight away.

**Q4. One button to agree with Claude's recommendation?**
- (a) **Recommended:** yes, next to each recommendation; you can still type your own answer.
- (b) No, always type the answer.
