#!/usr/bin/env node

/**
 * Upload to Google Sheets using service account
 * No OAuth prompts - fully automated
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load service account credentials
const SERVICE_ACCOUNT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../analytics-service-account.json'), 'utf8')
);

const CSV_FILE = process.argv[2] || 'data/deposits-2026-02-16.csv';

// JWT for service account authentication
function createJWT() {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${base64Header}.${base64Claim}`);
  const signature = sign.sign(SERVICE_ACCOUNT.private_key, 'base64url');
  
  return `${base64Header}.${base64Claim}.${signature}`;
}

// Get access token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const jwt = createJWT();
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Create spreadsheet
async function createSpreadsheet(accessToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      properties: {
        title: 'Crypto Casino Deposits - Feb 16 2026'
      },
      sheets: [{
        properties: {
          title: 'Deposits',
          gridProperties: {
            rowCount: 2000,
            columnCount: 8
          }
        }
      }]
    });
    
    const options = {
      hostname: 'sheets.googleapis.com',
      path: '/v4/spreadsheets',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          console.log('   API Response:', data.substring(0, 200));
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error.message));
          }
          console.log('   Sheet ID:', result.spreadsheetId);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Update spreadsheet values
async function updateValues(accessToken, spreadsheetId, values) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      values: values
    });
    
    const options = {
      hostname: 'sheets.googleapis.com',
      path: `/v4/spreadsheets/${spreadsheetId}/values/Deposits!A1:H${values.length}?valueInputOption=USER_ENTERED`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Make sheet publicly viewable
async function shareSheet(accessToken, spreadsheetId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      role: 'reader',
      type: 'anyone'
    });
    
    const options = {
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${spreadsheetId}/permissions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve());
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Parse CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  return lines.map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
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
    return values;
  });
}

async function main() {
  console.log('📊 Uploading to Google Sheets (service account)...\n');
  
  // Read CSV
  console.log('1️⃣ Reading CSV...');
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const rows = parseCSV(csvContent);
  console.log(`   ${rows.length} rows\n`);
  
  // Get access token
  console.log('2️⃣ Authenticating...');
  const accessToken = await getAccessToken();
  console.log('   ✅ Authenticated\n');
  
  // Create spreadsheet
  console.log('3️⃣ Creating spreadsheet...');
  const spreadsheet = await createSpreadsheet(accessToken);
  const spreadsheetId = spreadsheet.spreadsheetId;
  console.log(`   ✅ Created: ${spreadsheetId}\n`);
  
  // Upload data
  console.log('4️⃣ Uploading data...');
  await updateValues(accessToken, spreadsheetId, rows);
  console.log(`   ✅ ${rows.length} rows uploaded\n`);
  
  // Share publicly
  console.log('5️⃣ Making publicly viewable...');
  await shareSheet(accessToken, spreadsheetId);
  console.log('   ✅ Anyone with link can view\n');
  
  console.log('✅ Done!\n');
  console.log('🔗 View sheet:');
  console.log(`   https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
