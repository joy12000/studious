#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

let exit = 0;

function exists(p) { try { statSync(p); return true; } catch { return false; } }

// 1) SPA redirects check
const redirects = join(root, 'public', '_redirects');
if (!exists(redirects)) {
  console.error('[doctor] missing public/_redirects');
  exit = 1;
} else {
  const body = readFileSync(redirects, 'utf8');
  if (!body.includes('/* /index.html 200')) {
    console.error('[doctor] public/_redirects must contain: /* /index.html 200');
    exit = 1;
  }
}

// 2) Ellipsis "..." accidental truncation scan
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}
for (const f of walk(join(root, 'src'))) {
  if (!/\.(ts|tsx|js|jsx|md|html)$/.test(f)) continue;
  const txt = readFileSync(f, 'utf8');
  if (txt.includes('...')) {
    console.error('[doctor] suspicious ellipsis found in', f);
    exit = 1;
  }
}

process.exit(exit);

const STRICT = process.env.DOCTOR_STRICT === '1';
if (STRICT && exit) {
  process.exit(exit);
} else {
  if (exit) console.error('[doctor] WARN-ONLY mode: issues found but not failing the build');
  process.exit(0);
}
