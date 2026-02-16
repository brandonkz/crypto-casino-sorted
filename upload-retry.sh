#!/bin/bash

# Retry upload until APIs are activated

echo "⏳ Waiting for Google APIs to activate..."
echo "   (Usually takes 2-3 minutes)"
echo ""

for i in {1..10}; do
  echo "Attempt $i/10..."
  
  if node upload-sheets-api.js 2>&1 | grep -q "View sheet:"; then
    echo ""
    echo "✅ Success!"
    exit 0
  fi
  
  if [ $i -lt 10 ]; then
    echo "   Still activating, waiting 30s..."
    sleep 30
  fi
done

echo ""
echo "❌ APIs still not activated after 5 minutes"
echo "   Try manual upload instead:"
echo "   1. Open: https://sheets.google.com/create"
echo "   2. Import: data/deposits-2026-02-16.csv"
