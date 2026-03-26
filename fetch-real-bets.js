#!/usr/bin/env node

/**
 * Fetch Real Casino Deposits from Blockchain
 * 
 * Tracks verified casino wallet addresses on Ethereum
 * Filters for large deposits (>$1,000)
 * Outputs to site/live-bets.json for live feed
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load env from site/.env.local (where wallet addresses live)
require('dotenv').config({ path: path.join(__dirname, 'site', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, 'site', '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
const MIN_USD_VALUE = 1000; // Only show deposits >$1k
const MAX_BETS_TO_STORE = 100; // Keep last 100 bets (more wallets = more data)
const OUTPUT_FILE = path.join(__dirname, 'site', 'live-bets.json');

// Casino wallet addresses — all verified Ethereum wallets from .env.local
const CASINO_WALLETS = {};

function loadWallets() {
  const walletDefs = [
    // Stake (3 wallets)
    { id: 'stake_1', name: 'Stake', env: 'STAKE_WALLET_1', icon: '🟢', color: '#00d632' },
    { id: 'stake_4', name: 'Stake', env: 'STAKE_WALLET_4', icon: '🟢', color: '#00d632' },
    { id: 'stake_11', name: 'Stake', env: 'STAKE_WALLET_11', icon: '🟢', color: '#00d632' },
    // Rollbit (3 wallets)
    { id: 'rollbit', name: 'Rollbit', env: 'ROLLBIT_HOT_WALLET', icon: '🎲', color: '#3b82f6' },
    { id: 'rollbit_ens', name: 'Rollbit', env: 'ROLLBIT_ENS', icon: '🎲', color: '#3b82f6' },
    { id: 'rollbit_tokens', name: 'Rollbit', env: 'ROLLBIT_TOKEN_WALLET', icon: '🎲', color: '#3b82f6' },
    // Roobet
    { id: 'roobet', name: 'Roobet', env: 'ROOBET_HOT_WALLET', icon: '🦘', color: '#f59e0b' },
    // BC.Game (3 wallets)
    { id: 'bcgame_1', name: 'BC.Game', env: 'BCGAME_HOT_WALLET_1', icon: '🎰', color: '#10b981' },
    { id: 'bcgame_2', name: 'BC.Game', env: 'BCGAME_HOT_WALLET_2', icon: '🎰', color: '#10b981' },
    { id: 'bcgame_3', name: 'BC.Game', env: 'BCGAME_WALLET_3', icon: '🎰', color: '#10b981' },
    // Duelbits
    { id: 'duelbits', name: 'Duelbits', env: 'DUELBITS_HOT_WALLET', icon: '⚔️', color: '#ef4444' },
    // Rainbet
    { id: 'rainbet', name: 'Rainbet', env: 'RAINBET_WALLET', icon: '🌧️', color: '#06b6d4' },
    // Gamdom
    { id: 'gamdom', name: 'Gamdom', env: 'GAMDOM_HOT_WALLET', icon: '🎯', color: '#8b5cf6' },
    // Bitcasino (3 wallets)
    { id: 'bitcasino_1', name: 'Bitcasino', env: 'BITCASINO_HOT_WALLET', icon: '🅱️', color: '#f97316' },
    { id: 'bitcasino_2', name: 'Bitcasino', env: 'BITCASINO_WALLET_2', icon: '🅱️', color: '#f97316' },
    { id: 'bitcasino_3', name: 'Bitcasino', env: 'BITCASINO_WALLET_3', icon: '🅱️', color: '#f97316' },
    // Shuffle
    { id: 'shuffle', name: 'Shuffle', env: 'SHUFFLE_ETH_WALLET', icon: '🔀', color: '#a855f7' },
    // BetFury
    { id: 'betfury', name: 'BetFury', env: 'BETFURY_ETH_WALLET', icon: '🔥', color: '#dc2626' },
    // 500 Casino
    { id: 'casino500', name: '500 Casino', env: 'CASINO500_ETH_WALLET', icon: '5️⃣', color: '#eab308' },
    // CSGO500
    { id: 'csgo500', name: 'CSGO500', env: 'CSGO500_ETH_WALLET', icon: '🎮', color: '#22c55e' },
    // Metawin (Arkham: meta-winners)
    { id: 'metawin', name: 'Metawin', env: 'METAWIN_ETH_WALLET', icon: '🏆', color: '#f472b6' },
    // Cloudbet (Arkham: cloudbet)
    { id: 'cloudbet', name: 'Cloudbet', env: 'CLOUDBET_ETH_WALLET', icon: '☁️', color: '#38bdf8' },
    // Wolf.bet (Arkham: wolf-bet)
    { id: 'wolfbet', name: 'Wolf.bet', env: 'WOLFBET_ETH_WALLET', icon: '🐺', color: '#737373' },
  ];

  let loaded = 0;
  for (const def of walletDefs) {
    const address = process.env[def.env];
    if (address && address.startsWith('0x')) {
      CASINO_WALLETS[def.id] = {
        name: def.name,
        address: address,
        icon: def.icon,
        color: def.color
      };
      loaded++;
    }
  }
  console.log(`📦 Loaded ${loaded} Ethereum wallet addresses across ${new Set(walletDefs.filter(d => process.env[d.env]).map(d => d.name)).size} casinos\n`);
}

// Crypto to USD conversion rates (fetched dynamically)
let cryptoPrices = {
  ETH: 0,
  USDT: 1.00,
  USDC: 1.00
};

// ============================================================================
// CRYPTO PRICE FETCHING
// ============================================================================

async function updateCryptoPrices() {
  try {
    // Fetch ETH price from CoinGecko (free, no API key needed)
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'ethereum',
        vs_currencies: 'usd'
      },
      timeout: 5000
    });
    
    cryptoPrices.ETH = response.data.ethereum.usd;
    console.log(`✅ Updated ETH price: $${cryptoPrices.ETH.toLocaleString()}`);
  } catch (error) {
    console.error('⚠️  Failed to fetch ETH price, using last known value:', error.message);
    // Fallback to approximate price if API fails
    if (cryptoPrices.ETH === 0) {
      cryptoPrices.ETH = 3000; // Approximate fallback
    }
  }
}

// ============================================================================
// ETHERSCAN API
// ============================================================================

async function fetchTransactions(walletAddress, casinoId) {
  try {
    // Etherscan V2 API (V1 deprecated)
    const url = `https://api.etherscan.io/v2/api`;
    const params = {
      chainid: 1,
      module: 'account',
      action: 'txlist',
      address: walletAddress,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 20, // Last 20 transactions
      sort: 'desc',
      apikey: ETHERSCAN_API_KEY
    };
    
    const response = await axios.get(url, { params, timeout: 10000 });
    
    if (response.data.status !== '1') {
      throw new Error(response.data.message || 'API error');
    }
    
    return response.data.result || [];
  } catch (error) {
    console.error(`❌ Failed to fetch ${casinoId} transactions:`, error.message);
    return [];
  }
}

// ============================================================================
// TRANSACTION PROCESSING
// ============================================================================

function isIncomingDeposit(tx, walletAddress) {
  // Transaction is incoming if wallet is the recipient (to address)
  return tx.to && tx.to.toLowerCase() === walletAddress.toLowerCase();
}

function calculateUSDValue(tx) {
  // Convert wei to ETH (1 ETH = 10^18 wei)
  const ethAmount = parseFloat(tx.value) / 1e18;
  
  // Skip zero-value transactions
  if (ethAmount === 0) return 0;
  
  // Convert to USD
  return ethAmount * cryptoPrices.ETH;
}

function formatBet(tx, casino) {
  const ethAmount = (parseFloat(tx.value) / 1e18).toFixed(4);
  const usdValue = calculateUSDValue(tx);
  const timestamp = new Date(parseInt(tx.timeStamp) * 1000);
  
  return {
    casino: {
      id: Object.keys(CASINO_WALLETS).find(key => CASINO_WALLETS[key].address.toLowerCase() === tx.to.toLowerCase()),
      name: casino.name,
      icon: casino.icon,
      color: casino.color
    },
    crypto: {
      symbol: 'ETH',
      icon: '💎',
      amount: ethAmount
    },
    amount: ethAmount,
    usdValue: Math.round(usdValue),
    timestamp: timestamp.toISOString(),
    txHash: tx.hash,
    etherscanUrl: `https://etherscan.io/tx/${tx.hash}`,
    from: tx.from,
    blockNumber: tx.blockNumber
  };
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function fetchAllBets() {
  console.log('\n🔍 Fetching real casino deposits...\n');
  
  // Load wallets from env
  loadWallets();
  
  // Update crypto prices first
  await updateCryptoPrices();
  
  const allBets = [];
  
  // Fetch from all casino wallets
  for (const [casinoId, casino] of Object.entries(CASINO_WALLETS)) {
    console.log(`📊 Checking ${casino.name}...`);
    
    const transactions = await fetchTransactions(casino.address, casinoId);
    console.log(`   Found ${transactions.length} recent transactions`);
    
    // Filter for incoming deposits
    const deposits = transactions.filter(tx => isIncomingDeposit(tx, casino.address));
    console.log(`   ${deposits.length} are incoming deposits`);
    
    // Filter for large deposits (>$1k)
    const largeBets = deposits
      .map(tx => {
        const usdValue = calculateUSDValue(tx);
        return { tx, usdValue };
      })
      .filter(({ usdValue }) => usdValue >= MIN_USD_VALUE)
      .map(({ tx }) => formatBet(tx, casino));
    
    console.log(`   ✅ ${largeBets.length} deposits over $${MIN_USD_VALUE.toLocaleString()}\n`);
    
    allBets.push(...largeBets);
    
    // Rate limit: wait 250ms between API calls (Etherscan free tier = 5/sec)
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // Sort by timestamp (newest first)
  allBets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Keep only the most recent bets
  const recentBets = allBets.slice(0, MAX_BETS_TO_STORE);
  
  console.log(`\n💾 Saving ${recentBets.length} bets to ${OUTPUT_FILE}`);
  
  return recentBets;
}

async function saveBets(bets) {
  try {
    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write to file with pretty formatting
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      bets: bets,
      stats: {
        totalBets: bets.length,
        casinos: [...new Set(bets.map(b => b.casino.name))],
        totalVolume: bets.reduce((sum, b) => sum + b.usdValue, 0)
      }
    }, null, 2));
    
    console.log('✅ Successfully saved live bets data\n');
  } catch (error) {
    console.error('❌ Failed to save bets:', error.message);
  }
}

async function displaySummary(bets) {
  if (bets.length === 0) {
    console.log('⚠️  No large deposits found. Try lowering MIN_USD_VALUE or check later.');
    return;
  }
  
  console.log('📈 SUMMARY:\n');
  console.log(`   Total bets: ${bets.length}`);
  console.log(`   Total volume: $${bets.reduce((sum, b) => sum + b.usdValue, 0).toLocaleString()}`);
  console.log(`   Biggest bet: $${Math.max(...bets.map(b => b.usdValue)).toLocaleString()}`);
  console.log('\n   Latest 5 bets:');
  
  bets.slice(0, 5).forEach((bet, i) => {
    const timeAgo = Math.floor((Date.now() - new Date(bet.timestamp)) / 1000 / 60);
    console.log(`   ${i + 1}. ${bet.casino.icon} ${bet.casino.name}: ${bet.crypto.icon} ${bet.amount} ETH ($${bet.usdValue.toLocaleString()}) - ${timeAgo}m ago`);
  });
  
  console.log('\n');
}

// ============================================================================
// RUN
// ============================================================================

async function main() {
  try {
    const bets = await fetchAllBets();
    await saveBets(bets);
    await displaySummary(bets);
    
    console.log('✨ Done! Live feed data updated.\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, fetchAllBets, updateCryptoPrices };
