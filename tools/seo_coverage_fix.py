#!/usr/bin/env python3
"""Repair sitemap/index signals and JSON-LD dateModified values.

The script keeps the sitemap limited to canonical indexable HTML pages and adds
an internal guide index for blog URLs that otherwise only have sitemap discovery.
Sitemap locs that still say index.html are rewritten to the page's canonical
directory URL when that canonical is the same file.

It also sets schema.org dateModified on each page's JSON-LD from that file's
last git commit date (`git log -1 --format=%cs`). datePublished is left as-is.
Re-run with `python3 tools/seo_coverage_fix.py --dates-only`.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
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
    "terminal.html",
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
    if not canonical:
        return False
    # Directory hubs are canonical at /path/ while the sitemap may still list
    # /path/index.html. Keep the page when both URLs are the same file.
    # A redirect stub canonicalizes to a different file and is dropped.
    return file_for_url(canonical).resolve() == page.resolve()


def canonical_loc_for(url: str) -> str:
    canonical = canonical_url(file_for_url(url).read_text(encoding="utf-8", errors="ignore"))
    return canonical or url


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


SKIP_DATE_TYPES = {"BreadcrumbList"}
LD_JSON_RE = re.compile(
    r"(<script\b[^>]*type=[\"']application/ld\+json[\"'][^>]*>)([\s\S]*?)(</script>)",
    re.I,
)
DATE_MODIFIED_RE = re.compile(r'("dateModified"\s*:\s*")([^"]*)(")')
DATE_PUBLISHED_RE = re.compile(
    r'^([ \t]*)"datePublished"\s*:\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"',
    re.M,
)
TYPE_LINE_RE = re.compile(r'^([ \t]*)"@type"\s*:\s*"[^"]+"', re.M)


def git_commit_date(path: Path) -> str | None:
    rel = path.relative_to(ROOT).as_posix()
    result = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", rel],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    date = result.stdout.strip()
    if result.returncode != 0 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return None
    return date


def jsonld_needs_date(data: object) -> bool:
    if not isinstance(data, dict):
        return False
    types = data.get("@type")
    if isinstance(types, str):
        types = [types]
    elif not isinstance(types, list):
        return False
    return any(isinstance(item, str) and item not in SKIP_DATE_TYPES for item in types)


def apply_date_modified(block: str, date: str) -> str:
    """Set dateModified on one JSON-LD object. Leaves datePublished unchanged."""
    payload = block.strip()
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return block
    if not jsonld_needs_date(data):
        return block

    existing = DATE_MODIFIED_RE.search(block)
    if existing:
        if existing.group(2) == date:
            return block
        return DATE_MODIFIED_RE.sub(rf"\g<1>{date}\3", block, count=1)

    published = DATE_PUBLISHED_RE.search(block)
    if published:
        indent = published.group(1)
        return (
            block[: published.end()]
            + f',\n{indent}"dateModified": "{date}"'
            + block[published.end() :]
        )

    type_line = TYPE_LINE_RE.search(block)
    if not type_line:
        return block
    indent = type_line.group(1)
    line_end = block.find("\n", type_line.end())
    if line_end == -1:
        return block[: type_line.end()] + f', "dateModified": "{date}"' + block[type_line.end() :]
    line = block[type_line.start() : line_end]
    if line.rstrip().endswith(","):
        insertion = f'\n{indent}"dateModified": "{date}",'
        return block[:line_end] + insertion + block[line_end:]
    return (
        block[: type_line.end()]
        + f',\n{indent}"dateModified": "{date}"'
        + block[type_line.end() :]
    )


def update_date_modified() -> None:
    updated_files = 0
    updated_blocks = 0
    skipped = 0
    for path in sorted(ROOT.rglob("*.html")):
        if any(part in {".git", "node_modules"} or part.startswith("backup-") for part in path.parts):
            continue
        markup = path.read_text(encoding="utf-8", errors="ignore")
        if "application/ld+json" not in markup:
            continue
        date = git_commit_date(path)
        if not date:
            skipped += 1
            print(f"No git date for {path.relative_to(ROOT)}")
            continue

        changed = False

        def replacer(match: re.Match[str]) -> str:
            nonlocal changed, updated_blocks
            opening, body, closing = match.group(1), match.group(2), match.group(3)
            new_body = apply_date_modified(body, date)
            if new_body == body:
                return match.group(0)
            try:
                json.loads(new_body)
            except json.JSONDecodeError as exc:
                print(f"Skipped invalid JSON-LD edit in {path.relative_to(ROOT)}: {exc}")
                return match.group(0)
            changed = True
            updated_blocks += 1
            return opening + new_body + closing

        new_markup = LD_JSON_RE.sub(replacer, markup)
        if changed and new_markup != markup:
            path.write_text(new_markup, encoding="utf-8")
            updated_files += 1

    print(
        f"Set dateModified in {updated_blocks} JSON-LD blocks across {updated_files} files; "
        f"skipped {skipped} files with no git date."
    )


def refresh_sitemap() -> None:
    entries = current_sitemap_entries()
    kept: list[dict[str, str]] = []
    seen: set[str] = set()
    rewritten = 0
    for entry in entries:
        if not is_indexable(entry["loc"]):
            continue
        loc = canonical_loc_for(entry["loc"])
        if loc != entry["loc"]:
            rewritten += 1
        if loc in seen:
            continue
        seen.add(loc)
        updated = dict(entry)
        updated["loc"] = loc
        kept.append(updated)
    write_sitemap(kept)
    update_blog_index(blog_urls(kept))
    print(
        f"Kept {len(kept)} canonical indexable URLs; "
        f"removed {len(entries) - len(kept)} sitemap URLs; "
        f"rewrote {rewritten} locs to their canonical URL."
    )
    print(f"Linked {len(blog_urls(kept))} canonical blog guides from the blog index.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dates-only",
        action="store_true",
        help="Only set JSON-LD dateModified from each file's last git commit date.",
    )
    parser.add_argument(
        "--sitemap-only",
        action="store_true",
        help="Only rebuild sitemap.xml and the blog guide index.",
    )
    args = parser.parse_args()
    if args.dates_only and args.sitemap_only:
        raise SystemExit("Use only one of --dates-only or --sitemap-only.")
    if not args.dates_only:
        refresh_sitemap()
    if not args.sitemap_only:
        update_date_modified()


if __name__ == "__main__":
    main()
