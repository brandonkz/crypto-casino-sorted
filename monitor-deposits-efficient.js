#!/usr/bin/env node

/**
 * Efficient deposit monitoring - only runs when needed
 * Single fetch instead of continuous polling
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

let lastBlock = 0;

async function getWalletTransactions(address, label) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.etherscan.io',
      path: `/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=${lastBlock}&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
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
                amount: (parseInt(tx.value) / 1e18).toFixed(4),
                token: 'ETH',
                timestamp: parseInt(tx.timeStamp) * 1000,
                block: parseInt(tx.blockNumber),
                // Hash REMOVED for privacy (don't expose depositor addresses)
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

async function monitorDeposits() {
  console.log('🎰 Fetching latest deposits...');
  
  if (!ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  const allDeposits = [];
  
  // Fetch only ETH (skip token calls to save API credits)
  for (const [casino, address] of Object.entries(CASINO_WALLETS)) {
    if (!address) continue;
    
    console.log(`📊 ${casino}...`);
    
    try {
      const ethDeposits = await getWalletTransactions(address, casino);
      allDeposits.push(...ethDeposits);
      
      if (ethDeposits.length > 0) {
        lastBlock = Math.max(lastBlock, ...ethDeposits.map(d => d.block));
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  allDeposits.sort((a, b) => b.timestamp - a.timestamp);
  
  if (allDeposits.length > 0) {
    console.log(`✅ Found ${allDeposits.length} deposits`);
    
    // Save to JSON (transaction hashes removed for privacy)
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync('./data/live-deposits.json', JSON.stringify({
      lastUpdate: Date.now(),
      deposits: allDeposits.slice(0, 20),
      note: "Transaction hashes removed for user privacy"
    }, null, 2));
    
    console.log('💾 Saved to ./data/live-deposits.json');
  } else {
    console.log('No new deposits');
  }
  
  console.log(`\n📊 API Usage: ${Object.keys(CASINO_WALLETS).length} calls (ETH only)`);
}

monitorDeposits().catch(console.error);
