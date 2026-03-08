#!/bin/bash

# Daily automated deposit export
# Appends to deposits-all.csv for historical tracking

cd /Users/brandonkatz/.openclaw/workspace/crypto-casinos/site

echo "🎰 Daily Deposit Export - $(date)"
echo ""

# Run export (use full path for launchd)
/opt/homebrew/bin/node fetch-multichain.js

# Generate analytics with embedded data for live site
echo ""
echo "📊 Generating live analytics..."
/opt/homebrew/bin/node generate-live-analytics.js

# Check if successful
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Export complete"
  
  # Count total rows in cumulative file
  if [ -f "data/deposits-all.csv" ]; then
    TOTAL=$(wc -l < data/deposits-all.csv)
    echo "📊 Total tracked: $TOTAL deposits"
  fi
# Generate terminal data for CCT dashboard
  echo ""
  echo "🖥️ Generating terminal data..."
  /usr/bin/python3 generate-terminal-data.py

  echo ""
  echo "📰 Updating news + promos..."
  /usr/bin/python3 update-news-promos.py

  echo "🔥 Updating Reddit + Streamer watch..."
  /usr/bin/python3 update-reddit-streamers.py

  echo "📅 Updating events calendar..."
  /usr/bin/python3 update-events.py

  # Weekly recap (Mondays)
  if [ "$(date +%u)" -eq 1 ]; then
    echo ""
    echo "📝 Generating weekly recap..."
    /usr/bin/python3 generate-weekly-recap.py
  fi
else
  echo "❌ Export failed"
  exit 1
fi
