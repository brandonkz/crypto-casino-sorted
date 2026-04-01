#!/usr/bin/env node
/**
 * sync-intel-monitor.js
 * 
 * Reads crypto-casino-intel monitor output (twitter-alerts, daily briefings,
 * competitor data) and merges useful items into the site's data pipeline.
 * 
 * Outputs:
 *   data/intel-alerts.json   — curated twitter/news alerts from the monitor
 *   data/competitor-intel.json — competitor snapshot from intel data.json
 * 
 * Designed to run alongside update-news-promos.py / update-reddit-streamers.py
 * as part of the daily data refresh.
 */

const fs = require('fs');
const path = require('path');

const INTEL_DIR = path.resolve(__dirname, '../../crypto-casino-intel');
const SITE_INTEL_DIR = path.resolve(__dirname, 'crypto-casino-intel');
const DATA_DIR = path.resolve(__dirname, 'data');

// --- Helpers ---

function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.warn(`[sync-intel] Could not read ${filepath}: ${e.message}`);
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
  console.log(`[sync-intel] Wrote ${filepath}`);
}

function daysSince(dateStr) {
  try {
    const d = new Date(dateStr);
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  } catch { return 999; }
}

// --- 1. Merge twitter/news alerts ---

function buildIntelAlerts() {
  // Primary source: workspace intel twitter-alerts.json
  const wsAlerts = readJSON(path.join(INTEL_DIR, 'twitter-alerts.json'));
  // Also check site-local copy
  const siteAlerts = readJSON(path.join(SITE_INTEL_DIR, 'twitter-alerts.json'));
  // Check reports dir for dated files
  const reportsDir = path.join(INTEL_DIR, 'reports');
  let reportAlerts = [];
  try {
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('twitter-alerts-'))
      .sort()
      .slice(-3); // last 3 days
    for (const f of files) {
      const data = readJSON(path.join(reportsDir, f));
      if (Array.isArray(data)) reportAlerts.push(...data);
    }
  } catch {}

  // Combine all alert sources
  const allAlerts = [];
  const seen = new Set();

  function addAlerts(source, origin) {
    if (!source) return;
    const items = source.newsAlerts || source.tweets || (Array.isArray(source) ? source : []);
    for (const item of items) {
      const key = item.hash || item.title;
      if (!key || seen.has(key)) continue;
      // Skip items older than 7 days
      if (item.pubDate && daysSince(item.pubDate) > 7) continue;
      // Skip low-score items (noise filter)
      if (item.score !== undefined && item.score < 4) continue;
      seen.add(key);
      allAlerts.push({
        title: item.title,
        source: item.source || origin,
        url: item.url || null,
        pubDate: item.pubDate || item.timestamp || null,
        score: item.score || 0,
        query: item.query || null,
      });
    }
  }

  addAlerts(wsAlerts, 'intel-monitor');
  addAlerts(siteAlerts, 'intel-monitor-site');
  for (const ra of reportAlerts) {
    addAlerts(Array.isArray(ra) ? ra : [ra], 'intel-report');
  }

  // Sort by score desc, then recency
  allAlerts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
  });

  return {
    updated: new Date().toISOString().slice(0, 10),
    source: 'crypto-casino-intel monitor',
    items: allAlerts.slice(0, 15), // Top 15 alerts
  };
}

// --- 2. Build competitor intel snapshot ---

function buildCompetitorIntel() {
  const data = readJSON(path.join(INTEL_DIR, 'data.json'))
    || readJSON(path.join(SITE_INTEL_DIR, 'data.json'));
  if (!data) return null;

  const competitors = (data.competitors || []).map(c => ({
    name: c.name,
    logo: c.logo,
    welcomeBonus: c.welcomeBonus?.details !== 'RESEARCH_NEEDED' ? c.welcomeBonus : null,
    vipTiers: c.vipStructure?.tiers !== 'RESEARCH_NEEDED' ? c.vipStructure?.tiers : null,
    rakeback: c.vipStructure?.rakeback !== 'RESEARCH_NEEDED' ? c.vipStructure?.rakeback : null,
    withdrawalTime: c.withdrawalTime !== 'RESEARCH_NEEDED' ? c.withdrawalTime : null,
    lastUpdated: c.lastUpdated,
  })).filter(c => c.welcomeBonus || c.vipTiers || c.rakeback);

  // Daily briefing market snapshot
  let briefing = null;
  const reportsDir = path.join(INTEL_DIR, 'reports');
  try {
    const briefFiles = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('daily-briefing-'))
      .sort()
      .slice(-1);
    if (briefFiles.length) briefing = readJSON(path.join(reportsDir, briefFiles[0]));
  } catch {}

  return {
    updated: new Date().toISOString().slice(0, 10),
    source: 'crypto-casino-intel monitor',
    competitors,
    marketSnapshot: briefing?.sections?.marketSnapshot || null,
    redFlags: data.redFlags || null,
  };
}

// --- 3. Enrich existing news.json with intel alerts ---

function enrichNews(intelAlerts) {
  const newsPath = path.join(DATA_DIR, 'news.json');
  const news = readJSON(newsPath);
  if (!news || !intelAlerts?.items?.length) return;

  const existingTitles = new Set((news.items || []).map(i => i.title));
  let added = 0;

  for (const alert of intelAlerts.items) {
    if (existingTitles.has(alert.title)) continue;
    // Only add high-relevance intel items to main news
    if (alert.score < 5) continue;
    
    news.items.push({
      source: alert.source,
      title: alert.title,
      url: alert.url,
      tag: 'INTEL',
      time: 'via Monitor',
      published: alert.pubDate,
    });
    existingTitles.add(alert.title);
    added++;
    if (added >= 5) break; // Max 5 intel items in main news
  }

  news.updated = new Date().toISOString().slice(0, 10);
  writeJSON(newsPath, news);
  console.log(`[sync-intel] Added ${added} intel items to news.json`);
}

// --- Main ---

function main() {
  console.log('[sync-intel] Starting intel monitor sync...');
  
  // Build intel alerts
  const intelAlerts = buildIntelAlerts();
  writeJSON(path.join(DATA_DIR, 'intel-alerts.json'), intelAlerts);
  
  // Build competitor intel
  const competitorIntel = buildCompetitorIntel();
  if (competitorIntel) {
    writeJSON(path.join(DATA_DIR, 'competitor-intel.json'), competitorIntel);
  }

  // Enrich main news feed with high-score intel items
  enrichNews(intelAlerts);

  console.log(`[sync-intel] Done. ${intelAlerts.items.length} alerts, ${competitorIntel?.competitors?.length || 0} competitors.`);
}

main();
