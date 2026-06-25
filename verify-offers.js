#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');
const jsonOutput = args.has('--json');
const maxAgeArg = process.argv.find((arg) => arg.startsWith('--max-age-days='));
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const maxAgeDays = maxAgeArg ? Number(maxAgeArg.split('=')[1]) : 30;
const reportPath = reportArg ? reportArg.split('=').slice(1).join('=') : null;
const today = new Date().toISOString().slice(0, 10);

const operatorsPath = `${ROOT}/data/operators.json`;
const offersPath = `${ROOT}/data/welcome-offers.json`;

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function normalizeForSearch(text) {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function termsFingerprint(expected, sourceText, requiredTerms = []) {
  if (Array.isArray(requiredTerms) && requiredTerms.length) {
    const haystack = normalizeForSearch(sourceText);
    return requiredTerms
      .map((term) => {
        const needle = normalizeForSearch(term);
        return `${needle}:${haystack.includes(needle) ? 'present' : 'missing'}`;
      })
      .join('|');
  }

  const keywordPattern = /(bonus|cashback|rakeback|reward|rewards|vip|elite|wager|wagering|deposit|spin|spins|free spin|lossback|tier|level|withdraw|rollover|maximum|max|cap|match|commission|revenue share|weekly|monthly|\d+(?:\.\d+)?%|\$\s?\d|btc|usdt)/i;
  const chunks = sourceText
    .split(/(?<=[.!?])\s+|\n+| {2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12 && keywordPattern.test(part))
    .slice(0, 80);
  const joined = [expected, ...chunks]
    .join(' ')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[a-f0-9]{16,}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return joined || expected || sourceText.slice(0, 2000);
}

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000);
}

function ageDays(dateString) {
  if (!dateString) return Infinity;
  const parsed = Date.parse(dateString);
  if (Number.isNaN(parsed)) return Infinity;
  return Math.floor((Date.now() - parsed) / DAY_MS);
}

function sourceEntries(operatorsData, offersData) {
  const operators = operatorsData.operators || operatorsData;
  const offerItems = offersData.items || [];
  const entries = [];

  for (const operator of operators) {
    const url = operator.source_url || operator.reward_page_url;
    if (!url) {
      entries.push({
        kind: 'reward',
        name: operator.name,
        id: operator.id,
        url: null,
        object: operator,
        expected: operator.offer_summary || operator.reward_page_label || '',
        requiredTerms: operator.source_terms || [],
      });
      continue;
    }

    entries.push({
      kind: 'reward',
      name: operator.name,
      id: operator.id,
      url,
      object: operator,
      expected: operator.offer_summary || operator.reward_page_label || '',
      requiredTerms: operator.source_terms || [],
    });
  }

  for (const offer of offerItems) {
    if (!offer.source_url) {
      entries.push({
        kind: 'welcome',
        name: offer.casino,
        id: offer.casino.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        url: null,
        object: offer,
        expected: offer.offer || '',
        requiredTerms: offer.source_terms || [],
      });
      continue;
    }

    entries.push({
      kind: 'welcome',
      name: offer.casino,
      id: offer.casino.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      url: offer.source_url,
      object: offer,
      expected: offer.offer || '',
      requiredTerms: offer.source_terms || [],
    });
  }

  return entries;
}

async function fetchSource(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'CryptoCasinoSorted offer verifier (+https://cryptocasinosorted.com/casino-reward-sources.html)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      text: normalizeText(body),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classify(entry, fetched) {
  if (!entry.url) return 'missing_source';
  if (!fetched.ok) return 'fetch_failed';
  if (entry.missingTerms && entry.missingTerms.length) return 'source_terms_missing';
  if (!entry.object.source_terms_hash) return 'missing_baseline';
  if (entry.object.source_terms_hash !== fetched.hash) return 'source_changed';
  if (ageDays(entry.object.source_last_checked) > maxAgeDays) return 'stale';
  return 'ok';
}

