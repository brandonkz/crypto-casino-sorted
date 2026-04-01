#!/usr/bin/env node

/**
 * Crypto Casino Intel Monitor (v2 — real data)
 *
 * Sources:
 *   1. Google News RSS — keyword & account-mention queries
 *   2. Brave Search API (via web_search style, if BRAVE_API_KEY set)
 *
 * Reads watchlist.json for targets, stores state in twitter-monitor-state.json,
 * diffs against previous runs, and outputs only genuinely new hits.
 *
 * Designed for cron (exit 0 = no new hits, stdout = new hits summary).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ── paths ──────────────────────────────────────────────────────────────────────
const DIR = __dirname;
const WATCHLIST_FILE = path.join(DIR, 'watchlist.json');
const STATE_FILE = path.join(DIR, 'twitter-monitor-state.json');
const LOG_FILE = path.join(DIR, 'twitter-monitor.log');
const ALERTS_FILE = path.join(DIR, 'twitter-alerts.json');
const REPORTS_DIR = path.join(DIR, 'reports');

// ── helpers ────────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(msg);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Simple promisified GET that follows redirects (up to 5), with timeout */
function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CryptoCasinoIntel/2.0)' },
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const next = new URL(res.headers.location, url).href;
        return resolve(httpGet(next, maxRedirects - 1));
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

/** Very lightweight XML tag extractor (no deps) */
function extractItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const tag = (name) => {
      const r = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`);
      const match = block.match(r);
      return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    };
    items.push({
      title: decodeEntities(tag('title')),
      link: tag('link'),
      pubDate: tag('pubDate'),
      source: decodeEntities(tag('source')),
      description: decodeEntities(tag('description')),
    });
  }
  return items;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Generate a stable hash for deduplication */
function itemHash(item) {
  return crypto.createHash('sha256').update(item.title + '|' + item.source).digest('hex').slice(0, 16);
}

// ── Google News RSS fetcher ────────────────────────────────────────────────────

async function fetchGoogleNewsRSS(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=en&gl=US&ceid=US:en`;
  try {
    const xml = await httpGet(url);
    return extractItems(xml);
  } catch (err) {
    log(`⚠️  RSS fetch failed for "${query}": ${err.message}`);
    return [];
  }
}

// ── relevance scoring ──────────────────────────────────────────────────────────

const HIGH_VALUE_TERMS = [
  'growth chart', 'follower growth', 'streamer stats', 'partnership',
  'sponsor', 'deal', 'affiliate', 'kick gambling', 'crypto casino',
  'casino streamer', 'slots streamer', 'gambling streamer',
  'stake.com', 'rollbit', 'roobet', 'duelbits', 'bc.game', 'shuffle',
  'trainwreck', 'roshtein', 'xposed', 'adin ross', 'n3on',
  'krombet', 'streamcharts', 'dexerto',
];

