// Sprint 0 independent review findings (docs/refinement/sprint-0.md, "Independent review").
// Each test fails on the code as reviewed and names the finding it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRecord } from '../src/checkStatus.ts';

const load = (): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL('./fixtures/sprint-project.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-09T09:00:00Z');
const check = (o: unknown) => checkRecord(JSON.stringify(o), { now: NOW });
const waiting0 = (r: Record<string, unknown>) => (r.waiting as Record<string, unknown>[])[0];
const sprint = (r: Record<string, unknown>) => r.sprint as Record<string, unknown>;
const history0 = (r: Record<string, unknown>) => (r.history as Record<string, unknown>[])[0];

test('R1 (high): deeply nested JSON is refused, not a crash', () => {
  const deep = '['.repeat(5000) + ']'.repeat(5000);
  const base = JSON.stringify(load());
  for (const text of [base.replace('{', `{"extra":${deep},`), base.replace('"stories"', `"nest":${deep},"stories"`)]) {
    const r = checkRecord(text, { now: NOW });
    assert.equal(r.ok, false);
  }
});

test('R2: links that are https in form but unsafe are refused', () => {
  for (const url of [
    'https://github.com@evil.example/',
    'https://user:pass@example.com/',
    'https://ex.com/\u0000',
    'https://ex.com/‮gnp.exe',
    'https://gіthub.com/',          // Cyrillic i
    'https://xn--gthub-n4a.com/',
    'https://x.com/"onmouseover="alert(1)',
    'https://x.com/<script>',
  ]) {
    const rec = load();
    (rec.links as Record<string, unknown>).repo = url;
    const r = check(rec);
    assert.equal(r.ok, false, url);
    assert.match(r.errors.join('\n'), /links\.repo/, url);
  }
});

test('R3: refusal messages never repeat long or hostile input in full', () => {
  const rec = load();
  sprint(rec).stage = '<img src=x onerror=alert(1)>' + 'x'.repeat(5000);
  const msg = check(rec).errors.join('\n');
  assert.ok(msg.length < 400, `message is ${msg.length} characters`);
  assert.doesNotMatch(msg, /<img/);
});

test('R4: text with no visible character is empty', () => {
  for (const text of ['​​', '‍ ﻿']) {
    const rec = load();
    waiting0(rec).text = text;
    assert.match(check(rec).errors.join('\n'), /waiting\[0\]\.text/, JSON.stringify(text));
  }
});

test('R4: control characters, bidi overrides and lone surrogates in text are refused', () => {
  for (const text of ['ring \u0007 bell', 'esc \u001B[31m', 'abc ‮ cba', 'half \uD800 pair']) {
    const rec = load();
    waiting0(rec).text = text;
    const r = check(rec);
    assert.equal(r.ok, false, JSON.stringify(text));
    assert.match(r.errors.join('\n'), /waiting\[0\]\.text/);
  }
  const ok = load();
  waiting0(ok).text = 'Line one\nLine two\twith a tab';
  assert.equal(check(ok).ok, true);
});

test('R6: each kind of markup is flagged, not only script tags', () => {
  for (const text of ['<b>bold</b>', 'see javascript:alert(1)', 'x onclick = "y"', '<img src=x>']) {
    const rec = load();
    waiting0(rec).text = text;
    assert.match(check(rec).warnings.join('\n'), /waiting\[0\]\.text/, text);
  }
});

test('R6: lastActivity and history dates after the record was written are refused', () => {
  const a = load(); a.lastActivity = '2026-11-09';
  assert.match(check(a).errors.join('\n'), /lastActivity/);
  const b = load(); history0(b).closed = '2026-11-09';
  assert.match(check(b).errors.join('\n'), /history\[0\]\.closed/);
});

test('R6: the clock allowance is minutes, not days', () => {
  const rec = load(); rec.writtenAt = '2026-11-09T09:30:00Z';
  assert.match(check(rec).errors.join('\n'), /future/);
  const near = load(); near.writtenAt = '2026-11-09T09:04:00Z';
  assert.equal(check(near).ok, true);
});

test('R6: a date and time without a time zone, or with hour 24, is refused', () => {
  for (const t of ['2026-11-08T17:30:00', '2026-11-08T24:00:00Z', '2026-11-08 17:30:00Z']) {
    const rec = load(); rec.writtenAt = t;
    assert.match(check(rec).errors.join('\n'), /writtenAt/, t);
  }
});

test('R6: history on a kanban project, and more done and returned than planned, are refused', () => {
  const k = JSON.parse(readFileSync(new URL('./fixtures/kanban-project.json', import.meta.url), 'utf8'));
  k.history = load().history;
  assert.match(check(k).errors.join('\n'), /history.*kanban/);
  const rec = load(); history0(rec).done = 5;
  assert.match(check(rec).errors.join('\n'), /more than planned/);
});

test('R6: a __proto__ field is refused on an otherwise valid record', () => {
  const text = JSON.stringify(load()).replace('{', '{"__proto__":{"ok":true},');
  const r = checkRecord(text, { now: NOW });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /__proto__/);
});

test('R10: dates are compared on the record\'s own calendar day, not UTC', () => {
  // Written at 00:30 British Summer Time on 1 July, which is still 30 June in UTC.
  const rec = load();
  rec.writtenAt = '2026-07-01T00:30:00+01:00';
  rec.lastActivity = '2026-07-01';
  sprint(rec).stageSince = '2026-07-01';
  waiting0(rec).askedOn = '2026-07-01';
  history0(rec).refined = '2026-06-28'; history0(rec).closed = '2026-06-30';
  assert.deepEqual(check(rec).errors, []);
});

test('R11: duplicate waiting ids, closed before refined, and very long notes are refused', () => {
  const d = load();
  (d.waiting as unknown[]).push({ ...waiting0(d) });
  assert.match(check(d).errors.join('\n'), /Q1.*more than once/);
  const c = load(); history0(c).closed = '2026-11-01';
  assert.match(check(c).errors.join('\n'), /history\[0\]\.closed.*before/);
  const n = load(); n.notes = 'x'.repeat(3000);
  assert.match(check(n).errors.join('\n'), /notes/);
});

test('R11: a byte-order mark from a Windows editor is accepted', () => {
  assert.equal(checkRecord('﻿' + JSON.stringify(load()), { now: NOW }).ok, true);
});

test('Demo finding: one message per field, and dates in messages stay readable', () => {
  const rec = load(); waiting0(rec).text = '';
  const errs = check(rec).errors.filter((e) => e.startsWith('waiting[0].text'));
  assert.equal(errs.length, 1, errs.join(' | '));
  const f = load(); f.writtenAt = '2026-12-01T00:00:00Z';
  assert.match(check(f).errors.join('\n'), /2026-12-01T00:00:00Z/);
});
