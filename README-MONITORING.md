# Live Deposit Monitoring

## Privacy & Security

**Real blockchain data is NEVER committed to git or deployed publicly.**

This protects:
- User deposit addresses (senders)
- Casino hot wallet addresses (receivers)
- Transaction patterns and volumes

## How It Works

### Local Demo (Interview/Testing)
```bash
# 1. Fetch real blockchain deposits (stored locally only)
node monitor-deposits.js

# 2. View live feed on localhost
open live-feed.html
# OR run local server:
python3 -m http.server 8000
# Then visit: http://localhost:8000/live-feed.html
```

Real deposits will show with ⛓️ "Verified" badges linking to Etherscan.

### Public Deployment (cryptocasinosorted.com)
- `data/live-deposits.json` is **gitignored** (never pushed)
- Live feed falls back to **mock data only**
- No real user/wallet addresses exposed

## Files

**Private (gitignored):**
- `.env.local` - API keys & casino wallet addresses
- `data/live-deposits.json` - Real blockchain deposits

**Public (committed):**
- `monitor-deposits.js` - Monitoring script (uses env variables)
- `live-feed.html` - Display (works with or without real data)
- `.env.local.example` - Template for setup

## For Interviews

**Show real blockchain monitoring:**
1. Run monitoring script locally
2. Open live-feed.html in browser (localhost or file://)
3. Point to verified badges → click to Etherscan
4. Explain: "Real-time blockchain data, kept private for user protection"

**Privacy talking point:** "I could deploy this live, but chose not to for user privacy. Anyone could reverse-engineer deposit patterns."
