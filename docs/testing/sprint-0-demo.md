# Sprint 0 review

Build `470e232` on main, 9 November 2026. [The CI run](https://github.com/rorymcclelland/project-overview/actions/runs/42599918641). The demo page, built by `scripts/demo-page.ts` from this build's test run, is a private artifact; it shows the five real records, which are not kept in this public repo.

| Case | What was checked | Result |
|---|---|---|
| O0-1 case 1 | CI passes on a clean push | CI run 42599918641 |
| O0-1 case 2 | A failing test fails CI | CI run 42597400937 on throwaway branch `ci-must-fail` failed on its deliberate test |
| O0-1 case 3 | The secrets check finds keys and passes clean text | Passed (CI) |
| O0-2 cases 1 to 9 | The status record and its checker | Passed (CI) |
| O0-3 cases 1 and 4 | All five real records pass the checker, the website's with no sprint fields | By hand: 5 of 5 pass |
| O0-3 cases 2 and 3 | Each record matches its sources | By hand, and by the independent reviewer (findings R8, R13 fixed) |
| O0-4 case 1 | The guide's worked example passes | Passed (CI) |
| O0-4 case 2 | Rory saves the three skill changes | Waiting on Rory |

Two independent reviews: 21 findings, 20 fixed with a test each (R1 to R11, R13, C1 to C8), 1 logged for Sprint 1 (R12, records age; F-2). 45 automated tests.
