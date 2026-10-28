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

## Statuses (since 2026-10-28)

- Fail the run and open/update an `Offer check: N sources need review (date)` issue: **offer terms changed** (a tracked `source_terms` phrase is gone), **dead URL** (404/410), **missing source**.
- Listed only, never fail on their own: **bot block** (403/429/503 or a challenge page), **fetch error**, **manual recheck due** (manual sources older than 30 days), **page changed** (whole-page hash moved but no offer terms are tracked).
- Track offers with `source_terms` phrases copied from the official page; whole-page hashes on help centres change constantly and are not a reliable signal.
- `source_status: "unverifiable"` (manual sources): a browser check could not see the offer (login wall, SPA, "not shown"). Listed as **Unverifiable**, never counted as OK, regardless of `source_last_checked`. `source_browser_attempt` records the attempt date.
- `source_status: "no_current_offer"`: the official page showed no welcome offer (or the tracked one was gone). Listed as **No current offer listed**, never counted as OK.
- `source_status: "browser_verified"`: offer wording copied from the official page in a manual browser check; ages into **Manual recheck due** after 30 days.
