# Sprint 1 review

Build `5a9faee` on main, 9 November 2026. [The CI run](https://github.com/rorymcclelland/project-overview/actions/runs/42606537810). The demo page is a private artifact; it shows the real dashboard, which is not kept in this public repo.

| Case | What was checked | Result |
|---|---|---|
| O1-1 cases 1 to 9 | The refresh, on local stand-in repos and folders | Passed (CI) |
| O1-1 case 10 | A real refresh of the five projects into the dashboard | By hand: 9 November 11:07, all five read |
| O1-2 cases 1 to 5, 8 | What each card says; the page run in a test browser | Passed (CI) |
| O1-2 case 6 | Full width and about 400 px | By hand: screenshots in the demo |
| O1-2 case 7 | Every figure marked with its source | Waits for Rory to open the dashboard, which checks itself |
| O1-3 cases 1 to 5 | Record age and the four warnings | Passed (CI) |
| O1-4 case 1 | Two weekday tasks, 07:41 and 13:19, on Rory's PC | By hand: created |
| O1-4 case 2 | One scheduled run | By hand: fired 10:55, dashboard updated 10:57, old files removed |
| O1-4 case 3 | Without Rory's PC, the GitHub projects still refresh | Passed (CI) |

Independent review: 13 findings (1 high, 4 medium, 8 low), all fixed with a test each (S1 to S13). One more found in the demo (an empty line on a card without a record), fixed. 90 automated tests.
