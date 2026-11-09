// Fails if a tracked file looks like it holds a secret (project rule 4).
// Run in CI over every file git tracks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATTERNS: [string, RegExp][] = [
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe key', /\b[sr]k_live_[A-Za-z0-9]{20,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['Vercel token', /\bvc[a-z]?_[A-Za-z0-9]{24,}/],
  ['address with a password', /\b(redis|rediss|amqp|https?|ftp):\/\/[^\s:/@]*:[^\s@/]{6,}@/],
  ['password in plain text', /\b(password|passwd|secret|api_?key)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{30,}/],
  ['JSON web token', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['database address with a password', /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s:/@]+:[^\s@]{6,}@/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
];

export function findSecrets(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The test file builds fake secrets on purpose, from pieces, so it never matches itself.
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  let found = 0;
  for (const f of files) {
    if (f === 'package-lock.json') continue;
    const hits = findSecrets(readFileSync(f, 'utf8'));
    for (const h of hits) {
      console.log(`${f}: looks like a ${h}`);
      found++;
    }
  }
  console.log(found ? `\n${found} possible secret(s) found.` : `No secrets found in ${files.length} files.`);
  process.exitCode = found ? 1 : 0;
}
