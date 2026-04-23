#!/usr/bin/env node
/**
 * fetch-arkham-deposits.js
 *
 * Ethereum-only fallback deposit fetcher using Etherscan.
 * Kept under the existing filename so the current cron keeps working.
 *
 * Outputs to: site/data/deposits-YYYY-MM-DD.csv
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE = 'api.etherscan.io';
const COINGECKO_BASE = 'api.coingecko.com';
const ADDRESS_FILE = path.join(__dirname, 'arkham-addresses-dump.json');
const SOURCE_DATA = JSON.parse(fs.readFileSync(ADDRESS_FILE, 'utf8'));
const SINCE_MS = Date.now() - (24 * 60 * 60 * 1000);
const RATE_LIMIT_MS = 250;

const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'USDD', 'USDP', 'PYUSD', 'BUSD'
]);

const wallets = [];
for (const [key, val] of Object.entries(SOURCE_DATA)) {
  if (key === '_meta') continue;
  const casino = val.name || key;
  for (const w of (val.ethereum || [])) {
    wallets.push({ casino, address: w.address.toLowerCase(), label: w.label || '' });
  }
}

const knownAddressMap = new Map(wallets.map(w => [w.address, w.casino]));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(hostname, requestPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: requestPath, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          return reject(err);
        }

        if (res.statusCode >= 400) {
          return reject(new Error(`${hostname} ${res.statusCode}: ${parsed?.error || parsed?.message || 'request failed'}`));
        }

        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function etherscanGet(params) {
  const requestPath = `/v2/api?${querystring.stringify({ chainid: 1, ...params, apikey: ETHERSCAN_API_KEY })}`;
  const data = await getJson(ETHERSCAN_BASE, requestPath);
  const message = String(data?.message || '').toLowerCase();
  const resultText = typeof data?.result === 'string' ? data.result.toLowerCase() : '';

  if (data?.status === '0') {
    if (message.includes('no transactions') || resultText.includes('no transactions')) {
      return [];
    }
    throw new Error(`Etherscan API: ${data?.result || data?.message || 'unknown error'}`);
  }

  return Array.isArray(data?.result) ? data.result : [];
}

async function fetchCoinbaseSpot(symbol) {
  const data = await getJson('api.coinbase.com', `/v2/prices/${symbol}-USD/spot`);
  return Number(data?.data?.amount || 0);
}

async function fetchMarketPrices() {
  try {
    const requestPath = `/api/v3/simple/price?${querystring.stringify({ ids: 'ethereum,bitcoin', vs_currencies: 'usd' })}`;
    const data = await getJson(COINGECKO_BASE, requestPath);
    return {
      ETH: Number(data?.ethereum?.usd || 0),
      BTC: Number(data?.bitcoin?.usd || 0),
    };
  } catch (err) {
    console.warn(`⚠️ CoinGecko price fetch failed: ${err.message}`);
    const [eth, btc] = await Promise.all([
      fetchCoinbaseSpot('ETH').catch(() => 3000),
      fetchCoinbaseSpot('BTC').catch(() => 90000),
    ]);
    return { ETH: eth || 3000, BTC: btc || 90000 };
  }
}

function formatUnits(value, decimals) {
  const safeDecimals = Math.max(0, Math.min(Number(decimals || 0), 30));
  const raw = String(value || '0');

  if (!/^\d+$/.test(raw)) return 0;

  const big = BigInt(raw);
  const divisor = 10n ** BigInt(safeDecimals);
  const whole = big / divisor;
  const fraction = big % divisor;

  if (fraction === 0n) return Number(whole.toString());

  const fractionStr = fraction.toString().padStart(safeDecimals, '0').replace(/0+$/, '').slice(0, 8);
  return Number(`${whole.toString()}.${fractionStr}`);
}

function getTokenUsdPrice(symbol, prices) {
  const token = String(symbol || '').toUpperCase();
  if (!token) return null;
  if (STABLECOINS.has(token)) return 1;
  if (token === 'ETH' || token === 'WETH') return prices.ETH || null;
  if (token === 'BTC' || token === 'WBTC') return prices.BTC || null;
  return null;
}

function toIso(tsSeconds) {
  return new Date(Number(tsSeconds) * 1000).toISOString();
}

function buildEthDeposits(wallet, txs, prices) {
  return txs
    .filter(tx => String(tx.to || '').toLowerCase() === wallet.address)
    .filter(tx => Number(tx.timeStamp) * 1000 >= SINCE_MS)
    .filter(tx => String(tx.value || '0') !== '0')
    .map(tx => {
      const amount = formatUnits(tx.value, 18);
      const fromAddress = String(tx.from || '').toLowerCase();
      const usdValue = prices.ETH ? amount * prices.ETH : null;
      return {
        casino: wallet.casino,
        timestamp: toIso(tx.timeStamp),
        token: 'ETH',
        amount,
        usdValue,
        fromAddress,
        fromEntity: knownAddressMap.get(fromAddress) || '',
        txHash: tx.hash,
      };
    })
    .filter(row => row.usdValue != null && row.usdValue >= 100);
}

function buildTokenDeposits(wallet, txs, prices) {
  return txs
    .filter(tx => String(tx.to || '').toLowerCase() === wallet.address)
    .filter(tx => Number(tx.timeStamp) * 1000 >= SINCE_MS)
    .filter(tx => String(tx.value || '0') !== '0')
    .map(tx => {
      const symbol = String(tx.tokenSymbol || '').toUpperCase();
      const amount = formatUnits(tx.value, tx.tokenDecimal || 0);
      const usdPrice = getTokenUsdPrice(symbol, prices);
      const fromAddress = String(tx.from || '').toLowerCase();
      return {
        casino: wallet.casino,
        timestamp: toIso(tx.timeStamp),
        token: symbol || 'UNKNOWN',
        amount,
        usdValue: usdPrice != null ? amount * usdPrice : null,
        fromAddress,
        fromEntity: knownAddressMap.get(fromAddress) || '',
        txHash: tx.hash,
      };
    })
    .filter(row => row.usdValue != null && row.usdValue >= 100);
}

async function fetchDepositsForWallet(wallet, prices) {
  const deposits = [];

  const ethTxs = await etherscanGet({
    module: 'account',
    action: 'txlist',
    address: wallet.address,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: 1000,
    sort: 'desc',
  });
  deposits.push(...buildEthDeposits(wallet, ethTxs, prices));
  await sleep(RATE_LIMIT_MS);

  const tokenTxs = await etherscanGet({
    module: 'account',
    action: 'tokentx',
    address: wallet.address,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: 1000,
    sort: 'desc',
  });
  deposits.push(...buildTokenDeposits(wallet, tokenTxs, prices));
  await sleep(RATE_LIMIT_MS);

  return deposits;
}

function dedupeDeposits(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = [row.txHash, row.casino, row.token, row.amount, row.fromAddress].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  if (!ETHERSCAN_API_KEY) {
    throw new Error('Missing ETHERSCAN_API_KEY in .env.local or .env');
  }

  const today = new Date().toISOString().split('T')[0];
  const outputPath = path.join(__dirname, 'site', 'data', `deposits-${today}.csv`);

  console.log(`Fetching Etherscan deposits for ${wallets.length} Ethereum wallets across ${new Set(wallets.map(w => w.casino)).size} casinos...`);
  const prices = await fetchMarketPrices();
  console.log(`Using prices: ETH $${prices.ETH.toLocaleString()} | BTC $${prices.BTC.toLocaleString()}`);

  const allDeposits = [];
  const errors = [];

  for (const wallet of wallets) {
    process.stdout.write(`  ${wallet.casino} (${wallet.address.slice(0, 8)}...)  `);
    try {
      const deposits = await fetchDepositsForWallet(wallet, prices);
      console.log(`${deposits.length} deposits`);
      allDeposits.push(...deposits);
    } catch (err) {
      console.log('error');
      console.error(`  ⚠️ Error fetching ${wallet.casino} (${wallet.address}): ${err.message}`);
      errors.push({ wallet, message: err.message });
    }
  }

  if (errors.length > 0 && allDeposits.length === 0) {
    const sample = errors[0];
    throw new Error(`Etherscan fetch failed for all wallets. Example: ${sample.wallet.casino} (${sample.wallet.address}) -> ${sample.message}`);
  }

  const deduped = dedupeDeposits(allDeposits).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const csv = ['Casino,Timestamp,Token,Amount,USD Value,From Address,From Entity,TX Hash'];
  for (const d of deduped) {
    csv.push([
      d.casino,
      d.timestamp,
      d.token,
      d.amount,
      d.usdValue != null ? d.usdValue.toFixed(2) : '',
      d.fromAddress,
      d.fromEntity || '',
      d.txHash,
    ].map(v => `"${v ?? ''}"`).join(','));
  }
  fs.writeFileSync(outputPath, csv.join('\n'));

  const totalUSD = deduped.reduce((sum, d) => sum + (d.usdValue || 0), 0);
  const byCasino = {};
  for (const d of deduped) {
    byCasino[d.casino] = (byCasino[d.casino] || 0) + (d.usdValue || 0);
  }

  console.log(`\n✅ Done. ${deduped.length} deposits | $${Math.round(totalUSD).toLocaleString()} total`);
  console.log(`Saved to: ${outputPath}`);
  console.log('\nTop casinos by volume:');
  Object.entries(byCasino)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([name, usd]) => console.log(`  ${name}: $${Math.round(usd).toLocaleString()}`));
}

main().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
