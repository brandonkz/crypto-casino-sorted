#!/usr/bin/env node

/**
 * Track crypto casino deposits to Google Sheets
 * Run daily to build historical dataset for marketing
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const GOOGLE_ACCOUNT = 'alphaxasset@gmail.com';

// Google Sheet ID (you'll need to create this)
const SHEET_ID = process.env.GOOGLE_SHEET_ID || 'YOUR_SHEET_ID_HERE';

const CASINO_WALLETS = {
  'Stake': process.env.STAKE_WALLET_1,
  'Rollbit': process.env.ROLLBIT_WALLET
};

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
      path: `/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
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
                
                return {
                  date: date.toISOString().split('T')[0], // YYYY-MM-DD
                  time: date.toISOString().split('T')[1].split('.')[0], // HH:MM:SS
                  casino: label,
                  amount: (parseInt(tx.value) / 1e18).toFixed(6),
                  token: 'ETH',
                  usdValue: ((parseInt(tx.value) / 1e18) * 2800).toFixed(2), // Rough USD estimate
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

async function appendToSheet(deposits) {
  if (deposits.length === 0) {
    console.log('No deposits to append');
    return;
  }
  
  console.log(`\n📊 Appending ${deposits.length} deposits to Google Sheets...`);
  
  // Convert to 2D array for sheets
  const rows = deposits.map(d => [
    d.date,
    d.time,
    d.casino,
    d.amount,
    d.token,
    d.usdValue,
    d.block
  ]);
  
  const rowsJson = JSON.stringify(rows);
  
  try {
    const result = execSync(
      `gog sheets append "${SHEET_ID}" "Deposits!A:G" --values-json '${rowsJson}' --insert INSERT_ROWS --account ${GOOGLE_ACCOUNT}`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    console.log('✅ Added to Google Sheets');
    console.log(result);
  } catch (error) {
    console.error('❌ Error appending to sheet:', error.message);
    console.error('\nMake sure you:');
    console.error('1. Created a Google Sheet');
    console.error('2. Added GOOGLE_SHEET_ID to .env.local');
    console.error('3. Sheet has a tab named "Deposits"');
    console.error('4. Headers: Date | Time | Casino | Amount | Token | USD Value | Block');
  }
}

async function createSheetIfNeeded() {
  if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
    console.log('\n📝 Creating new Google Sheet...');
    
    try {
      // Create new sheet
      const createResult = execSync(
        `gog sheets create "Crypto Casino Deposits" --account ${GOOGLE_ACCOUNT}`,
        { encoding: 'utf8' }
      );
      
      const newSheetId = createResult.match(/Created spreadsheet: ([a-zA-Z0-9_-]+)/)?.[1];
      
      if (newSheetId) {
        console.log(`✅ Created sheet: ${newSheetId}`);
        console.log(`\nAdd this to your .env.local:`);
        console.log(`GOOGLE_SHEET_ID=${newSheetId}`);
        console.log(`\nSheet URL: https://docs.google.com/spreadsheets/d/${newSheetId}`);
        
        // Add headers
        const headers = [['Date', 'Time', 'Casino', 'Amount', 'Token', 'USD Value', 'Block']];
        execSync(
          `gog sheets update "${newSheetId}" "Sheet1!A1:G1" --values-json '${JSON.stringify(headers)}' --input USER_ENTERED --account ${GOOGLE_ACCOUNT}`,
          { encoding: 'utf8' }
        );
        
        console.log('✅ Added headers');
        
        return newSheetId;
      }
    } catch (error) {
      console.error('❌ Error creating sheet:', error.message);
      return null;
    }
  }
  
  return SHEET_ID;
}

async function main() {
  console.log('🎰 Crypto Casino Deposit Tracker → Google Sheets\n');
  
  if (!ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  // Check/create sheet
  const sheetId = await createSheetIfNeeded();
  
  if (!sheetId || sheetId === 'YOUR_SHEET_ID_HERE') {
    console.log('\n⚠️  Set GOOGLE_SHEET_ID in .env.local first');
    process.exit(1);
  }
  
  // Fetch deposits
  console.log('📊 Fetching last 24h of deposits...\n');
  
  const currentBlock = await getCurrentBlock();
  const startBlock = currentBlock - BLOCKS_PER_DAY;
  
  console.log(`   Blocks: ${startBlock.toLocaleString()} → ${currentBlock.toLocaleString()}`);
  
  const allDeposits = [];
  
  for (const [casino, address] of Object.entries(CASINO_WALLETS)) {
    if (!address) continue;
    
    console.log(`   ${casino}...`);
    const deposits = await getWalletTransactions(address, casino, startBlock);
    allDeposits.push(...deposits);
    
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  allDeposits.sort((a, b) => a.timestamp - b.timestamp); // Oldest first for chronological order
  
  console.log(`\n✅ Found ${allDeposits.length} deposits`);
  
  if (allDeposits.length > 0) {
    const totalETH = allDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const totalUSD = allDeposits.reduce((sum, d) => sum + parseFloat(d.usdValue), 0);
    
    console.log(`   Total: ${totalETH.toFixed(2)} ETH (~$${totalUSD.toLocaleString()})`);
    
    // Append to sheet
    await appendToSheet(allDeposits);
    
    console.log(`\n📊 View your data:`);
    console.log(`   https://docs.google.com/spreadsheets/d/${sheetId}`);
  }
  
  console.log(`\n💡 Tip: Run this daily via cron to build historical dataset`);
  console.log(`   Example: 0 2 * * * cd ${__dirname} && node track-to-sheets.js`);
}

main().catch(console.error);
