#!/usr/bin/env python3
"""
update-giveaways.py — Fetch crypto casino giveaways from X via nitter RSS.

Sources:
  - Official casino accounts (hardcoded in CASINO_HANDLES)
  - Streamer accounts from data/streamers.json

Usage:
  python3 update-giveaways.py            # full run
  python3 update-giveaways.py --dry-run  # print matches, don't write
  python3 update-giveaways.py --quick    # casino accounts only (faster)

Cron (every 30 min):
  */30 * * * * cd /path/to/repo && python3 update-giveaways.py >> logs/giveaways.log 2>&1
"""

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────

NITTER_INSTANCE = "https://nitter.net"
REQUEST_DELAY_S = 1.2        # Polite delay between requests
TIMEOUT_S = 10
MAX_AGE_HOURS = 48           # Mark giveaways older than this as "ended"
DATA_DIR = Path(__file__).parent / "data"
OUT_FILE = DATA_DIR / "giveaways.json"
STREAMERS_FILE = DATA_DIR / "streamers.json"

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CryptoCasinoSorted-Bot/1.0)"}

# Official casino X handles → display name
CASINO_HANDLES = {
    "Stakecasino":      "Stake",
    "gamdom":           "Gamdom",
    "Shuffle":          "Shuffle",
    "RollbitOfficial":  "Rollbit",
    "BCGameCasino":     "BC.Game",
    "Duelbits":         "Duelbits",
    "ThunderpickCSGO":  "Thunderpick",
    "MetaWin":          "MetaWin",
    "1winPro":          "1win",
    "gambasports":      "Gamba",
    "YeetGaming":       "Yeet",
    "Roobet":           "Roobet",
    "CSGORoll":         "CSGORoll",
    "gamdomsport":      "Gamdom",
}

# Keywords that flag a tweet as a giveaway
GIVEAWAY_KEYWORDS = [
    "giveaway", "give away", "giving away",
    "win $", "win a ", "prize",
    "repost to win", "rt to win", "repost & win", "repost and win",
    "drop your", "drop ur", "drop your stake", "drop your username",
    "comment your", "comment below",
    "winner", "winners",
    "free $", "free spins", "free spin",
    "🎁", "🏆",
]

# Keywords that mean the giveaway is over
ENDED_KEYWORDS = [
    "winner announced", "winner has been", "winners have been",
    "giveaway ended", "giveaway over", "giveaway closed",
    "giveaway is closed", "closed",
]

