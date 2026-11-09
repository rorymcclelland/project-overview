# Sprint 2 review: what is waiting on me

Build on main, 9 November 2026, 116 automated tests, CI green. The demo page is a private artifact; its screenshots show the real dashboard, which is not kept in this public repo.

## O2-1 Update on change

| Case | What was checked | How | Result |
|---|---|---|---|
| 1 | A record written, the dashboard shows it within 10 minutes | By hand | Passed: committed 17:34, refresh started 17:35, shown 17:41 (7 minutes) |
| 2 | Two refreshes a few seconds apart both finish; the dashboard holds the newer | By hand | Passed: both finished; one consistent set of tables at 18:35 |
| 3 | If firing fails, the project's work carries on and says so in one line | By hand: the saved sprint-close skill | Passed: the saved skill says exactly that |
| 4 | Update on change follows the same procedure as the scheduled refresh | CI (`test/update-on-change.test.ts`) | Passed |

Open: **F-5**. The three on-change runs fired while this session was using Rory's PC all fell back to the cloud, so Job Scout read "not refreshed". The 13:30 scheduled run used the PC. To confirm with the 07:41 run on 10 November.

## O2-2 The inbox

| Case | What was checked | How | Result |
|---|---|---|---|
| 1 to 8 | Every item once, order, "waited" wording, the 7-day mark, the type filter, links to cards, markup shown as text, totals match the cards | CI (`test/inbox.test.ts`, `test/page-dom.test.ts`, `test/sprint2-review.test.ts`) | Passed |
| 9 | Readable at full width and about 400 px | By hand: screenshots | Passed: nothing scrolls sideways |

## S2-A Spike: saving answers in the page

Rory pressed Save on the throwaway page at 19:55. The shared and the private save both worked, and a session read both back. The page can also use the store, who is signed in, comments and Rory's connectors. Decision 0003: answers are saved privately to Rory, one document per question, and each project's next session takes them into its refinement file. Sprint 3 is refined against this.

## Independent review

24 mutations tried (14 survived) and hostile rows. 11 findings (T1 to T11): nine fixed with a test each, T6 logged (F-5), T11 left (the checker already refuses duplicate ids).

## Also found

- **F-6** The live dashboard ran an old card script after Sprint 1's review. Fixed: the page now shows a build stamp, so anyone can check it runs what was tested.
