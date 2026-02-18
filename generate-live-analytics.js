#!/usr/bin/env node

/**
 * Generate mobile-optimized analytics.html with embedded data
 * No Chart.js - fast loading on mobile
 */

const fs = require('fs');

console.log('📊 Generating mobile-optimized analytics...\n');

// Read CSV
const csvContent = fs.readFileSync('data/deposits-all.csv', 'utf8');
const lines = csvContent.trim().split('\n');

// Parse data
const data = [];
for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length >= 8) {
        data.push({
            date: cols[0],
            casino: cols[3],
            usdValue: parseFloat(cols[7]) || 0
        });
    }
}

console.log(`   Parsed ${data.length} deposits`);

// Calculate stats
const casinoStats = {};
let totalVolume = 0;
let biggest = { value: 0, casino: '' };

data.forEach(d => {
    const casino = d.casino.includes('Stake') ? 'Stake' : 
                   d.casino.includes('Rollbit') ? 'Rollbit' : d.casino;
    
    if (!casinoStats[casino]) {
        casinoStats[casino] = { volume: 0, count: 0 };
    }
    
    casinoStats[casino].volume += d.usdValue;
    casinoStats[casino].count += 1;
    totalVolume += d.usdValue;
    
    if (d.usdValue > biggest.value) {
        biggest = { value: d.usdValue, casino };
    }
});

const minDate = data[0]?.date || '';
const maxDate = data[data.length - 1]?.date || '';

console.log(`   Total: $${(totalVolume / 1000000).toFixed(2)}M, ${Object.keys(casinoStats).length} casinos\n`);

// Create embedded script
const embedScript = `
    // EMBEDDED DATA - ${new Date().toISOString()}
    const stats = {
        casinos: ${JSON.stringify(casinoStats)},
        totalVolume: ${totalVolume},
        totalDeposits: ${data.length},
        biggest: ${JSON.stringify(biggest)},
        minDate: "${minDate}",
        maxDate: "${maxDate}"
    };
    
    const minD = new Date(stats.minDate);
    const maxD = new Date(stats.maxDate);
    const daysDiff = Math.ceil((maxD - minD) / 86400000) + 1;
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    document.getElementById('headerSubtext').textContent = formatDate(minD) + ' – ' + formatDate(maxD) + ' (' + daysDiff + ' day' + (daysDiff > 1 ? 's' : '') + ')';
    document.getElementById('totalVolume').textContent = '$' + (stats.totalVolume / 1000000).toFixed(2) + 'M';
    document.getElementById('totalDeposits').textContent = stats.totalDeposits.toLocaleString() + ' deposits';
    document.getElementById('avgDeposit').textContent = '$' + (stats.totalVolume / stats.totalDeposits).toFixed(0);
    document.getElementById('biggestDeposit').textContent = '$' + stats.biggest.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('biggestCasino').textContent = stats.biggest.casino;
    document.getElementById('timePeriod').textContent = daysDiff + 'd';
    document.getElementById('dateRange').textContent = formatDate(minD) + ' – ' + formatDate(maxD);
    
    const casinos = Object.keys(stats.casinos).sort((a, b) => stats.casinos[b].volume - stats.casinos[a].volume);
    const casinoListHTML = casinos.map(casino => \`
        <div class="casino-item">
            <div class="casino-name">\${casino}</div>
            <div class="casino-stats">
                <div class="casino-volume">$\${(stats.casinos[casino].volume / 1000000).toFixed(2)}M</div>
                <div class="casino-count">\${stats.casinos[casino].count.toLocaleString()} deposits</div>
            </div>
        </div>
    \`).join('');
    
    document.getElementById('casinoList').innerHTML = casinoListHTML;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
`;

// Read template
const template = fs.readFileSync('analytics-mobile-optimized.html', 'utf8');

// Replace fetch block with embedded data
const updated = template.replace(
    /\/\/ Placeholder[\s\S]*?\.catch\(error => \{[\s\S]*?\}\);/,
    embedScript
);

// Write to analytics.html for production
fs.writeFileSync('analytics.html', updated);

console.log('✅ Generated analytics.html (mobile-optimized)');
console.log(`📱 Fast loading: No Chart.js, embedded data`);
console.log(`📊 ${Object.keys(casinoStats).length} casinos, ${data.length} deposits\n`);
console.log('🚀 Ready to deploy!');
