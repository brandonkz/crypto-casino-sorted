const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const site = "https://cryptocasinosorted.com";
const today = "2026-07-03";

const trustLinks = [
  ["/about.html", "About"],
  ["/how-we-rank.html", "How We Rank"],
  ["/responsible-gambling.html", "Responsible Gambling"],
  ["/privacy.html", "Privacy"],
  ["/contact.html", "Contact"],
];

const categoryDefs = [
  {
    slug: "comparisons",
    title: "Comparisons",
    description: "Head-to-head crypto casino comparisons focused on withdrawals, trust signals, game fit, VIP value and bonus friction.",
    match: (p) => /\bvs\b|comparison|compared/i.test(p.text),
  },
  {
    slug: "withdrawals-kyc",
    title: "Withdrawals & KYC",
    description: "Cashout tests, no-KYC reality checks, withdrawal limits, network fees, bonus traps and payout proof workflows.",
    match: (p) => /withdraw|cashout|payout|kyc|no-kyc|instant/i.test(p.text),
  },
  {
    slug: "rewards-vip",
    title: "Rewards & VIP",
    description: "Rakeback, cashback, lossback, VIP tiers, welcome offers and the math behind casino bonus value.",
    match: (p) => /reward|vip|bonus|rakeback|cashback|lossback|wagering|welcome|loyalty/i.test(p.text),
  },
  {
    slug: "coins-networks",
    title: "Coins & Networks",
    description: "Crypto deposit and withdrawal guides for Bitcoin, Ethereum, Litecoin, Solana, TRON, stablecoins and wallets.",
    match: (p) => /bitcoin|ethereum|litecoin|solana|dogecoin|tron|trx|usdt|usdc|wallet|metamask|deposit|network|coin|crypto-for/i.test(p.text),
  },
  {
    slug: "guides-safety",
    title: "Guides & Safety",
    description: "Beginner guides, provably fair checks, bankroll safety, scam warnings, RTP explainers and crypto gambling fundamentals.",
    match: () => true,
  },
];

const canonicalMap = {
  "stake-vs-bcgame-comparison.html": "stake-vs-bcgame-comparison-2026.html",
  "stake-vs-rollbit-2026.html": "rollbit-vs-stake-comparison-2026.html",
  "stake-vs-rollbit-reddit-trust-check-2026.html": "stake-vs-rollbit-reddit-withdrawal-proof-2026.html",
  "stake-vs-rollbit-no-kyc-withdrawal-comparison-2026.html": "stake-vs-rollbit-reddit-withdrawal-proof-2026.html",
  "stake-vs-shuffle-vs-rollbit-withdrawals-2026.html": "stake-vs-shuffle-vs-rollbit-instant-withdrawals-2026.html",
  "crypto-casino-instant-withdrawal-2026.html": "crypto-casino-instant-withdrawals-ranked-2026.html",
  "crypto-casino-instant-withdrawals-reality-check-2026.html": "crypto-casino-instant-withdrawals-ranked-2026.html",
  "best-crypto-casino-instant-withdrawal-reddit-2026.html": "crypto-casino-instant-withdrawals-ranked-2026.html",
  "instant-withdrawal-crypto-casino-reddit-test-2026.html": "crypto-casino-instant-withdrawals-ranked-2026.html",
  "instant-withdrawals-vs-bonus-traps-crypto-casinos-2026.html": "instant-withdrawal-crypto-casinos-bonus-traps-2026.html",
  "best-crypto-casino-reddit-withdrawal-checklist-2026.html": "best-crypto-casino-withdrawal-proof-checklist-2026.html",
  "no-kyc-crypto-casinos-instant-withdrawal-2026.html": "no-kyc-crypto-casino-withdrawals-trust-check-2026.html",
  "no-kyc-crypto-casino-withdrawal-test-before-deposit-2026.html": "no-kyc-crypto-casino-withdrawals-trust-check-2026.html",
  "bitcoin-casino-no-kyc-kyc-may-be-required-2026.html": "bitcoin-casino-no-kyc-2026-guide.html",
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith("backup-")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
}

