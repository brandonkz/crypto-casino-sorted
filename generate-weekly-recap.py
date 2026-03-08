#!/usr/bin/env python3
"""Generate a weekly crypto gaming recap blog post from terminal data."""

import json
from datetime import datetime, timezone
from pathlib import Path

SITE = Path(__file__).resolve().parent
BLOG_DIR = SITE / "blog"
DATA_FILE = SITE / "data" / "terminal-data.json"


def fmt(n):
    if n >= 1e9:
        return f"${n/1e9:.1f}B"
    if n >= 1e6:
        return f"${n/1e6:.1f}M"
    if n >= 1e3:
        return f"${n/1e3:.1f}K"
    return f"${n:.0f}"


def main():
    if not DATA_FILE.exists():
        print("No terminal-data.json")
        return

    data = json.load(open(DATA_FILE))
    dates = data.get("dates", [])
    casinos = data.get("casinos", [])
    totals = data.get("totals", {})
    health = data.get("health", {})
    whales = data.get("whales", {})

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = f"weekly-crypto-gaming-recap-{today}.html"
    out_path = BLOG_DIR / slug

    # Top casinos by volume
    top = casinos[:5]

    # Whale stats
    whale_stats = whales.get("stats", {})

    # Build content
    title = f"Weekly Crypto Gaming Recap — {today}"

    html = f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>{title} | CryptoCasinoSorted</title>
  <meta name=\"description\" content=\"Weekly recap of crypto casino volume, whale activity, and market shifts.\">
  <link rel=\"canonical\" href=\"https://cryptocasinosorted.com/blog/{slug}\">
  <link rel=\"stylesheet\" href=\"../terminal-theme.css\">
  <link rel=\"stylesheet\" href=\"../style.css\">
</head>
<body>
  <nav class=\"t-nav\">
    <a href=\"/\" class=\"t-nav-logo\">🎰 CCT <span class=\"sub\">CryptoCasinoSorted</span></a>
    <div class=\"t-nav-links\">
      <a href=\"/terminal.html\">Terminal</a>
      <a href=\"/analytics.html\">Live Data</a>
      <a href=\"/calculators.html\">Tools</a>
      <a href=\"/blog/index.html\">Blog</a>
      <a href=\"/reviews/index.html\" class=\"t-nav-hide-mobile\">Reviews</a>
    </div>
  </nav>

  <article class=\"t-article\">
    <header class=\"t-article-header\">
      <div class=\"breadcrumb\"><a href=\"/blog/index.html\">Blog</a> / Weekly Recap</div>
      <h1>{title}</h1>
      <p class=\"subtitle\">Data-driven summary of crypto casino activity, whale deposits, and market shifts.</p>
      <div class=\"post-meta\">
        <span>Updated {today}</span>
        <span>Source: On-chain deposits</span>
      </div>
    </header>

    <div class=\"post-content\">
      <h2>Top Casinos by Volume</h2>
      <p>This week’s leaders based on on-chain deposit volume:</p>
      <ul>
        {''.join([f"<li><strong>{c}</strong> — {fmt(totals[c]['volume_usd'])} volume, {totals[c]['count']:,} deposits</li>" for c in top])}
      </ul>

      <h2>Whale Activity</h2>
      <p>Whales (≥$5K) continue to dominate volume.</p>
      <ul>
        <li>Total whale deposits: <strong>{whale_stats.get('total_count', 0):,}</strong></li>
        <li>Total whale volume: <strong>{fmt(whale_stats.get('total_volume', 0))}</strong></li>
        <li>Biggest single deposit: <strong>{fmt(whale_stats.get('biggest_single', 0))}</strong></li>
        <li>Whale share of total volume: <strong>{whale_stats.get('pct_of_total_volume', 0)}%</strong></li>
      </ul>

      <h2>Casino Health Scores</h2>
      <p>Composite scores (0-100) based on volume trend, deposit trend, consistency, and activity:</p>
      <ul>
        {''.join([f"<li><strong>{c}</strong> — {health.get(c,{}).get('score','?')}/100 ({health.get(c,{}).get('status','?')})</li>" for c in top])}
      </ul>

      <div class=\"highlight-box\">
        <h3>Key Takeaway</h3>
        <p>Whales account for <strong>{whale_stats.get('pct_of_total_volume', 0)}%</strong> of total volume. Casinos that attract whales are dominating the leaderboard.</p>
      </div>

      <p>Want the live feed? Visit the <a href=\"/terminal.html\">Crypto Casino Terminal</a>.</p>
    </div>
  </article>

  <footer class=\"t-footer\">
    <div class=\"t-container\">
      <p>CCT — Crypto Casino Terminal · <a href=\"/\">CryptoCasinoSorted</a></p>
      <p><a href=\"/terminal.html\">Terminal</a> · <a href=\"/calculators.html\">Tools</a> · <a href=\"/blog/index.html\">Blog</a></p>
    </div>
  </footer>
</body>
</html>"""

    out_path.write_text(html)
    print(f"✅ Weekly recap generated: {out_path}")

    # Insert into blog index at top
    index_path = BLOG_DIR / "index.html"
    if index_path.exists():
        index = index_path.read_text()
        card = f"""
      <article class=\"blog-card\">
        <div class=\"blog-card-content\">
          <div class=\"blog-meta\">Weekly Recap • {today}</div>
          <h3><a href=\"/blog/{slug}\">{title}</a></h3>
          <p>Data-driven summary of crypto casino activity, whale deposits, and market shifts.</p>
          <a href=\"/blog/{slug}\" class=\"read-more\">Read Recap →</a>
        </div>
      </article>
"""
        index = index.replace("<div class=\"blog-grid\">", "<div class=\"blog-grid\">" + card)
        index_path.write_text(index)
        print("✅ Blog index updated")


if __name__ == "__main__":
    main()
