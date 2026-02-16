#!/bin/bash

# Start local server and open dashboard
# Avoids CORS issues

cd "$(dirname "$0")"

echo "🚀 Starting local server..."
echo "   Dashboard will open at: http://localhost:8765"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Start Python server in background
python3 -m http.server 8765 > /dev/null 2>&1 &
SERVER_PID=$!

# Wait a moment for server to start
sleep 1

# Open dashboard
open "http://localhost:8765/dashboard-simple.html"

# Wait for user to stop
wait $SERVER_PID
