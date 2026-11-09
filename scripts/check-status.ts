// Checks status records: node scripts/check-status.ts <file or folder> ...
// With no arguments it checks the test fixtures. Exit code 1 if any record fails.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkRecord } from '../src/checkStatus.ts';

const args = process.argv.slice(2);
const targets = args.length ? args : ['test/fixtures'];
const files = targets.flatMap((t) =>
  statSync(t).isDirectory()
    ? readdirSync(t).filter((f) => f.endsWith('.json')).sort().map((f) => join(t, f))
    : [t],
);

let failed = 0;
for (const file of files) {
  const r = checkRecord(readFileSync(file, 'utf8'));
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${file}`);
  for (const e of r.errors) console.log(`      error:   ${e}`);
  for (const w of r.warnings) console.log(`      warning: ${w}`);
  if (!r.ok) failed++;
}
console.log(`\n${files.length - failed} of ${files.length} records pass.`);
process.exitCode = failed ? 1 : 0;
