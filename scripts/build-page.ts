// Builds the dashboard's files: page/index.html as it is, and src/card.ts made
// into a plain script that sets window.OverviewCard. The page therefore runs the
// same card logic the tests check (test/page.test.ts compares them).
// node scripts/build-page.ts [--out build/page]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function toScript(file: string): string {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  // One shared scope: imports between the two files become plain references.
  return js.replace(/^import .*$/gm, '').replace(/^export \{\};?\s*$/m, '').replace(/^export /gm, '');
}

/** card.ts and inbox.ts as one plain script, setting window.OverviewCard and window.OverviewInbox. */
export function buildCardScript(): string {
  return `// Built from src/card.ts and src/inbox.ts by scripts/build-page.ts. Do not edit here.\n(() => {\n${toScript('card.ts')}\n${toScript('inbox.ts')}\nwindow.OverviewCard = { toCard, orderCards };\nwindow.OverviewInbox = { toInbox, filterInbox, OVERDUE_DAYS };\n})();\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'build/page';
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'card.js'), buildCardScript());
  writeFileSync(join(out, 'index.html'), readFileSync(new URL('../page/index.html', import.meta.url), 'utf8'));
  console.log(`Built ${out}/index.html and ${out}/card.js`);
}
