#!/usr/bin/env python3
"""Repair sitemap/index signals for Google Search Console coverage.

The script keeps the sitemap limited to canonical indexable HTML pages and adds
an internal guide index for blog URLs that otherwise only have sitemap discovery.
"""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://cryptocasinosorted.com"
SITEMAP = ROOT / "sitemap.xml"
BLOG_INDEX = ROOT / "blog" / "index.html"

UTILITY_URL_NAMES = {
    "analytics.html",
    "analytics-mobile-optimized.html",
    "dashboard-live.html",
    "dashboard-poster.html",
    "dashboard-simple.html",
    "index-poster-style.html",
    "llms.txt",
    "nav-standard.html",
    "shared-nav.html",
    "streamers-poster.html",
    "test-csv.html",
}

INDEX_BLOCK_START = "<!-- SEO_COVERAGE_INDEX_START -->"
INDEX_BLOCK_END = "<!-- SEO_COVERAGE_INDEX_END -->"


def file_for_url(url: str) -> Path:
    path = urlparse(url).path
    if path == "/":
        return ROOT / "index.html"
    if path.endswith("/"):
        return ROOT / path.strip("/") / "index.html"
    return ROOT / path.strip("/")


def find_attr(markup: str, pattern: str) -> str | None:
    match = re.search(pattern, markup, flags=re.I | re.S)
    return html.unescape(match.group(1).strip()) if match else None


def canonical_url(markup: str) -> str | None:
    return find_attr(
        markup,
        r"<link\s+rel=[\"']canonical[\"'][^>]*href=[\"']([^\"']+)",
    ) or find_attr(
        markup,
        r"<link\s+href=[\"']([^\"']+)[\"'][^>]*rel=[\"']canonical[\"']",
    )


def robots_value(markup: str) -> str:
    return find_attr(
        markup,
        r"<meta\s+name=[\"']robots[\"'][^>]*content=[\"']([^\"']+)",
    ) or ""


def title(markup: str) -> str:
    raw = find_attr(markup, r"<h1[^>]*>(.*?)</h1>")
    raw = raw or find_attr(markup, r"<title[^>]*>(.*?)</title>")
    raw = raw or "Crypto casino guide"
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = re.sub(r"\s*\|\s*CryptoCasinoSorted\s*$", "", raw)
    raw = re.sub(r"\s+", " ", raw)
    return raw.strip()


def is_indexable(url: str) -> bool:
    parsed = urlparse(url)
    name = parsed.path.rstrip("/").split("/")[-1]
    if name in UTILITY_URL_NAMES:
        return False

    page = file_for_url(url)
    if page.suffix != ".html" or not page.exists():
        return False

    markup = page.read_text(encoding="utf-8", errors="ignore")
    if "noindex" in robots_value(markup).lower():
        return False

    canonical = canonical_url(markup)
    return bool(canonical and canonical.rstrip("/") == url.rstrip("/"))


def current_sitemap_entries() -> list[dict[str, str]]:
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tree = ET.parse(SITEMAP)
    entries: list[dict[str, str]] = []
    for url_node in tree.findall(".//s:url", ns):
        entry: dict[str, str] = {}
        for child in url_node:
            tag = child.tag.rsplit("}", 1)[-1]
            entry[tag] = child.text or ""
        if entry.get("loc"):
            entries.append(entry)
    return entries


def write_sitemap(entries: list[dict[str, str]]) -> None:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for entry in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{html.escape(entry['loc'])}</loc>")
        if entry.get("lastmod"):
            lines.append(f"    <lastmod>{html.escape(entry['lastmod'])}</lastmod>")
        if entry.get("changefreq"):
            lines.append(f"    <changefreq>{html.escape(entry['changefreq'])}</changefreq>")
        if entry.get("priority"):
            lines.append(f"    <priority>{html.escape(entry['priority'])}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    SITEMAP.write_text("\n".join(lines) + "\n", encoding="utf-8")


def blog_urls(entries: list[dict[str, str]]) -> list[str]:
    urls = []
    for entry in entries:
        path = urlparse(entry["loc"]).path
        if path.startswith("/blog/") and path not in {"/blog/", "/blog/index.html"}:
            urls.append(entry["loc"])
    return urls


def build_guide_index(urls: list[str]) -> str:
    items = []
    for url in urls:
        path = urlparse(url).path
        page_title = title(file_for_url(url).read_text(encoding="utf-8", errors="ignore"))
        items.append(f'          <li><a href="{path}">{html.escape(page_title)}</a></li>')

    return "\n".join(
        [
            INDEX_BLOCK_START,
            '      <section class="category-section guide-index">',
            "        <h2>Complete Guide Index</h2>",
            "        <p>All canonical crypto casino guides currently submitted for indexing.</p>",
            '        <ul class="guide-index-list">',
            *items,
            "        </ul>",
            "      </section>",
            INDEX_BLOCK_END,
        ]
    )


def update_blog_index(urls: list[str]) -> None:
    markup = BLOG_INDEX.read_text(encoding="utf-8", errors="ignore")
    block = build_guide_index(urls)
    pattern = re.compile(
        rf"\n?{re.escape(INDEX_BLOCK_START)}.*?{re.escape(INDEX_BLOCK_END)}",
        flags=re.S,
    )
    if pattern.search(markup):
        markup = pattern.sub("\n" + block, markup)
    else:
        markup = markup.replace("    </div>\n</main>", f"    </div>\n{block}\n</main>")
    BLOG_INDEX.write_text(markup, encoding="utf-8")


def main() -> None:
    entries = current_sitemap_entries()
    kept = [entry for entry in entries if is_indexable(entry["loc"])]
    write_sitemap(kept)
    update_blog_index(blog_urls(kept))
    print(f"Kept {len(kept)} canonical indexable URLs; removed {len(entries) - len(kept)} sitemap URLs.")
    print(f"Linked {len(blog_urls(kept))} canonical blog guides from the blog index.")


if __name__ == "__main__":
    main()
