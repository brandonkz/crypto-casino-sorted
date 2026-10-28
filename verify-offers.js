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
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`);
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
        monitor: operator.source_monitor || 'auto',
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
      monitor: operator.source_monitor || 'auto',
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
        monitor: offer.source_monitor || 'auto',
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
      monitor: offer.source_monitor || 'auto',
    });
  }

  return entries;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BLOCK_STATUSES = new Set([401, 403, 406, 429, 451, 503]);
const DEAD_STATUSES = new Set([404, 410]);

function looksLikeBotWall(raw) {
  return /<title>\s*(just a moment|attention required|access denied|403 forbidden)/i.test(raw)
    || /<form[^>]+challenge-form|cf_chl_opt\s*=/i.test(raw);
}

function looksLikeSoftNotFound(raw) {
  return /page not found|cannot get \//i.test(raw.slice(0, 400000));
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': BROWSER_UA,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const raw = await response.text();
    return { ok: response.ok, status: response.status, finalUrl: response.url, raw, text: normalizeText(raw) };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSource(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = await fetchOnce(url);
      // Success, a hard 404/410 or a bot wall will not change on retry.
      if (last.ok || DEAD_STATUSES.has(last.status) || looksLikeBotWall(last.raw)) break;
    } catch (error) {
      last = { error };
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  if (last.error) throw last.error;
  last.blocked = BLOCK_STATUSES.has(last.status) || looksLikeBotWall(last.raw);
  last.dead = DEAD_STATUSES.has(last.status) && !last.blocked;
  return last;
}

// Statuses that are real offer problems and should make the run loud.
const ACTIONABLE = new Set(['source_terms_missing', 'source_dead', 'missing_source']);
// Statuses worth listing but that must not fail the run on their own.
const INFORMATIONAL = new Set(['blocked', 'fetch_failed', 'manual_due', 'content_drift', 'missing_baseline', 'unverifiable', 'no_current_offer']);

function classify(entry, fetched) {
  if (!entry.url) return 'missing_source';
  if (fetched.blocked) return 'blocked';
  if (fetched.dead) return 'source_dead';
  if (!fetched.ok) return 'fetch_failed';
  // Compare the offer terms themselves when we have them: that is the real signal.
  if (entry.requiredTerms && entry.requiredTerms.length) {
    return entry.missingTerms.length ? 'source_terms_missing' : 'ok';
  }
  // Without terms, a whole-page hash change is usually help-centre/CMS churn, not an offer change.
  if (!entry.object.source_terms_hash) return 'missing_baseline';
  if (entry.object.source_terms_hash !== fetched.hash) return 'content_drift';
  return 'ok';
}

function rowStatus(status) {
  return {
    ok: '✅ OK',
    manual_due: '🕒 Manual recheck due',
    unverifiable: '🔍 Unverifiable (browser check could not confirm offer; manual recheck)',
    no_current_offer: 'ℹ️ No current offer listed',
    content_drift: 'ℹ️ Page changed (no offer terms tracked)',
    missing_baseline: '⚠️ Missing baseline',
    fetch_failed: '⚠️ Unverifiable (fetch error)',
    blocked: '🛡️ Unverifiable (bot block)',
    source_dead: '🚨 Dead URL',
    missing_source: '🚨 Missing source',
    source_terms_missing: '🚨 Offer terms changed',
  }[status] || status;
}

function markdownReport(results) {
  const actionable = results.filter((item) => ACTIONABLE.has(item.status));
  const info = results.filter((item) => INFORMATIONAL.has(item.status));
  const lines = [];
  lines.push(`# Reward offer source verification`);
  lines.push('');
  lines.push(`Run date: ${today}`);
  lines.push(`Max source age: ${maxAgeDays} days`);
  lines.push(`Result: ${actionable.length} source(s) need review (changed offer terms, dead or missing URL); ${info.length} unverifiable or due a manual recheck; ${results.length - actionable.length - info.length} OK`);
  lines.push(`ACTIONABLE_COUNT=${actionable.length}`);
  lines.push('');
  lines.push(`| Status | Type | Casino | Source | Notes |`);
  lines.push(`|---|---|---|---|---|`);
  for (const item of results) {
    const source = item.url ? `[source](${item.url})` : 'missing';
    const notes = [
      item.httpStatus ? `HTTP ${item.httpStatus}` : null,
      item.age === Infinity ? 'no last_checked' : `age ${item.age}d`,
      item.manual ? 'manual browser verification' : null,
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

    if (entry.monitor === 'manual') {
      // Manual sources are JS-rendered or bot-walled; a script cannot re-verify them,
      // so age is a reminder, not a failure.
      result.status = ageDays(entry.object.source_last_checked) > maxAgeDays ? 'manual_due' : 'ok';
      // A browser check that could not confirm the offer must never count as checked.
      if (entry.object.source_status === 'unverifiable') result.status = 'unverifiable';
      if (entry.object.source_status === 'no_current_offer') result.status = 'no_current_offer';
      result.manual = true;
      // Still confirm the URL exists: a 404 is a real problem even when content needs a human.
      try {
        const probe = await fetchSource(entry.url, 2);
        result.httpStatus = probe.status;
        if (probe.dead) result.status = 'source_dead';
      } catch (error) {
        result.error = error.name === 'AbortError' ? 'request timed out' : error.message;
      }
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
      if (result.status === 'ok') result.age = 0;

      if (updateBaseline && fetched.ok && !fetched.blocked && result.status !== 'source_terms_missing') {
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

  const actionableCount = results.filter((item) => ACTIONABLE.has(item.status)).length;
  if (actionableCount && !updateBaseline) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
