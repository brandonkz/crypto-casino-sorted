#!/usr/bin/env node

/**
 * Fetch ACTUAL crypto gambling protocols from DeFiLlama
 * (not staking - actual casinos and prediction markets)
 */

const https = require('https');
const fs = require('fs');

function fetchAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.llama.fi',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoCasinoSorted/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Smart filter for ACTUAL gambling (not staking)
 */
function isActualGambling(protocol) {
  const name = protocol.name.toLowerCase();
  const category = (protocol.category || '').toLowerCase();
  
  // Exclude these categories entirely
  const excludeCategories = [
    'liquid staking',
    'liquid restaking',
    'canonical bridge',
    'yield',
    'dexes',
    'lending'
  ];
  
  if (excludeCategories.includes(category)) {
    return false;
  }
  
  // Include these categories
  const includeCategories = [
    'gaming',
    'prediction market'
  ];
  
  if (includeCategories.includes(category)) {
    return true;
  }
  
  // Known casino names (even if category is wrong)
  const knownCasinos = [
    'rollbit',
    'rollbot',
    'shuffle',
    'roobet',
    'duelbits',
    'wild.io',
    'metawin',
    'casino',
    'dice',
    'lottery',
    'polymarket'
  ];
  
  return knownCasinos.some(casino => name.includes(casino));
}

async function main() {
  console.log('🎰 Actual Crypto Gambling Protocols (No Staking!)\n');
  
  try {
    const allProtocols = await fetchAPI('/protocols');
    console.log(`📊 Found ${allProtocols.length} total protocols on DeFiLlama`);
    
    // Filter for actual gambling
    const gamblingProtocols = allProtocols.filter(isActualGambling);
    console.log(`🎲 Filtered to ${gamblingProtocols.length} actual gambling/gaming protocols\n`);
    
    // Sort by TVL
    gamblingProtocols.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
    
    // Show top 30
    console.log('Top 30 Gambling Protocols:\n');
    gamblingProtocols.slice(0, 30).forEach((p, i) => {
      const tvl = p.tvl ? `$${(p.tvl / 1e6).toFixed(1)}M` : 'N/A';
      const category = p.category || 'Unknown';
      console.log(`${(i + 1).toString().padStart(2)}. ${p.name.padEnd(30)} ${tvl.padStart(12)} (${category})`);
    });
    
    // Show by category
    console.log('\n📊 By Category:\n');
    const byCategory = {};
    gamblingProtocols.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    });
    
    Object.entries(byCategory)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([cat, protocols]) => {
        const totalTVL = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
        console.log(`${cat}: ${protocols.length} protocols, $${(totalTVL / 1e6).toFixed(1)}M TVL`);
      });
    
    // Save detailed data for top 20
    console.log('\n📊 Fetching detailed data...\n');
    const topProtocols = gamblingProtocols.slice(0, 20);
    const detailedData = [];
    
    for (const protocol of topProtocols) {
      console.log(`   ${protocol.name}...`);
      try {
        const details = await fetchAPI(`/protocol/${protocol.slug}`);
        detailedData.push({
          name: protocol.name,
          slug: protocol.slug,
          tvl: protocol.tvl || 0,
          category: protocol.category,
          chains: details.chains || [],
          url: details.url,
          description: details.description
        });
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
      }
    }
    
    const output = {
      lastUpdated: new Date().toISOString(),
      totalProtocols: gamblingProtocols.length,
      protocols: detailedData,
      allNames: gamblingProtocols.map(p => ({ name: p.name, tvl: p.tvl, category: p.category }))
    };
    
    fs.writeFileSync('actual-gambling-data.json', JSON.stringify(output, null, 2));
    console.log('\n✅ Saved to actual-gambling-data.json');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Check if any of these match your tracked casinos');
    console.log('   2. For casinos NOT on DeFiLlama, we need Dune queries');
    console.log('   3. TVL is not the same as gambling volume (but it is a good proxy)\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