function relevanceScore(item) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  let score = 0;
  for (const term of HIGH_VALUE_TERMS) {
    if (text.includes(term)) score++;
  }
  // Recency bonus: items < 7 days old get +2
  try {
    const age = Date.now() - new Date(item.pubDate).getTime();
    if (age < 7 * 86400000) score += 2;
    if (age < 2 * 86400000) score += 2; // even more for < 2 days
  } catch {}
  return score;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  log('\n🔍 Crypto Casino Intel Monitor v2');
  log(`📅 ${new Date().toLocaleString()}\n`);

  // Load watchlist
  const watchlist = loadJson(WATCHLIST_FILE, { accounts: [], keywords: [], topicQueries: [] });
  if (!watchlist.keywords.length && !watchlist.accounts.length && !watchlist.topicQueries.length) {
    log('❌ Empty watchlist — nothing to monitor. Edit watchlist.json.');
    process.exit(0);
  }

  // Load state (seen hashes)
  const state = loadJson(STATE_FILE, { seenHashes: {}, lastRun: null });

  // Build search queries
  const queries = new Set();

  // Account mentions: "from:username" doesn't work in Google News, so search name + context
  for (const acct of watchlist.accounts) {
    queries.add(`${acct} gambling OR casino OR streamer`);
  }
  for (const kw of watchlist.keywords) {
    queries.add(kw);
  }
  for (const tq of watchlist.topicQueries) {
    queries.add(tq);
  }

  // Fetch all queries (serialized to be polite to Google News)
  const allItems = [];
  const seen = new Set(); // dedup within this run

  for (const q of queries) {
    log(`🔍 Fetching: "${q}"`);
    const items = await fetchGoogleNewsRSS(q);
    for (const item of items) {
      const h = itemHash(item);
      if (!seen.has(h)) {
        seen.add(h);
        item._hash = h;
        item._query = q;
        item._score = relevanceScore(item);
        allItems.push(item);
      }
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 800));
  }

  log(`\n📊 Total unique items fetched: ${allItems.length}`);

  // Filter to new items only (not in state)
  const newItems = allItems.filter(i => !state.seenHashes[i._hash]);

  // Filter by minimum relevance
  const MIN_SCORE = 2;
  const relevant = newItems.filter(i => i._score >= MIN_SCORE);

  // Sort by score desc
  relevant.sort((a, b) => b._score - a._score);

  // Cap output at 20 most relevant
  const top = relevant.slice(0, 20);

  // Mark all fetched as seen (not just relevant — avoids re-surfacing low-score items)
  for (const item of allItems) {
    state.seenHashes[item._hash] = {
      title: item.title.slice(0, 120),
      date: item.pubDate,
      firstSeen: new Date().toISOString(),
    };
  }

  // Prune state older than 90 days to prevent unbounded growth
  const NINETY_DAYS = 90 * 86400000;
  const now = Date.now();
  for (const [hash, entry] of Object.entries(state.seenHashes)) {
    try {
      if (now - new Date(entry.firstSeen).getTime() > NINETY_DAYS) {
        delete state.seenHashes[hash];
      }
    } catch {}
  }

  state.lastRun = new Date().toISOString();
  saveJson(STATE_FILE, state);

  // Output results
  if (top.length === 0) {
    log('\n✅ No new relevant hits since last run.');
    // Update alerts file
    saveJson(ALERTS_FILE, loadJson(ALERTS_FILE, { tweets: [], newsAlerts: [] }));
    return;
  }

  log(`\n🔥 ${top.length} new relevant hit(s):\n`);

  const alertEntries = [];

  for (const item of top) {
    const age = item.pubDate ? `(${item.pubDate})` : '';
    log(`  📰 [score:${item._score}] ${item.title}`);
    log(`     Source: ${item.source} ${age}`);
    log(`     Query: "${item._query}"`);
    log('');

    alertEntries.push({
      hash: item._hash,
      title: item.title,
      source: item.source,
      pubDate: item.pubDate,
      query: item._query,
      score: item._score,
      timestamp: new Date().toISOString(),
    });
  }

  // Save alerts
  const alerts = loadJson(ALERTS_FILE, { tweets: [], newsAlerts: [] });
  if (!alerts.newsAlerts) alerts.newsAlerts = [];
  alerts.newsAlerts.push(...alertEntries);
  // Keep only last 200 alerts
  if (alerts.newsAlerts.length > 200) {
    alerts.newsAlerts = alerts.newsAlerts.slice(-200);
  }
  saveJson(ALERTS_FILE, alerts);

  // Save daily report
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const reportFile = path.join(REPORTS_DIR, `twitter-alerts-${dateStr}.json`);
  saveJson(reportFile, alertEntries);
  log(`💾 Report saved: ${reportFile}`);
  log(`✅ Done — ${top.length} new relevant hit(s), ${newItems.length - relevant.length} new but low-score, ${allItems.length - newItems.length} previously seen.`);
}

main().catch(err => {
  log(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
