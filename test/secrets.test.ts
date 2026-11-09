// Sprint 0, story O0-1 case 3: the secrets check finds keys and passes clean text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets } from '../scripts/check-secrets.ts';

test('O0-1 case 3: likely secrets are found', () => {
  for (const s of [
    'sk-ant-api03-' + 'a'.repeat(40),
    'ghp_' + 'b'.repeat(36),
    'eyJhbGciOiJIUzI1NiJ9.' + 'c'.repeat(30) + '.' + 'd'.repeat(30),
    'postgres' + '://user:' + 'hunter2hunter2' + '@db.example.com:5432/db',
    '-----BEGIN ' + 'PRIVATE KEY-----',
  ]) assert.ok(findSecrets(s).length > 0, s);
});

test('O0-1 case 3: ordinary text passes', () => {
  assert.deepEqual(findSecrets('A status record says where a project stands. postgres://localhost/test'), []);
});
