# Refreshing the overview

How a session (on request, "refresh the overview", or a scheduled run) brings the dashboard up to date. It only reads projects and only writes the dashboard (project rule 3). It never asks Rory to approve anything.

**The dashboard:** "Project overview", slug `6be65e49-fe04-41e2-a215-9a162dd97ffc`. Its two sources, `datasets/projects` and `datasets/waiting`, are JSON files; each refresh replaces both.

## 1. Run the refresh

**If Rory's PC is connected** (the `device_bash` tool answers), run it there, where Job Scout's folder and the first records are:

```bash
[ -d /tmp/po-sync ] || git clone -q --depth 1 https://github.com/rorymcclelland/project-overview /tmp/po-sync
cd /tmp/po-sync && git pull -q && npm ci --omit=dev -s
node scripts/refresh.ts --projects projects.json \
  --out "$HOME/mnt/Project overview/private/refresh" \
  --previous "$HOME/mnt/Project overview/private/refresh/summary.json" \
  --first "$HOME/mnt/Project overview/private/records" \
  --folder "job-scout=$HOME/mnt/Job Scout" --cache /tmp/po-cache
```

The folders `C:\Data\code\Project overview` and `C:\Data\Sync\My files\Projects\Job Scout` must be connected; if one is missing, ask for it once with `device_request_folder_access`, read only. Then stage `private\refresh\projects.json` and `waiting.json` with `device_stage_files`, and check the staged `projects.json` has the same newest `refreshedAt` as the run just made (a stale copy has been seen before).

**If the PC cannot be reached**, run it in the cloud workspace instead. Job Scout's card will then say it was not refreshed, and the first records carry over unchanged:

```bash
git clone -q --depth 1 https://github.com/rorymcclelland/project-overview /tmp/po && cd /tmp/po && npm ci --omit=dev -s
# previous tables: read_asset each file named by datasets/projects and datasets/waiting (source.url, the id after /_blob/), saved as /tmp/prev-projects.json and /tmp/prev-waiting.json
node scripts/refresh.ts --projects projects.json --out /tmp/refresh \
  --previous-projects /tmp/prev-projects.json --previous-waiting /tmp/prev-waiting.json
```

Never put a refresh's output in the repository: it holds Job Scout's private details.

## 2. Put it in the dashboard

1. `upload_asset` both files to the dashboard (names `projects.json`, `waiting.json`).
2. `db_get` `datasets/projects` and `datasets/waiting` for their versions and current file addresses.
3. One `db_write` with an `update` of each: `source.url` to the new address, `updated` to `{at: <the refresh's time>, by: "Refresh by Claude, from each project's records"}`, `edit` to `{via: "claude", at: <now>}` (the real time, from `date -u +%FT%TZ` just before the write, never a guess), each with its `ifVersion`.
4. `delete_asset` each old file, once nothing names it.

## 3. Report

Say in a few lines what the refresh's report says: each project's source and whether its record changed, any refusal, any project not refreshed. A scheduled run sends this as its summary.
