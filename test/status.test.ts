// Sprint 0, story O0-2: the agreed test cases (docs/refinement/sprint-0.md).
// Each test names the case it checks, e.g. "O0-2 case 3".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRecord, MAX_RECORD_BYTES } from '../src/checkStatus.ts';

const load = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const asText = (o: unknown) => JSON.stringify(o);
// A fixed "now" so the date checks do not depend on when the tests run.
const NOW = new Date('2026-11-09T09:00:00Z');
const check = (o: unknown) => checkRecord(asText(o), { now: NOW });

test('O0-2 case 1: a complete record for a sprint project passes', () => {
  const r = check(load('sprint-project.json'));
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('O0-2 case 2: a complete record for a kanban project, with no sprint fields, passes', () => {
  const r = check(load('kanban-project.json'));
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('O0-2 case 2 (edge): a kanban record that includes sprint fields fails', () => {
  const rec = load('kanban-project.json');
  rec.sprint = load('sprint-project.json').sprint;
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /kanban/i);
});

test('O0-2 case 2 (edge): a sprint record with no sprint section fails', () => {
  const rec = load('sprint-project.json');
  delete rec.sprint;
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /sprint/);
});

test('O0-2 case 3: a missing required field fails, and the message names the field', () => {
  for (const field of ['writtenAt', 'lastActivity', 'project']) {
    const rec = load('sprint-project.json');
    delete rec[field];
    const r = check(rec);
    assert.equal(r.ok, false, field);
    assert.match(r.errors.join('\n'), new RegExp(field), field);
  }
  const rec = load('sprint-project.json');
  delete (rec.sprint as Record<string, unknown>).stage;
  assert.match(check(rec).errors.join('\n'), /sprint\.stage/);
});

test('O0-2 case 4: an unknown stage fails, listing the allowed stages', () => {
  const rec = load('sprint-project.json');
  (rec.sprint as Record<string, unknown>).stage = 'nearly done';
  const r = check(rec);
  assert.equal(r.ok, false);
  const msg = r.errors.join('\n');
  assert.match(msg, /nearly done/);
  for (const s of ['refining', 'awaiting-answers', 'ready', 'building', 'awaiting-signoff', 'closed']) {
    assert.match(msg, new RegExp(s));
  }
});

test('O0-2 case 5: a record written in the future fails', () => {
  const rec = load('sprint-project.json');
  rec.writtenAt = '2026-12-01T00:00:00Z';
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /writtenAt.*future/);
});

test('O0-2 case 5: a stage that began after the record was written fails', () => {
  const rec = load('sprint-project.json');
  (rec.sprint as Record<string, unknown>).stageSince = '2026-11-09';
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /stageSince/);
});

test('O0-2 case 5 (edge): a question asked after the record was written fails', () => {
  const rec = load('sprint-project.json');
  (rec.waiting as Record<string, unknown>[])[0].askedOn = '2026-11-20';
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /waiting\[0\]\.askedOn/);
});

test('O0-2 case 5 (edge): an impossible date fails', () => {
  const rec = load('sprint-project.json');
  rec.lastActivity = '2026-02-30';
  assert.equal(check(rec).ok, false);
});

test('O0-2 case 6: a waiting question with no text fails', () => {
  for (const text of [undefined, '', '   ']) {
    const rec = load('sprint-project.json');
    const item = (rec.waiting as Record<string, unknown>[])[0];
    if (text === undefined) delete item.text; else item.text = text;
    const r = check(rec);
    assert.equal(r.ok, false, JSON.stringify(text));
    assert.match(r.errors.join('\n'), /waiting\[0\]\.text/);
  }
});

test('O0-2 case 4 (types): every waiting type is accepted, and an unknown one is refused with the list', () => {
  for (const type of ['question', 'demo-signoff', 'deploy-approval', 'hand-check', 'account-step']) {
    const rec = load('sprint-project.json');
    (rec.waiting as Record<string, unknown>[])[0].type = type;
    assert.equal(check(rec).ok, true, type);
  }
  const rec = load('sprint-project.json');
  (rec.waiting as Record<string, unknown>[])[0].type = 'chore';
  assert.match(check(rec).errors.join('\n'), /hand-check/);
});

test('O0-2 case 7: text with HTML or script passes, but is flagged to be shown as plain text', () => {
  const rec = load('sprint-project.json');
  (rec.waiting as Record<string, unknown>[])[0].text = 'Approve <script>alert(1)</script> <img src=x onerror=alert(2)>?';
  const r = check(rec);
  assert.equal(r.ok, true);
  assert.match(r.warnings.join('\n'), /waiting\[0\]\.text.*plain text/);
});

test('O0-2 case 8: a record over 1 MB is refused before it is read', () => {
  const rec = load('sprint-project.json');
  rec.notes = 'x'.repeat(MAX_RECORD_BYTES);
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /too large/i);
});

test('O0-2 case 8 (hostile): text that is not JSON, or not an object, is refused clearly', () => {
  for (const bad of ['not json', '[]', 'null', '"a string"', '{"__proto__": {"ok": true}}']) {
    const r = checkRecord(bad, { now: NOW });
    assert.equal(r.ok, false, bad);
    assert.ok(r.errors.length > 0, bad);
  }
});

test('O0-2 case 8 (hostile): a link that is not https is refused', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'data:text/html,hi']) {
    const rec = load('sprint-project.json');
    (rec.links as Record<string, unknown>).demo = url;
    const r = check(rec);
    assert.equal(r.ok, false, url);
    assert.match(r.errors.join('\n'), /links\.demo/, url);
  }
});

test('O0-2 case 8 (hostile): unexpected fields are refused, not silently kept', () => {
  const rec = load('sprint-project.json');
  rec.status = 'all fine';
  const r = check(rec);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /status/);
});

test('O0-2 case 9: a record of an unknown version is refused with a clear message', () => {
  for (const version of [2, 0, '1', undefined]) {
    const rec = load('sprint-project.json');
    if (version === undefined) delete rec.version; else rec.version = version;
    const r = check(rec);
    assert.equal(r.ok, false, String(version));
    assert.match(r.errors.join('\n'), /version/i, String(version));
  }
});
