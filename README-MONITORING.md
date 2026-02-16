# Live Deposit Monitoring

## Privacy & Security

**Real blockchain data is NEVER committed to git or deployed publicly.**

This protects:
- User deposit addresses (senders)
- Casino hot wallet addresses (receivers)
- Transaction patterns and volumes

## How It Works

### Local Demo (Interview/Testing)

**Efficient approach (recommended):**
```bash
# Fetch latest deposits (2 API calls only)
node monitor-deposits-efficient.js

# View live feed
open live-feed.html
```

**Continuous monitoring (for live demos):**
```bash
# Runs every 30 seconds (720 calls/hour)
./start-monitoring.sh
```

Real deposits show with ⛓️ "Verified" badges (no transaction links for privacy).

### API Usage

**Efficient script:** 2 calls/run (ETH only, 2 wallets)
- Before interview: ~10 calls total
- Etherscan free tier: 100,000/day ✅

**Continuous monitoring:** 720 calls/hour
- Only for live demos
- Still within free tier if < 5 hours

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
