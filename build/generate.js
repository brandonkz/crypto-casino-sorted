/* Build-time generator. Reads data/rewards.json and writes:
   - the homepage finder default results + embedded data
   - the shared static comparison table
   - 6 volume bracket pages under /best-rewards/<n>-monthly/
   - /methodology.html
   Run: node build/generate.js   (output is committed; no client-side fetch) */
const fs = require('fs');
const path = require('path');
const FC = require('../assets/finder-core.js');
const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/rewards.json'), 'utf8'));
const casinos = data.casinos;
const VERIFIED = '2026-07-09';
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const BRACKETS = [250, 1000, 2500, 5000, 10000, 25000];
const GAME_DEFAULT = 'slots';

function nav(active){
  const L=(href,label,key,cls)=>`<a href="${href}"${cls?` class="${cls}${active===key?' active':''}"`:(active===key?' class="active"':'')}>${label}</a>`;
  return `<nav class="t-nav">
    <a href="/" class="t-nav-logo">CryptoCasinoSorted</a>
    <input type="checkbox" id="t-nav-toggle" class="t-nav-toggle" aria-label="Toggle navigation menu">
    <label for="t-nav-toggle" class="t-nav-burger" aria-hidden="true"><span></span><span></span><span></span></label>
    <div class="t-nav-links">
      ${L('/rewards-recommender.html','Rewards','rewards','t-nav-primary')}
      ${L('/rakeback-comparison.html','Rakeback','rakeback')}
      ${L('/bonus-calculator.html','Bonus Calc','bonus')}
      ${L('/casino-reward-sources.html','Sources','sources')}
      ${L('/reviews/','Reviews','reviews')}
      ${L('/blog/','Guides','guides')}
    </div>
  </nav>`;
}
const FOOTER = `<footer class="ccs-trust-footer" aria-label="Site trust links">
  <div class="ccs-trust-footer-inner">
    <strong>CryptoCasinoSorted</strong>
    <nav>
      <a href="/about.html">About</a>
      <a href="/how-we-rank.html">How We Rank</a>
      <a href="/methodology.html">Methodology</a>
      <a href="/responsible-gambling.html">Responsible Gambling</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/contact.html">Contact</a>
    </nav>
    <span>18+ only. Gamble responsibly.</span>
  </div>
</footer>`;

