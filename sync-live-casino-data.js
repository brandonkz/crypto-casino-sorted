#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const syncPairs = [
  [path.join(root, 'crypto-casinos', 'site', 'data', 'deposits-all.csv'), path.join(root, 'data', 'deposits-all.csv')],
  [path.join(root, 'crypto-casinos', 'site', 'data', 'gambler-pnl.json'), path.join(root, 'data', 'gambler-pnl.json')],
  [path.join(root, 'site', 'data', 'whale-watch.json'), path.join(root, 'data', 'whale-watch.json')],
  [path.join(root, 'site', 'data', 'gambler-pnl.json'), path.join(root, 'data', 'gambler-pnl.json')],
];

let copied = 0;
for (const [src, dest] of syncPairs) {
  if (!fs.existsSync(src)) continue;
  const srcStat = fs.statSync(src);
  const destExists = fs.existsSync(dest);
  const destStat = destExists ? fs.statSync(dest) : null;

  if (!destExists || srcStat.mtimeMs > destStat.mtimeMs) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Synced ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
    copied++;
  }
}

execFileSync('node', [path.join(root, 'generate-dashboard-data.js')], { stdio: 'inherit' });
console.log(`Done. ${copied} file(s) synced.`);