# Entry step patterns (regex)
STEP_PATTERNS = [
    r"follow\s+@?\w+",
    r"re(?:post|tweet|rt)\b",
    r"like\s+(?:this|the)?\s*(?:post|tweet)?",
    r"tag\s+\d+\s+friends?",
    r"comment\s+(?:your|with|below)\b",
    r"drop\s+(?:your|ur)\s+\w+\s+(?:username|id|name|user)",
    r"join\s+(?:discord|kick|twitch|telegram)",
    r"subscribe",
    r"watch\s+(?:the|my|tonight)",
    r"type\s+\w+\s+in\s+(?:chat|stream)",
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def is_giveaway(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in GIVEAWAY_KEYWORDS)

def detect_status(text: str, pub_dt: datetime) -> str:
    t = text.lower()
    if any(kw in t for kw in ENDED_KEYWORDS):
        return "ended"
    age_hours = (datetime.now(timezone.utc) - pub_dt).total_seconds() / 3600
    if age_hours > MAX_AGE_HOURS:
        return "ended"
    if any(kw in t for kw in ["live now", "rn on stream", "in stream now", "live on kick", "live on twitch"]):
        return "live"
    return "open"

def parse_prize(text: str) -> tuple:
    """Returns (prize_str, winner_count | None)."""
    amounts = re.findall(r'\$[\d,]+(?:\.\d+)?[kK]?', text)
    winners_m = re.search(r'(\d+)\s*x?\s*winners?', text, re.I) or \
                re.search(r'(\d+)\s+(?:people|lucky)', text, re.I)
    winners = int(winners_m.group(1)) if winners_m else None

    if amounts:
        prize = amounts[0]
        # If multiple amounts and a multiplier pattern like "5 × $100"
        multi_m = re.search(r'(\d+)\s*[x×]\s*\$[\d,]+', text, re.I)
        if multi_m:
            prize = f"{amounts[0]} ({multi_m.group(1)} winners)"
            winners = winners or int(multi_m.group(1))
        elif winners and winners > 1 and len(amounts) == 1:
            prize = f"{prize} ({winners} winners)"
        return prize, winners

    spins_m = re.search(r'(\d+)\s+free\s+spins?', text, re.I)
    if spins_m:
        return f"{spins_m.group(1)} free spins", winners
    if "free spins" in text.lower():
        return "Free spins", winners
    if "bonus" in text.lower():
        return "Bonus (see post)", winners

    return "Prize (see post)", winners

def extract_steps(text: str) -> list:
    """Pull entry instructions out of the tweet text."""
    steps = []
    seen = set()
    # Split on newlines, bullets, numbers
    lines = re.split(r'[\n\r•\-–]|\b\d\.\s', text)
    for line in lines:
        line = re.sub(r'<[^>]+>', '', line).strip()
        if not (3 < len(line) < 100):
            continue
        for pat in STEP_PATTERNS:
            if re.search(pat, line, re.I):
                clean = line.strip("- •→").strip()
                if clean.lower() not in seen:
                    steps.append(clean)
                    seen.add(clean.lower())
                break
    return steps[:5] if steps else ["See X post for entry details"]

def classify_type(text: str) -> str:
    t = text.lower()
    if any(kw in t for kw in ["live", "stream", "kick", "twitch", "in chat"]):
        return "stream"
    if "discord" in t:
        return "discord"
    if "follow" in t and "repost" not in t and "rt" not in t:
        return "follow"
    return "repost"

def relative_time(pub_dt: datetime) -> str:
    diff = datetime.now(timezone.utc) - pub_dt
    h = diff.total_seconds() / 3600
    if h < 1:
        return "Just now"
    if h < 24:
        return f"{int(h)}h ago"
    if h < 48:
        return "Yesterday"
    return f"{int(h / 24)}d ago"

def strip_html(raw: str) -> str:
    return re.sub(r'<[^>]+>', ' ', raw).strip()

# ── RSS fetching ───────────────────────────────────────────────────────────────

def fetch_rss(handle: str) -> list:
    url = f"{NITTER_INSTANCE}/{handle}/rss"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            xml_data = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return []

    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return []

    items = []
    for item in root.findall(".//item"):
        title = item.findtext("title") or ""
        desc_raw = item.findtext("description") or ""
        full_text = f"{title}\n{strip_html(desc_raw)}"
        link = (item.findtext("link") or "").replace("nitter.net", "x.com").replace("#m", "")
        pub_str = item.findtext("pubDate") or ""
        tweet_id = item.findtext("guid") or hashlib.md5(link.encode()).hexdigest()[:16]

        try:
            pub_dt = parsedate_to_datetime(pub_str)
        except Exception:
            pub_dt = datetime.now(timezone.utc)

        items.append({"text": full_text, "link": link, "tweet_id": str(tweet_id), "pub_dt": pub_dt})

    return items

def process_account(handle: str, casino_name: str, host_type: str) -> list:
    results = []
    for item in fetch_rss(handle):
        text = item["text"]
        if not is_giveaway(text):
            continue
        pub_dt = item["pub_dt"]
        prize, winners = parse_prize(text)
        status = detect_status(text, pub_dt)
        results.append({
            "id":          f"{handle}_{item['tweet_id']}",
            "casino":      casino_name,
            "prize":       prize,
            "winners":     winners,
            "host":        handle,
            "handle":      f"@{handle}",
            "host_type":   host_type,
            "steps":       extract_steps(text),
            "status":      status,
            "posted_ago":  relative_time(pub_dt),
            "posted_ts":   pub_dt.isoformat(),
            "on_stream":   status == "live",
            "x_url":       item["link"],
            "entry_type":  classify_type(text),
            "manual":      False,
        })
    return results

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Update giveaways data from nitter RSS")
    parser.add_argument("--dry-run", action="store_true", help="Print matches, don't write file")
    parser.add_argument("--quick", action="store_true", help="Casino accounts only (skip streamers)")
    args = parser.parse_args()

    print(f"🎁  update-giveaways.py — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    # Load existing to preserve manually-added records
    existing = {}
    if OUT_FILE.exists():
        try:
            old = json.loads(OUT_FILE.read_text())
            for g in old.get("giveaways", []):
                existing[g["id"]] = g
        except Exception:
            pass

    # Build accounts map: handle → casino name
    accounts = dict(CASINO_HANDLES)
    if not args.quick:
        try:
            sd = json.loads(STREAMERS_FILE.read_text())
            for s in sd.get("streamers", []):
                x_url = s.get("socials", {}).get("x", {}).get("url", "")
                if not x_url or x_url in ("https://x.com/", "https://twitter.com/"):
                    continue
                handle = x_url.rstrip("/").split("/")[-1]
                if not handle or handle in accounts:
                    continue
                deals = s.get("currentDeals") or []
                casino = deals[0].get("casino", "Various") if deals else "Various"
                accounts[handle] = casino
            print(f"  Loaded {len(accounts)} accounts ({len(CASINO_HANDLES)} casinos + {len(accounts)-len(CASINO_HANDLES)} streamers)")
        except Exception as e:
            print(f"  Warning: could not load streamers.json — {e}")
    else:
        print(f"  Quick mode: {len(accounts)} casino accounts only")

    # Fetch
    fresh = {}
    total_found = 0
    for i, (handle, casino) in enumerate(accounts.items(), 1):
        host_type = "Casino" if handle in CASINO_HANDLES else "Streamer"
        results = process_account(handle, casino, host_type)
        if results:
            print(f"  ✓ @{handle} → {len(results)} giveaway(s)")
            total_found += len(results)
        for r in results:
            fresh[r["id"]] = r
        if i < len(accounts):
            time.sleep(REQUEST_DELAY_S)

    # Merge: keep manual records not found in RSS
    for gid, g in existing.items():
        if gid not in fresh and g.get("manual"):
            fresh[gid] = g

    # Sort: live → open → ended, then newest first within each group
    def sort_key(g):
        order = {"live": 0, "open": 1, "ended": 2}
        return (order.get(g["status"], 3), g.get("posted_ts", "")[::-1])  # reverse ts for newest first

    sorted_giveaways = sorted(fresh.values(), key=sort_key)

    active = [g for g in sorted_giveaways if g["status"] in ("open", "live")]
    total_prize = sum(
        int(m.group(1).replace(",", ""))
        for g in active
        if (m := re.search(r'\$([\d,]+)', g.get("prize", "")))
    )

    out = {
        "updated":        datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "active_count":   len(active),
        "total_prize_usd": total_prize,
        "giveaways":      sorted_giveaways,
    }

    if args.dry_run:
        print(f"\n🔍 Dry run — {total_found} giveaways found, {len(active)} active. Not writing file.")
        for g in active:
            print(f"  [{g['casino']}] {g['prize']} via {g['handle']} — {g['status']}")
    else:
        OUT_FILE.write_text(json.dumps(out, indent=2, ensure_ascii=False))
        print(f"\n✅  {total_found} giveaways found, {len(active)} active → {OUT_FILE}")

if __name__ == "__main__":
    main()
