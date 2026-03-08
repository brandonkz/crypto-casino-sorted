#!/usr/bin/env python3
"""Refresh events.json timestamp. (Placeholder for future RSS feeds.)"""

import json
from datetime import datetime, timezone

try:
    with open("data/events.json", "r") as f:
        data = json.load(f)
except Exception:
    data = {"events": []}

data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

with open("data/events.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ Events refreshed: {len(data.get('events', []))} items")