function stripTags(value) {
  return (value || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanTitle(value) {
  return stripTags(value).replace(/\s+\|\s*CryptoCasinoSorted$/i, "").replace(/\s+[-—]\s*CryptoCasinoSorted$/i, "").trim();
}

function meta(html, name) {
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`, "i"));
  if (!tag) return "";
  return (tag[0].match(/\bcontent=["']([^"']*)["']/i) || [])[1] || "";
}

function getTitle(html) {
  return cleanTitle((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
}

function getH1(html) {
  return stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
}

function getDate(html, fallback = today) {
  const iso = html.match(/"datePublished"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/i);
  if (iso) return iso[1];
  const month = html.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-9]{1,2}),\s+(2026)\b/i);
  if (!month) return fallback;
  const months = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
  return `${month[3]}-${months[month[1].toLowerCase()]}-${String(month[2]).padStart(2, "0")}`;
}

function limitTitle(h1) {
  let value = cleanTitle(h1).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (value.length <= 60) return polishTitleLength(value, h1);
  value = value.replace(/:.*$/, "").trim();
  if (value.length >= 50 && value.length <= 60) return polishTitleLength(value, h1);
  const words = cleanTitle(h1).split(/\s+/);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > 57) break;
    out = next;
  }
  if (!/\b2026\b/.test(out) && /\b2026\b/.test(h1) && out.length <= 55) out = `${out} 2026`;
  return polishTitleLength(out, h1);
}

function polishTitleLength(out, h1) {
  out = out.replace(/[,:;|-]+$/, "").trim();
  if (out.length < 50 && !/crypto casino/i.test(out) && out.length <= 36) out = `${out} Crypto Casino`;
  if (out.length < 50 && !/guide/i.test(out) && out.length <= 44) out = `${out} Guide`;
  return out;
}

function categoryFor(post) {
  const bySlug = Object.fromEntries(categoryDefs.map((cat) => [cat.slug, cat]));
  const filename = post.file || "";
  const text = post.text || "";
  if (/withdraw|cashout|payout|kyc|no-kyc|instant/i.test(filename)) return bySlug["withdrawals-kyc"];
  if (/bitcoin|ethereum|litecoin|solana|dogecoin|tron|trx|usdt|usdc|wallet|metamask|deposit|network|coin|crypto-for/i.test(filename)) return bySlug["coins-networks"];
  if (/-vs-|\bvs\b|comparison|compared/i.test(filename) || /\bvs\b|comparison|compared/i.test(post.h1 || "")) return bySlug["comparisons"];
  if (/reward|vip|bonus|rakeback|cashback|lossback|wagering|welcome|loyalty/i.test(text)) return bySlug["rewards-vip"];
  return bySlug["guides-safety"];
}

function trustFooter(depth) {
  const links = trustLinks.map(([href, label]) => `<a href="${href}">${label}</a>`).join("\n      ");
  return `
<footer class="ccs-trust-footer" aria-label="Site trust links">
  <div class="ccs-trust-footer-inner">
    <strong>CryptoCasinoSorted</strong>
    <nav>
      ${links}
    </nav>
    <span>18+ only. Gamble responsibly.</span>
  </div>
</footer>`;
}

function sharedStyles() {
  const file = "terminal-theme.css";
  let css = read(file);
  if (css.includes(".ccs-trust-footer")) return;
  css += `

/* === SEO TRUST + BLOG COMPONENTS === */
.ccs-trust-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--t-border, rgba(255,255,255,0.14));
  background: rgba(4, 16, 38, 0.96);
  color: var(--t-dim, #9fb1d1);
  padding: 18px 16px;
  font-family: var(--t-sans, Inter, system-ui, sans-serif);
}
.ccs-trust-footer-inner {
  width: min(100%, 1180px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 0.78rem;
}
.ccs-trust-footer strong { color: var(--t-text, #f7fbff); }
.ccs-trust-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.ccs-author-byline,
.ccs-related-guides {
  max-width: 780px;
  margin: 20px auto 28px;
  border: 1px solid rgba(255, 157, 0, 0.3);
  background: rgba(9, 30, 67, 0.72);
  padding: 16px 18px;
  color: var(--t-dim, #9fb1d1);
}
.ccs-author-byline strong,
.ccs-related-guides h2 {
  display: block;
  color: var(--t-text, #f7fbff);
  font-size: 0.92rem;
  margin: 0 0 6px;
}
.ccs-author-byline p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
}
.ccs-related-guides ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.ccs-related-guides li {
  margin: 7px 0;
}
.category-section {
  margin: 0 0 34px;
}
.category-section > h2,
.category-page-title {
  color: var(--ccs-ink, #f7fbff);
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 12px;
}
.category-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.category-link {
  display: inline-flex;
  margin: 0 0 18px;
  color: var(--ccs-orange-2, #ff9d00);
  font-weight: 800;
}
@media (max-width: 720px) {
  .ccs-trust-footer-inner { align-items: flex-start; flex-direction: column; }
}
`;
  write(file, css);
}

function ensureFooter(html) {
  if (html.includes("ccs-trust-footer")) return html;
  return html.replace(/<\/body>/i, `${trustFooter()}\n</body>`);
}

function ensureHeadMeta(html, rel, post) {
  const url = `${site}/${rel.replace(/\\/g, "/").replace(/^index\.html$/, "")}`;
  const canonical = post && post.canonicalTarget
    ? `${site}/blog/${post.canonicalTarget}`
    : url.replace(/\/blog\/index\.html$/, "/blog/");

  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
  } else {
    html = html.replace(/<\/head>/i, `  <link rel="canonical" href="${canonical}">\n</head>`);
  }

  if (post && post.noindex) {
    if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
      html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="noindex, follow">`);
    } else {
      html = html.replace(/<\/head>/i, `  <meta name="robots" content="noindex, follow">\n</head>`);
    }
  }

  if (post && post.canonicalTarget && !html.includes("http-equiv=\"refresh\"")) {
    html = html.replace(/<\/head>/i, `  <meta http-equiv="refresh" content="0; url=/blog/${post.canonicalTarget}">\n</head>`);
  }

  html = normalizeSocialImages(html);

  if (rel === "blog/index.html") {
    html = html.replace(/href=["']https:\/\/cryptocasinosorted\.com\/blog\/index\.html["']/gi, `href="${site}/blog/"`);
  }
  return html;
}

function normalizeSocialImages(html) {
  const fallback = `${site}/og-image.png`;
  const normalizeGroup = (input, key, attr) => {
    const re = new RegExp(`<meta\\b(?=[^>]*(?:property|name)=["']${key}["'])[^>]*>`, "gi");
    const tags = input.match(re) || [];
    const nonFallback = tags.find((tag) => !tag.includes(fallback));
    const keep = nonFallback || tags[0] || `<meta ${attr}="${key}" content="${fallback}">`;
    input = input.replace(re, "");
    return input.replace(/<\/head>/i, `  ${keep}\n</head>`);
  };
  html = normalizeGroup(html, "og:image", "property");
  html = normalizeGroup(html, "twitter:image", "name");
  return html;
}

function removeLd(html, types) {
  return html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, (block) => {
    return types.some((type) => block.includes(`"@type": "${type}"`) || block.includes(`"@type":"${type}"`)) ? "" : block;
  });
}

function articleSchema(post) {
  const url = `${site}/blog/${post.file}`;
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": ${JSON.stringify(post.h1 || post.title)},
  "description": ${JSON.stringify(post.description)},
  "author": {
    "@type": "Organization",
    "name": "CryptoCasinoSorted",
    "url": "${site}/about.html"
  },
  "publisher": {
    "@type": "Organization",
    "name": "CryptoCasinoSorted",
    "url": "${site}",
    "logo": {
      "@type": "ImageObject",
      "url": "${site}/og-image.png"
    }
  },
  "datePublished": "${post.date}",
  "dateModified": "${today}",
  "mainEntityOfPage": "${url}",
  "image": "${site}/og-image.png"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "${site}/"},
    {"@type": "ListItem", "position": 2, "name": "Blog", "item": "${site}/blog/"},
    {"@type": "ListItem", "position": 3, "name": ${JSON.stringify(post.h1 || post.title)}, "item": "${url}"}
  ]
}
</script>`;
}

function faqSchema(html) {
  const questions = [...html.matchAll(/<h[23][^>]*>([^<]*\?[^<]*)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>|<\/(?:article|main|div)>)/gi)]
    .map((m) => {
      const q = stripTags(m[1]);
      const answer = stripTags((m[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "");
      return q && answer ? { q, answer } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
  if (!questions.length) return "";
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": ${JSON.stringify(questions.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })), null, 2)}
}
</script>`;
}

const casinoTargets = [
  ["/reviews/bcgame-review.html", /\bBC\.Game\b/],
  ["/reviews/stake-review.html", /\bStake(?:\.com)?\b/],
  ["/reviews/yeet-review.html", /\bYeet\b/],
  ["/reviews/xtp-review.html", /\bXTP\b/],
  ["/blog/roobet-vs-rollbit-comparison-2026.html", /\bRoobet\b/],
  ["/blog/rollbit-vs-stake-comparison-2026.html", /\bRollbit\b/],
  ["/blog/stake-vs-shuffle-comparison-2026.html", /\bShuffle\b/],
  ["/blog/stake-vs-duelbits-comparison-2026.html", /\bDuelbits\b/],
  ["/blog/gamdom-vs-stake-comparison-2026.html", /\bGamdom\b/],
  ["/blog/rainbet-vs-roobet-comparison-2026.html", /\bRainbet\b/],
  ["/blog/bitcasino-vs-stake-comparison-2026.html", /\bBitcasino\b/],
  ["/blog/bitstarz-vs-stake-crypto-casino-2026.html", /\bBitStarz\b/],
  ["/blog/betfury-vs-stake-crypto-casino-comparison-2026.html", /\bBetFury\b/],
  ["/blog/jackbit-casino-review-2026.html", /\bJackbit\b/],
];

function linkCasinoMentions(html, post) {
  if (!post.category || post.category.slug !== "comparisons" || post.noindex) return html;
  return html.replace(/<body[^>]*>[\s\S]*?<\/body>/i, (body) => {
    let out = body;
    for (const [href, pattern] of casinoTargets) {
      if (href === `/blog/${post.file}`) continue;
      if (out.includes(`href="${href}"`)) continue;
      out = out.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/i, (m, open, text, close) => {
        if (/<a\b/i.test(text) || !pattern.test(stripTags(text))) return m;
        return open + text.replace(pattern, (match) => `<a href="${href}">${match}</a>`) + close;
      });
    }
    return out;
  });
}

function removeSelfLinks(html, post) {
  const self = `/blog/${post.file}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`<a\\s+href=["']${self}["']>([\\s\\S]*?)<\\/a>`, "gi"), "$1");
}

function normalizeHeadingLevels(html) {
  let previous = 0;
  return html.replace(/<(\/?)h([1-6])\b([^>]*)>/gi, (match, close, level, attrs) => {
    level = Number(level);
    if (!close) {
      if (previous && level > previous + 1) level = previous + 1;
      previous = level;
    }
    return `<${close || ""}h${level}${attrs}>`;
  });
}

function byline() {
  return `<section class="ccs-author-byline" aria-label="Author">
  <strong>By CryptoCasinoSorted Editorial Team</strong>
  <p>CryptoCasinoSorted reviews crypto casinos using public terms, player-friction checks, withdrawal signals and bonus-value math. Read more about our process on the <a href="/about.html">About page</a>.</p>
</section>`;
}

function relatedBlock(post, posts) {
  if (post.noindex) return "";
  const related = posts
    .filter((p) => !p.noindex && p.file !== post.file && p.category.slug === post.category.slug)
    .slice(0, 4);
  if (related.length < 3) return "";
  return `<section class="ccs-related-guides" aria-label="Related guides">
  <h2>Related guides</h2>
  <ul>
${related.map((p) => `    <li><a href="/blog/${p.file}">${escapeHtml(p.primaryKeyword)}</a></li>`).join("\n")}
  </ul>
</section>`;
}

function insertAfterHero(html, block) {
  if (html.includes("ccs-author-byline")) return html;
  const hero = html.match(/<\/header>\s*(?:<div class=["'][^"']*post-content|<article|<section|<div)/i);
  if (hero) {
    return html.slice(0, hero.index + 9) + `\n\n${block}\n` + html.slice(hero.index + 9);
  }
  const h1 = html.match(/<\/h1>/i);
  if (h1) return html.slice(0, h1.index + 5) + `\n${block}\n` + html.slice(h1.index + 5);
  return html;
}

function insertRelated(html, block) {
  html = html.replace(/<section class=["']ccs-related-guides[\s\S]*?<\/section>/i, "");
  if (!block) return html;
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${block}\n</main>`);
  return html.replace(/<\/body>/i, `${block}\n</body>`);
}

function card(post) {
  return `      <article class="blog-card">
        <div class="blog-card-content">
          <div class="blog-meta">${post.displayDate} - ${post.category.title}</div>
          <h3><a href="/blog/${post.file}">${escapeHtml(post.h1 || post.title)}</a></h3>
          <p>${escapeHtml(post.description || `${post.category.title} guide from CryptoCasinoSorted.`)}</p>
          <a href="/blog/${post.file}" class="blog-link">Read guide &rarr;</a>
        </div>
      </article>`;
}

function displayDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildTrustPages() {
  const page = (file, title, description, body) => write(file, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${site}/${file}">
  <meta property="og:title" content="${escapeHtml(title)} | CryptoCasinoSorted">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${site}/${file}">
  <meta property="og:image" content="${site}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${site}/og-image.png">
  <title>${escapeHtml(title)} | CryptoCasinoSorted</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/terminal-theme.css">
  <link rel="icon" href="/favicon.ico">
</head>
<body>
<nav class="t-nav">
  <a href="/" class="t-nav-logo">CCT <span class="sub">CryptoCasinoSorted</span></a>
  <div class="t-nav-links">
    <a href="/rewards-recommender.html" class="t-nav-primary">Rewards</a>
    <a href="/rakeback-comparison.html">Rakeback</a>
    <a href="/bonus-calculator.html">Bonus Calc</a>
    <a href="/blog/">Guides</a>
  </div>
</nav>
<main class="article-container rewards-article">
  <a href="/" class="back-link">Back to Home</a>
  <header class="article-hero">
    <div class="eyebrow">Trust</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="article-meta">Updated ${today}</div>
  </header>
  <div class="post-content">
${body}
  </div>
</main>
${trustFooter()}
</body>
</html>
`);

  page("about.html", "About CryptoCasinoSorted", "Who runs CryptoCasinoSorted, how reviews are produced, and how independence is handled.", `
    <p class="lead">CryptoCasinoSorted is an independent crypto casino research site focused on rewards value, withdrawal friction, bonus clarity and player safety.</p>
    <h2>Who runs the site</h2>
    <p>The site is operated by Brandon Katz's publishing portfolio, with editorial work produced and maintained by the CryptoCasinoSorted team. The goal is simple: help players compare crypto casinos without pretending every bonus is automatically valuable.</p>
    <h2>Methodology summary</h2>
    <p>We review public casino terms, reward mechanics, KYC language, withdrawal signals, bonus restrictions, available coins, community complaints and product clarity. When a claim cannot be verified from public information, we say so.</p>
    <h2>Independence statement</h2>
    <p>Some pages may include affiliate links. Commercial relationships do not control rankings. Our scoring model prioritises expected value, trust, clarity, friction and depth before commission potential.</p>`);

  page("how-we-rank.html", "How We Rank Crypto Casinos", "CryptoCasinoSorted ranking methodology for EV, trust, clarity, friction and depth.", `
    <p class="lead">Our rankings are built around the same five scoring buckets used on the homepage: EV, trust, clarity, friction and depth.</p>
    <h2>EV</h2>
    <p>We estimate whether rewards, rakeback, cashback, lossback, bonuses and promotions have realistic value after wagering terms, game weighting and withdrawal restrictions.</p>
    <h2>Trust</h2>
    <p>We look for visible terms, provably fair tools, public reputation, withdrawal complaints, licensing signals and consistency between marketing claims and actual rules.</p>
    <h2>Clarity</h2>
    <p>Clear reward formulas, bonus terms, KYC triggers and payment rules score higher than vague promises or hidden thresholds.</p>
    <h2>Friction</h2>
    <p>We penalise unnecessary withdrawal delays, confusing wallet flows, surprise verification, bonus lockups and unclear support paths.</p>
    <h2>Depth</h2>
    <p>Depth covers game library, sportsbook quality, VIP progression, supported coins, mobile experience and whether the casino has enough substance for repeat play.</p>`);

  page("privacy.html", "Privacy Policy", "CryptoCasinoSorted privacy policy for analytics, affiliate links and contact messages.", `
    <p class="lead">CryptoCasinoSorted is a static website. We do not ask visitors to create an account or deposit funds with us.</p>
    <h2>Analytics</h2>
    <p>We may use analytics tools to understand traffic, popular pages and site performance. Analytics data is aggregated and used to improve the site.</p>
    <h2>Affiliate links</h2>
    <p>Some outbound links may include affiliate tracking. These links can tell a partner that a visitor came from CryptoCasinoSorted, but they do not give us access to your casino account.</p>
    <h2>Contact</h2>
    <p>If you email us, we use your message and email address only to respond to the enquiry or handle the issue you raised.</p>
    <h2>Updates</h2>
    <p>This policy may be updated as the site changes. The current version was last updated on ${today}.</p>`);

  page("responsible-gambling.html", "Responsible Gambling", "Responsible gambling guidance, 18+ notice and support links for crypto casino players.", `
    <p class="lead">CryptoCasinoSorted is for adults only. You must be 18+ and legally allowed to gamble in your jurisdiction.</p>
    <h2>Get help</h2>
    <p>If gambling is causing stress, debt, secrecy or loss of control, stop playing and speak to a support organisation. Useful resources include <a href="https://www.begambleaware.org/" rel="nofollow noopener">BeGambleAware</a> and <a href="https://www.gamcare.org.uk/" rel="nofollow noopener">GamCare</a>.</p>
    <h2>Self-exclusion</h2>
    <p>Use account limits, cooling-off periods and self-exclusion tools offered by gambling operators. If you need a broader block, look into national self-exclusion systems available in your country.</p>
    <h2>Crypto-specific risk</h2>
    <p>Crypto gambling adds volatility, wallet mistakes, network-fee risk and limited chargeback options. Never gamble with borrowed money, emergency funds or funds you cannot afford to lose.</p>`);

  page("contact.html", "Contact", "Contact CryptoCasinoSorted for corrections, casino data, feedback and commercial enquiries.", `
    <p class="lead">Send corrections, data tips, casino feedback or commercial enquiries to <a href="mailto:hello@cryptocasinosorted.com">hello@cryptocasinosorted.com</a>.</p>
    <h2>Corrections</h2>
    <p>If a bonus term, withdrawal rule, supported coin or casino feature has changed, send the page URL and the source we should verify.</p>
    <h2>Commercial enquiries</h2>
    <p>Affiliate and partnership enquiries are welcome, but rankings are not sold. Casino offers still need clear terms and player-safe conditions to be included responsibly.</p>`);
}

function buildCategoryPage(cat, posts) {
  const rel = `blog/category-${cat.slug}.html`;
  const list = posts.filter((p) => !p.noindex && p.category.slug === cat.slug);
  write(rel, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(cat.description)}">
  <link rel="canonical" href="${site}/${rel}">
  <meta property="og:title" content="${escapeHtml(cat.title)} | CryptoCasinoSorted">
  <meta property="og:description" content="${escapeHtml(cat.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${site}/${rel}">
  <meta property="og:image" content="${site}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${site}/og-image.png">
  <title>${escapeHtml(cat.title)} | CryptoCasinoSorted</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="../terminal-theme.css">
  <link rel="icon" href="/favicon.ico">
</head>
<body class="guides-page">
<nav class="t-nav">
  <a href="/" class="t-nav-logo">CCT <span class="sub">CryptoCasinoSorted</span></a>
  <div class="t-nav-links">
    <a href="/rewards-recommender.html" class="t-nav-primary">Rewards</a>
    <a href="/rakeback-comparison.html">Rakeback</a>
    <a href="/bonus-calculator.html">Bonus Calc</a>
    <a href="/blog/" class="active">Guides</a>
  </div>
</nav>
<main>
  <section class="hero">
    <div class="container">
      <h1>${escapeHtml(cat.title)}</h1>
      <p>${escapeHtml(cat.description)}</p>
    </div>
  </section>
  <div class="blog-grid">
    <a class="category-link" href="/blog/">Back to all guides</a>
    <section class="category-section">
      <h2 class="category-page-title">All ${escapeHtml(cat.title)} Guides</h2>
      <div class="category-section-grid">
${list.map(card).join("\n")}
      </div>
    </section>
  </div>
</main>
${trustFooter()}
</body>
</html>
`);
}

function buildBlogIndex(posts) {
  let html = read("blog/index.html");
  html = ensureHeadMeta(html, "blog/index.html");
  html = ensureFooter(html);
  const grouped = categoryDefs.map((cat) => ({ cat, posts: posts.filter((p) => !p.noindex && p.category.slug === cat.slug) }));
  const content = grouped.map(({ cat, posts: catPosts }) => `      <section class="category-section">
        <h2>${cat.title}</h2>
        <a class="category-link" href="/blog/category-${cat.slug}.html">View all ${cat.title.toLowerCase()} guides</a>
        <div class="category-section-grid">
${catPosts.slice(0, 12).map(card).join("\n")}
        </div>
      </section>`).join("\n\n");
  html = html.replace(/<div class="blog-grid">[\s\S]*?<\/div>\s*(?=<\/main>)/i, `<div class="blog-grid">\n${content}\n    </div>\n`);
  html = ensureNavBlogSlash(html);
  html = html.replace(/Crypto Casino Blog: Guides, Strategies & Industry Insights \| CryptoCasinoSorted/i, "Crypto Casino Reward Guides | CryptoCasinoSorted");
  html = html.replace(/<link rel="canonical" href="https:\/\/cryptocasinosorted\.com\/blog\/index\.html">/i, `<link rel="canonical" href="${site}/blog/">`);
  write("blog/index.html", html);
}

function homepageSchema() {
  let html = read("index.html");
  html = removeLd(html, ["Organization"]);
  const org = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CryptoCasinoSorted",
  "url": "${site}/",
  "logo": "${site}/og-image.png"
}
</script>`;
  html = html.replace(/<\/head>/i, `${org}\n</head>`);
  write("index.html", ensureFooter(html));
}

function ensureNavBlogSlash(html) {
  return html
    .replace(/href=["']\/blog\/index\.html["']/gi, `href="/blog/"`)
    .replace(/href=["']index\.html["']/gi, `href="/blog/"`);
}

function processPosts(posts) {
  for (const post of posts) {
    let html = read(`blog/${post.file}`);
    html = removeSelfLinks(html, post);
    html = ensureNavBlogSlash(html);
    html = ensureHeadMeta(html, `blog/${post.file}`, post);
    const pageTitle = limitTitle(post.h1 || post.title);
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)} | CryptoCasinoSorted</title>`);
    html = removeLd(html, ["Article", "BreadcrumbList", "FAQPage"]);
    html = html.replace(/<\/head>/i, `${articleSchema(post)}\n${faqSchema(html)}\n</head>`);
    html = insertAfterHero(html, byline());
    html = linkCasinoMentions(html, post);
    html = insertRelated(html, relatedBlock(post, posts));
    html = normalizeHeadingLevels(html);
    html = ensureFooter(html);
    write(`blog/${post.file}`, html);
  }
}

function processAllPages(posts) {
  const postSet = new Set(posts.map((p) => path.join(root, "blog", p.file)));
  for (const file of walk(root)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (postSet.has(file)) continue;
    if (rel.startsWith("blog/category-")) continue;
    if (["blog/index.html", "index.html"].includes(rel)) continue;
    let html = fs.readFileSync(file, "utf8");
    html = ensureNavBlogSlash(html);
    html = ensureHeadMeta(html, rel);
    html = ensureFooter(html);
    fs.writeFileSync(file, html);
  }
}

function buildSitemap(posts) {
  const urls = [];
  const allPages = walk(root)
    .map((f) => path.relative(root, f).replace(/\\/g, "/"))
    .filter((rel) => !rel.includes("/backup-") && !rel.includes("old") && !rel.includes("debug"));
  const excludedPosts = new Set(posts.filter((p) => p.noindex).map((p) => `blog/${p.file}`));
  for (const rel of allPages) {
    if (excludedPosts.has(rel)) continue;
    if (rel === "blog/index.html") {
      urls.push({ loc: `${site}/blog/`, lastmod: today, priority: "0.9" });
      continue;
    }
    const loc = rel === "index.html" ? `${site}/` : `${site}/${rel}`;
    urls.push({ loc, lastmod: today, priority: rel === "index.html" ? "1.0" : rel.startsWith("blog/") ? "0.8" : "0.7" });
  }
  const seen = new Set();
  const body = urls
    .filter((u) => (seen.has(u.loc) ? false : seen.add(u.loc)))
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`)
    .join("\n");
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`);
  write("robots.txt", `User-agent: *
Allow: /

Sitemap: ${site}/sitemap.xml
`);
}

function inventoryPosts() {
  return fs.readdirSync(path.join(root, "blog"))
    .filter((file) => file.endsWith(".html") && file !== "index.html" && !file.startsWith("category-"))
    .sort()
    .map((file) => {
      const html = read(`blog/${file}`);
      const title = getTitle(html);
      const h1 = getH1(html) || title;
      const description = meta(html, "description");
      const date = getDate(html);
      const noindex = file.startsWith("weekly-crypto-gaming-recap-") || Boolean(canonicalMap[file]);
      const post = {
        file,
        title,
        h1,
        description,
        date,
        displayDate: displayDate(date),
        noindex,
        canonicalTarget: canonicalMap[file] || null,
        text: `${file} ${title} ${h1} ${description}`,
        primaryKeyword: h1.replace(/\s*\|\s*CryptoCasinoSorted$/i, ""),
      };
      post.category = categoryFor(post);
      return post;
    });
}

function report(posts) {
  const groups = {};
  for (const post of posts) {
    const key = post.noindex ? (post.file.startsWith("weekly-") ? "weekly recaps noindexed" : `canonical to ${post.canonicalTarget}`) : post.category.title;
    groups[key] ||= [];
    groups[key].push(post.file);
  }
  write("seo-fix-report-2026-07-03.json", JSON.stringify({
    generatedAt: today,
    canonicalFallbacks: canonicalMap,
    noindexedWeeklyRecaps: posts.filter((p) => p.file.startsWith("weekly-")).map((p) => p.file),
    categoryCounts: Object.fromEntries(categoryDefs.map((cat) => [cat.title, posts.filter((p) => !p.noindex && p.category.slug === cat.slug).length])),
    groups,
    searchConsoleNote: "Submit https://cryptocasinosorted.com/sitemap.xml in Google Search Console after deployment.",
  }, null, 2));
}

sharedStyles();
buildTrustPages();
let posts = inventoryPosts();
processPosts(posts);
posts = inventoryPosts();
buildBlogIndex(posts);
for (const cat of categoryDefs) buildCategoryPage(cat, posts);
homepageSchema();
processAllPages(posts);
buildSitemap(posts);
report(posts);

console.log(`Processed ${posts.length} blog posts.`);
console.log(`Canonical fallback pages: ${Object.keys(canonicalMap).length}`);
console.log(`Weekly recaps noindexed: ${posts.filter((p) => p.file.startsWith("weekly-")).length}`);
