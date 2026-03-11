#!/usr/bin/env python3
"""Auto-update gaming news (RSS) and refresh promo timestamps.
Writes data/news.json and data/promos.json.
"""

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime


def relative_time(pub_str):
    """Convert RSS pubDate to a relative time label."""
    try:
        pub_dt = parsedate_to_datetime(pub_str)
        now = datetime.now(timezone.utc)
        diff = now - pub_dt
        hours = diff.total_seconds() / 3600
        if hours < 1:
            return "Just now"
        elif hours < 24:
            h = int(hours)
            return f"{h}h ago"
        elif hours < 48:
            return "Yesterday"
        else:
            days = int(hours / 24)
            return f"{days}d ago"
    except Exception:
        return "Recent"

NEWS_FEEDS = [
    ("Casino.org", "https://www.casino.org/news/feed/"),
    ("Gambling Insider", "https://www.gamblinginsider.com/rss"),
    ("SBC News", "https://sbcnews.co.uk/feed/"),
    ("CDC Gaming", "https://cdcgaming.com/feed/"),
    ("Decrypt", "https://decrypt.co/feed"),
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("The Block", "https://www.theblock.co/rss.xml"),
]

# Require casino/gambling OR crypto+gaming relevance
KEYWORDS = re.compile(r"casino|gambl|sportsbook|betting|igaming|crypto|blockchain|web3|gaming", re.I)

MAX_ITEMS = 8
TIMEOUT = 10


def fetch_rss(source, url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (CryptoCasinoSorted RSS)"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)
        items = []
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            if not title or not link:
                continue
            if not KEYWORDS.search(title):
                continue
            items.append({
                "source": source,
                "title": title,
                "url": link,
                "tag": "NEWS",
                "time": relative_time(pub) if pub else "Recent",
                "published": pub,
            })
        return items
    except Exception:
        return []


def update_news():
    all_items = []
    for source, url in NEWS_FEEDS:
        all_items.extend(fetch_rss(source, url))

    # Deduplicate by title
    seen = set()
    deduped = []
    for item in all_items:
        key = item["title"].lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped[:MAX_ITEMS]


def update_promos():
    # Load casino affiliate links
    ref_map = {}
    try:
        with open("data/casinos.json", "r") as f:
            casinos = json.load(f)
        for c in casinos:
            if c.get("name") and c.get("ref_url"):
                ref_map[c["name"].lower()] = c["ref_url"]
    except Exception:
        pass

    # Keep existing promos, update timestamp + affiliate URLs
    try:
        with open("data/promos.json", "r") as f:
            promos = json.load(f)
    except Exception:
        promos = {"promos": []}

    for p in promos.get("promos", []):
        name = p.get("casino", "").lower()
        if name in ref_map:
            p["url"] = ref_map[name]

    promos["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return promos


def main():
    news_items = update_news()
    promos = update_promos()

    # If no news matched, keep previous news.json
    if not news_items:
        try:
            with open("data/news.json", "r") as f:
                news = json.load(f)
            news["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            if not news.get("items") or len(news.get("items", [])) < 5:
                raise ValueError("insufficient news")
            print("⚠️ No RSS matches — keeping previous news.json")
        except Exception:
            # Fallback seed headlines so the panel is never empty
            news = {
                "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "items": [
                    {
                        "source": "CryptoCasinoSorted",
                        "title": "Weekly iGaming recap is live — biggest deposit spikes + VIP shifts",
                        "url": "/blog/index.html",
                        "tag": "RECAP",
                        "time": "This week"
                    },
                    {
                        "source": "CryptoCasinoSorted",
                        "title": "Whale activity now updated daily on the Terminal",
                        "url": "/terminal.html",
                        "tag": "DATA",
                        "time": "Today"
                    },
                    {
                        "source": "CryptoCasinoSorted",
                        "title": "Casino health scores now rank platform momentum (0–100)",
                        "url": "/terminal.html#health",
                        "tag": "HEALTH",
                        "time": "Today"
                    },
                    {
                        "source": "CryptoCasinoSorted",
                        "title": "Promo Radar refreshed daily — find the best bonus offers",
                        "url": "/#promos",
                        "tag": "PROMOS",
                        "time": "This week"
                    },
                    {
                        "source": "CryptoCasinoSorted",
                        "title": "Top casinos by volume updated with on-chain data",
                        "url": "/terminal.html#dashboard",
                        "tag": "VOLUME",
                        "time": "This week"
                    }
                ]
            }
    else:
        news = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "items": news_items
        }

    with open("data/news.json", "w") as f:
        json.dump(news, f, indent=2)

    with open("data/promos.json", "w") as f:
        json.dump(promos, f, indent=2)

    print(f"✅ News updated: {len(news.get('items', []))} items")
    print(f"✅ Promos refreshed: {len(promos.get('promos', []))} items")


if __name__ == "__main__":
    main()
