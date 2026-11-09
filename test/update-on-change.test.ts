// Sprint 2, O2-1 case 4: update on change runs the same refresh as the schedule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRecord } from '../src/checkStatus.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TASK = /trig_[A-Za-z0-9]{20,}/;

test('O2-1 case 4: the guide for projects and the refresh procedure name the same on-change task', () => {
  const guide = read('docs/status-record.md').match(TASK)?.[0];
  const procedure = read('docs/refresh.md').match(TASK)?.[0];
  assert.ok(guide, 'docs/status-record.md names the on-change task');
  assert.equal(guide, procedure);
  assert.match(read('docs/status-record.md'), /docs\/refresh\.md|same procedure/);
});

test('O2-1 case 2: the procedure retries once after a version conflict', () => {
  assert.match(read('docs/refresh.md'), /conflict[^.]*read (them|it) again and retry once/i);
});

test('O2-1: the overview keeps its own status record, and it passes the checker', () => {
  const r = checkRecord(read('docs/status.json'));
  assert.deepEqual(r.errors, []);
  const projects = JSON.parse(read('projects.json')) as { id: string }[];
  assert.ok(projects.some((p) => p.id === 'project-overview'));
});

test('O2-1: the procedure loads the PC tools before deciding the PC is out of reach', () => {
  assert.match(read('docs/refresh.md'), /select:mcp__remote-devices__device_bash/);
});
