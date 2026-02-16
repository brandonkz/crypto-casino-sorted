#!/usr/bin/env node

/**
 * Generate analytics.html with embedded data for production
 * No external CSV needed - all data baked into HTML
 */

const fs = require('fs');

console.log('📊 Generating production analytics page...\n');

// Read CSV and calculate stats
const csvContent = fs.readFileSync('data/deposits-all.csv', 'utf8');
const lines = csvContent.trim().split('\n');

// Parse all rows
const data = [];
for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',');
    
    // Quick parse (no complex quoted value handling for speed)
    if (cols.length >= 8) {
        data.push({
            date: cols[0],
            casino: cols[3],
            usdValue: parseFloat(cols[7]) || 0
        });
    }
}

console.log(`   Parsed ${data.length} deposits`);

// Calculate aggregated stats
const stats = {
    casinos: {},
    totalVolume: 0,
    totalDeposits: data.length,
    biggestDeposit: { value: 0, casino: '' },
    minDate: data[0]?.date || '',
    maxDate: data[data.length - 1]?.date || ''
};

data.forEach(d => {
    const casino = d.casino.includes('Stake') ? 'Stake' : 
                   d.casino.includes('Rollbit') ? 'Rollbit' : d.casino;
    
    if (!stats.casinos[casino]) {
        stats.casinos[casino] = { volume: 0, count: 0 };
    }
    
    stats.casinos[casino].volume += d.usdValue;
    stats.casinos[casino].count += 1;
    stats.totalVolume += d.usdValue;
    
    if (d.usdValue > stats.biggestDeposit.value) {
        stats.biggestDeposit = { value: d.usdValue, casino };
    }
});

console.log(`   Total volume: $${(stats.totalVolume / 1000000).toFixed(2)}M`);
console.log(`   Casinos: ${Object.keys(stats.casinos).length}\n`);

// Create the embedded data script
const embedScript = `
    // EMBEDDED DATA - Generated ${new Date().toISOString()}
    window.CASINO_STATS = ${JSON.stringify(stats, null, 2)};
    
    // Use embedded data instead of fetching CSV
    const stats = window.CASINO_STATS;
    
    const minDate = new Date(stats.minDate);
    const maxDate = new Date(stats.maxDate);
    const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    document.getElementById('headerSubtext').textContent = formatDate(minDate) + ' – ' + formatDate(maxDate) + ' (' + daysDiff + ' day' + (daysDiff > 1 ? 's' : '') + ')';
    document.getElementById('timePeriod').textContent = daysDiff + ' day' + (daysDiff > 1 ? 's' : '');
    document.getElementById('dateRange').textContent = formatDate(minDate) + ' – ' + formatDate(maxDate);
    
    const avgDeposit = stats.totalVolume / stats.totalDeposits;
    
    document.getElementById('totalVolume').textContent = '$' + (stats.totalVolume / 1000000).toFixed(2) + 'M';
    document.getElementById('totalDeposits').textContent = stats.totalDeposits.toLocaleString() + ' deposits';
    document.getElementById('avgDeposit').textContent = '$' + avgDeposit.toFixed(0);
    document.getElementById('biggestDeposit').textContent = '$' + stats.biggestDeposit.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('biggestCasino').textContent = stats.biggestDeposit.casino;
    
    const periodText = daysDiff === 1 ? '24h' : daysDiff + ' days';
    document.getElementById('volumeTitle').textContent = 'Volume by Casino (' + periodText + ')';
    document.getElementById('depositsTitle').textContent = 'Number of Deposits (' + periodText + ')';
    document.getElementById('comparisonTitle').textContent = 'Casino Comparison (' + periodText + ')';
    
    const casinos = Object.keys(stats.casinos).sort((a, b) => stats.casinos[b].volume - stats.casinos[a].volume);
    const volumes = casinos.map(c => stats.casinos[c].volume);
    const counts = casinos.map(c => stats.casinos[c].count);
`;

// Read template
const template = fs.readFileSync('analytics.html', 'utf8');

// Replace the fetch() call with embedded data
const updated = template.replace(
    /fetch\('\.\/data\/deposits-all\.csv'\)[\s\S]*?catch\(error => \{[\s\S]*?\}\);/,
    embedScript
);

// Write production version
fs.writeFileSync('analytics.html', updated);

console.log('✅ Generated production analytics.html with embedded data');
console.log(`📊 Stats embedded: ${Object.keys(stats.casinos).length} casinos, ${stats.totalDeposits} deposits\n`);
console.log('🚀 Ready to deploy - no external CSV needed!');
