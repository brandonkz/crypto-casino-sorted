#!/usr/bin/env node

/**
 * Fetch crypto casino data from DeFiLlama API
 * Much easier than Dune - no API key needed!
 */

const https = require('https');
const fs = require('fs');

/**
 * Fetch data from DeFiLlama API
 */
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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
 * Get all protocols
 */
async function getAllProtocols() {
  console.log('📊 Fetching all protocols from DeFiLlama...');
  const protocols = await fetchAPI('/protocols');
  return protocols;
}

/**
 * Filter for gambling/casino protocols
 */
function filterGamblingProtocols(protocols) {
  const gamblingKeywords = [
    'casino',
    'gambling',
    'bet',
    'dice',
    'lottery',
    'game',
    'rollbit',
    'stake',
    'polymarket',
    'augur',
    'shuffle'
  ];
  
  return protocols.filter(p => {
    const name = p.name.toLowerCase();
    const category = (p.category || '').toLowerCase();
    
    // Check if it's in gaming category or matches keywords
    if (category === 'gaming' || category === 'prediction market') {
      return true;
    }
    
    return gamblingKeywords.some(keyword => name.includes(keyword));
  });
}

/**
 * Get protocol details including TVL history
 */
async function getProtocolDetails(slug) {
  try {
    const data = await fetchAPI(`/protocol/${slug}`);
    return data;
  } catch (error) {
    console.error(`  ❌ Failed to fetch ${slug}:`, error.message);
    return null;
  }
}

/**
 * Calculate trends (WoW, MoM)
 */
function calculateTrends(tvlData) {
  if (!tvlData || tvlData.length < 30) {
    return { wow: 0, mom: 0 };
  }
  
  const latest = tvlData[tvlData.length - 1]?.totalLiquidityUSD || 0;
  const weekAgo = tvlData[tvlData.length - 7]?.totalLiquidityUSD || 0;
  const monthAgo = tvlData[tvlData.length - 30]?.totalLiquidityUSD || 0;
  
  const wow = weekAgo > 0 ? ((latest - weekAgo) / weekAgo * 100) : 0;
  const mom = monthAgo > 0 ? ((latest - monthAgo) / monthAgo * 100) : 0;
  
  return { wow, mom };
}

/**
 * Main execution
 */
async function main() {
  console.log('🎰 Crypto Casino Data Fetcher (DeFiLlama)\n');
  
  try {
    // Fetch all protocols
    const allProtocols = await getAllProtocols();
    console.log(`   Found ${allProtocols.length} total protocols`);
    
    // Filter for gambling/gaming
    const gamblingProtocols = filterGamblingProtocols(allProtocols);
    console.log(`   Filtered to ${gamblingProtocols.length} gambling/gaming protocols\n`);
    
    // Show top 20 by TVL
    console.log('🎲 Top Gambling Protocols by TVL:\n');
    gamblingProtocols
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 20)
      .forEach((p, i) => {
        const tvl = p.tvl ? `$${(p.tvl / 1e6).toFixed(1)}M` : 'N/A';
        const category = p.category || 'Unknown';
        console.log(`${(i + 1).toString().padStart(2)}. ${p.name.padEnd(25)} ${tvl.padStart(12)} (${category})`);
      });
    
    // Fetch detailed data for top protocols
    console.log('\n📊 Fetching detailed data for top protocols...\n');
    
    const topProtocols = gamblingProtocols
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 10);
    
    const detailedData = [];
    
    for (const protocol of topProtocols) {
      console.log(`   Fetching ${protocol.name}...`);
      const details = await getProtocolDetails(protocol.slug);
      
      if (details) {
        const trends = calculateTrends(details.tvl);
        detailedData.push({
          name: protocol.name,
          slug: protocol.slug,
          tvl: protocol.tvl || 0,
          category: protocol.category,
          chains: details.chains || [],
          trends: trends,
          url: details.url
        });
      }
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      protocols: detailedData,
      totalTVL: detailedData.reduce((sum, p) => sum + p.tvl, 0)
    };
    
    fs.writeFileSync('gambling-data.json', JSON.stringify(outputData, null, 2));
    console.log('\n✅ Data saved to gambling-data.json');
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Total Protocols: ${detailedData.length}`);
    console.log(`   Total TVL: $${(outputData.totalTVL / 1e6).toFixed(1)}M`);
    console.log(`   Chains: ${[...new Set(detailedData.flatMap(p => p.chains))].join(', ')}`);
    
    console.log('\n💡 Note: This is TVL (Total Value Locked), not gambling volume.');
    console.log('   For actual wagering data, we still need on-chain transaction data.');
    console.log('   But this gives us a solid starting point!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
