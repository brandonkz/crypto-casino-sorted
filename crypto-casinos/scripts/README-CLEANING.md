# Deposit Data Cleaning

## Problem

Raw Arkham deposit data includes massive amounts of noise:
- **Payment processors** (AlphaPo) processing for multiple casinos
- **Internal hot wallet transfers** (same wallet 3+ times in 24h)
- **High-volume shuffles** (same wallet >$100K in 24h)
- **Suspicious round numbers** (e.g. $998,871 ≈ $1M)

**Example (2026-04-08):**
- Raw data: $8.03M across 900 deposits
- Clean data: $1.22M across 787 deposits
- **85% of volume was noise**

## Solution

`clean-deposits.js` filters out:

1. **Known payment processors** → AlphaPo (not a casino)
2. **Repeat wallets (count)** → Same wallet >3 deposits in 24h
3. **Repeat wallets (volume)** → Same wallet >$100K total in 24h
4. **Suspicious round numbers** → >$500K and within 2% of round million

## Usage

```bash
node scripts/clean-deposits.js site/data/deposits-2026-04-08.csv site/data/
```

**Outputs:**
- `deposits-2026-04-08-clean.csv` → Use this for public stats
- `deposits-2026-04-08-flagged.csv` → What was removed + reasons
- `clean-stats.json` → Summary (clean vs flagged volume, breakdown)

## Integration

### Daily Intel Digest Cron
Now automatically runs cleaning before generating stats.

### Analytics Page
TODO: Update `generate-live-analytics.js` to use `-clean.csv` files.

### Tweet Generation
TODO: Update `generate-pnl-tweets.js` to use clean data.

## Thresholds

Configurable in `clean-deposits.js`:

```javascript
const THRESHOLDS = {
  repeatWalletCount: 3,        // Flag if >3 deposits
  repeatWalletTotal: 100000,   // Flag if >$100K total
  roundNumberMin: 500000,      // Check round numbers >$500K
  roundNumberTolerance: 0.02,  // Within 2% = suspicious
};
```

## Example Output

```
📊 SUMMARY
Total deposits:    900
Total volume:      $8,025,571

✅ Clean deposits:  787 (87.4%)
   Clean volume:    $1,222,554

🚩 Flagged:         113 (12.6%)
   Flagged volume:  $6,803,017

🔍 Flag breakdown:
   payment_processor         4
   repeat_wallet_count       96
   repeat_wallet_volume      17
   round_number              2

🐋 Top flagged:
   1. $2,160,000 @ AlphaPo [payment_processor, repeat_wallet_volume]
   2. $1,000,000 @ AlphaPo [payment_processor, round_number]
   3. $998,871 @ Roobet [repeat_wallet_volume, round_number]
```

## Future Improvements

1. **Identify more processors** (monitor "From Entity" field)
2. **Track known hot wallets** (maintain blocklist)
3. **Cross-reference with casino APIs** (if available)
4. **Historical trending** (flag wallets that suddenly spike)
5. **Machine learning** (pattern detection for new types of noise)

## Why This Matters

**Before cleaning:**
- Tweet: "Roobet processed $3.2M in deposits yesterday!"
- Reality: Most was internal hot wallet shuffles

**After cleaning:**
- Tweet: "Roobet had $450K in real player deposits yesterday"
- Reality: Accurate, credible, valuable intel

Credibility = competitive advantage.
