#!/usr/bin/env node
/**
 * fetch-arkham-deposits.js
 * Fetches recent deposit data for tracked casinos from Arkham API
 * Outputs to site/data/deposits-YYYY-MM-DD.csv
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ARKHAM_API_KEY = '166b3613-2d8f-4ad7-8cf5-b9379b433fee';
const ARKHAM_BASE = 'api.arkhamintelligence.com';

// Casino wallet addresses from arkham-addresses-dump.json
const ARKHAM_FILE = path.join(__dirname, 'arkham-addresses-dump.json');
const arkham = JSON.parse(fs.readFileSync(ARKHAM_FILE, 'utf8'));

// Build flat list of ETH wallets with casino names
const wallets = [];
for (const [key, val] of Object.entries(arkham)) {
  if (key === '_meta') continue;
  const name = val.name || key;
  for (const w of (val.ethereum || [])) {
    wallets.push({ casino: name, address: w.address, label: w.label });
  }
}

function arkhamGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ARKHAM_BASE,
      path: endpoint,
      method: 'GET',
      headers: { 'API-Key': ARKHAM_API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          return reject(e);
        }

        if (res.statusCode >= 400) {
          const message = parsed?.message || `HTTP ${res.statusCode}`;
          return reject(new Error(`Arkham API ${res.statusCode}: ${message}`));
        }

        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchDepositsForWallet(address, casino, sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 3600000).toISOString();
  const endpoint = `/transfers?base=${address}&timeGte=${encodeURIComponent(since)}&limit=100&usdGte=100`;
  try {
    const data = await arkhamGet(endpoint);
    const transfers = data.transfers || [];
    // Only count inflows (deposits TO this wallet)
    return {
      deposits: transfers
        .filter(t => t.toAddress?.address?.toLowerCase() === address.toLowerCase())
        .map(t => ({
          casino,
          address,
          txHash: t.transactionHash,
          timestamp: t.blockTimestamp,
          token: t.tokenSymbol,
          amount: t.unitValue,
          usdValue: t.historicalUSD,
          fromAddress: t.fromAddress?.address,
          fromEntity: t.fromAddress?.arkhamEntity?.name || null
        })),
      error: null
    };
  } catch (e) {
    console.error(`  ⚠️ Error fetching ${casino} (${address}): ${e.message}`);
    return { deposits: [], error: e.message };
  }
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const outputPath = path.join(__dirname, 'site', 'data', `deposits-${today}.csv`);
  
  console.log(`Fetching Arkham deposits for ${wallets.length} wallets across ${new Set(wallets.map(w=>w.casino)).size} casinos...`);
  
  const allDeposits = [];
  const errors = [];
  for (const w of wallets) {
    process.stdout.write(`  ${w.casino} (${w.address.slice(0,8)}...)  `);
    const result = await fetchDepositsForWallet(w.address, w.casino);
    console.log(`${result.deposits.length} deposits`);
    allDeposits.push(...result.deposits);
    if (result.error) {
      errors.push({ casino: w.casino, address: w.address, message: result.error });
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }

  if (errors.length > 0 && allDeposits.length === 0) {
    const sample = errors[0];
    throw new Error(`Arkham fetch failed for all wallets. Example: ${sample.casino} (${sample.address}) -> ${sample.message}`);
  }

  // Write CSV
  const csv = [
    'Casino,Timestamp,Token,Amount,USD Value,From Address,From Entity,TX Hash'
  ];
  for (const d of allDeposits) {
    csv.push([
      d.casino,
      d.timestamp,
      d.token,
      d.amount,
      d.usdValue?.toFixed(2),
      d.fromAddress,
      d.fromEntity || '',
      d.txHash
    ].map(v => `"${v ?? ''}"`).join(','));
  }

  fs.writeFileSync(outputPath, csv.join('\n'));
  
  // Summary
  const totalUSD = allDeposits.reduce((sum, d) => sum + (d.usdValue || 0), 0);
  const byCasino = {};
  for (const d of allDeposits) {
    byCasino[d.casino] = (byCasino[d.casino] || 0) + (d.usdValue || 0);
  }
  
  console.log(`\n✅ Done. ${allDeposits.length} deposits | $${totalUSD.toLocaleString()} total`);
  console.log(`Saved to: ${outputPath}`);
  console.log('\nTop casinos by volume:');
  Object.entries(byCasino)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([name, usd]) => console.log(`  ${name}: $${usd.toLocaleString()}`));
}

main().catch(console.error);
