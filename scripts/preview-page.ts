// Renders the dashboard page outside Claude, for screenshots and checks: a small
// stand-in for the Dashboard type's `dash` object feeds it the refresh's tables.
// node scripts/preview-page.ts --projects <projects.json> --waiting <waiting.json> --out <file.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildCardScript, buildPage } from './build-page.ts';

const { values: a } = parseArgs({ options: { projects: { type: 'string' }, waiting: { type: 'string' }, out: { type: 'string' } } });
if (!a.projects || !a.waiting || !a.out) throw new Error('missing argument');
const page = buildPage();
const data = { projects: JSON.parse(readFileSync(a.projects, 'utf8')), waiting: JSON.parse(readFileSync(a.waiting, 'utf8')) };
const stub = `<script>
const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const calcs = {}; const draws = [];
window.dash = {
  data(id) {
    if (DATA[id]) return { status: 'ok', data: DATA[id] };
    if (calcs[id]) return { status: 'ok', data: calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i])) };
    return { status: 'missing', data: [] };
  },
  calc(id, c) { calcs[id] = c; },
  draw(name, fn) { if (fn) draws.push([name, fn]); else for (const [n, f] of draws) if (n === name) document.querySelectorAll('[data-draw="' + n + '"]').forEach((el) => f(el)); },
  onData(fn) { fn(); },
};
window.addEventListener('DOMContentLoaded', () => {
  for (const [name, fn] of draws) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => fn(el));
  document.body.setAttribute('data-ready', '1');
});
</script>`;
const theme = `<style>
:root { --font-anthropic-sans: system-ui, sans-serif; --font-anthropic-serif: Georgia, serif; --color-fg:#1d1d1b; --color-fg-muted:#6b6a64; --color-bg:#faf9f5; --color-panel:#fff; --color-border-line:#e3e1d9; --color-ok:#2f7d4f; --color-warn:#b7791f; --color-bad:#b3261e;
--cds-font-size-caption:12.5px; --cds-font-size-body:15px; --cds-font-size-heading:17px; --cds-font-size-title:28px; --cds-font-weight-medium:600;
--cds-gap-xs:4px; --cds-gap-sm:8px; --cds-gap-md:14px; --cds-gap-lg:20px; --cds-gap-xl:32px; --cds-pad-sm:6px; --cds-pad-md:10px; --cds-pad-lg:16px; --cds-radius:10px; }
body { margin: 0; background: var(--color-bg); } #dash-root { padding: 20px; }
</style>`;
const cardScript = `<script>${buildCardScript()}</script>`;
const body = page.replace('<script src="card.js"></script>', () => cardScript);
writeFileSync(a.out, `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${theme}${stub}</head><body><div id="dash-root">${body}</div></body></html>`);
console.log(`Wrote ${a.out}`);
