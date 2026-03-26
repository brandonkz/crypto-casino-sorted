#!/usr/bin/env node

/**
 * scan-gambler-pnl.js
 *
 * Scans casino wallets for depositors, traces full tx history,
 * and outputs gambler P&L stats to site/data/gambler-pnl.json
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATH = path.join(__dirname, 'site', '.env.local');
dotenv.config({ path: ENV_PATH });
dotenv.config({ path: path.join(__dirname, 'site', '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const OUTPUT_FILE = path.join(__dirname, 'site', 'data', 'gambler-pnl.json');
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 1;
const RATE_LIMIT_MS = 250;
const MIN_DEPOSIT_ETH = 0.1;
const SCAN_TX_LIMIT = 200;
const FULL_HISTORY_PAGE_SIZE = 10000;
const MAX_GAMBLERS = 100;

if (!ETHERSCAN_API_KEY || ETHERSCAN_API_KEY === 'YourApiKeyToken') {
  console.error('Missing ETHERSCAN_API_KEY in site/.env.local');
  process.exit(1);
}

const casinoWalletDefs = [
  // Stake (5 wallets)
  { env: 'STAKE_WALLET_1', casino: 'Stake' },
  { env: 'STAKE_WALLET_2', casino: 'Stake' },
  { env: 'STAKE_WALLET_3', casino: 'Stake' },
  { env: 'STAKE_WALLET_4', casino: 'Stake' },
  { env: 'STAKE_WALLET_11', casino: 'Stake' },
  // Rollbit (3 wallets)
  { env: 'ROLLBIT_HOT_WALLET', casino: 'Rollbit' },
  { env: 'ROLLBIT_HOT_WALLET_2', casino: 'Rollbit' },
  { env: 'ROLLBIT_TOKEN_WALLET', casino: 'Rollbit' },
  // Roobet (2 wallets)
  { env: 'ROOBET_HOT_WALLET', casino: 'Roobet' },
  { env: 'ROOBET_HOT_WALLET_2', casino: 'Roobet' },
  // BC.Game (6 wallets)
  { env: 'BCGAME_HOT_WALLET_1', casino: 'BC.Game' },
  { env: 'BCGAME_HOT_WALLET_2', casino: 'BC.Game' },
  { env: 'BCGAME_HOT_WALLET_3', casino: 'BC.Game' },
  { env: 'BCGAME_HOT_WALLET_4', casino: 'BC.Game' },
  { env: 'BCGAME_HOT_WALLET_5', casino: 'BC.Game' },
  { env: 'BCGAME_HOT_WALLET_6', casino: 'BC.Game' },
  // Duelbits
  { env: 'DUELBITS_HOT_WALLET', casino: 'Duelbits' },
  // Rainbet
  { env: 'RAINBET_WALLET', casino: 'Rainbet' },
  // Gamdom (2 wallets)
  { env: 'GAMDOM_HOT_WALLET', casino: 'Gamdom' },
  { env: 'GAMDOM_HOT_WALLET_2', casino: 'Gamdom' },
  // Bitcasino (6 wallets)
  { env: 'BITCASINO_HOT_WALLET', casino: 'Bitcasino' },
  { env: 'BITCASINO_WALLET_2', casino: 'Bitcasino' },
  { env: 'BITCASINO_WALLET_3', casino: 'Bitcasino' },
  { env: 'BITCASINO_WALLET_4', casino: 'Bitcasino' },
  { env: 'BITCASINO_WALLET_5', casino: 'Bitcasino' },
  { env: 'BITCASINO_WALLET_6', casino: 'Bitcasino' },
  // Shuffle (2 wallets)
  { env: 'SHUFFLE_ETH_WALLET', casino: 'Shuffle' },
  { env: 'SHUFFLE_GAS_WALLET', casino: 'Shuffle' },
  // Chips.gg (NEW)
  { env: 'CHIPSGG_ETH_WALLET', casino: 'Chips.gg' },
  // 500 Casino
  { env: 'CASINO500_ETH_WALLET', casino: '500 Casino' },
  { env: 'CASINO500_ETH_WALLET_2', casino: '500 Casino' },
  // BetFury
  { env: 'BETFURY_ETH_WALLET', casino: 'BetFury' },
  // CSGO500
  { env: 'CSGO500_ETH_WALLET', casino: 'CSGO500' },
  // Metawin
  { env: 'METAWIN_ETH_WALLET', casino: 'Metawin' },
  // Cloudbet
  { env: 'CLOUDBET_ETH_WALLET', casino: 'Cloudbet' },
  // Wolf.bet
  { env: 'WOLFBET_ETH_WALLET', casino: 'Wolf.bet' },
];

function loadCasinoWallets() {
  const wallets = [];
  const addressToCasino = {};
  for (const def of casinoWalletDefs) {
    const address = process.env[def.env];
    if (!address || !address.startsWith('0x')) {
      console.warn(`Skipping ${def.env} (missing or invalid address)`);
      continue;
    }
    const normalized = address.toLowerCase();
    wallets.push({ address: normalized, casino: def.casino, env: def.env });
    addressToCasino[normalized] = def.casino;
  }
  return { wallets, addressToCasino };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function etherscanRequest(params) {
  const response = await axios.get(ETHERSCAN_URL, {
    params: {
      chainid: CHAIN_ID,
      ...params,
      apikey: ETHERSCAN_API_KEY
    },
    timeout: 20000
  });

  await sleep(RATE_LIMIT_MS);

  if (!response.data) {
    throw new Error('Empty Etherscan response');
  }

  if (response.data.status === '0') {
    const message = response.data.message || 'Unknown error';
    if (message.toLowerCase().includes('no transactions')) {
      return [];
    }
    throw new Error(message);
  }

  return response.data.result || [];
}

async function fetchTxList(address, page, offset, sort = 'desc') {
  return etherscanRequest({
    module: 'account',
    action: 'txlist',
    address,
    startblock: 0,
    endblock: 99999999,
    page,
    offset,
    sort
  });
}

async function fetchEthPrice() {
  const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: { ids: 'ethereum', vs_currencies: 'usd' },
    timeout: 10000
  });
  const price = response.data && response.data.ethereum && response.data.ethereum.usd;
  if (!price) {
    throw new Error('Failed to fetch ETH price from CoinGecko');
  }
  return price;
}

function weiToEth(wei) {
  return Number(wei) / 1e18;
}

function isCasinoAddress(address, addressToCasino) {
  if (!address) return false;
  return Boolean(addressToCasino[address.toLowerCase()]);
}

async function scanDepositors(wallets, addressToCasino) {
  const depositors = new Set();

  for (const wallet of wallets) {
    console.log(`Scanning ${wallet.casino} (${wallet.env}) for depositors...`);
    let txs = [];
    try {
      txs = await fetchTxList(wallet.address, 1, SCAN_TX_LIMIT, 'desc');
    } catch (error) {
      console.error(`Failed to fetch ${wallet.casino} txs: ${error.message}`);
      continue;
    }

    for (const tx of txs) {
      const to = (tx.to || '').toLowerCase();
      const from = (tx.from || '').toLowerCase();
      const valueEth = weiToEth(tx.value);

      if (to !== wallet.address) continue;
      if (valueEth <= MIN_DEPOSIT_ETH) continue;
      if (isCasinoAddress(from, addressToCasino) && isCasinoAddress(to, addressToCasino)) {
        continue;
      }
      if (!isCasinoAddress(from, addressToCasino)) {
        depositors.add(from);
      }
    }
  }

  return Array.from(depositors);
}

async function fetchFullHistory(address) {
  let page = 1;
  let all = [];

  while (true) {
    const pageTxs = await fetchTxList(address, page, FULL_HISTORY_PAGE_SIZE, 'asc');
    if (!pageTxs.length) break;
    all = all.concat(pageTxs);
    if (pageTxs.length < FULL_HISTORY_PAGE_SIZE) break;
    page += 1;
  }

  return all;
}

function computeGamblerStats(address, txs, addressToCasino, ethPrice) {
  const normalized = address.toLowerCase();
  let totalDepositedETH = 0;
  let totalWithdrawnETH = 0;
  let firstSeen = null;
  let lastSeen = null;
  const casinoBreakdown = {};

  for (const tx of txs) {
    const from = (tx.from || '').toLowerCase();
    const to = (tx.to || '').toLowerCase();
    const timestamp = Number(tx.timeStamp) * 1000;
    const valueEth = weiToEth(tx.value);

    if (!firstSeen || timestamp < firstSeen) firstSeen = timestamp;
    if (!lastSeen || timestamp > lastSeen) lastSeen = timestamp;

    const fromCasino = isCasinoAddress(from, addressToCasino);
    const toCasino = isCasinoAddress(to, addressToCasino);

    if (fromCasino && toCasino) {
      continue;
    }

    if (from === normalized && toCasino && valueEth > 0) {
      totalDepositedETH += valueEth;
      const casinoName = addressToCasino[to];
      if (!casinoBreakdown[casinoName]) {
        casinoBreakdown[casinoName] = { deposited: 0, withdrawn: 0 };
      }
      casinoBreakdown[casinoName].deposited += valueEth;
    }

    if (to === normalized && fromCasino && valueEth > 0) {
      totalWithdrawnETH += valueEth;
      const casinoName = addressToCasino[from];
      if (!casinoBreakdown[casinoName]) {
        casinoBreakdown[casinoName] = { deposited: 0, withdrawn: 0 };
      }
      casinoBreakdown[casinoName].withdrawn += valueEth;
    }
  }

  const netPnlETH = totalWithdrawnETH - totalDepositedETH;

  const round = value => Number(value.toFixed(6));

  return {
    address: normalized,
    totalDepositedETH: round(totalDepositedETH),
    totalDepositedUSD: round(totalDepositedETH * ethPrice),
    totalWithdrawnETH: round(totalWithdrawnETH),
    totalWithdrawnUSD: round(totalWithdrawnETH * ethPrice),
    netPnlETH: round(netPnlETH),
    netPnlUSD: round(netPnlETH * ethPrice),
    casinoBreakdown,
    firstSeen: firstSeen ? new Date(firstSeen).toISOString() : null,
    lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
    txCount: txs.length
  };
}

async function main() {
  const { wallets, addressToCasino } = loadCasinoWallets();

  if (!wallets.length) {
    console.error('No casino wallets loaded. Check site/.env.local for addresses.');
    process.exit(1);
  }

  console.log(`Loaded ${wallets.length} casino wallets.`);

  let ethPrice = 0;
  try {
    ethPrice = await fetchEthPrice();
    console.log(`ETH price: $${ethPrice}`);
  } catch (error) {
    console.error(`Failed to fetch ETH price: ${error.message}`);
    process.exit(1);
  }

  const depositors = await scanDepositors(wallets, addressToCasino);
  console.log(`Found ${depositors.length} unique depositors.`);

  const gamblers = [];
  for (const depositor of depositors) {
    console.log(`Tracing history for ${depositor}...`);
    let txs = [];
    try {
      txs = await fetchFullHistory(depositor);
    } catch (error) {
      console.error(`Failed to fetch history for ${depositor}: ${error.message}`);
      continue;
    }

    const stats = computeGamblerStats(depositor, txs, addressToCasino, ethPrice);
    if (stats.totalDepositedETH > 0) {
      gamblers.push(stats);
    }
  }

  gamblers.sort((a, b) => a.netPnlETH - b.netPnlETH);
  const topGamblers = gamblers.slice(0, MAX_GAMBLERS);

  const payload = {
    lastUpdated: new Date().toISOString(),
    ethPrice,
    gamblers: topGamblers
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));

  console.log(`Saved ${topGamblers.length} gamblers to ${OUTPUT_FILE}`);
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
