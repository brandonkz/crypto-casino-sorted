#!/usr/bin/env node

/**
 * Fetch all deposits from the last 24 hours in one go
 * Run once before demo/interview
 * 2 API calls total
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Casino wallets from .env.local
const CASINO_WALLETS = {
  'Stake': process.env.STAKE_WALLET_1,
  'Rollbit': process.env.ROLLBIT_WALLET
};

// Calculate block range for last 24 hours
// Ethereum: ~7200 blocks per day (12 second block time)
const BLOCKS_PER_DAY = 7200;

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
          const blockNumber = parseInt(result.result, 16);
          resolve(blockNumber);
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
      path: `/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
      method: 'GET'
    };
    
    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === '1' && result.result) {
            const deposits = result.result
              .filter(tx => tx.to.toLowerCase() === address.toLowerCase() && tx.value !== '0')
              .map(tx => ({
                casino: label,
                walletAddress: address,
                amount: (parseInt(tx.value) / 1e18).toFixed(4),
                token: 'ETH',
                timestamp: parseInt(tx.timeStamp) * 1000,
                block: parseInt(tx.blockNumber)
              }));
            
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

async function fetchDailyDeposits() {
  console.log('🎰 Fetching last 24 hours of deposits...\n');
  
  if (!ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  // Get current block and calculate 24h range
  console.log('📊 Getting current block...');
  const currentBlock = await getCurrentBlock();
  const startBlock = currentBlock - BLOCKS_PER_DAY;
  
  console.log(`   Current block: ${currentBlock.toLocaleString()}`);
  console.log(`   Start block: ${startBlock.toLocaleString()} (~24h ago)`);
  console.log('');
  
  const allDeposits = [];
  
  // Fetch deposits for each casino
  for (const [casino, address] of Object.entries(CASINO_WALLETS)) {
    if (!address) continue;
    
    console.log(`📊 ${casino} (${address.substring(0, 10)}...)`);
    
    try {
      const deposits = await getWalletTransactions(address, casino, startBlock);
      allDeposits.push(...deposits);
      
      console.log(`   ✅ Found ${deposits.length} deposits in last 24h`);
      
      // Show some samples
      if (deposits.length > 0) {
        const total = deposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
        const biggest = Math.max(...deposits.map(d => parseFloat(d.amount)));
        console.log(`   💰 Total: ${total.toFixed(2)} ETH`);
        console.log(`   🔥 Biggest: ${biggest.toFixed(4)} ETH`);
      }
      console.log('');
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  // Sort by timestamp (newest first)
  allDeposits.sort((a, b) => b.timestamp - a.timestamp);
  
  console.log(`\n✅ Total deposits found: ${allDeposits.length}`);
  
  if (allDeposits.length > 0) {
    const totalVolume = allDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    console.log(`💰 Total volume: ${totalVolume.toFixed(2)} ETH (~$${(totalVolume * 2800).toLocaleString()})`);
    
    // Save to JSON
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync('./data/live-deposits.json', JSON.stringify({
      lastUpdate: Date.now(),
      timeRange: '24 hours',
      blockRange: {
        start: startBlock,
        end: currentBlock
      },
      totalDeposits: allDeposits.length,
      totalVolumeETH: totalVolume.toFixed(4),
      deposits: allDeposits.slice(0, 100), // Keep top 100
      note: "Transaction hashes removed for user privacy"
    }, null, 2));
    
    console.log('💾 Saved to ./data/live-deposits.json');
  } else {
    console.log('No deposits found in the last 24 hours');
  }
  
  console.log(`\n📊 API Usage: ${Object.keys(CASINO_WALLETS).length + 1} calls total`);
  console.log('   (1 for current block + 1 per wallet)');
}

fetchDailyDeposits().catch(console.error);
