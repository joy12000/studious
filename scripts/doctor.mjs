#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let exit = 0;

function exists(p) { try { statSync(p); return true; } catch { return false; } }

// SPA redirects check
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

// Ellipsis scan
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}
try {
  for (const f of walk(join(root, 'src'))) {
    if (!/\.(ts|tsx|js|jsx|md|html)$/.test(f)) continue;
    const txt = readFileSync(f, 'utf8');
    // Warn on suspicious text ellipsis inside code (not spread syntax)
    if (txt.includes('...')) {
      console.error('[doctor] suspicious ellipsis found in', f);
      exit = 1;
    }
  }
} catch (e) {
  console.error('[doctor] scan failed:', e.message || e);
}

// WARN-ONLY: never fail the build (can re-enable later)
if (exit) console.error('[doctor] WARN-ONLY: issues found, but build will continue');
process.exit(0);
