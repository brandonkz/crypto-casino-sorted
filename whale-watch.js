#!/usr/bin/env node

/**
 * Whale Watch — Track big crypto casino deposits and follow up on withdrawals
 * 
 * 1. Scans casino wallets for large deposits (>$10K)
 * 2. Stores whales in whale-watch.json with deposit details
 * 3. Periodically checks if whale has received anything back from casinos
 * 4. Generates tweet content for new whales + updates on existing ones
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'site', '.env.local') });
dotenv.config({ path: path.join(__dirname, 'site', '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';
const WHALE_FILE = path.join(__dirname, 'site', 'data', 'whale-watch.json');
const TWEET_FILE = path.join(__dirname, 'twitter-content', `whale-tweets-${new Date().toISOString().slice(0, 10)}.json`);
const MIN_DEPOSIT_USD = 10000;
const RATE_LIMIT_MS = 250;

// Casino wallet definitions
const CASINO_DEFS = [
  // Stake (5 wallets)
  { env: 'STAKE_WALLET_1', casino: 'Stake', icon: '🟢' },
  { env: 'STAKE_WALLET_2', casino: 'Stake', icon: '🟢' },
  { env: 'STAKE_WALLET_3', casino: 'Stake', icon: '🟢' },
  { env: 'STAKE_WALLET_4', casino: 'Stake', icon: '🟢' },
  { env: 'STAKE_WALLET_11', casino: 'Stake', icon: '🟢' },
  // Rollbit (3 wallets)
  { env: 'ROLLBIT_HOT_WALLET', casino: 'Rollbit', icon: '🎲' },
  { env: 'ROLLBIT_HOT_WALLET_2', casino: 'Rollbit', icon: '🎲' },
  { env: 'ROLLBIT_TOKEN_WALLET', casino: 'Rollbit', icon: '🎲' },
  // Roobet (2 wallets)
  { env: 'ROOBET_HOT_WALLET', casino: 'Roobet', icon: '🦘' },
  { env: 'ROOBET_HOT_WALLET_2', casino: 'Roobet', icon: '🦘' },
  // BC.Game (6 wallets)
  { env: 'BCGAME_HOT_WALLET_1', casino: 'BC.Game', icon: '🎰' },
  { env: 'BCGAME_HOT_WALLET_2', casino: 'BC.Game', icon: '🎰' },
  { env: 'BCGAME_HOT_WALLET_3', casino: 'BC.Game', icon: '🎰' },
  { env: 'BCGAME_HOT_WALLET_4', casino: 'BC.Game', icon: '🎰' },
  { env: 'BCGAME_HOT_WALLET_5', casino: 'BC.Game', icon: '🎰' },
  { env: 'BCGAME_HOT_WALLET_6', casino: 'BC.Game', icon: '🎰' },
  // Duelbits
  { env: 'DUELBITS_HOT_WALLET', casino: 'Duelbits', icon: '⚔️' },
  // Rainbet
  { env: 'RAINBET_WALLET', casino: 'Rainbet', icon: '🌧️' },
  // Gamdom (2 wallets)
  { env: 'GAMDOM_HOT_WALLET', casino: 'Gamdom', icon: '🎯' },
  { env: 'GAMDOM_HOT_WALLET_2', casino: 'Gamdom', icon: '🎯' },
  // Bitcasino (6 wallets)
  { env: 'BITCASINO_HOT_WALLET', casino: 'Bitcasino', icon: '🅱️' },
  { env: 'BITCASINO_WALLET_2', casino: 'Bitcasino', icon: '🅱️' },
  { env: 'BITCASINO_WALLET_3', casino: 'Bitcasino', icon: '🅱️' },
  { env: 'BITCASINO_WALLET_4', casino: 'Bitcasino', icon: '🅱️' },
  { env: 'BITCASINO_WALLET_5', casino: 'Bitcasino', icon: '🅱️' },
  { env: 'BITCASINO_WALLET_6', casino: 'Bitcasino', icon: '🅱️' },
  // Shuffle (2 wallets)
  { env: 'SHUFFLE_ETH_WALLET', casino: 'Shuffle', icon: '🔀' },
  { env: 'SHUFFLE_GAS_WALLET', casino: 'Shuffle', icon: '🔀' },
  // Chips.gg (NEW)
  { env: 'CHIPSGG_ETH_WALLET', casino: 'Chips.gg', icon: '🎲' },
  // 500 Casino
  { env: 'CASINO500_ETH_WALLET', casino: '500 Casino', icon: '5️⃣' },
  { env: 'CASINO500_ETH_WALLET_2', casino: '500 Casino', icon: '5️⃣' },
  // BetFury
  { env: 'BETFURY_ETH_WALLET', casino: 'BetFury', icon: '🔥' },
  // CSGO500
  { env: 'CSGO500_ETH_WALLET', casino: 'CSGO500', icon: '🎮' },
  // Metawin
  { env: 'METAWIN_ETH_WALLET', casino: 'Metawin', icon: '🏆' },
  // Cloudbet
  { env: 'CLOUDBET_ETH_WALLET', casino: 'Cloudbet', icon: '☁️' },
  // Wolf.bet
  { env: 'WOLFBET_ETH_WALLET', casino: 'Wolf.bet', icon: '🐺' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadCasinoAddresses() {
  const addressToCasino = {};
  const casinoWallets = [];
  for (const def of CASINO_DEFS) {
    const addr = process.env[def.env];
    if (addr && addr.startsWith('0x')) {
      const normalized = addr.toLowerCase();
      addressToCasino[normalized] = { casino: def.casino, icon: def.icon };
      casinoWallets.push({ address: normalized, casino: def.casino, icon: def.icon, env: def.env });
    }
  }
  return { addressToCasino, casinoWallets };
}

async function etherscanGet(params) {
  const resp = await axios.get(ETHERSCAN_URL, {
    params: { chainid: 1, ...params, apikey: ETHERSCAN_API_KEY },
    timeout: 20000
  });
  await sleep(RATE_LIMIT_MS);
  if (resp.data.status === '0') {
    const msg = resp.data.message || '';
    if (msg.toLowerCase().includes('no transactions')) return [];
    throw new Error(msg);
  }
  return resp.data.result || [];
}

async function fetchEthPrice() {
  const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: { ids: 'ethereum', vs_currencies: 'usd' }, timeout: 10000
  });
  return resp.data.ethereum.usd;
}

function loadWhaleData() {
  if (fs.existsSync(WHALE_FILE)) {
    return JSON.parse(fs.readFileSync(WHALE_FILE, 'utf8'));
  }
  return { whales: [], lastScan: null };
}

function saveWhaleData(data) {
  fs.mkdirSync(path.dirname(WHALE_FILE), { recursive: true });
  fs.writeFileSync(WHALE_FILE, JSON.stringify(data, null, 2));
}

function fmt(n) { return '$' + Math.abs(Math.round(n)).toLocaleString(); }
function truncAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

async function scanForNewWhales(casinoWallets, addressToCasino, ethPrice) {
  console.log('🐋 Scanning for new whale deposits...\n');
  const newWhales = [];

  for (const wallet of casinoWallets) {
    process.stdout.write(`  Scanning ${wallet.casino} (${wallet.env})...`);
    let txs = [];
    try {
      txs = await etherscanGet({
        module: 'account', action: 'txlist', address: wallet.address,
        startblock: 0, endblock: 99999999, page: 1, offset: 50, sort: 'desc'
      });
    } catch (e) {
      console.log(` ❌ ${e.message}`);
      continue;
    }

    let count = 0;
    for (const tx of txs) {
      const to = (tx.to || '').toLowerCase();
      const from = (tx.from || '').toLowerCase();
      if (to !== wallet.address) continue;
      
      const ethAmount = parseFloat(tx.value) / 1e18;
      const usdAmount = ethAmount * ethPrice;
      if (usdAmount < MIN_DEPOSIT_USD) continue;
      
      // Skip casino-to-casino
      if (addressToCasino[from]) continue;
      
      newWhales.push({
        address: from,
        casino: wallet.casino,
        casinoIcon: wallet.icon,
        depositETH: Number(ethAmount.toFixed(6)),
        depositUSD: Math.round(usdAmount),
        depositTxHash: tx.hash,
        depositTimestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        firstSeen: new Date().toISOString(),
        withdrawnETH: 0,
        withdrawnUSD: 0,
        lastChecked: null,
        status: 'watching', // watching | updated | closed
        daysSinceDeposit: 0,
        updates: []
      });
      count++;
    }
    console.log(` ${count} whales found`);
  }

  return newWhales;
}

async function checkWhaleWithdrawals(whale, addressToCasino, ethPrice) {
  // Get whale's recent transactions to see if any casino sent them ETH back
  let txs = [];
  try {
    txs = await etherscanGet({
      module: 'account', action: 'txlist', address: whale.address,
      startblock: 0, endblock: 99999999, page: 1, offset: 1000, sort: 'desc'
    });
  } catch (e) {
    console.log(`  ❌ Failed to check ${truncAddr(whale.address)}: ${e.message}`);
    return whale;
  }

  let totalWithdrawn = 0;
  const withdrawalCasinos = new Set();

  for (const tx of txs) {
    const from = (tx.from || '').toLowerCase();
    const to = (tx.to || '').toLowerCase();
    
    // Casino sending TO this whale = withdrawal/payout
    if (to === whale.address && addressToCasino[from]) {
      const ethAmount = parseFloat(tx.value) / 1e18;
      if (ethAmount > 0) {
        totalWithdrawn += ethAmount;
        withdrawalCasinos.add(addressToCasino[from].casino);
      }
    }
  }

  const prevWithdrawn = whale.withdrawnETH;
  whale.withdrawnETH = Number(totalWithdrawn.toFixed(6));
  whale.withdrawnUSD = Math.round(totalWithdrawn * ethPrice);
  whale.lastChecked = new Date().toISOString();
  whale.daysSinceDeposit = Math.floor((Date.now() - new Date(whale.depositTimestamp).getTime()) / (1000 * 60 * 60 * 24));

  // Log update if withdrawal amount changed
  if (whale.withdrawnETH !== prevWithdrawn) {
    whale.status = 'updated';
    whale.updates.push({
      date: new Date().toISOString(),
      withdrawnETH: whale.withdrawnETH,
      withdrawnUSD: whale.withdrawnUSD,
      note: withdrawalCasinos.size > 0 ? `Received from: ${[...withdrawalCasinos].join(', ')}` : null
    });
  }

  return whale;
}

function generateTweets(newWhales, updatedWhales, allWhales, ethPrice) {
  const tweets = [];

  // New whale alerts
  for (const w of newWhales.slice(0, 3)) {
    tweets.push({
      label: `🐋 NEW WHALE — ${truncAddr(w.address)}`,
      text: `🐋 Whale alert.

${fmt(w.depositUSD)} just deposited into ${w.casino}.

Wallet: ${truncAddr(w.address)}
Tx: etherscan.io/tx/${w.depositTxHash.slice(0, 10)}...

I'll be tracking this wallet. Let's see if any of it comes back.`,
      type: 'new_whale'
    });
  }

  // Updates on watched whales
  for (const w of updatedWhales.slice(0, 2)) {
    const pnl = w.withdrawnUSD - w.depositUSD;
    tweets.push({
      label: `📊 UPDATE — ${truncAddr(w.address)}`,
      text: `Update on the ${fmt(w.depositUSD)} ${w.casino} whale (${truncAddr(w.address)}):

Day ${w.daysSinceDeposit} since deposit.
Deposited: ${fmt(w.depositUSD)}
Withdrawn: ${fmt(w.withdrawnUSD)}
Net: ${pnl >= 0 ? '+' : '-'}${fmt(Math.abs(pnl))}

${w.withdrawnUSD === 0 ? 'Still $0 back. The blockchain remembers.' : `Got some back. Still down ${fmt(Math.abs(pnl))}.`}`,
      type: 'update'
    });
  }

  // Zero withdrawal whales summary (periodic)
  const zeroWhales = allWhales.filter(w => w.withdrawnETH === 0 && w.daysSinceDeposit >= 3);
  if (zeroWhales.length >= 3) {
    const totalDeposited = zeroWhales.reduce((s, w) => s + w.depositUSD, 0);
    tweets.push({
      label: '💀 ZERO WITHDRAWAL ROUNDUP',
      text: `Whale Watch update:

${zeroWhales.length} whales I'm tracking have withdrawn exactly $0.

Combined deposits: ${fmt(totalDeposited)}
Days waiting: ${Math.min(...zeroWhales.map(w => w.daysSinceDeposit))}-${Math.max(...zeroWhales.map(w => w.daysSinceDeposit))} days

Casinos: ${[...new Set(zeroWhales.map(w => w.casino))].join(', ')}

Every deposit is on Etherscan. None came back.`,
      type: 'roundup'
    });
  }

  return tweets;
}

async function main() {
  const { addressToCasino, casinoWallets } = loadCasinoAddresses();
  console.log(`📦 Loaded ${casinoWallets.length} casino wallets\n`);

  const ethPrice = await fetchEthPrice();
  console.log(`💰 ETH: $${ethPrice}\n`);

  // Load existing whale data
  const data = loadWhaleData();
  const existingAddresses = new Set(data.whales.map(w => w.address + w.depositTxHash));

  // Scan for new whales
  const rawNewWhales = await scanForNewWhales(casinoWallets, addressToCasino, ethPrice);
  
  // Deduplicate against existing
  const newWhales = rawNewWhales.filter(w => !existingAddresses.has(w.address + w.depositTxHash));
  console.log(`\n🆕 ${newWhales.length} new whales (${rawNewWhales.length} total found, ${rawNewWhales.length - newWhales.length} already tracked)\n`);

  // Add new whales to data
  data.whales.push(...newWhales);

  // Check withdrawals for all watched whales
  console.log('🔍 Checking withdrawal status for tracked whales...\n');
  const updatedWhales = [];
  
  for (const whale of data.whales) {
    if (whale.status === 'closed') continue;
    
    const prevWithdrawn = whale.withdrawnETH;
    await checkWhaleWithdrawals(whale, addressToCasino, ethPrice);
    
    if (whale.withdrawnETH !== prevWithdrawn) {
      updatedWhales.push(whale);
      console.log(`  📈 ${truncAddr(whale.address)} — withdrew ${fmt(whale.withdrawnUSD)} (was ${fmt(prevWithdrawn * ethPrice)})`);
    }
  }

  // Save updated data
  data.lastScan = new Date().toISOString();
  data.ethPrice = ethPrice;
  saveWhaleData(data);

  // Generate tweets
  const tweets = generateTweets(newWhales, updatedWhales, data.whales, ethPrice);
  
  // Save tweets
  fs.mkdirSync(path.dirname(TWEET_FILE), { recursive: true });
  fs.writeFileSync(TWEET_FILE, JSON.stringify({ date: new Date().toISOString(), tweets }, null, 2));

  // Print summary
  console.log('\n=== WHALE WATCH SUMMARY ===');
  console.log(`Total whales tracked: ${data.whales.length}`);
  console.log(`New whales today: ${newWhales.length}`);
  console.log(`Withdrawals detected: ${updatedWhales.length}`);
  console.log(`Zero withdrawal whales: ${data.whales.filter(w => w.withdrawnETH === 0).length}`);
  console.log(`Total deposited: ${fmt(data.whales.reduce((s, w) => s + w.depositUSD, 0))}`);
  console.log(`Total withdrawn: ${fmt(data.whales.reduce((s, w) => s + w.withdrawnUSD, 0))}`);

  if (tweets.length > 0) {
    console.log('\n=== TWEETS ===\n');
    tweets.forEach(t => {
      console.log(`--- ${t.label} ---`);
      console.log(t.text);
      console.log(`[${t.text.length} chars]\n`);
    });
  } else {
    console.log('\nNo new tweets to generate today.');
  }

  return { newWhales, updatedWhales, tweets, data };
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
