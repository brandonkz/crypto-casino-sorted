#!/usr/bin/env node

/**
 * Export crypto casino deposits to CSV
 * Import to Google Sheets or analyze locally
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Build wallet list dynamically from .env.local
const CASINO_WALLETS = {
  // Stake (multiple wallets)
  'Stake': process.env.STAKE_WALLET_1,
  'Stake 4': process.env.STAKE_WALLET_4,
  'Stake 11': process.env.STAKE_WALLET_11,
  
  // Rollbit
  'Rollbit': process.env.ROLLBIT_HOT_WALLET,
  'Rollbit ENS': process.env.ROLLBIT_ENS,
  
  // Roobet
  'Roobet': process.env.ROOBET_HOT_WALLET,
  
  // BC.Game
  'BC.Game': process.env.BCGAME_HOT_WALLET_1,
  'BC.Game 2': process.env.BCGAME_HOT_WALLET_2,
  
  // Duelbits
  'Duelbits': process.env.DUELBITS_HOT_WALLET,
  
  // Rainbet
  'Rainbet': process.env.RAINBET_WALLET,
  
  // Gamdom
  'Gamdom': process.env.GAMDOM_HOT_WALLET,
  
  // Bitcasino
  'Bitcasino': process.env.BITCASINO_HOT_WALLET
};

// Filter out undefined wallets
Object.keys(CASINO_WALLETS).forEach(key => {
  if (!CASINO_WALLETS[key]) delete CASINO_WALLETS[key];
});

const BLOCKS_PER_DAY = 7200;
const ETH_USD_PRICE = 2800; // Update manually or fetch from API

async function getCurrentBlock() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.etherscan.io',
      path: `/v2/api?chainid=1&module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`,
      method: 'GET'
    };
    
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(parseInt(result.result, 16));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getWalletTransactions(address, label, startBlock) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.etherscan.io',
      path: `/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&page=1&offset=1000&sort=asc&apikey=${ETHERSCAN_API_KEY}`,
      method: 'GET'
    };
    
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === '1' && result.result) {
            const deposits = result.result
              .filter(tx => tx.to.toLowerCase() === address.toLowerCase() && tx.value !== '0')
              .map(tx => {
                const timestamp = parseInt(tx.timeStamp) * 1000;
                const date = new Date(timestamp);
                const amount = parseInt(tx.value) / 1e18;
                
                return {
                  date: date.toISOString().split('T')[0],
                  time: date.toISOString().split('T')[1].substring(0, 8),
                  datetime: date.toISOString(),
                  casino: label,
                  walletAddress: address,
                  amount: amount.toFixed(6),
                  token: 'ETH',
                  usdValue: (amount * ETH_USD_PRICE).toFixed(2),
                  block: parseInt(tx.blockNumber),
                  timestamp: timestamp
                };
              });
            
            resolve(deposits);
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function escapeCSV(value) {
  if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function exportToCSV() {
  console.log('🎰 Exporting deposits to CSV...\n');
  
  if (!ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  // Fetch deposits
  const currentBlock = await getCurrentBlock();
  const startBlock = currentBlock - BLOCKS_PER_DAY;
  
  console.log(`📊 Fetching last 24h (blocks ${startBlock.toLocaleString()} → ${currentBlock.toLocaleString()})...\n`);
  
  const allDeposits = [];
  
  for (const [casino, address] of Object.entries(CASINO_WALLETS)) {
    if (!address) continue;
    
    console.log(`   ${casino}...`);
    const deposits = await getWalletTransactions(address, casino, startBlock);
    allDeposits.push(...deposits);
    
    console.log(`   ✅ ${deposits.length} deposits`);
    
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  allDeposits.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`\n✅ Total: ${allDeposits.length} deposits`);
  
  if (allDeposits.length === 0) {
    console.log('No deposits found');
    return;
  }
  
  // Stats
  const totalETH = allDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const totalUSD = allDeposits.reduce((sum, d) => sum + parseFloat(d.usdValue), 0);
  
  console.log(`💰 Total: ${totalETH.toFixed(2)} ETH (~$${totalUSD.toLocaleString()})`);
  
  // Generate CSV
  const headers = ['Date', 'Time', 'DateTime', 'Casino', 'Wallet Address', 'Amount', 'Token', 'USD Value'];
  const rows = allDeposits.map(d => [
    d.date,
    d.time,
    d.datetime,
    d.casino,
    d.walletAddress,
    d.amount,
    d.token,
    d.usdValue
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
  
  // Save to file
  const filename = `deposits-${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join(__dirname, 'data', filename);
  
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, csv);
  
  console.log(`\n💾 Saved to: ${filepath}`);
  console.log(`   ${allDeposits.length} rows`);
  
  // Also save cumulative CSV (append if exists)
  const cumulativePath = path.join(__dirname, 'data', 'deposits-all.csv');
  
  if (fs.existsSync(cumulativePath)) {
    // Append without headers
    fs.appendFileSync(cumulativePath, '\n' + rows.map(row => row.map(escapeCSV).join(',')).join('\n'));
    console.log(`\n📈 Appended to: ${cumulativePath}`);
  } else {
    // Create with headers
    fs.writeFileSync(cumulativePath, csv);
    console.log(`\n📈 Created: ${cumulativePath}`);
  }
  
  console.log(`\n💡 Import to Google Sheets:`);
  console.log(`   1. Open: https://sheets.google.com`);
  console.log(`   2. File → Import → Upload`);
  console.log(`   3. Select: ${filepath}`);
  console.log(`   4. Import location: Append to current sheet`);
}

exportToCSV().catch(console.error);
