# Reward Offer Verification

CryptoCasinoSorted keeps commercial CTAs and official evidence separate:

- Affiliate CTAs use `affiliate_url`.
- Official reward / offer evidence uses `source_url` or `reward_page_url`.
- Official sources are listed publicly at `/casino-reward-sources.html`.

## Manual commands

Check current sources:

```bash
npm run verify:offers
```

Refresh baselines after a human has reviewed source pages and confirmed the stored terms are still accurate:

```bash
npm run verify:offers:update
```

The verifier intentionally exits non-zero when a source changed, is stale, cannot be fetched, or is missing. GitHub Actions uses that to open/update a review issue.

## Known limits

Some casino pages block GitHub Actions / plain fetch requests or render important terms client-side. Those require manual browser checks, then a baseline refresh once the data is confirmed.
