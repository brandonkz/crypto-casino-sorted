# Dune Analytics Setup - Quick Start Guide

## ✅ API Key Configured

Your Dune API key is loaded and working: `pbpMtWVQ...`

---

## 🚀 Step 1: Create Your First Query

### Go to Dune and create a query:
**URL:** https://dune.com/queries

### Click "New Query" and paste this SQL:

```sql
-- Top Crypto Gambling Wallets (Last 30 Days)
-- Replace contract addresses with actual casino addresses

WITH casino_transactions AS (
  SELECT 
    "from" as wallet_address,
    value/1e18 as eth_amount,
    block_time
  FROM ethereum.transactions
  WHERE "to" IN (
    '0x1234...', -- Rollbit contract (REPLACE THIS)
    '0x5678...', -- Stake contract (REPLACE THIS)
    '0x9abc...'  -- BC.Game contract (REPLACE THIS)
  )
  AND block_time > NOW() - INTERVAL '30' DAY
)

SELECT 
  wallet_address,
  COUNT(*) as transaction_count,
  SUM(eth_amount) as total_eth_wagered,
  COUNT(DISTINCT DATE_TRUNC('day', block_time)) as active_days,
  MAX(block_time) as last_active
FROM casino_transactions
GROUP BY 1
ORDER BY 3 DESC
LIMIT 100
```

### Save the query and copy the Query ID from the URL
Example: `https://dune.com/queries/1234567` → Query ID is `1234567`

---

## 🎰 Step 2: Find Casino Contract Addresses

### Method 1: Search Existing Dune Dashboards

**Search these on Dune:**
- https://dune.com/queries?q=rollbit
- https://dune.com/queries?q=stake+casino
- https://dune.com/queries?q=crypto+gambling
- https://dune.com/queries?q=bc.game

Look for public dashboards that already track these casinos. Copy their contract addresses.

### Method 2: Etherscan/BSCScan

**Rollbit:**
1. Google "Rollbit smart contract address"
2. Check https://etherscan.io (Ethereum) and https://arbiscan.io (Arbitrum)
3. Look for labeled addresses

**BC.Game:**
1. Check https://bscscan.com
2. Search "BC.Game" or look for high-volume casino addresses

**Stake.com:**
1. Likely has deposit addresses rather than smart contracts
2. Check their docs or Etherscan for known addresses

### Method 3: Ask the Community

**Discord/Telegram:**
- Rollbit Discord: Ask in #general
- Dune Analytics Discord: #query-questions channel
- Crypto Twitter: Search for people analyzing these casinos

---

## 📊 Step 3: Popular Dune Queries to Copy

### Pre-Built Dashboards (if they exist):

Search Dune for:
- "Crypto Casino Analytics"
- "Rollbit Volume"
- "On-Chain Gambling"

**Copy their:**
- Contract addresses
- Query structure
- Data formatting

---

## 🔧 Step 4: Test Your Query

Once you have:
1. Created a query on Dune
2. Found 1-2 casino contract addresses
3. Updated the SQL with real addresses

**Run this command:**
```bash
cd /Users/brandonkatz/.openclaw/workspace/crypto-casinos/site
node fetch-wallet-data.js
```

I'll update the script to use your Query ID and fetch real data.

---

## 📝 What to Send Me

**When you find contract addresses, send me:**

```
Rollbit Ethereum: 0x1234...
Rollbit Arbitrum: 0x5678...
Stake Deposit: 0x9abc...
BC.Game BSC: 0xdef0...
```

**When you create the Dune query, send me:**
```
Query ID: 1234567
Query URL: https://dune.com/queries/1234567
```

Then I'll update `fetch-wallet-data.js` to automatically:
1. Execute your query
2. Wait for results
3. Parse the data
4. Update `wallet-tracker.html`
5. Commit and push

---

## 🎯 Quick Wins (If Stuck)

### Can't find contract addresses?
**Start with just one casino** - Rollbit is most likely to have on-chain data. Find one address and we'll expand later.

### Don't want to write SQL?
**Copy an existing query** - Find any gambling-related dashboard on Dune, fork it, and send me the Query ID.

### Just want to test?
**Use a generic query** - Even a simple "top Ethereum wallets" query will let us test the pipeline. We'll improve it later.

---

## 🚀 Next Actions

**For you:**
1. Search Dune for existing gambling queries (5 minutes)
2. Fork/copy one OR create new query (10 minutes)
3. Send me the Query ID

**For me:**
1. Update script with your Query ID
2. Build data parsing logic
3. Auto-update HTML with real data
4. Set up daily cron job

---

Let's start simple: Just get ONE casino's data working, then we'll expand to all of them.
