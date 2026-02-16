#!/usr/bin/env node

/**
 * Simple Google Sheets uploader
 * Reads CSV and uploads via gog CLI
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CSV_FILE = process.argv[2] || 'data/deposits-2026-02-16.csv';
const ACCOUNT = 'alphaxasset@gmail.com';

console.log('📊 Uploading to Google Sheets...\n');

// Step 1: Create sheet
console.log('1️⃣ Creating sheet...');

let sheetId;
try {
  const output = execSync(
    `gog sheets create "Crypto Casino Deposits - Feb 16 2026" --account ${ACCOUNT}`,
    { encoding: 'utf8', timeout: 20000 }
  );
  
  console.log(output);
  
  // Extract sheet ID
  const match = output.match(/spreadsheet[:\s]+([a-zA-Z0-9_-]{44})/i);
  if (match) {
    sheetId = match[1];
    console.log(`✅ Sheet ID: ${sheetId}\n`);
  } else {
    console.error('❌ Could not extract sheet ID');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error creating sheet:', error.message);
  process.exit(1);
}

// Step 2: Read CSV
console.log('2️⃣ Reading CSV...');

const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
const lines = csvContent.trim().split('\n');

console.log(`   ${lines.length} rows\n`);

// Step 3: Upload in batches
console.log('3️⃣ Uploading data...');

const BATCH_SIZE = 200;
let uploaded = 0;

for (let i = 0; i < lines.length; i += BATCH_SIZE) {
  const batch = lines.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
  
  console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} rows)...`);
  
  // Parse CSV rows
  const rows = batch.map(line => {
    // Simple CSV parse (handles quoted values)
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
  
  const valuesJson = JSON.stringify(rows).replace(/'/g, "'\\''");
  
  try {
    execSync(
      `gog sheets append "${sheetId}" "Sheet1!A:H" --values-json '${valuesJson}' --insert INSERT_ROWS --account ${ACCOUNT}`,
      { encoding: 'utf8', timeout: 20000, stdio: 'pipe' }
    );
    
    uploaded += batch.length;
    
  } catch (error) {
    console.error(`   ⚠️  Error on batch ${batchNum}:`, error.message);
    // Continue with next batch
  }
}

console.log(`\n✅ Upload complete!`);
console.log(`   ${uploaded}/${lines.length} rows uploaded`);
console.log(`\n🔗 View sheet:`);
console.log(`   https://docs.google.com/spreadsheets/d/${sheetId}`);
