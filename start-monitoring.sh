#!/bin/bash

# Start real-time blockchain deposit monitoring
# Runs continuously and updates live-deposits.json every 30 seconds

echo "🎰 Starting CryptoCasinoSorted live feed monitor..."
echo "   Tracking: Stake & Rollbit deposits on Ethereum"
echo "   Refresh: Every 30 seconds"
echo "   Data: ./data/live-deposits.json"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")"
node monitor-deposits.js --watch
