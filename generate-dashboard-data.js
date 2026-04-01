#!/usr/bin/env node

/**
 * Generate dashboard-ready JSON from deposits CSV + arkham wallet data
 * Outputs: data/dashboard.json
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, 'data/deposits-all.csv');
const ARKHAM_FILE = path.join(__dirname, '..', 'arkham-addresses-dump.json');
const OUTPUT_FILE = path.join(__dirname, 'data/dashboard.json');

console.log('📊 Generating dashboard data...\n');

// Parse CSV
const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const values = [];
  let current = '', inQuotes = false;
  for (let j = 0; j < lines[i].length; j++) {
    const ch = lines[i][j];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { values.push(current); current = ''; }
    else current += ch;
  }
  values.push(current);
  const obj = {};
  headers.forEach((h, idx) => obj[h.trim()] = (values[idx] || '').trim());
  rows.push(obj);
}

console.log(`  Parsed ${rows.length} deposit records`);

// Parse Arkham wallet data
let arkham = {};
try {
  arkham = JSON.parse(fs.readFileSync(ARKHAM_FILE, 'utf8'));
} catch (e) {
  console.log('  ⚠️ No arkham data found, skipping wallet coverage');
}

// --- Compute stats ---
const allDates = [...new Set(rows.map(r => r.Date).filter(Boolean))].sort();
const lastDate = allDates[allDates.length - 1];
const lastDt = new Date(lastDate + 'T00:00:00Z');

function daysAgo(n) {
  const d = new Date(lastDt);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const d7 = daysAgo(7), d14 = daysAgo(14), d30 = daysAgo(30);

const rows7d = rows.filter(r => r.Date > d7);
const rowsPrev7d = rows.filter(r => r.Date > d14 && r.Date <= d7);
const rows30d = rows.filter(r => r.Date > d30);

function sumUSD(arr) { return arr.reduce((s, r) => s + parseFloat(r['USD Value'] || 0), 0); }
function countUnique(arr, key) { return new Set(arr.map(r => r[key]).filter(Boolean)).size; }

const totalVolume = sumUSD(rows);
const vol7d = sumUSD(rows7d);
const volPrev7d = sumUSD(rowsPrev7d);
const vol30d = sumUSD(rows30d);
const growth7d = volPrev7d > 0 ? ((vol7d / volPrev7d) - 1) * 100 : null;

// Casino breakdown
const casinoMap = {};
// Normalize casino names (Stake 11 -> Stake, Bitcasino 3 -> Bitcasino, etc.)
function normalizeCasino(name) {
  if (/^Stake\b/i.test(name)) return 'Stake';
  if (/^Bitcasino/i.test(name)) return 'Bitcasino';
  if (/^Rollbit/i.test(name)) return 'Rollbit';
  return name;
}

rows.forEach(r => {
  const casino = normalizeCasino(r.Casino);
  if (!casinoMap[casino]) casinoMap[casino] = { volume: 0, count: 0, vol7d: 0, vol30d: 0, count7d: 0, uniqueWallets: new Set() };
  const usd = parseFloat(r['USD Value'] || 0);
  casinoMap[casino].volume += usd;
  casinoMap[casino].count += 1;
  casinoMap[casino].uniqueWallets.add(r['Wallet Address']);
  if (r.Date > d7) { casinoMap[casino].vol7d += usd; casinoMap[casino].count7d += 1; }
  if (r.Date > d30) { casinoMap[casino].vol30d += usd; }
});

const casinoBreakdown = Object.entries(casinoMap)
  .map(([name, s]) => ({
    name,
    totalVolume: Math.round(s.volume),
    totalDeposits: s.count,
    vol7d: Math.round(s.vol7d),
    vol30d: Math.round(s.vol30d),
    deposits7d: s.count7d,
    uniqueWallets: s.uniqueWallets.size,
    avgDeposit: Math.round(s.volume / s.count),
    marketShare: ((s.volume / totalVolume) * 100).toFixed(1),
  }))
  .sort((a, b) => b.totalVolume - a.totalVolume);

// Chain breakdown (all are Ethereum in this dataset, but include anyway)
const chainMap = {};
rows.forEach(r => {
  const chain = r.Chain || 'Unknown';
  if (!chainMap[chain]) chainMap[chain] = { volume: 0, count: 0 };
  chainMap[chain].volume += parseFloat(r['USD Value'] || 0);
  chainMap[chain].count += 1;
});
const chainBreakdown = Object.entries(chainMap)
  .map(([name, s]) => ({ name, volume: Math.round(s.volume), deposits: s.count, share: ((s.volume / totalVolume) * 100).toFixed(1) }))
  .sort((a, b) => b.volume - a.volume);

// Daily volume for chart (last 30 days)
const dailyMap = {};
rows.forEach(r => {
  if (r.Date > d30) {
    if (!dailyMap[r.Date]) dailyMap[r.Date] = { volume: 0, count: 0 };
    dailyMap[r.Date].volume += parseFloat(r['USD Value'] || 0);
    dailyMap[r.Date].count += 1;
  }
});
const dailyVolume = Object.entries(dailyMap)
  .map(([date, s]) => ({ date, volume: Math.round(s.volume), deposits: s.count }))
  .sort((a, b) => a.date.localeCompare(b.date));

// Top deposits (whales)
const topDeposits = rows
  .map(r => ({
    casino: normalizeCasino(r.Casino),
    usd: parseFloat(r['USD Value'] || 0),
    amount: r.Amount,
    token: r.Token,
    wallet: r['Wallet Address'],
    date: r.Date,
    txHash: r['Tx Hash'] || null,
  }))
  .sort((a, b) => b.usd - a.usd)
  .slice(0, 15)
  .map(d => ({ ...d, usd: Math.round(d.usd) }));

// Wallet coverage from Arkham data
const walletCoverage = [];
for (const [key, val] of Object.entries(arkham)) {
  if (key === '_meta') continue;
  const chains = {};
  let total = 0;
  for (const chain of ['ethereum', 'solana', 'tron', 'bitcoin', 'bsc', 'arbitrum', 'base', 'polygon']) {
    const addrs = val[chain] || [];
    if (addrs.length) {
      chains[chain] = addrs.length;
      total += addrs.length;
    }
  }
  walletCoverage.push({ id: key, name: val.name || key, chains, totalAddresses: total });
}
walletCoverage.sort((a, b) => b.totalAddresses - a.totalAddresses);

// Top depositing wallets
const walletVolume = {};
rows.forEach(r => {
  const w = r['Wallet Address'];
  if (!w) return;
  if (!walletVolume[w]) walletVolume[w] = { volume: 0, count: 0, casinos: new Set() };
  walletVolume[w].volume += parseFloat(r['USD Value'] || 0);
  walletVolume[w].count += 1;
  walletVolume[w].casinos.add(normalizeCasino(r.Casino));
});
const topWallets = Object.entries(walletVolume)
  .map(([addr, s]) => ({
    address: addr,
    totalVolume: Math.round(s.volume),
    deposits: s.count,
    casinos: [...s.casinos],
  }))
  .sort((a, b) => b.totalVolume - a.totalVolume)
  .slice(0, 20);

// Build final JSON
const dashboard = {
  generated: new Date().toISOString(),
  dataRange: { from: allDates[0], to: lastDate },
  totalDays: allDates.length,
  overview: {
    totalVolume: Math.round(totalVolume),
    totalDeposits: rows.length,
    uniqueWallets: countUnique(rows, 'Wallet Address'),
    avgDeposit: Math.round(totalVolume / rows.length),
    vol7d: Math.round(vol7d),
    deposits7d: rows7d.length,
    growth7d: growth7d !== null ? parseFloat(growth7d.toFixed(1)) : null,
    vol30d: Math.round(vol30d),
    deposits30d: rows30d.length,
    largestDeposit: Math.round(topDeposits[0]?.usd || 0),
    casinosTracked: casinoBreakdown.length,
  },
  casinoBreakdown,
  chainBreakdown,
  dailyVolume,
  topDeposits,
  topWallets,
  walletCoverage,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dashboard, null, 2));
console.log(`\n✅ Dashboard data written to ${OUTPUT_FILE}`);
console.log(`   ${rows.length} deposits | $${Math.round(totalVolume).toLocaleString()} total volume`);
console.log(`   ${casinoBreakdown.length} casinos | ${walletCoverage.length} wallet coverage entries`);
