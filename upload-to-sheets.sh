#!/bin/bash

# Upload deposits CSV to Google Sheets
# Handles large files by batching

CSV_FILE="data/deposits-2026-02-16.csv"
ACCOUNT="alphaxasset@gmail.com"

echo "📊 Creating new Google Sheet..."

# Create sheet
SHEET_OUTPUT=$(gog sheets create "Crypto Casino Deposits - Feb 16 2026" --account "$ACCOUNT" 2>&1)
echo "$SHEET_OUTPUT"

# Extract sheet ID from output
SHEET_ID=$(echo "$SHEET_OUTPUT" | grep -oE '[a-zA-Z0-9_-]{44}' | head -1)

if [ -z "$SHEET_ID" ]; then
    echo "❌ Failed to create sheet"
    exit 1
fi

echo "✅ Created sheet: $SHEET_ID"
echo "🔗 https://docs.google.com/spreadsheets/d/$SHEET_ID"
echo ""
echo "📤 Uploading CSV data..."

# Read CSV and convert to JSON array
python3 - "$CSV_FILE" "$SHEET_ID" "$ACCOUNT" << 'PYTHON'
import csv
import json
import subprocess
import sys

csv_file = sys.argv[1]
sheet_id = sys.argv[2]
account = sys.argv[3]

# Read CSV
with open(csv_file, 'r') as f:
    reader = csv.reader(f)
    rows = list(reader)

print(f"📊 Read {len(rows)} rows from CSV")

# Upload in batches of 100 rows
batch_size = 100
total_batches = (len(rows) + batch_size - 1) // batch_size

for i in range(0, len(rows), batch_size):
    batch = rows[i:i+batch_size]
    batch_num = (i // batch_size) + 1
    
    print(f"📤 Uploading batch {batch_num}/{total_batches} ({len(batch)} rows)...")
    
    # Convert to JSON
    values_json = json.dumps(batch)
    
    # Append to sheet
    cmd = [
        'gog', 'sheets', 'append',
        sheet_id,
        'Sheet1!A:H',
        '--values-json', values_json,
        '--insert', 'INSERT_ROWS',
        '--account', account
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            sys.exit(1)
    except subprocess.TimeoutExpired:
        print(f"⚠️  Timeout on batch {batch_num}, continuing...")
        continue

print(f"\n✅ Upload complete!")
print(f"🔗 https://docs.google.com/spreadsheets/d/{sheet_id}")
PYTHON

echo ""
echo "✅ Done!"
echo "🔗 https://docs.google.com/spreadsheets/d/$SHEET_ID"
