#!/usr/bin/env node
import fs from 'fs';
const [,, file, findExpr, replacement] = process.argv;
if (!file || !findExpr) { console.error('usage: node scripts/safe-replace.mjs <file> <findRegExp> <replacement>'); process.exit(1); }
let s = fs.readFileSync(file,'utf8'); const eol = s.includes('\r\n')?'\r\n':'\n';
const norm = x => x.replace(/\r\n/g,'\n').replace(/[\u200B\u00A0]/g,' ');
s = norm(s); const re = new RegExp(findExpr, 'g'); const next = s.replace(re, replacement ?? '');
if (next === s) { console.error('no match'); process.exit(2); }
fs.writeFileSync(file, next.replace(/\n/g,eol), 'utf8'); console.log('ok:', file);