function head(title, desc, canonical, extraLd){
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
  <title>${esc(title)}</title>
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://cryptocasinosorted.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="/terminal-theme.css">
  <link rel="stylesheet" href="/redesign.css">
  <link rel="icon" href="/favicon.ico">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-0L3N9F43ED"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-0L3N9F43ED');</script>
  ${extraLd||''}
</head>`;
}

/* ---- static comparison table (crawlable HTML) ---- */
function comparisonTable(){
  const rows = casinos.map(c=>{
    const t=c.rakeback_tiers&&c.rakeback_tiers[0]?c.rakeback_tiers[0].rate:0;
    const topRate=(c.rakeback_tiers||[]).reduce((m,x)=>Math.max(m,x.rate),0);
    const rake = topRate?`<span class="num">${(t*100).toFixed(1)}%</span>&ndash;<span class="num">${(topRate*100).toFixed(1)}%</span>`:'<span class="num">0%</span>';
    const cash = c.cashback&&c.cashback.rate?`<span class="num">${(c.cashback.rate*100).toFixed(0)}%</span>`:'&mdash;';
    const wt = c.withdrawal_test;
    const speed = wt&&wt.time?`<span class="num">${esc(wt.time)}</span>`:'&mdash;';
    const stamp = wt&&wt.date?`<span class="tested">Tested <span class="num">${wt.date}</span></span>`:'';
    const cta = c.ref_url?`<a class="btn-primary" href="${esc(c.ref_url)}" rel="sponsored noopener" target="_blank">Visit</a>`:`<a class="btn-secondary" href="/reviews/">Review</a>`;
    return `<tr>
      <td class="casino">${esc(c.name)}${c.payout_model_assumed?' <span class="assumed-tag">modeled</span>':''}</td>
      <td>${rake}</td>
      <td>${cash}</td>
      <td>${speed} ${stamp}</td>
      <td>${cta}</td>
    </tr>`;
  }).join('\n');
  return `<div class="cmp-wrap"><table class="cmp">
    <thead><tr><th>Casino</th><th>Rakeback</th><th>Cashback</th><th>Withdrawal (tested)</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/* ---- finder result rows ---- */
function resultRow(r, i){
  const rankClass = i===0?'rank-1':(i<3?'rank-'+(i+1):'');
  const stamp = r.test&&r.test.date?`<span class="tested">Tested <span class="num">${r.test.date}</span>${r.test.time?` &middot; <span class="num">${esc(r.test.time)}</span>`:''}</span>`:'';
  const cta = r.ref?`<a class="btn-primary" href="${esc(r.ref)}" rel="sponsored noopener" target="_blank">Go to ${esc(r.name)}</a>`:`<a class="btn-secondary" href="/reviews/">Read review</a>`;
  const flag = r.capped?`<div class="flag">Promo value exceeds expected losses at this volume. Read the terms.</div>`:'';
  return `<div class="result-row ${rankClass}">
    <div>
      <div class="result-head"><span class="result-rank">#${i+1}</span><span class="result-name">${esc(r.name)}</span>${r.assumed?'<span class="assumed-tag">modeled</span>':''} ${stamp}</div>
      <div class="result-rate"><span class="num">${r.rateText}</span> of expected losses returned</div>
      <div class="result-math">${esc(r.math)}</div>
      <div class="result-tier">Tier at this volume: ${esc(r.tierName)}</div>
    </div>
    <div class="result-cta">
      <div class="result-ev"><span class="num">${r.evText}</span><small>/mo back</small></div>
      ${cta}
    </div>
    ${flag}
  </div>`;
}

function finderResultsHTML(wager, game, n){
  return FC.rank(casinos, wager, game).slice(0, n||3).map(resultRow).join('\n');
}

function finderWidget(){
  const def = finderResultsHTML(1000, GAME_DEFAULT, 3);
  return `<div class="finder" id="finder">
    <div class="finder-grid">
      <form class="finder-controls" id="finder-form" onsubmit="return false">
        <label for="wager">Monthly wager (USD)</label>
        <div class="amount-row">
          <input type="number" id="wager" name="wager" min="50" max="100000" step="50" value="1000" class="num">
        </div>
        <input type="range" id="wager-range" min="100" max="25000" step="100" value="1000" aria-label="Monthly wager slider">
        <label>Game type</label>
        <div class="seg" id="game-seg" role="group" aria-label="Game type">
          <button type="button" data-game="slots" aria-pressed="true">Slots</button>
          <button type="button" data-game="originals" aria-pressed="false">Originals</button>
          <button type="button" data-game="live" aria-pressed="false">Live casino</button>
          <button type="button" data-game="sports" aria-pressed="false">Sports</button>
        </div>
        <p class="finder-note">Numbers are modeled long-run estimates, not guarantees. <a href="/methodology.html">How we calculate this</a>.</p>
      </form>
      <div>
        <div class="eyebrow">Top 3 by return rate</div>
        <div id="finder-results">${def}</div>
        <p class="finder-note">See the full <a id="bracket-link" href="/best-rewards/1000-monthly/">$1,000/month breakdown</a>.</p>
      </div>
    </div>
  </div>`;
}

function embed(){
  return `<script>window.REWARDS=${JSON.stringify({casinos:casinos, verified:VERIFIED})};</script>`;
}

/* ---------------- HOMEPAGE ---------------- */
function buildHomepage(){
  const idx = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  // preserve existing <head> from the SEO pass, but ensure our css/fonts present
  let headHtml = idx.slice(0, idx.indexOf('</head>')+'</head>'.length);
  if(!/redesign\.css/.test(headHtml) || !/terminal-theme\.css/.test(headHtml)){
    const inject = `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="/terminal-theme.css">
  <link rel="stylesheet" href="/redesign.css">
`;
    headHtml = headHtml.replace('</head>', inject+'</head>');
  }
  const body = `
<body class="audit has-bar">
${nav('rewards')}
<main>
  <section class="hero"><div class="wrap">
    <div class="eyebrow">Rewards Finder</div>
    <h1>See what each crypto casino actually pays you back.</h1>
    <p class="lead">Enter your monthly wager. We rank casinos by how much of your expected losses come back as rakeback and cashback. The math is shown on every row.</p>
    <p class="verified-line">Last verified <span class="num">${VERIFIED}</span>. Figures are modeled estimates. <a href="/methodology.html">Methodology</a>.</p>
  </div></section>

  <section><div class="wrap">
    ${finderWidget()}
  </div></section>

  <section><div class="wrap">
    <h2>Full rakeback comparison</h2>
    <p class="verified-line">Same data as the finder. Sortable columns coming; header stays visible as you scroll.</p>
    ${comparisonTable()}
    <p class="finder-note">Every casino link is an affiliate link, marked rel="sponsored". See <a href="/how-we-rank.html">how we rank</a> and <a href="/methodology.html">how the numbers are calculated</a>.</p>
  </div></section>
</main>

<div class="mobile-bar" id="mobile-bar" aria-live="polite">
  <span class="mb-name" id="mb-name"></span>
  <a class="btn-primary" id="mb-cta" href="#" rel="sponsored noopener" target="_blank">Go</a>
  <button class="mb-close" id="mb-close" aria-label="Dismiss">&times;</button>
</div>

${FOOTER}
${embed()}
<script src="/assets/finder-core.js"></script>
<script src="/assets/finder.js"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(ROOT,'index.html'), headHtml+body);
  console.log('wrote index.html');
}

/* ---------------- BRACKET PAGES ---------------- */
const BRACKET_ANALYSIS = {
  250: "At $250 a month you are a light player. Percentage rakeback is tiny here, so flat and recurring perks matter more than headline rakeback rates. Most VIP ladders barely move at this volume, so you sit in the base tier everywhere. Cashback on losses does more work than rakeback because your theoretical loss is small either way. Pick on withdrawal speed and low friction, not on a big rakeback number you will never reach. The gap between the top and bottom casino here is a few dollars a month, so trust and payout reliability should decide it.",
  1000: "At $1,000 a month the base tier still rules. You are past the point where flat bonuses dominate, but not near the thresholds where rakeback rates climb. Casinos with a cashback component pull ahead because cashback scales straight off your theoretical loss. Edge-based rakeback casinos pay less here than their marketing implies, since the rate applies to house edge, not to your full wager. This is the volume where reading the payout model matters most. A clean cashback beats a high advertised rakeback that only applies at tiers you have not reached.",
  2500: "At $2,500 a month you start crossing into second tiers on some ladders. Rakeback rates tick up, which favours edge-based programs that reward volume. Cashback still helps, but its lead narrows as rakeback grows. This is the crossover band where rankings begin to shuffle. A casino that looked mediocre at $1,000 can jump once its next tier unlocks. Watch tier thresholds closely here, because a small change in monthly volume can move you a whole tier and change the payout.",
  5000: "At $5,000 a month tier progression is the main story. Most players reach mid tiers, so the higher rakeback rates start to apply. Edge-based casinos with steep ladders reward this volume best. Flat bonuses are now a rounding error against percentage returns. The return rate spread between casinos widens, so the choice matters more in dollar terms than it did at low volume. This is where a well-structured VIP program begins to pay for the friction of switching sites.",
  10000: "At $10,000 a month you are a high-volume player and tier rates are near their peak for most programs. The casinos with the highest ceiling rakeback rates lead. Cashback becomes secondary because rakeback dollars now dwarf it. Return rates look their best here, but read the fine print: some programs cap rakeback or pay in a volatile token, which erodes the real value. At this volume the difference between a clean-cash payout and a token payout is real money each month.",
  25000: "At $25,000 or more a month you are in top-tier territory and rakeback ceilings decide the ranking. The programs with the highest sustained rates win, and small rate differences translate into large monthly dollars. Token payouts and rakeback caps matter most here, because they quietly cut the headline rate. Withdrawal reliability and limits also matter more, since you are moving large sums. At this volume, model the payout on the sustained ceiling rate, not the entry rate, and confirm there is no monthly cap before you commit."
};

function buildBracket(wager){
  const slug = `${wager}-monthly`;
  const dir = path.join(ROOT,'best-rewards',slug);
  fs.mkdirSync(dir,{recursive:true});
  const canonical = `https://cryptocasinosorted.com/best-rewards/${slug}/`;
  const label = wager>=25000?'$25,000+':'$'+wager.toLocaleString('en-US');
  const title = `Best Crypto Casino Rewards at ${label}/Month Wagered (2026)`;
  const desc = `The crypto casinos that return the most on ${label} wagered per month, ranked by return rate with the math shown. Rakeback, cashback and tested withdrawals.`;
  const top3 = finderResultsHTML(wager, GAME_DEFAULT, 3);
  const full = FC.rank(casinos, wager, GAME_DEFAULT);
  const fullRows = full.map(resultRow).join('\n');
  const neighbours = BRACKETS.filter(b=>b!==wager);
  const navLinks = neighbours.map(b=>`<a class="btn-secondary" href="/best-rewards/${b}-monthly/">${b>=25000?'$25,000+':'$'+b.toLocaleString('en-US')}/mo</a>`).join(' ');
  const ld = `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Home","item":"https://cryptocasinosorted.com/"},
    {"@type":"ListItem","position":2,"name":"Best rewards by volume","item":"https://cryptocasinosorted.com/best-rewards/1000-monthly/"},
    {"@type":"ListItem","position":3,"name":title,"item":canonical}]})}</script>`;
  const page = head(title,desc,canonical,ld)+`
<body class="audit">
${nav('rewards')}
<main><div class="wrap narrow">
  <p class="eyebrow"><a href="/">Rewards Finder</a> / by volume</p>
  <h1>Best crypto casino rewards at <span class="num">${label}</span> per month</h1>
  <p class="verified-line">Ranked by return rate for <span class="num">${label}</span> wagered on slots. Last verified <span class="num">${VERIFIED}</span>. Modeled estimates. <a href="/methodology.html">Methodology</a>.</p>

  <h2>Top 3 at this volume</h2>
  ${top3}

  <h2>Why the ranking looks like this at ${label}/month</h2>
  <p>${BRACKET_ANALYSIS[wager]}</p>

  <h2>Full ranking at ${label}/month</h2>
  ${fullRows}

  <h2>Methodology</h2>
  <p>Return rate is expected reward value divided by theoretical loss. Theoretical loss is your monthly wager times the house edge for the game type (slots <span class="num">4%</span>, originals <span class="num">1%</span>, live <span class="num">1.5%</span>, sports <span class="num">5%</span>). Cashback is modeled on theoretical loss, which is the long-run average. A winning month pays no cashback. Numbers are modeled estimates, not guarantees, and individual results vary. Full detail on the <a href="/methodology.html">methodology page</a>.</p>

  <h2>Other volumes</h2>
  <p>${navLinks}</p>
  <p><a class="btn-primary" href="/">Back to the Rewards Finder</a></p>
</div></main>
${FOOTER}
</body></html>`;
  fs.writeFileSync(path.join(dir,'index.html'), page);
  console.log('wrote /best-rewards/'+slug+'/');
  return canonical;
}

/* ---------------- METHODOLOGY ---------------- */
function buildMethodology(){
  const canonical='https://cryptocasinosorted.com/methodology.html';
  const title='How We Calculate Crypto Casino Reward Value (Methodology)';
  const desc='How CryptoCasinoSorted models expected reward value: house edge assumptions, the losses-converge-to-theo assumption, the bonus haircut, how withdrawal tests are run, and last-verified dates.';
  const worked = FC.compute(casinos.find(c=>c.slug==='stake'), 2500, 'slots');
  const rowsVerified = casinos.map(c=>{
    const wt=c.withdrawal_test;
    return `<tr><td class="casino">${esc(c.name)}</td><td>${wt&&wt.time?`<span class="num">${esc(wt.time)}</span>`:'&mdash;'}</td><td>${wt&&wt.date?`<span class="num">${wt.date}</span>`:'&mdash;'}</td></tr>`;
  }).join('\n');
  const page = head(title,desc,canonical)+`
<body class="audit">
${nav()}
<main><div class="wrap narrow">
  <p class="eyebrow">Methodology</p>
  <h1>How we calculate reward value</h1>
  <p class="verified-line">Last verified <span class="num">${VERIFIED}</span>.</p>

  <p>This page explains the numbers behind the <a href="/">Rewards Finder</a> and the volume bracket pages. Read it before you trust any figure. The numbers are modeled long-run estimates. They are not guarantees, and your own results will vary.</p>

  <h2>The core idea: theoretical loss</h2>
  <p>Every reward is measured against your theoretical loss, or theo. Theo is what the house expects to win from you over time. It is your monthly wager times the house edge for the game you play.</p>
  <p>We use four house edge assumptions by game type: slots <span class="num">4%</span>, originals like dice, crash and plinko <span class="num">1%</span>, live casino and tables <span class="num">1.5%</span>, sports <span class="num">5%</span>. You pick the game type in the finder. Slots is the default.</p>

  <h2>Expected reward value</h2>
  <p>We add up three things. Rakeback, using one of two models per casino. An edge-based model pays wager times house edge times the rakeback rate. A wager-based model pays wager times the rakeback rate. Cashback on losses, modeled as theo times the cashback rate. And flat recurring bonuses at face value, or at half value if they carry wagering requirements.</p>
  <p>Cashback usually pays on realised losses. Over many sessions, realised losses converge to theo, so we model cashback on theo. This is a long-run average. In a winning month, cashback pays zero. The tool models the average, not any single month.</p>

  <h2>Return rate</h2>
  <p>Return rate is expected reward value divided by theo, shown as the percent of your expected losses that comes back. We rank by return rate. If a promo returns more than <span class="num">100%</span> of expected losses at a given volume, we cap the display at <span class="num">&gt;100%</span> and flag it, because that usually means a short-term promo with terms to read. We never present gambling as profitable. The house edge is real and you should expect to lose money over time.</p>

  <h2>Tiers</h2>
  <p>We apply the steady-state VIP tier your entered volume sustains in a month. We do not model mid-month tier jumps. Important: no casino publishes its tier thresholds, so the thresholds we use are modeled estimates, flagged in our data file.</p>

  <h2>Worked example</h2>
  <p>Stake, edge-based, at <span class="num">$2,500</span> a month on slots. Theo is <span class="num">$2,500</span> times <span class="num">4%</span> equals <span class="num">$100</span>. The modeled tier at this volume applies to that theo.</p>
  <p class="result-math">${esc(worked.math)}. Return rate ${worked.rateText} of expected losses.</p>

  <h2>How withdrawal tests work</h2>
  <p>A withdrawal test means we fund an account, play a little, and request a payout, then record how long it took. The withdrawal time shown comes from these checks. Note plainly: the date on each Tested stamp right now is our last data-verification date, <span class="num">${VERIFIED}</span>, not a fresh per-transaction test for every casino. Where we have a dated transaction test, we will show that date instead.</p>
  <table class="cmp"><thead><tr><th>Casino</th><th>Withdrawal time</th><th>Verified</th></tr></thead><tbody>${rowsVerified}</tbody></table>

  <h2>Update cadence</h2>
  <p>We re-check reward terms and withdrawal behaviour on a rolling basis and bump the last-verified date when the data changes. If you spot a number that looks wrong, tell us on the <a href="/contact.html">contact page</a>.</p>
  <p><a class="btn-primary" href="/">Back to the Rewards Finder</a></p>
</div></main>
${FOOTER}
</body></html>`;
  fs.writeFileSync(path.join(ROOT,'methodology.html'), page);
  console.log('wrote methodology.html');
}

buildHomepage();
BRACKETS.forEach(buildBracket);
buildMethodology();
console.log('DONE');
