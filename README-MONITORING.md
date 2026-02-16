# Live Deposit Monitoring

## Privacy & Security

**Real blockchain data is NEVER committed to git or deployed publicly.**

This protects:
- User deposit addresses (senders)
- Casino hot wallet addresses (receivers)
- Transaction patterns and volumes

## How It Works

### Before Interview (Recommended)

**Fetch entire day's activity in one go:**
```bash
node fetch-daily-deposits.js
```

**What you get:**
- Last 24 hours of deposits (~1,000+ transactions)
- Total volume stats ($700K+ typical)
- 3 API calls total (0.003% of daily limit)
- Perfect for demos/interviews

**Then view:**
```bash
open live-feed.html
```

### API Usage Comparison

| Approach | API Calls | Use Case |
|----------|-----------|----------|
| **Daily fetch** | 3 total | ✅ Before interview (recommended) |
| Efficient | 2 per run | Manual refresh |
| Continuous | 720/hour | Live monitoring (not needed) |

**Etherscan free tier:** 100,000/day

### What the Data Shows

Real 24h example:
- **Stake**: 434 deposits, 162 ETH, biggest: 30 ETH
- **Rollbit**: 841 deposits, 113 ETH, biggest: 5 ETH
- **Total**: 1,275 deposits, $773K volume

All transaction hashes removed for user privacy.

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
