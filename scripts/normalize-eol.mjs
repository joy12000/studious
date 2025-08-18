#!/usr/bin/env node
import fs from 'fs'; import { execSync } from 'child_process';
function listFiles(){ try{ return execSync('git ls-files',{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);}catch{return fs.readdirSync('.',{withFileTypes:true}).filter(d=>d.isFile()).map(d=>d.name);}}
const targets = process.argv.slice(2).length? process.argv.slice(2): listFiles();
let changed=0; for(const f of targets){ try{ const txt=fs.readFileSync(f,'utf8'); if(txt.includes('\r\n')){ fs.writeFileSync(f, txt.replace(/\r\n/g,'\n'),'utf8'); console.log('LF:',f); changed++; } } catch{} }
console.log(`Done. changed=${changed}`);
