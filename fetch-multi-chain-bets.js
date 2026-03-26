#!/usr/bin/env node

/**
 * Multi-Chain Casino Deposit Tracker
 * 
 * Tracks verified casino wallets across:
 * - Ethereum
 * - BSC (Binance Smart Chain)
 * - Polygon
 * - Arbitrum
 * - Base
 * 
 * Uses Moralis API for multi-chain support
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load API keys
const envPath = path.join(__dirname, '.env.local');
let MORALIS_API_KEY, ETHERSCAN_API_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const moralisMatch = envContent.match(/MORALIS_API_KEY=(.+)/);
  const etherscanMatch = envContent.match(/ETHERSCAN_API_KEY=(.+)/);
  
  if (moralisMatch) MORALIS_API_KEY = moralisMatch[1].trim();
  if (etherscanMatch) ETHERSCAN_API_KEY = etherscanMatch[1].trim();
}

const MIN_USD_VALUE = 100; // Only show deposits >$100
const MAX_BETS_PER_CHAIN = 50; // Keep last 50 bets per chain
const MAX_AGE_DAYS = 7; // Only show deposits from last 7 days
const OUTPUT_FILE = path.join(__dirname, 'site', 'live-bets.json');

// Chain configurations
const CHAINS = {
  eth: { id: '0x1', name: 'Ethereum', icon: '⟠', color: '#627eea', explorerBase: 'https://etherscan.io' },
  bsc: { id: '0x38', name: 'BSC', icon: '🔶', color: '#f3ba2f', explorerBase: 'https://bscscan.com' },
  polygon: { id: '0x89', name: 'Polygon', icon: '🟣', color: '#8247e5', explorerBase: 'https://polygonscan.com' },
  arbitrum: { id: '0xa4b1', name: 'Arbitrum', icon: '🔵', color: '#28a0f0', explorerBase: 'https://arbiscan.io' },
  base: { id: '0x2105', name: 'Base', icon: '🔷', color: '#0052ff', explorerBase: 'https://basescan.org' }
};

// Casino wallet addresses (multi-chain)
// Note: Same addresses work across EVM chains (Ethereum, BSC, Polygon, etc.)
const CASINO_WALLETS = {
  // Ethereum - Major Casinos
  shuffle_eth: {
    name: 'Shuffle',
    address: '0xdfaa75323fb721e5f29d43859390f62cc4b600b8',
    chain: 'eth',
    icon: '🔀',
    color: '#8b5cf6'
  },
  shuffle_eth_2: {
    name: 'Shuffle',
    address: '0xb0E62712d08d246C03EF19076dfbA56C355b4022',
    chain: 'eth',
    icon: '🔀',
    color: '#8b5cf6'
  },
  stake_eth: {
    name: 'Stake',
    address: '0x0000000000a39bb272e79075ade125fd351887ac',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  stake_eth_2: {
    name: 'Stake',
    address: '0x974caa59e49682cda0ad2bbe82983419a2ecc400',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  rollbit_eth: {
    name: 'Rollbit',
    address: '0xcbd6832ebc203e49e2b771897067fce3c58575ac',
    chain: 'eth',
    icon: '🎲',
    color: '#3b82f6'
  },
  rollbit_erc20: {
    name: 'Rollbit',
    address: '0xef8801eaf234ff82801821ffe2d78d60a0237f97',
    chain: 'eth',
    icon: '🎲',
    color: '#3b82f6'
  },
  rollbit_eth_3: {
    name: 'Rollbit',
    address: '0x772D8d6e4A4a5251d7a174e3F60E3F954B386aF0',
    chain: 'eth',
    icon: '🎲',
    color: '#3b82f6'
  },
  roobet_eth: {
    name: 'Roobet',
    address: '0xc94ebb328ac25b95db0e0aa968371885fa516215',
    chain: 'eth',
    icon: '🦘',
    color: '#f59e0b'
  },
  duelbits_eth: {
    name: 'Duelbits',
    address: '0x014435b1e39945cf4f5f0c3cbb5833195a95cc9b',
    chain: 'eth',
    icon: '⚔️',
    color: '#ef4444'
  },
  gamdom_eth: {
    name: 'Gamdom',
    address: '0xd5fbda4c79f38920159fe5f22df9655fde292d47',
    chain: 'eth',
    icon: '🎮',
    color: '#06b6d4'
  },
  betfury_eth: {
    name: 'BetFury',
    address: '0x52a258ed593c793251a89bfd36cae158ee9fc4f8',
    chain: 'eth',
    icon: '🔥',
    color: '#f97316'
  },
  betfury_eth_2: {
    name: 'BetFury',
    address: '0x343FEC76950938a45d9dE62BeA9b1F214dFF57Ce',
    chain: 'eth',
    icon: '🔥',
    color: '#f97316'
  },
  betfury_eth_3: {
    name: 'BetFury',
    address: '0x4b2CAd10b86c42Fb79518D0ee4905D2868a77D42',
    chain: 'eth',
    icon: '🔥',
    color: '#f97316'
  },
  bcgame_eth: {
    name: 'BC.Game',
    address: '0x788529118f2a28c60b9de2ba0353f5ee4293e044',
    chain: 'eth',
    icon: '🎰',
    color: '#10b981'
  },
  casino500_eth: {
    name: '500 Casino',
    address: '0xafc53db8506736e8264b4629e971a152ec3ff7d4',
    chain: 'eth',
    icon: '🃏',
    color: '#a855f7'
  },
  bitcasino_eth1: {
    name: 'Bitcasino.io',
    address: '0x5bcbdfb6cc624b959c39a2d16110d1f2d9204f72',
    chain: 'eth',
    icon: '🎲',
    color: '#14b8a6'
  },
  bitcasino_eth2: {
    name: 'Bitcasino.io',
    address: '0xe48c9a989438606a79a7560cfba3d34bafbac38e',
    chain: 'eth',
    icon: '🎲',
    color: '#14b8a6'
  },
  csgo500_eth: {
    name: 'CSGO500',
    address: '0x12352a385b6ca96b724d6203e234dc25f73e224c',
    chain: 'eth',
    icon: '🔫',
    color: '#64748b'
  },
  
  stake_eth_3: {
    name: 'Stake',
    address: '0x6e29f75b0350fd0e85EE34a21eF94767b0186996',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  stake_eth_4: {
    name: 'Stake',
    address: '0xDF1fC5523f2e5eA4f6DAc2eAEd3263953A391B0c',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  stake_eth_5: {
    name: 'Stake',
    address: '0x758BE77a3eE14e7193730560daA07dd3fcBFD200',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  stake_eth_6: {
    name: 'Stake',
    address: '0x787B8840100d9BaAdD7463f4a73b5BA73B00C6cA',
    chain: 'eth',
    icon: '💎',
    color: '#00e701'
  },
  // Stake Tron wallet (not tracked yet - no Tron chain support)
  // TZ8Ksz21Hk1tQuztCKCUJBRXStCav9uyjM
  
  alphapro_eth: {
    name: 'Alpha Pro',
    address: '0xf60DC2b5079ABDe7d4cC0CC1920f184Dc9DC4907',
    chain: 'eth',
    icon: '🅰️',
    color: '#6366f1'
  },
  betfin_eth: {
    name: 'Betfin',
    address: '0xbfCDB5b5102f376AEFA31129E8125D04B3666666',
    chain: 'eth',
    icon: '🎯',
    color: '#22c55e'
  },
  betfin_eth_2: {
    name: 'Betfin',
    address: '0xBf87898C4e609598a393cCD765482BeF80000000',
    chain: 'eth',
    icon: '🎯',
    color: '#22c55e'
  },
  
  // Binance Hot Wallet (Ethereum)
  binance_eth: {
    name: 'Binance',
    address: '0xfa500178de024bf43cfa69b7e636a28ab68f2741',
    chain: 'eth',
    icon: '🟡',
    color: '#f3ba2f'
  },
  
  // BSC (Binance Smart Chain)
  shuffle_bsc: {
    name: 'Shuffle',
    address: '0xdfaa75323fb721e5f29d43859390f62cc4b600b8', // Same address!
    chain: 'bsc',
    icon: '🔀',
    color: '#8b5cf6'
  },
  stake_bsc: {
    name: 'Stake',
    address: '0x0000000000a39bb272e79075ade125fd351887ac', // Main hot wallet
    chain: 'bsc',
    icon: '💎',
    color: '#00e701'
  },
  stake_bsc_2: {
    name: 'Stake',
    address: '0x974caa59e49682cda0ad2bbe82983419a2ecc400',
    chain: 'bsc',
    icon: '💎',
    color: '#00e701'
  },
  
  // Polygon
  stake_polygon: {
    name: 'Stake',
    address: '0x0000000000a39bb272e79075ade125fd351887ac', // Main hot wallet
    chain: 'polygon',
    icon: '💎',
    color: '#00e701'
  },
  stake_polygon_2: {
    name: 'Stake',
    address: '0x019D0706D65c4768ec8081eD7CE41F59Eef9b86c',
    chain: 'polygon',
    icon: '💎',
    color: '#00e701'
  },
  stake_polygon_2: {
    name: 'Stake',
    address: '0x974caa59e49682cda0ad2bbe82983419a2ecc400',
    chain: 'polygon',
    icon: '💎',
    color: '#00e701'
  },
  
  // Arbitrum (L2)
  shuffle_arbitrum: {
    name: 'Shuffle',
    address: '0xdfaa75323fb721e5f29d43859390f62cc4b600b8', // Same address!
    chain: 'arbitrum',
    icon: '🔀',
    color: '#8b5cf6'
  },
  stake_arbitrum: {
    name: 'Stake',
    address: '0x0000000000a39bb272e79075ade125fd351887ac', // Main hot wallet
    chain: 'arbitrum',
    icon: '💎',
    color: '#00e701'
  },
  stake_arbitrum_2: {
    name: 'Stake',
    address: '0x974caa59e49682cda0ad2bbe82983419a2ecc400',
    chain: 'arbitrum',
    icon: '💎',
    color: '#00e701'
  },
  
  // Base (Coinbase L2)
  shuffle_base: {
    name: 'Shuffle',
    address: '0xdfaa75323fb721e5f29d43859390f62cc4b600b8', // Same address!
    chain: 'base',
    icon: '🔀',
    color: '#8b5cf6'
  },
  stake_base: {
    name: 'Stake',
    address: '0x0000000000a39bb272e79075ade125fd351887ac', // Main hot wallet
    chain: 'base',
    icon: '💎',
    color: '#00e701'
  },
  stake_base_2: {
    name: 'Stake',
    address: '0x974caa59e49682cda0ad2bbe82983419a2ecc400',
    chain: 'base',
    icon: '💎',
    color: '#00e701'
  },
  stake_base_3: { name: 'Stake', address: '0xDF1fC5523f2e5eA4f6DAc2eAEd3263953A391B0c', chain: 'base', icon: '💎', color: '#00e701' },
  stake_base_4: { name: 'Stake', address: '0x019D0706D65c4768ec8081eD7CE41F59Eef9b86c', chain: 'base', icon: '💎', color: '#00e701' },
  stake_base_5: { name: 'Stake', address: '0xFa500178de024BF43CFA69B7e636A28AB68F2741', chain: 'base', icon: '💎', color: '#00e701' },
  stake_bsc_3: { name: 'Stake', address: '0xFa500178de024BF43CFA69B7e636A28AB68F2741', chain: 'bsc', icon: '💎', color: '#00e701' },
  stake_polygon_3: { name: 'Stake', address: '0x019D0706D65c4768ec8081eD7CE41F59Eef9b86c', chain: 'polygon', icon: '💎', color: '#00e701' },

  // Roobet multi-chain (Arkham Mar 26)
  roobet_base: { name: 'Roobet', address: '0xA26148AE51fa8E787DF319C04137602Cc018b521', chain: 'base', icon: '🦘', color: '#f59e0b' },
  roobet_base_2: { name: 'Roobet', address: '0xC94eBB328aC25b95DB0E0AA968371885Fa516215', chain: 'base', icon: '🦘', color: '#f59e0b' },
  roobet_bsc: { name: 'Roobet', address: '0xA26148AE51fa8E787DF319C04137602Cc018b521', chain: 'bsc', icon: '🦘', color: '#f59e0b' },
  roobet_polygon: { name: 'Roobet', address: '0xC94eBB328aC25b95DB0E0AA968371885Fa516215', chain: 'polygon', icon: '🦘', color: '#f59e0b' },
  roobet_polygon_2: { name: 'Roobet', address: '0xA26148AE51fa8E787DF319C04137602Cc018b521', chain: 'polygon', icon: '🦘', color: '#f59e0b' },

  // BC.Game multi-chain (Arkham Mar 26)
  bcgame_base: { name: 'BC.Game', address: '0xA7B9874D15742358fB455Dd56f97C6d19ad74f5C', chain: 'base', icon: '🎰', color: '#10b981' },
  bcgame_arb: { name: 'BC.Game', address: '0xe7176831C898D585Cd999bCee9984A7fA9A6be96', chain: 'arbitrum', icon: '🎰', color: '#10b981' },
  bcgame_bsc: { name: 'BC.Game', address: '0x49395574019Ae44d46D535215303A09fD596727c', chain: 'bsc', icon: '🎰', color: '#10b981' },
  bcgame_polygon: { name: 'BC.Game', address: '0x6AdC35BBdD759bE047d9D28B94f5734a9c0cB563', chain: 'polygon', icon: '🎰', color: '#10b981' },

  // Gamdom multi-chain (Arkham Mar 26)
  gamdom_base: { name: 'Gamdom', address: '0x580450Dff316AE00D0fbEF9621A304020A046CE2', chain: 'base', icon: '🎮', color: '#06b6d4' },
  gamdom_bsc: { name: 'Gamdom', address: '0xd5FBDa4C79F38920159fE5f22DF9655FDe292d47', chain: 'bsc', icon: '🎮', color: '#06b6d4' },
  gamdom_polygon: { name: 'Gamdom', address: '0x580450Dff316AE00D0fbEF9621A304020A046CE2', chain: 'polygon', icon: '🎮', color: '#06b6d4' },

  // Duelbits multi-chain (Arkham Mar 26)
  duelbits_base: { name: 'Duelbits', address: '0x014435B1E39945CF4f5F0c3cbb5833195A95CC9B', chain: 'base', icon: '⚔️', color: '#ef4444' },
  duelbits_bsc: { name: 'Duelbits', address: '0x014435B1E39945CF4f5F0c3cbb5833195A95CC9B', chain: 'bsc', icon: '⚔️', color: '#ef4444' },
  duelbits_polygon: { name: 'Duelbits', address: '0x014435B1E39945CF4f5F0c3cbb5833195A95CC9B', chain: 'polygon', icon: '⚔️', color: '#ef4444' },

  // Rollbit multi-chain (Arkham Mar 26)
  rollbit_base: { name: 'Rollbit', address: '0x046EeE2cc3188071C02BfC1745A6b17c656e3f3d', chain: 'base', icon: '🎲', color: '#3b82f6' },
  rollbit_base_2: { name: 'Rollbit', address: '0x46dcA395D20E63Cb0Fe1EDC9f0e6f012E77c0913', chain: 'base', icon: '🎲', color: '#3b82f6' },
  rollbit_bsc_2: { name: 'Rollbit', address: '0xEf8801eaf234ff82801821FFe2d78D60a0237F97', chain: 'bsc', icon: '🎲', color: '#3b82f6' },
  rollbit_bsc_3: { name: 'Rollbit', address: '0x46dcA395D20E63Cb0Fe1EDC9f0e6f012E77c0913', chain: 'bsc', icon: '🎲', color: '#3b82f6' },
  rollbit_polygon_2: { name: 'Rollbit', address: '0xCBD6832Ebc203e49E2B771897067fce3c58575ac', chain: 'polygon', icon: '🎲', color: '#3b82f6' },
  rollbit_polygon_3: { name: 'Rollbit', address: '0x8aE57A027c63fcA8070D1Bf38622321dE8004c67', chain: 'polygon', icon: '🎲', color: '#3b82f6' },
  rollbit_polygon_4: { name: 'Rollbit', address: '0xEf8801eaf234ff82801821FFe2d78D60a0237F97', chain: 'polygon', icon: '🎲', color: '#3b82f6' },

  // BetFury multi-chain (Arkham Mar 26 — same address most chains)
  betfury_base: { name: 'BetFury', address: '0x52A258ED593C793251a89bfd36caE158EE9fC4F8', chain: 'base', icon: '🔥', color: '#f97316' },
  betfury_base_2: { name: 'BetFury', address: '0x4b2CAd10b86c42Fb79518D0ee4905D2868a77D42', chain: 'base', icon: '🔥', color: '#f97316' },
  betfury_arb: { name: 'BetFury', address: '0x52A258ED593C793251a89bfd36caE158EE9fC4F8', chain: 'arbitrum', icon: '🔥', color: '#f97316' },
  betfury_bsc: { name: 'BetFury', address: '0x52A258ED593C793251a89bfd36caE158EE9fC4F8', chain: 'bsc', icon: '🔥', color: '#f97316' },
  betfury_polygon: { name: 'BetFury', address: '0x52A258ED593C793251a89bfd36caE158EE9fC4F8', chain: 'polygon', icon: '🔥', color: '#f97316' },

  // Metawin multi-chain (Arkham Mar 26 — same address all chains)
  metawin_eth: { name: 'Metawin', address: '0xfF0f50FA7016e4390cB6B069347c635cFd035c6B', chain: 'eth', icon: '🏆', color: '#f472b6' },
  metawin_base: { name: 'Metawin', address: '0xfF0f50FA7016e4390cB6B069347c635cFd035c6B', chain: 'base', icon: '🏆', color: '#f472b6' },
  metawin_arb: { name: 'Metawin', address: '0xfF0f50FA7016e4390cB6B069347c635cFd035c6B', chain: 'arbitrum', icon: '🏆', color: '#f472b6' },
  metawin_bsc: { name: 'Metawin', address: '0xfF0f50FA7016e4390cB6B069347c635cFd035c6B', chain: 'bsc', icon: '🏆', color: '#f472b6' },
  metawin_polygon: { name: 'Metawin', address: '0xfF0f50FA7016e4390cB6B069347c635cFd035c6B', chain: 'polygon', icon: '🏆', color: '#f472b6' },

  // Cloudbet multi-chain (Arkham Mar 26 — same address all chains)
  cloudbet_eth: { name: 'Cloudbet', address: '0x155f16487000C813e72c90a3B62c0dc418106570', chain: 'eth', icon: '☁️', color: '#38bdf8' },
  cloudbet_base: { name: 'Cloudbet', address: '0x155f16487000C813e72c90a3B62c0dc418106570', chain: 'base', icon: '☁️', color: '#38bdf8' },
  cloudbet_arb: { name: 'Cloudbet', address: '0x155f16487000C813e72c90a3B62c0dc418106570', chain: 'arbitrum', icon: '☁️', color: '#38bdf8' },
  cloudbet_bsc: { name: 'Cloudbet', address: '0x155f16487000C813e72c90a3B62c0dc418106570', chain: 'bsc', icon: '☁️', color: '#38bdf8' },
  cloudbet_polygon: { name: 'Cloudbet', address: '0x155f16487000C813e72c90a3B62c0dc418106570', chain: 'polygon', icon: '☁️', color: '#38bdf8' },

  // Wolf.bet multi-chain (Arkham Mar 26)
  wolfbet_eth: { name: 'Wolf.bet', address: '0x7A7F78a2aF5aEF01a889e8713083ab77DCC9Fc9B', chain: 'eth', icon: '🐺', color: '#737373' },
  wolfbet_base: { name: 'Wolf.bet', address: '0x7A7F78a2aF5aEF01a889e8713083ab77DCC9Fc9B', chain: 'base', icon: '🐺', color: '#737373' },
  wolfbet_bsc: { name: 'Wolf.bet', address: '0x7A7F78a2aF5aEF01a889e8713083ab77DCC9Fc9B', chain: 'bsc', icon: '🐺', color: '#737373' }
};

// Crypto prices cache
let cryptoPrices = {
  ETH: 0,
  BNB: 0,
  MATIC: 0
};

// ============================================================================
// PRICE FETCHING
// ============================================================================

async function updateCryptoPrices() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'ethereum,binancecoin,matic-network',
        vs_currencies: 'usd'
      },
      timeout: 5000
    });
    
    cryptoPrices.ETH = response.data.ethereum?.usd || 3000;
    cryptoPrices.BNB = response.data.binancecoin?.usd || 400;
    cryptoPrices.MATIC = response.data['matic-network']?.usd || 0.8;
    
    console.log(`✅ Prices: ETH $${cryptoPrices.ETH.toLocaleString()}, BNB $${cryptoPrices.BNB.toLocaleString()}, MATIC $${cryptoPrices.MATIC.toFixed(2)}`);
  } catch (error) {
    console.error('⚠️  Failed to fetch prices:', error.message);
    // Use fallback prices
    if (cryptoPrices.ETH === 0) {
      cryptoPrices.ETH = 3000;
      cryptoPrices.BNB = 400;
      cryptoPrices.MATIC = 0.8;
    }
  }
}

function getNativeTokenPrice(chain) {
  switch (chain) {
    case 'eth':
    case 'arbitrum':
    case 'base':
      return cryptoPrices.ETH;
    case 'bsc':
      return cryptoPrices.BNB;
    case 'polygon':
      return cryptoPrices.MATIC;
    default:
      return 0;
  }
}

function getNativeTokenSymbol(chain) {
  switch (chain) {
    case 'eth':
    case 'arbitrum':
    case 'base':
      return 'ETH';
    case 'bsc':
      return 'BNB';
    case 'polygon':
      return 'MATIC';
    default:
      return 'TOKEN';
  }
}

// ============================================================================
// MORALIS API
// ============================================================================

async function fetchTransactionsMoralis(walletAddress, chain) {
  if (!MORALIS_API_KEY) {
    throw new Error('MORALIS_API_KEY not found in .env.local');
  }
  
  try {
    const chainConfig = CHAINS[chain];
    const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}`;
    
    const response = await axios.get(url, {
      params: {
        chain: chainConfig.id,
        limit: 50
      },
      headers: {
        'Accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      },
      timeout: 10000
    });
    
    return response.data.result || [];
  } catch (error) {
    console.error(`❌ Moralis API error for ${chain}:`, error.message);
    return [];
  }
}

// ============================================================================
// TRANSACTION PROCESSING
// ============================================================================

function isIncomingDeposit(tx, walletAddress) {
  return tx.to_address && tx.to_address.toLowerCase() === walletAddress.toLowerCase();
}

function calculateUSDValue(tx, chain) {
  const nativeAmount = parseFloat(tx.value) / 1e18;
  if (nativeAmount === 0) return 0;
  
  const price = getNativeTokenPrice(chain);
  return nativeAmount * price;
}

function formatBet(tx, casino) {
  const chainConfig = CHAINS[casino.chain];
  const nativeAmount = (parseFloat(tx.value) / 1e18).toFixed(4);
  const usdValue = calculateUSDValue(tx, casino.chain);
  const timestamp = new Date(tx.block_timestamp);
  const tokenSymbol = getNativeTokenSymbol(casino.chain);
  
  // Check if deposit is too old
  const ageMs = Date.now() - timestamp.getTime();
  const ageDays = ageMs / 86400000;
  if (ageDays > MAX_AGE_DAYS) {
    return null; // Skip old deposits
  }
  
  return {
    casino: {
      id: Object.keys(CASINO_WALLETS).find(key => 
        CASINO_WALLETS[key].address.toLowerCase() === tx.to_address.toLowerCase() &&
        CASINO_WALLETS[key].chain === casino.chain
      ),
      name: casino.name,
      icon: casino.icon,
      color: casino.color
    },
    chain: {
      id: casino.chain,
      name: chainConfig.name,
      icon: chainConfig.icon,
      color: chainConfig.color
    },
    crypto: {
      symbol: tokenSymbol,
      icon: tokenSymbol === 'ETH' ? '💎' : tokenSymbol === 'BNB' ? '🔶' : '🟣',
      amount: nativeAmount
    },
    amount: nativeAmount,
    usdValue: Math.round(usdValue),
    timestamp: timestamp.toISOString(),
    txHash: tx.hash,
    explorerUrl: `${chainConfig.explorerBase}/tx/${tx.hash}`,
    from: tx.from_address,
    blockNumber: tx.block_number
  };
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function fetchAllBets() {
  console.log('\n🔍 Fetching multi-chain casino deposits...\n');
  
  await updateCryptoPrices();
  
  const allBets = [];
  const chainStats = {};
  
  // Group casinos by chain
  const casinosByChain = {};
  for (const [id, casino] of Object.entries(CASINO_WALLETS)) {
    if (!casinosByChain[casino.chain]) {
      casinosByChain[casino.chain] = [];
    }
    casinosByChain[casino.chain].push({ id, ...casino });
  }
  
  // Fetch from all chains
  for (const [chain, casinos] of Object.entries(casinosByChain)) {
    console.log(`\n${CHAINS[chain].icon} ${CHAINS[chain].name.toUpperCase()} Chain:`);
    console.log('─'.repeat(50));
    
    chainStats[chain] = { deposits: 0, volume: 0 };
    
    for (const casino of casinos) {
      console.log(`📊 ${casino.name}...`);
      
      const transactions = await fetchTransactionsMoralis(casino.address, chain);
      console.log(`   Found ${transactions.length} recent transactions`);
      
      const deposits = transactions.filter(tx => isIncomingDeposit(tx, casino.address));
      console.log(`   ${deposits.length} are incoming deposits`);
      
      const largeBets = deposits
        .map(tx => {
          const usdValue = calculateUSDValue(tx, chain);
          return { tx, usdValue };
        })
        .filter(({ usdValue }) => usdValue >= MIN_USD_VALUE)
        .map(({ tx }) => formatBet(tx, casino))
        .filter(bet => bet !== null); // Remove old deposits
      
      console.log(`   ✅ ${largeBets.length} deposits over $${MIN_USD_VALUE.toLocaleString()}`);
      
      chainStats[chain].deposits += largeBets.length;
      chainStats[chain].volume += largeBets.reduce((sum, b) => sum + b.usdValue, 0);
      
      allBets.push(...largeBets);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Sort by timestamp
  allBets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  console.log('\n📊 CHAIN SUMMARY:');
  console.log('─'.repeat(50));
  for (const [chain, stats] of Object.entries(chainStats)) {
    const chainConfig = CHAINS[chain];
    console.log(`${chainConfig.icon} ${chainConfig.name}: ${stats.deposits} deposits, $${stats.volume.toLocaleString()} volume`);
  }
  console.log('');
  
  return { bets: allBets, chainStats };
}

async function saveBets(data) {
  try {
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const output = {
      lastUpdated: new Date().toISOString(),
      bets: data.bets,
      stats: {
        totalBets: data.bets.length,
        chains: data.chainStats,
        casinos: [...new Set(data.bets.map(b => b.casino.name))],
        totalVolume: data.bets.reduce((sum, b) => sum + b.usdValue, 0)
      },
      supportedChains: Object.keys(CHAINS).map(key => ({
        id: key,
        name: CHAINS[key].name,
        icon: CHAINS[key].icon
      }))
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    console.log(`✅ Saved ${data.bets.length} bets to ${OUTPUT_FILE}\n`);
  } catch (error) {
    console.error('❌ Failed to save bets:', error.message);
  }
}

async function displaySummary(data) {
  if (data.bets.length === 0) {
    console.log('⚠️  No large deposits found across any chain.');
    return;
  }
  
  console.log('📈 OVERALL SUMMARY:\n');
  console.log(`   Total bets: ${data.bets.length}`);
  console.log(`   Total volume: $${data.bets.reduce((sum, b) => sum + b.usdValue, 0).toLocaleString()}`);
  console.log(`   Biggest bet: $${Math.max(...data.bets.map(b => b.usdValue)).toLocaleString()}`);
  console.log('\n   Latest 5 bets (all chains):');
  
  data.bets.slice(0, 5).forEach((bet, i) => {
    const timeAgo = Math.floor((Date.now() - new Date(bet.timestamp)) / 1000 / 60);
    console.log(`   ${i + 1}. ${bet.chain.icon} ${bet.chain.name} | ${bet.casino.icon} ${bet.casino.name}: ${bet.crypto.icon} ${bet.amount} ${bet.crypto.symbol} ($${bet.usdValue.toLocaleString()}) - ${timeAgo}m ago`);
  });
  
  console.log('\n');
}

// ============================================================================
// RUN
// ============================================================================

async function main() {
  try {
    const data = await fetchAllBets();
    await saveBets(data);
    await displaySummary(data);
    
    console.log('✨ Done! Multi-chain live feed updated.\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, fetchAllBets, updateCryptoPrices };
