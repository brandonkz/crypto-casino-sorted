#!/usr/bin/env node

/**
 * Multi-chain deposit fetcher for crypto casino wallets
 * Supports: Ethereum, BSC, Polygon, Arbitrum, Solana, Tron, TON
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const HELIOS_API_KEY = process.env.HELIOS_API_KEY;
const HELIOS_RPC_URL = HELIOS_API_KEY ? `https://rpc.helios.xyz/?api-key=${HELIOS_API_KEY}` : null;

const RATE_LIMIT_MS = 250;

const PRICE_USD = {
  ETH: parseFloat(process.env.ETH_USD_PRICE || '2800'),
  BNB: parseFloat(process.env.BNB_USD_PRICE || '0'),
  MATIC: parseFloat(process.env.MATIC_USD_PRICE || '0'),
  SOL: parseFloat(process.env.SOL_USD_PRICE || '0'),
  TRX: parseFloat(process.env.TRX_USD_PRICE || '0'),
  TON: parseFloat(process.env.TON_USD_PRICE || '0')
};

const BLOCKS_PER_DAY = {
  1: 7200,     // Ethereum
  56: 28800,   // BSC
  137: 43200,  // Polygon
  42161: 7200, // Arbitrum (approx)
  8453: 43200  // Base
};

const CHAINS = {
  ethereum: { name: 'Ethereum', type: 'etherscan', chainId: 1, token: 'ETH' },
  bsc: { name: 'BSC', type: 'etherscan', chainId: 56, token: 'BNB' },
  polygon: { name: 'Polygon', type: 'etherscan', chainId: 137, token: 'MATIC' },
  arbitrum: { name: 'Arbitrum', type: 'etherscan', chainId: 42161, token: 'ETH' },
  base: { name: 'Base', type: 'etherscan', chainId: 8453, token: 'ETH' },
  solana: { name: 'Solana', type: 'solana', token: 'SOL' },
  tron: { name: 'Tron', type: 'tron', token: 'TRX' },
  ton: { name: 'TON', type: 'ton', token: 'TON' }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function escapeCSV(value) {
  if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCasinoWallets() {
  return {
    ethereum: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_WALLET_1 },
      { casino: 'Stake', label: 'Stake 4', address: process.env.STAKE_WALLET_4 },
      { casino: 'Stake', label: 'Stake 11', address: process.env.STAKE_WALLET_11 },
      { casino: 'Rollbit', label: 'Rollbit', address: process.env.ROLLBIT_HOT_WALLET },
      { casino: 'Rollbit', label: 'Rollbit ENS', address: process.env.ROLLBIT_ENS },
      { casino: 'Rollbit', label: 'Rollbit Tokens', address: process.env.ROLLBIT_TOKEN_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_HOT_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_HOT_WALLET_1 },
      { casino: 'BC.Game', label: 'BC.Game 2', address: process.env.BCGAME_HOT_WALLET_2 },
      { casino: 'BC.Game', label: 'BC.Game 5', address: process.env.BCGAME_WALLET_3 },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_HOT_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_HOT_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_HOT_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino 2', address: process.env.BITCASINO_WALLET_2 },
      { casino: 'Bitcasino', label: 'Bitcasino 3', address: process.env.BITCASINO_WALLET_3 },
      { casino: 'Shuffle', label: 'Shuffle', address: process.env.SHUFFLE_ETH_WALLET },
      { casino: 'BetFury', label: 'BetFury', address: process.env.BETFURY_ETH_WALLET },
      { casino: '500 Casino', label: '500 Casino', address: process.env.CASINO500_ETH_WALLET },
      { casino: 'CSGO500', label: 'CSGO500', address: process.env.CSGO500_ETH_WALLET },
    ],
    bsc: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_BSC_WALLET },
      { casino: 'Shuffle', label: 'Shuffle', address: process.env.SHUFFLE_BSC_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_BSC_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_BSC_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_BSC_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_BSC_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_BSC_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_BSC_WALLET }
    ],
    polygon: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_POLYGON_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_POLYGON_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_POLYGON_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_POLYGON_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_POLYGON_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_POLYGON_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_POLYGON_WALLET }
    ],
    arbitrum: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_ARB_WALLET },
      { casino: 'Shuffle', label: 'Shuffle', address: process.env.SHUFFLE_ARB_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_ARBITRUM_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_ARBITRUM_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_ARBITRUM_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_ARBITRUM_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_ARBITRUM_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_ARBITRUM_WALLET }
    ],
    base: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_BASE_WALLET },
      { casino: 'Shuffle', label: 'Shuffle', address: process.env.SHUFFLE_BASE_WALLET },
    ],
    solana: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_SOL_WALLET },
      { casino: 'Rollbit', label: 'Rollbit', address: process.env.ROLLBIT_SOL_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_SOL_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_SOL_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_SOL_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_SOL_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_SOL_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_SOL_WALLET }
    ],
    tron: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_TRON_WALLET },
      { casino: 'Rollbit', label: 'Rollbit', address: process.env.ROLLBIT_TRON_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_TRON_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_TRON_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_TRON_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_TRON_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_TRON_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_TRON_WALLET }
    ],
    ton: [
      { casino: 'Stake', label: 'Stake', address: process.env.STAKE_TON_WALLET },
      { casino: 'Rollbit', label: 'Rollbit', address: process.env.ROLLBIT_TON_WALLET },
      { casino: 'Roobet', label: 'Roobet', address: process.env.ROOBET_TON_WALLET },
      { casino: 'BC.Game', label: 'BC.Game', address: process.env.BCGAME_TON_WALLET },
      { casino: 'Duelbits', label: 'Duelbits', address: process.env.DUELBITS_TON_WALLET },
      { casino: 'Rainbet', label: 'Rainbet', address: process.env.RAINBET_TON_WALLET },
      { casino: 'Gamdom', label: 'Gamdom', address: process.env.GAMDOM_TON_WALLET },
      { casino: 'Bitcasino', label: 'Bitcasino', address: process.env.BITCASINO_TON_WALLET }
    ]
  };
}

async function getEvmCurrentBlock(chainId) {
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`;
  const data = await requestJson(url);
  return parseInt(data.result, 16);
}

async function getEvmTransactions({ chainId, address, startBlock }) {
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&page=1&offset=1000&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  const data = await requestJson(url);
  if (data.status !== '1' || !Array.isArray(data.result)) return [];
  return data.result;
}

function buildEvmDeposits({ chain, address, label, txs }) {
  return txs
    .filter(tx => tx.to && tx.to.toLowerCase() === address.toLowerCase() && tx.value !== '0')
    .map(tx => {
      const timestamp = parseInt(tx.timeStamp) * 1000;
      const date = new Date(timestamp);
      const amount = parseInt(tx.value, 10) / 1e18;
      const usdValue = (amount * (PRICE_USD[chain.token] || 0));

      return {
        date: date.toISOString().split('T')[0],
        time: date.toISOString().split('T')[1].substring(0, 8),
        datetime: date.toISOString(),
        casino: label,
        chain: chain.name,
        walletAddress: address,
        amount: amount.toFixed(6),
        token: chain.token,
        usdValue: usdValue.toFixed(2),
        txHash: tx.hash,
        timestamp
      };
    });
}

async function fetchSolanaDeposits(address, label) {
  const requestBody = (method, params) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const headers = { 'Content-Type': 'application/json' };
  const sigsResponse = await requestJson(HELIOS_RPC_URL, {
    method: 'POST',
    headers,
    body: requestBody('getConfirmedSignaturesForAddress2', [address, { limit: 50 }])
  });

  const signatures = Array.isArray(sigsResponse.result) ? sigsResponse.result : [];
  const deposits = [];

  await sleep(RATE_LIMIT_MS);

  for (const sig of signatures) {
    if (!sig.signature) continue;
    await sleep(RATE_LIMIT_MS);

    const txResponse = await requestJson(HELIOS_RPC_URL, {
      method: 'POST',
      headers,
      body: requestBody('getTransaction', [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }])
    });

    const tx = txResponse.result;
    if (!tx || !tx.meta || !tx.transaction) continue;

    const keys = tx.transaction.message.accountKeys || [];
    const keyList = keys.map(k => (typeof k === 'string' ? k : k.pubkey)).filter(Boolean);
    const idx = keyList.findIndex(k => k === address);
    if (idx === -1) continue;

    const pre = tx.meta.preBalances?.[idx];
    const post = tx.meta.postBalances?.[idx];
    if (typeof pre !== 'number' || typeof post !== 'number') continue;

    const delta = (post - pre) / 1e9;
    if (delta <= 0) continue;

    const timestamp = (tx.blockTime || sig.blockTime || 0) * 1000;
    const date = new Date(timestamp || Date.now());
    const usdValue = delta * (PRICE_USD.SOL || 0);

    deposits.push({
      date: date.toISOString().split('T')[0],
      time: date.toISOString().split('T')[1].substring(0, 8),
      datetime: date.toISOString(),
      casino: label,
      chain: CHAINS.solana.name,
      walletAddress: address,
      amount: delta.toFixed(6),
      token: 'SOL',
      usdValue: usdValue.toFixed(2),
      txHash: sig.signature,
      timestamp
    });
  }

  return deposits;
}

function extractTronToAddress(tx) {
  return tx.toAddress || tx.to || tx.to_address || tx.contractData?.to_address || tx.contractData?.to;
}

function extractTronAmount(tx) {
  if (typeof tx.amount === 'number') return tx.amount;
  if (typeof tx.amount === 'string') return parseInt(tx.amount, 10);
  if (typeof tx.contractData?.amount === 'number') return tx.contractData.amount;
  if (typeof tx.contractData?.amount === 'string') return parseInt(tx.contractData.amount, 10);
  if (typeof tx.value === 'number') return tx.value;
  if (typeof tx.value === 'string') return parseInt(tx.value, 10);
  return null;
}

async function fetchTronDeposits(address, label) {
  const url = `https://apilist.tronscanapi.com/api/transaction?address=${address}&limit=50`;
  const data = await requestJson(url);
  const txs = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const deposits = [];

  for (const tx of txs) {
    const to = extractTronToAddress(tx);
    if (!to || to !== address) continue;

    const amountSun = extractTronAmount(tx);
    if (!amountSun || amountSun <= 0) continue;

    const amount = amountSun / 1e6;
    const timestamp = tx.timestamp || tx.block_timestamp || 0;
    const date = new Date(timestamp || Date.now());
    const usdValue = amount * (PRICE_USD.TRX || 0);

    deposits.push({
      date: date.toISOString().split('T')[0],
      time: date.toISOString().split('T')[1].substring(0, 8),
      datetime: date.toISOString(),
      casino: label,
      chain: CHAINS.tron.name,
      walletAddress: address,
      amount: amount.toFixed(6),
      token: 'TRX',
      usdValue: usdValue.toFixed(2),
      txHash: tx.hash || tx.transactionHash || tx.txID,
      timestamp: timestamp || Date.now()
    });
  }

  return deposits;
}

function extractTonTimestamp(tx) {
  return tx.utime || tx.now || tx.transaction?.now || 0;
}

function extractTonHash(tx) {
  return tx.hash || tx.transaction_id?.hash || tx.transaction_id || tx.id || '';
}

function extractTonIncomingMessage(tx) {
  return tx.in_msg || tx.inMsg || tx['in_msg'] || tx.inMessage;
}

async function fetchTonDeposits(address, label) {
  const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(address)}&limit=50`;
  const data = await requestJson(url);
  const txs = Array.isArray(data?.result) ? data.result : [];
  const deposits = [];

  for (const tx of txs) {
    const inMsg = extractTonIncomingMessage(tx);
    if (!inMsg) continue;

    const destination = inMsg.destination || inMsg.dst || inMsg.destination_address || inMsg.destinationAddress;
    if (destination && destination !== address) continue;

    const valueNano = inMsg.value || inMsg.valueGrams || inMsg.amount;
    if (!valueNano) continue;

    const amount = parseInt(valueNano, 10) / 1e9;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const timestamp = extractTonTimestamp(tx) * 1000;
    const date = new Date(timestamp || Date.now());
    const usdValue = amount * (PRICE_USD.TON || 0);

    deposits.push({
      date: date.toISOString().split('T')[0],
      time: date.toISOString().split('T')[1].substring(0, 8),
      datetime: date.toISOString(),
      casino: label,
      chain: CHAINS.ton.name,
      walletAddress: address,
      amount: amount.toFixed(6),
      token: 'TON',
      usdValue: usdValue.toFixed(2),
      txHash: extractTonHash(tx),
      timestamp
    });
  }

  return deposits;
}

async function fetchAllDeposits() {
  if (!ETHERSCAN_API_KEY) {
    throw new Error('ETHERSCAN_API_KEY not found in .env.local');
  }

  const walletConfig = buildCasinoWallets();
  const allDeposits = [];

  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    const wallets = (walletConfig[chainKey] || []).filter(w => w.address);
    if (wallets.length === 0) continue;

    console.log(`\n🔗 ${chain.name}...`);

    if (chain.type === 'etherscan') {
      const currentBlock = await getEvmCurrentBlock(chain.chainId);
      await sleep(RATE_LIMIT_MS);
      const startBlock = currentBlock - (BLOCKS_PER_DAY[chain.chainId] || 7200);

      for (const wallet of wallets) {
        console.log(`   ${wallet.label}...`);
        try {
          const txs = await getEvmTransactions({
            chainId: chain.chainId,
            address: wallet.address,
            startBlock
          });
          const deposits = buildEvmDeposits({
            chain,
            address: wallet.address,
            label: wallet.label,
            txs
          });
          allDeposits.push(...deposits);
          console.log(`   ✅ ${deposits.length} deposits`);
        } catch (err) {
          console.warn(`   ⚠️ ${wallet.label} failed: ${err.message}`);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (chain.type === 'solana') {
      if (!HELIOS_RPC_URL) {
        console.warn('   ⚠️ HELIOS_API_KEY missing - skipping Solana');
        continue;
      }
      for (const wallet of wallets) {
        console.log(`   ${wallet.label}...`);
        try {
          const deposits = await fetchSolanaDeposits(wallet.address, wallet.label);
          allDeposits.push(...deposits);
          console.log(`   ✅ ${deposits.length} deposits`);
        } catch (err) {
          console.warn(`   ⚠️ ${wallet.label} failed: ${err.message}`);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (chain.type === 'tron') {
      for (const wallet of wallets) {
        console.log(`   ${wallet.label}...`);
        try {
          const deposits = await fetchTronDeposits(wallet.address, wallet.label);
          allDeposits.push(...deposits);
          console.log(`   ✅ ${deposits.length} deposits`);
        } catch (err) {
          console.warn(`   ⚠️ ${wallet.label} failed: ${err.message}`);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (chain.type === 'ton') {
      for (const wallet of wallets) {
        console.log(`   ${wallet.label}...`);
        try {
          const deposits = await fetchTonDeposits(wallet.address, wallet.label);
          allDeposits.push(...deposits);
          console.log(`   ✅ ${deposits.length} deposits`);
        } catch (err) {
          console.warn(`   ⚠️ ${wallet.label} failed: ${err.message}`);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }
  }

  return allDeposits;
}

function parseCsvRows(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function migrateCumulativeCsvIfNeeded(cumulativePath, targetHeaders) {
  if (!fs.existsSync(cumulativePath)) return;

  const content = fs.readFileSync(cumulativePath, 'utf8').trim();
  if (!content) return;

  const { headers, rows } = parseCsvRows(content);
  if (headers.join(',') === targetHeaders.join(',')) return;

  const normalizedRows = rows.map(row => ([
    row['Date'] || row['date'] || '',
    row['Time'] || row['time'] || '',
    row['DateTime'] || row['datetime'] || '',
    row['Casino'] || row['casino'] || '',
    row['Chain'] || row['chain'] || 'Ethereum',
    row['Wallet Address'] || row['walletAddress'] || '',
    row['Amount'] || row['amount'] || '',
    row['Token'] || row['token'] || '',
    row['USD Value'] || row['usd_value'] || row['usdValue'] || '',
    row['Tx Hash'] || row['txHash'] || ''
  ]));

  const newContent = [
    targetHeaders.join(','),
    ...normalizedRows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  fs.writeFileSync(cumulativePath, newContent);
  console.log('ℹ️  Migrated existing deposits-all.csv to new header format');
}

async function exportDepositsToCsv() {
  console.log('🎰 Exporting multi-chain deposits to CSV...\n');

  const allDeposits = await fetchAllDeposits();
  allDeposits.sort((a, b) => a.timestamp - b.timestamp);

  const deduped = [];
  const seen = new Set();
  for (const deposit of allDeposits) {
    const key = deposit.txHash || `nohash:${deposit.chain}:${deposit.walletAddress}:${deposit.timestamp}:${deposit.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(deposit);
  }

  console.log(`\n✅ Total: ${deduped.length} deposits`);
  if (deduped.length === 0) {
    console.log('No deposits found');
    return;
  }

  const headers = ['Date', 'Time', 'DateTime', 'Casino', 'Chain', 'Wallet Address', 'Amount', 'Token', 'USD Value', 'Tx Hash'];
  const rows = deduped.map(d => [
    d.date,
    d.time,
    d.datetime,
    d.casino,
    d.chain,
    d.walletAddress,
    d.amount,
    d.token,
    d.usdValue,
    d.txHash
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  const filename = `deposits-${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join(__dirname, 'data', filename);

  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, csv);

  console.log(`\n💾 Saved to: ${filepath}`);
  console.log(`   ${deduped.length} rows`);

  const cumulativePath = path.join(__dirname, 'data', 'deposits-all.csv');
  migrateCumulativeCsvIfNeeded(cumulativePath, headers);

  if (fs.existsSync(cumulativePath)) {
    fs.appendFileSync(cumulativePath, '\n' + rows.map(row => row.map(escapeCSV).join(',')).join('\n'));
    console.log(`\n📈 Appended to: ${cumulativePath}`);
  } else {
    fs.writeFileSync(cumulativePath, csv);
    console.log(`\n📈 Created: ${cumulativePath}`);
  }
}

module.exports = {
  fetchAllDeposits,
  exportDepositsToCsv
};

if (require.main === module) {
  exportDepositsToCsv().catch(console.error);
}
