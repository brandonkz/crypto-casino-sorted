#!/bin/bash

# Daily automated deposit export
# Appends to deposits-all.csv for historical tracking

cd /Users/brandonkatz/.openclaw/workspace/crypto-casinos/site

echo "🎰 Daily Deposit Export - $(date)"
echo ""

# Run export
node export-deposits-csv.js

# Generate analytics with embedded data for live site
echo ""
echo "📊 Generating live analytics..."
node generate-live-analytics.js

# Check if successful
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Export complete"
  
  # Count total rows in cumulative file
  if [ -f "data/deposits-all.csv" ]; then
    TOTAL=$(wc -l < data/deposits-all.csv)
    echo "📊 Total tracked: $TOTAL deposits"
  fi
else
  echo "❌ Export failed"
  exit 1
fi
