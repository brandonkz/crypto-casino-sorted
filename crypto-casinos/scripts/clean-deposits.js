#!/usr/bin/env node

/**
 * Clean Deposits Script
 * 
 * Filters out suspicious deposits that are likely internal transfers:
 * 1. Same wallet depositing >3 times in 24h
 * 2. Same wallet total >$100K in 24h (likely hot wallet shuffles)
 * 3. Round numbers >$500K (suspiciously clean amounts)
 * 4. Known payment processors (AlphaPo, etc.)
 * 
 * Outputs:
 * - deposits-YYYY-MM-DD-clean.csv (filtered data)
 * - deposits-YYYY-MM-DD-flagged.csv (what was removed)
 * - clean-stats.json (summary)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const KNOWN_PROCESSORS = [
  'AlphaPo',
  'AlphaPo (payment processor for casinos)',
  // Add more as discovered
];

const THRESHOLDS = {
  repeatWalletCount: 3,        // Flag if same wallet deposits >3 times
  repeatWalletTotal: 100000,   // Flag if same wallet total >$100K
  roundNumberMin: 500000,      // Flag round numbers >$500K
  roundNumberTolerance: 0.02,  // Within 2% of round number = suspicious
};

function isRoundNumber(amount, min = THRESHOLDS.roundNumberMin) {
  if (amount < min) return false;
  
  // Check if close to round thousands/millions
  const roundTargets = [
    500000, 1000000, 2000000, 5000000, 10000000
  ];
  
  for (const target of roundTargets) {
    const diff = Math.abs(amount - target);
    const tolerance = target * THRESHOLDS.roundNumberTolerance;
    if (diff < tolerance) {
      return { isRound: true, target, diff };
    }
  }
  
  return { isRound: false };
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    rows.push(row);
  }
  
  return { headers, rows };
}

function analyzeDeposits(rows) {
  const walletStats = {};
  
  // Aggregate by wallet address
  rows.forEach(row => {
    const wallet = row['From Address'];
    const amount = parseFloat(row['USD Value']) || 0;
    const casino = row['Casino'];
    
    if (!walletStats[wallet]) {
      walletStats[wallet] = {
        count: 0,
        total: 0,
        deposits: [],
        casinos: new Set()
      };
    }
    
    walletStats[wallet].count++;
    walletStats[wallet].total += amount;
    walletStats[wallet].deposits.push({ ...row, amount });
    walletStats[wallet].casinos.add(casino);
  });
  
  return walletStats;
}

function flagDeposit(row, walletStats) {
  const flags = [];
  const wallet = row['From Address'];
  const amount = parseFloat(row['USD Value']) || 0;
  const casino = row['Casino'];
  const entity = row['From Entity'];
  
  // Flag 1: Known payment processor
  if (KNOWN_PROCESSORS.includes(casino) || KNOWN_PROCESSORS.includes(entity)) {
    flags.push({
      type: 'payment_processor',
      reason: `${casino} is a known payment processor, not a casino`,
      casino
    });
  }
  
  // Flag 2: Repeat wallet (>3 deposits in 24h)
  if (walletStats[wallet].count > THRESHOLDS.repeatWalletCount) {
    flags.push({
      type: 'repeat_wallet_count',
      reason: `Wallet deposited ${walletStats[wallet].count} times (>${THRESHOLDS.repeatWalletCount})`,
      count: walletStats[wallet].count
    });
  }
  
  // Flag 3: High-volume repeat wallet (>$100K total)
  if (walletStats[wallet].total > THRESHOLDS.repeatWalletTotal) {
    flags.push({
      type: 'repeat_wallet_volume',
      reason: `Wallet total $${walletStats[wallet].total.toFixed(0)} (>$${THRESHOLDS.repeatWalletTotal})`,
      total: walletStats[wallet].total
    });
  }
  
  // Flag 4: Suspicious round number
  const roundCheck = isRoundNumber(amount);
  if (roundCheck.isRound) {
    flags.push({
      type: 'round_number',
      reason: `Amount $${amount.toFixed(0)} is ${roundCheck.diff.toFixed(0)} away from $${roundCheck.target} (suspiciously round)`,
      amount,
      target: roundCheck.target
    });
  }
  
  return flags;
}

function cleanDeposits(inputFile, outputDir) {
  console.log(`\n🧹 Cleaning deposits from: ${inputFile}\n`);
  
  const { headers, rows } = parseCSV(inputFile);
  const walletStats = analyzeDeposits(rows);
  
  const cleanRows = [];
  const flaggedRows = [];
  
  let totalVolume = 0;
  let cleanVolume = 0;
  let flaggedVolume = 0;
  
  const flagSummary = {
    payment_processor: 0,
    repeat_wallet_count: 0,
    repeat_wallet_volume: 0,
    round_number: 0,
  };
  
  rows.forEach(row => {
    const amount = parseFloat(row['USD Value']) || 0;
    totalVolume += amount;
    
    const flags = flagDeposit(row, walletStats);
    
    if (flags.length === 0) {
      cleanRows.push(row);
      cleanVolume += amount;
    } else {
      flaggedRows.push({ ...row, flags });
      flaggedVolume += amount;
      
      // Count flag types
      flags.forEach(flag => {
        flagSummary[flag.type] = (flagSummary[flag.type] || 0) + 1;
      });
    }
  });
  
  // Write clean CSV
  const dateMatch = path.basename(inputFile).match(/deposits-(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : 'unknown';
  
  const cleanFile = path.join(outputDir, `deposits-${date}-clean.csv`);
  const flaggedFile = path.join(outputDir, `deposits-${date}-flagged.csv`);
  const statsFile = path.join(outputDir, `clean-stats.json`);
  
  // Write clean deposits
  const cleanCSV = [
    headers.join(','),
    ...cleanRows.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');
  
  fs.writeFileSync(cleanFile, cleanCSV);
  
  // Write flagged deposits (with flag reasons)
  const flaggedHeaders = [...headers, 'Flag Reasons'];
  const flaggedCSV = [
    flaggedHeaders.join(','),
    ...flaggedRows.map(row => {
      const reasons = row.flags.map(f => f.reason).join(' | ');
      return [...headers.map(h => `"${row[h] || ''}"`), `"${reasons}"`].join(',');
    })
  ].join('\n');
  
  fs.writeFileSync(flaggedFile, flaggedCSV);
  
  // Write stats
  const stats = {
    date,
    input: {
      file: inputFile,
      deposits: rows.length,
      volume: totalVolume,
    },
    clean: {
      file: cleanFile,
      deposits: cleanRows.length,
      volume: cleanVolume,
      percentage: ((cleanRows.length / rows.length) * 100).toFixed(1),
    },
    flagged: {
      file: flaggedFile,
      deposits: flaggedRows.length,
      volume: flaggedVolume,
      percentage: ((flaggedRows.length / rows.length) * 100).toFixed(1),
      breakdown: flagSummary,
    },
    thresholds: THRESHOLDS,
  };
  
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  
  // Print summary
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total deposits:    ${rows.length.toLocaleString()}`);
  console.log(`Total volume:      $${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log('');
  console.log(`✅ Clean deposits:  ${cleanRows.length.toLocaleString()} (${stats.clean.percentage}%)`);
  console.log(`   Clean volume:    $${cleanVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log('');
  console.log(`🚩 Flagged:         ${flaggedRows.length.toLocaleString()} (${stats.flagged.percentage}%)`);
  console.log(`   Flagged volume:  $${flaggedVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log('');
  console.log('🔍 Flag breakdown:');
  Object.entries(flagSummary).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`   ${type.padEnd(25)} ${count.toLocaleString()}`);
    }
  });
  console.log('');
  console.log('📁 Output files:');
  console.log(`   Clean:    ${cleanFile}`);
  console.log(`   Flagged:  ${flaggedFile}`);
  console.log(`   Stats:    ${statsFile}`);
  console.log('');
  
  // Show top flagged deposits
  console.log('🐋 Top 10 flagged deposits:');
  const topFlagged = flaggedRows
    .sort((a, b) => parseFloat(b['USD Value']) - parseFloat(a['USD Value']))
    .slice(0, 10);
  
  topFlagged.forEach((row, i) => {
    const amount = parseFloat(row['USD Value']);
    const casino = row['Casino'];
    const reasons = row.flags.map(f => f.type).join(', ');
    console.log(`   ${i + 1}. $${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} @ ${casino} [${reasons}]`);
  });
  
  console.log('\n✅ Done!\n');
  
  return stats;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node clean-deposits.js <input-csv> [output-dir]');
    console.log('');
    console.log('Example:');
    console.log('  node clean-deposits.js ../site/data/deposits-2026-04-08.csv ../site/data/');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const outputDir = args[1] || path.dirname(inputFile);
  
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }
  
  cleanDeposits(inputFile, outputDir);
}

module.exports = { cleanDeposits };
