#!/usr/bin/env python3
"""Update Reddit buzz + Streamer watch (RSS where possible, fallback to existing)."""

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

REDDIT_FEEDS = [
    ("r/gambling", "https://www.reddit.com/r/gambling/.rss"),
    ("r/cryptocurrency", "https://www.reddit.com/r/cryptocurrency/.rss"),
    ("r/sportsbook", "https://www.reddit.com/r/sportsbook/.rss"),
]

KEYWORDS = re.compile(r"casino|gambl|sportsbook|betting|crypto|igaming|odds", re.I)

MAX_ITEMS = 6
TIMEOUT = 10


def fetch_reddit(sub, url):
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)
        items = []
        for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry"):
            title = (entry.findtext("{http://www.w3.org/2005/Atom}title") or "").strip()
            link_el = entry.find("{http://www.w3.org/2005/Atom}link")
            link = link_el.get('href') if link_el is not None else ""
            if not title or not link:
                continue
            if not KEYWORDS.search(title):
                continue
            tag = "DISCUSSION"
            if re.search(r"withdraw|payout|cashout", title, re.I): tag = "WITHDRAWALS"
            if re.search(r"odds|sportsbook|bet", title, re.I): tag = "SPORTS"
            if re.search(r"bonus|promo|rakeback", title, re.I): tag = "PROMO"
            items.append({
                "subreddit": sub,
                "title": title,
                "url": link,
                "score": 0,
                "tag": tag,
                "time": "Today"
            })
        return items
    except Exception:
        return []


def update_reddit():
    all_items = []
    for sub, url in REDDIT_FEEDS:
        all_items.extend(fetch_reddit(sub, url))

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


def update_streamers():
    # Keep existing streamers list, just update timestamp
    try:
        with open("data/streamers.json", "r") as f:
            streamers = json.load(f)
    except Exception:
        streamers = {"items": []}
    streamers["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return streamers


def main():
    reddit_items = update_reddit()

    if not reddit_items:
        try:
            with open("data/reddit.json", "r") as f:
                reddit = json.load(f)
            reddit["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            if not reddit.get("items"):
                raise ValueError("empty reddit")
            print("⚠️ No RSS matches — keeping previous reddit.json")
        except Exception:
            reddit = {
                "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "items": [
                    {"subreddit":"r/gambling","title":"Top crypto casinos this week?","url":"https://www.reddit.com/r/gambling/","score":0,"tag":"DISCUSSION","time":"This week"},
                    {"subreddit":"r/cryptocurrency","title":"Casino withdrawals: fastest to slowest?","url":"https://www.reddit.com/r/cryptocurrency/","score":0,"tag":"WITHDRAWALS","time":"This week"},
                    {"subreddit":"r/sportsbook","title":"Crypto sportsbooks vs fiat books — odds edge?","url":"https://www.reddit.com/r/sportsbook/","score":0,"tag":"SPORTS","time":"This week"}
                ]
            }
    else:
        reddit = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "items": reddit_items}

    streamers = update_streamers()

    with open("data/reddit.json", "w") as f:
        json.dump(reddit, f, indent=2)

    with open("data/streamers.json", "w") as f:
        json.dump(streamers, f, indent=2)

    print(f"✅ Reddit updated: {len(reddit.get('items', []))} items")
    print(f"✅ Streamers refreshed: {len(streamers.get('items', []))} items")


if __name__ == "__main__":
    main()
