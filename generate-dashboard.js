#!/usr/bin/env node

/**
 * Generate self-contained dashboard HTML with embedded data
 * No server needed - just open in browser
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = 'data/deposits-all.csv';
const OUTPUT_FILE = 'dashboard-live.html';

console.log('📊 Generating dashboard...\n');

// Read CSV
const csvContent = fs.readFileSync(CSV_FILE, 'utf8');

// Read dashboard template
const template = fs.readFileSync('dashboard.html', 'utf8');

// Inject CSV data into HTML
const htmlWithData = template.replace(
  'async function loadData() {',
  `
    const EMBEDDED_CSV = \`${csvContent.replace(/`/g, '\\`')}\`;
    
    async function loadData() {
        // Use embedded data instead of fetch
        try {
            const data = parseCSV(EMBEDDED_CSV);
  `
).replace(
  'const response = await fetch(\'./data/deposits-all.csv\');\n                if (!response.ok) throw new Error(\'Failed to load data\');\n                \n                const text = await response.text();\n                const data = parseCSV(text);',
  '// Data already loaded from EMBEDDED_CSV above'
);

// Write output
fs.writeFileSync(OUTPUT_FILE, htmlWithData);

console.log(`✅ Generated: ${OUTPUT_FILE}`);
console.log(`📊 Embedded ${csvContent.split('\n').length} rows`);
console.log(`\n🔗 Open it:`);
console.log(`   open ${OUTPUT_FILE}`);
console.log(`\n   Or double-click the file in Finder`);
