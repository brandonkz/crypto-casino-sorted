#!/usr/bin/env node

/**
 * Generate dashboard with pre-aggregated data (faster)
 * Instead of 9K+ rows, embed summary stats only
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = 'data/deposits-all.csv';
const TEMPLATE_FILE = 'dashboard.html';
const OUTPUT_FILE = 'dashboard-live.html';

console.log('📊 Generating optimized dashboard...\n');

// Read and parse CSV
const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

console.log(`   Processing ${lines.length} rows...`);

// Parse data
const data = [];
for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
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
    
    const obj = {};
    headers.forEach((header, idx) => {
        obj[header.trim()] = values[idx]?.trim() || '';
    });
    data.push(obj);
}

console.log('   ✅ Parsed');

// Aggregate data
const totalVolume = data.reduce((sum, d) => sum + parseFloat(d['USD Value'] || 0), 0);
const totalDeposits = data.length;
const avgDeposit = totalVolume / totalDeposits;

const biggest = data.reduce((max, d) => {
    const val = parseFloat(d['USD Value'] || 0);
    return val > max.value ? { value: val, casino: d.Casino } : max;
}, { value: 0, casino: '' });

// Casino breakdown
const casinoStats = {};
data.forEach(d => {
    const casino = d.Casino;
    if (!casinoStats[casino]) {
        casinoStats[casino] = { volume: 0, count: 0 };
    }
    casinoStats[casino].volume += parseFloat(d['USD Value'] || 0);
    casinoStats[casino].count += 1;
});

// Hourly breakdown
const hourlyStats = Array(24).fill(0);
data.forEach(d => {
    const time = d.Time;
    if (time) {
        const hour = parseInt(time.split(':')[0]);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
            hourlyStats[hour] += parseFloat(d['USD Value'] || 0);
        }
    }
});

// Size distribution
const ranges = [
    { label: '<$100', min: 0, max: 100, count: 0 },
    { label: '$100-500', min: 100, max: 500, count: 0 },
    { label: '$500-1K', min: 500, max: 1000, count: 0 },
    { label: '$1K-5K', min: 1000, max: 5000, count: 0 },
    { label: '$5K-10K', min: 5000, max: 10000, count: 0 },
    { label: '>$10K', min: 10000, max: Infinity, count: 0 }
];

data.forEach(d => {
    const val = parseFloat(d['USD Value'] || 0);
    const range = ranges.find(r => val >= r.min && val < r.max);
    if (range) range.count++;
});

console.log('   ✅ Aggregated\n');

// Create embedded data object
const aggregatedData = {
    stats: {
        totalVolume,
        totalDeposits,
        avgDeposit,
        biggest
    },
    casinoStats,
    hourlyStats,
    ranges
};

// Read template
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

// Inject pre-aggregated data
const htmlWithData = template.replace(
    '// Load and analyze data\n        async function loadData() {',
    `// Pre-aggregated data embedded
        const AGGREGATED_DATA = ${JSON.stringify(aggregatedData)};
        
        async function loadData() {
            // Skip parsing, use pre-aggregated data
            const { stats, casinoStats, hourlyStats, ranges } = AGGREGATED_DATA;
            
            // Update stats
            document.getElementById('totalVolume').textContent = '$' + stats.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 });
            document.getElementById('totalDeposits').textContent = stats.totalDeposits.toLocaleString();
            document.getElementById('avgDeposit').textContent = '$' + stats.avgDeposit.toLocaleString('en-US', { maximumFractionDigits: 2 });
            document.getElementById('biggestDeposit').textContent = '$' + stats.biggest.value.toLocaleString('en-US', { maximumFractionDigits: 2 });
            document.getElementById('biggestCasino').textContent = stats.biggest.casino;
            
            // Create charts
            createCharts(casinoStats, hourlyStats, ranges);
            
            // Show content
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
            return;
            
            /* OLD CODE BELOW - REPLACED WITH PRE-AGGREGATED DATA */
            //`
).replace(
    'try {\n                const response = await fetch(\'./data/deposits-all.csv\');',
    '/* Disabled - using pre-aggregated data\ntry {\n                const response = await fetch(\'./data/deposits-all.csv\');'
).replace(
    'loadData().catch(console.error);',
    '/**/\n        }\n        \n        loadData().catch(console.error);'
);

// Write output
fs.writeFileSync(OUTPUT_FILE, htmlWithData);

console.log(`✅ Generated: ${OUTPUT_FILE}`);
console.log(`📊 Embedded aggregated data (${Object.keys(casinoStats).length} casinos)`);
console.log(`💾 File size: ${(htmlWithData.length / 1024).toFixed(1)} KB\n`);
console.log(`🔗 Open it:`);
console.log(`   open ${OUTPUT_FILE}`);
