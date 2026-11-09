// Second independent review (re-check of the R-fixes), findings C1 to C8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRecord } from '../src/checkStatus.ts';
import { findSecrets } from '../scripts/check-secrets.ts';

const load = (): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL('./fixtures/sprint-project.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-09T09:00:00Z');
const check = (o: unknown) => checkRecord(JSON.stringify(o), { now: NOW });
const evil = '<img src=x onerror=alert(1)>' + 'y'.repeat(300);
const clean = (msgs: string[]) => {
  const all = msgs.join('\n');
  assert.doesNotMatch(all, /<img/);
  assert.ok(msgs.every((m) => m.length < 400), 'a message is too long');
};

test('C1: no message repeats hostile input, whatever the path', () => {
  const a = load(); a[evil] = 1; clean(check(a).errors);
  const b = load(); (b.links as Record<string, unknown>)[evil] = 'https://x.com'; clean(check(b).errors);
  const c = load(); (c.history as Record<string, unknown>[])[0].closed = evil; clean(check(c).errors);
  const d = load(); (d.waiting as Record<string, unknown>[]).push({ ...(d.waiting as Record<string, unknown>[])[0], id: evil });
  (d.waiting as Record<string, unknown>[])[0].id = evil; clean(check(d).errors);
  const e = load(); const st = (e.sprint as { stories: Record<string, unknown>[] }).stories;
  st[0].id = evil; st[1].id = evil; clean(check(e).errors);
});

test('C2: text made only of invisible characters is empty; tag characters are refused', () => {
  for (const t of ['­', 'ㅤ', 'ᅟ', 'ﾠ', '⁡', '͏']) {
    const r = load(); (r.waiting as Record<string, unknown>[])[0].text = t;
    assert.match(check(r).errors.join('\n'), /waiting\[0\]\.text/, `U+${t.codePointAt(0)!.toString(16)}`);
  }
  const r = load(); (r.waiting as Record<string, unknown>[])[0].text = 'Approve this' + String.fromCodePoint(0xe0041, 0xe0042);
  assert.match(check(r).errors.join('\n'), /waiting\[0\]\.text/);
});

test('C3: the depth limit, the __proto__ refusal, refined dates and duplicate stories each have their own test', () => {
  const deep = JSON.stringify(load()).replace('{', `{"x":${'['.repeat(20)}${']'.repeat(20)},`);
  assert.match(checkRecord(deep, { now: NOW }).errors.join('\n'), /nested more than/);
  const p = JSON.stringify(load()).replace('{', '{"__proto__":{"ok":true},');
  assert.match(checkRecord(p, { now: NOW }).errors.join('\n'), /"__proto__" field, which is not allowed/);
  const h = load(); (h.history as Record<string, unknown>[])[0].refined = '2026-11-09';
  (h.history as Record<string, unknown>[])[0].closed = '2026-11-09';
  assert.match(check(h).errors.join('\n'), /history\[0\]\.refined/);
  const s = load(); const st = (s.sprint as { stories: Record<string, unknown>[] }).stories; st[1].id = st[0].id as string;
  assert.match(check(s).errors.join('\n'), /S4-1 appears more than once/);
});

test('C4: more secret shapes are found', () => {
  for (const s of [
    'PASSWORD=' + 'hunter2hunter2', 'api_key: ' + 'abcd1234efgh5678', 'token: ' + 'abcd1234efgh5678ijkl',
    'aws_secret_access_key = ' + 'A'.repeat(40), 'https://hooks.slack.com/' + 'services/T000/B000/' + 'x'.repeat(24),
    'AIza' + 'Sy' + 'A'.repeat(32) + '-', 'vc' + 'p_' + 'a'.repeat(30),
  ]) assert.ok(findSecrets(s).length > 0, s);
  assert.deepEqual(findSecrets('password: see your password manager'), []);
});

test('C5: a time zone beyond +14:00 or -12:00 is refused', () => {
  for (const t of ['2026-11-08T17:30:00+23:00', '2026-11-08T17:30:00-13:00']) {
    const r = load(); r.writtenAt = t;
    assert.match(check(r).errors.join('\n'), /writtenAt/, t);
  }
  const ok = load(); ok.writtenAt = '2026-11-09T21:30:00+13:00'; // still 08:30 UTC
  ok.lastActivity = '2026-11-09';
  assert.deepEqual(check(ok).errors, []);
});

test('C6: links with impossible ports or hosts are refused', () => {
  for (const u of ['https://x.com:99999/', 'https://./', 'https://-/', 'https://a..b/']) {
    const r = load(); (r.links as Record<string, unknown>).repo = u;
    assert.match(check(r).errors.join('\n'), /links\.repo/, u);
  }
});

test('C7: disguised script and data links are flagged as markup', () => {
  for (const t of ['java\tscript:x', 'java&#115;cript:x', 'data:text/html,hi']) {
    const r = load(); (r.waiting as Record<string, unknown>[])[0].text = t;
    const out = check(r);
    assert.ok(!out.ok || /plain text/.test(out.warnings.join('\n')), t);
  }
});

test('C8: a record with thousands of problems gives a short list, not thousands of messages', () => {
  const r = load();
  for (let i = 0; i < 5000; i++) r[`f${i}`] = i;
  const errs = check(r).errors;
  assert.ok(errs.length <= 51, `${errs.length} messages`);
  assert.match(errs.at(-1)!, /more problem/);
});