function rowStatus(status) {
  return {
    ok: '✅ OK',
    stale: '⚠️ Stale',
    source_changed: '🚨 Changed',
    missing_baseline: '⚠️ Missing baseline',
    fetch_failed: '⚠️ Fetch failed',
    missing_source: '⚠️ Missing source',
    source_terms_missing: '🚨 Terms missing',
  }[status] || status;
}

function markdownReport(results) {
  const needsReview = results.filter((item) => item.status !== 'ok');
  const lines = [];
  lines.push(`# Reward offer source verification`);
  lines.push('');
  lines.push(`Run date: ${today}`);
  lines.push(`Max source age: ${maxAgeDays} days`);
  lines.push(`Result: ${needsReview.length ? `${needsReview.length} item(s) need review` : 'all monitored sources OK'}`);
  lines.push('');
  lines.push(`| Status | Type | Casino | Source | Notes |`);
  lines.push(`|---|---|---|---|---|`);
  for (const item of results) {
    const source = item.url ? `[source](${item.url})` : 'missing';
    const notes = [
      item.httpStatus ? `HTTP ${item.httpStatus}` : null,
      item.age === Infinity ? 'no last_checked' : `age ${item.age}d`,
      item.hashChanged ? `hash ${item.previousHash || 'none'} → ${item.hash}` : null,
      item.error ? item.error.replace(/\|/g, '/') : null,
      item.missingTerms && item.missingTerms.length ? `missing terms: ${item.missingTerms.join(', ')}` : null,
    ].filter(Boolean).join('; ');
    lines.push(`| ${rowStatus(item.status)} | ${item.kind} | ${item.name} | ${source} | ${notes || '-'} |`);
  }
  lines.push('');
  lines.push(`Commercial CTAs should continue to use affiliate URLs only. Official source links belong on /casino-reward-sources.html.`);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const operatorsData = readJson(operatorsPath);
  const offersData = readJson(offersPath);
  const entries = sourceEntries(operatorsData, offersData);
  const results = [];

  for (const entry of entries) {
    const result = {
      kind: entry.kind,
      name: entry.name,
      id: entry.id,
      url: entry.url,
      previousHash: entry.object.source_terms_hash || null,
      age: ageDays(entry.object.source_last_checked),
    };

    if (!entry.url) {
      result.status = 'missing_source';
      results.push(result);
      continue;
    }

    try {
      const fetched = await fetchSource(entry.url);
      const haystack = normalizeForSearch(fetched.text);
      entry.missingTerms = (entry.requiredTerms || [])
        .map(String)
        .filter((term) => !haystack.includes(normalizeForSearch(term)));
      const sourceText = termsFingerprint(entry.expected, fetched.text, entry.requiredTerms);
      fetched.hash = hashText(sourceText);
      result.httpStatus = fetched.status;
      result.finalUrl = fetched.finalUrl;
      result.hash = fetched.hash;
      result.hashChanged = Boolean(entry.object.source_terms_hash && entry.object.source_terms_hash !== fetched.hash);
      result.missingTerms = entry.missingTerms;
      result.status = classify(entry, fetched);

      if (updateBaseline && fetched.ok) {
        entry.object.source_url = entry.url;
        entry.object.source_last_checked = today;
        entry.object.source_terms_hash = fetched.hash;
        entry.object.source_status = 'verified';
        result.status = 'ok';
        result.age = 0;
        result.hashChanged = false;
      }
    } catch (error) {
      result.status = 'fetch_failed';
      result.error = error.name === 'AbortError' ? 'request timed out' : error.message;
    }

    results.push(result);
  }

  if (updateBaseline) {
    if (Array.isArray(operatorsData)) writeJson(operatorsPath, operatorsData);
    else writeJson(operatorsPath, operatorsData);
    writeJson(offersPath, offersData);
  }

  const report = markdownReport(results);
  if (reportPath) fs.writeFileSync(reportPath, report);

  if (jsonOutput) {
    console.log(JSON.stringify({ date: today, maxAgeDays, results }, null, 2));
  } else {
    console.log(report);
  }

  const needsReview = results.some((item) => item.status !== 'ok');
  if (needsReview && !updateBaseline) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
