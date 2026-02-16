#!/usr/bin/env node

/**
 * Monitor real crypto casino deposits via Etherscan API
 * Updates live feed with actual blockchain transactions
 */

const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Major crypto casino hot wallets (Ethereum mainnet)
// All addresses are publicly labeled on Etherscan/BscScan
const CASINO_WALLETS = {
  'Stake': '0x974CaA59e49682CdA0AD2bbe82983419A2ECC400', // Stake.com (Etherscan labeled)
  'Stake 6': '0xfa500178de024bf43cfa69b7e636a28ab68f2741', // Stake.com 6 (~$22.5M balance, 34M+ txs)
  'Rollbit': '0xcbd6832ebc203e49e2b771897067fce3c58575ac' // Rollbit: Hot Wallet (Etherscan labeled)
};

// Track last checked block to avoid duplicates
let lastBlock = 0;

/**
 * Fetch recent transactions for a wallet
 */
async function getWalletTransactions(address, label) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.etherscan.io',
      path: `/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=${lastBlock}&endblock=99999999&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
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
                amount: (parseInt(tx.value) / 1e18).toFixed(4),
                token: 'ETH',
                timestamp: parseInt(tx.timeStamp) * 1000,
                hash: tx.hash,
                block: parseInt(tx.blockNumber)
              }));
            
            resolve(deposits);
          } else {
            console.log(`   API response: ${result.message || 'No transactions'}`);
            resolve([]);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch ERC-20 token transfers (USDT, USDC, etc.)
 */
async function getTokenTransfers(address, label) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.etherscan.io',
      path: `/v2/api?chainid=1&module=account&action=tokentx&address=${address}&startblock=${lastBlock}&endblock=99999999&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
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
              .filter(tx => tx.to.toLowerCase() === address.toLowerCase())
              .map(tx => ({
                casino: label,
                amount: (parseInt(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal))).toFixed(2),
                token: tx.tokenSymbol,
                timestamp: parseInt(tx.timeStamp) * 1000,
                hash: tx.hash,
                block: parseInt(tx.blockNumber)
              }));
            
            resolve(deposits);
          } else {
            console.log(`   Token API response: ${result.message || 'No transfers'}`);
            resolve([]);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Main monitoring loop
 */
async function monitorDeposits() {
  console.log('🎰 Monitoring crypto casino deposits...\n');
  
  if (!ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  const allDeposits = [];
  
  // Fetch deposits for each casino
  for (const [casino, address] of Object.entries(CASINO_WALLETS)) {
    console.log(`📊 Checking ${casino} (${address})...`);
    
    try {
      // Get ETH deposits
      const ethDeposits = await getWalletTransactions(address, casino);
      allDeposits.push(...ethDeposits);
      
      // Get token deposits
      const tokenDeposits = await getTokenTransfers(address, casino);
      allDeposits.push(...tokenDeposits);
      
      console.log(`   Found ${ethDeposits.length + tokenDeposits.length} recent deposits`);
      
      // Update last checked block
      if (ethDeposits.length > 0) {
        lastBlock = Math.max(lastBlock, ...ethDeposits.map(d => d.block));
      }
      
      // Rate limit (5 requests per second max on free tier)
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Sort by timestamp (newest first)
  allDeposits.sort((a, b) => b.timestamp - a.timestamp);
  
  // Display results
  if (allDeposits.length > 0) {
    console.log(`\n✅ Found ${allDeposits.length} new deposits:\n`);
    allDeposits.slice(0, 10).forEach(dep => {
      const time = new Date(dep.timestamp).toLocaleTimeString();
      console.log(`   ${dep.casino}: ${dep.amount} ${dep.token} at ${time}`);
      console.log(`   TX: https://etherscan.io/tx/${dep.hash}\n`);
    });
    
    // Save to JSON for live feed
    const outputPath = './data/live-deposits.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      lastUpdate: Date.now(),
      deposits: allDeposits.slice(0, 50) // Keep last 50
    }, null, 2));
    
    console.log(`💾 Saved to ${outputPath}`);
  } else {
    console.log('   No new deposits since last check');
  }
}

/**
 * Run once or continuous monitoring
 */
async function main() {
  const continuous = process.argv.includes('--watch');
  
  if (continuous) {
    console.log('👀 Starting continuous monitoring (every 30 seconds)...\n');
    
    // Run immediately
    await monitorDeposits();
    
    // Then every 30 seconds
    setInterval(async () => {
      console.log('\n🔄 Checking for new deposits...');
      await monitorDeposits();
    }, 30000);
    
  } else {
    // Single run
    await monitorDeposits();
  }
}

main().catch(console.error);
