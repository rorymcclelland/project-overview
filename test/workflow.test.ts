// Sprint 0, story O0-4 case 1: a record made by following the updated
// sprint-close steps (docs/status-record.md, "Writing a record") passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRecord } from '../src/checkStatus.ts';

test('O0-4 case 1: the worked example in the guide passes the checker', () => {
  const guide = readFileSync(new URL('../docs/status-record.md', import.meta.url), 'utf8');
  const m = guide.match(/<!-- example:start -->\s*```json\n([\s\S]*?)```\s*<!-- example:end -->/);
  assert.ok(m, 'the guide has a worked example between example markers');
  const r = checkRecord(m[1], { now: new Date('2026-11-09T09:00:00Z') });
  assert.deepEqual(r.errors, []);
});
