#!/usr/bin/env python3
"""Generate pre-aggregated JSON for the Crypto Casino Terminal (CCT).
Includes: base stats, health scores, whale tracker, wallet analysis."""

import csv
import json
import math
from collections import defaultdict
from statistics import median, stdev

# === LOAD RAW DATA ===
daily = defaultdict(lambda: defaultdict(lambda: {'count': 0, 'volume_eth': 0, 'volume_usd': 0}))
hourly = defaultdict(lambda: defaultdict(int))
casino_totals = defaultdict(lambda: {'count': 0, 'volume_eth': 0, 'volume_usd': 0})
sizes = []
all_deposits = []
wallet_deposits = defaultdict(list)  # wallet -> list of {casino, usd, date, time}
casino_wallets = defaultdict(set)     # casino -> set of wallets

with open('data/deposits-all.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        date = row['Date']
        casino = row['Casino']
        amount = float(row['Amount'] or 0)
        usd = float(row['USD Value'] or 0)
        hour = row['Time'][:2] if row.get('Time') else '00'
        wallet = row.get('Wallet Address', '')
        time_str = row.get('Time', '00:00:00')

        daily[date][casino]['count'] += 1
        daily[date][casino]['volume_eth'] += amount
        daily[date][casino]['volume_usd'] += usd
        hourly[date][hour] += 1

        casino_totals[casino]['count'] += 1
        casino_totals[casino]['volume_eth'] += amount
        casino_totals[casino]['volume_usd'] += usd
        sizes.append(usd)

        deposit = {
            'date': date, 'time': time_str, 'casino': casino,
            'usd': usd, 'eth': amount, 'wallet': wallet[:10] + '...' + wallet[-6:] if len(wallet) > 16 else wallet
        }
        all_deposits.append(deposit)

        if wallet:
            wallet_deposits[wallet].append(deposit)
            casino_wallets[casino].add(wallet)

dates = sorted(daily.keys())
casinos = sorted(casino_totals.keys(), key=lambda c: -casino_totals[c]['volume_usd'])

# === BASE STATS ===
output = {
    'dates': dates,
    'casinos': casinos,
    'daily': {d: {c: daily[d][c] for c in daily[d]} for d in dates},
    'hourly': {d: dict(hourly[d]) for d in dates},
    'totals': dict(casino_totals),
    'summary': {
        'total_deposits': len(sizes),
        'total_volume_usd': sum(sizes),
        'avg_deposit_usd': sum(sizes) / len(sizes) if sizes else 0,
        'median_deposit_usd': sorted(sizes)[len(sizes) // 2] if sizes else 0,
        'max_deposit_usd': max(sizes) if sizes else 0,
        'date_range': {'start': dates[0], 'end': dates[-1]},
        'days_tracked': len(dates),
        'unique_wallets': len(wallet_deposits),
    },
    'distribution': {
        'under_100': len([s for s in sizes if s < 100]),
        '100_500': len([s for s in sizes if 100 <= s < 500]),
        '500_1000': len([s for s in sizes if 500 <= s < 1000]),
        '1000_5000': len([s for s in sizes if 1000 <= s < 5000]),
        '5000_10000': len([s for s in sizes if 5000 <= s < 10000]),
        '10000_50000': len([s for s in sizes if 10000 <= s < 50000]),
        'over_50000': len([s for s in sizes if s >= 50000]),
    }
}

# === CASINO HEALTH SCORES ===
def compute_health(casino):
    """Composite health score 0-100 based on volume trend, count trend, consistency, avg size."""
    daily_vols = []
    daily_counts = []
    daily_avgs = []
    for d in dates:
        v = daily[d].get(casino, {'volume_usd': 0, 'count': 0})
        daily_vols.append(v['volume_usd'])
        daily_counts.append(v['count'])
        if v['count'] > 0:
            daily_avgs.append(v['volume_usd'] / v['count'])

    if len(dates) < 4:
        return None

    # Split into recent half and older half
    mid = len(dates) // 2
    old_vols = daily_vols[:mid]
    new_vols = daily_vols[mid:]
    old_counts = daily_counts[:mid]
    new_counts = daily_counts[mid:]

    old_vol_avg = sum(old_vols) / len(old_vols) if old_vols else 0
    new_vol_avg = sum(new_vols) / len(new_vols) if new_vols else 0
    old_count_avg = sum(old_counts) / len(old_counts) if old_counts else 0
    new_count_avg = sum(new_counts) / len(new_counts) if new_counts else 0

    # 1. Volume trend (0-30): growing = good
    if old_vol_avg > 0:
        vol_growth = (new_vol_avg - old_vol_avg) / old_vol_avg
    else:
        vol_growth = 1 if new_vol_avg > 0 else 0
    vol_score = min(30, max(0, 15 + vol_growth * 30))

    # 2. Deposit count trend (0-25): more depositors = good
    if old_count_avg > 0:
        count_growth = (new_count_avg - old_count_avg) / old_count_avg
    else:
        count_growth = 1 if new_count_avg > 0 else 0
    count_score = min(25, max(0, 12.5 + count_growth * 25))

    # 3. Consistency (0-25): low variance = stable = good
    if len(daily_vols) > 1 and sum(daily_vols) > 0:
        non_zero = [v for v in daily_vols if v > 0]
        if len(non_zero) > 1:
            cv = stdev(non_zero) / (sum(non_zero) / len(non_zero))  # coefficient of variation
            consistency_score = max(0, min(25, 25 - cv * 12))
        else:
            consistency_score = 5
    else:
        consistency_score = 5

    # 4. Activity breadth (0-20): deposits on more days = healthier
    active_days = sum(1 for v in daily_vols if v > 0)
    breadth_score = min(20, (active_days / len(dates)) * 20)

    total = vol_score + count_score + consistency_score + breadth_score

    # 7-day trend for sparkline
    last7_vols = daily_vols[-7:] if len(daily_vols) >= 7 else daily_vols
    last7_counts = daily_counts[-7:] if len(daily_counts) >= 7 else daily_counts

    # Week-over-week delta
    if len(daily_vols) >= 14:
        this_week = sum(daily_vols[-7:])
        last_week = sum(daily_vols[-14:-7])
        wow_delta = ((this_week - last_week) / last_week * 100) if last_week > 0 else 0
    else:
        wow_delta = 0

    # Determine status
    if total >= 70:
        status = 'healthy'
        light = 'green'
    elif total >= 45:
        status = 'stable'
        light = 'amber'
    else:
        status = 'declining'
        light = 'red'

    return {
        'score': round(total, 1),
        'status': status,
        'light': light,
        'components': {
            'volume_trend': round(vol_score, 1),
            'deposit_trend': round(count_score, 1),
            'consistency': round(consistency_score, 1),
            'activity': round(breadth_score, 1),
        },
        'wow_volume_delta': round(wow_delta, 1),
        'sparkline_volume': [round(v, 0) for v in last7_vols],
        'sparkline_count': last7_counts,
        'unique_wallets': len(casino_wallets.get(casino, set())),
        'avg_deposit': round(casino_totals[casino]['volume_usd'] / casino_totals[casino]['count'], 2) if casino_totals[casino]['count'] > 0 else 0,
    }

health_scores = {}
for c in casinos:
    h = compute_health(c)
    if h:
        health_scores[c] = h

output['health'] = health_scores

# === WHALE TRACKER ===
WHALE_THRESHOLD = 5000
MEGA_WHALE_THRESHOLD = 50000

whales = []
whale_by_casino = defaultdict(lambda: {'count': 0, 'total_usd': 0, 'max_usd': 0})
whale_by_date = defaultdict(lambda: {'count': 0, 'total_usd': 0})

for dep in all_deposits:
    if dep['usd'] >= WHALE_THRESHOLD:
        tag = 'MEGA' if dep['usd'] >= MEGA_WHALE_THRESHOLD else 'WHALE' if dep['usd'] >= 10000 else 'BIG FISH'
        whales.append({
            'date': dep['date'],
            'time': dep['time'],
            'casino': dep['casino'],
            'usd': round(dep['usd'], 2),
            'eth': round(dep['eth'], 6),
            'wallet': dep['wallet'],
            'tag': tag,
        })
        whale_by_casino[dep['casino']]['count'] += 1
        whale_by_casino[dep['casino']]['total_usd'] += dep['usd']
        whale_by_casino[dep['casino']]['max_usd'] = max(whale_by_casino[dep['casino']]['max_usd'], dep['usd'])
        whale_by_date[dep['date']]['count'] += 1
        whale_by_date[dep['date']]['total_usd'] += dep['usd']

# Sort whales by USD descending, keep top 200
whales.sort(key=lambda w: -w['usd'])
top_whales = whales[:200]

# Whale stats
total_whale_vol = sum(w['usd'] for w in whales)
total_vol = sum(sizes)

# Whale concentration per casino
whale_casino_stats = {}
for c in casinos:
    wc = whale_by_casino.get(c, {'count': 0, 'total_usd': 0, 'max_usd': 0})
    total_c = casino_totals[c]['volume_usd']
    whale_casino_stats[c] = {
        'count': wc['count'],
        'total_usd': round(wc['total_usd'], 2),
        'max_single': round(wc['max_usd'], 2),
        'whale_pct': round(wc['total_usd'] / total_c * 100, 1) if total_c > 0 else 0,
    }

# Whale daily timeline
whale_timeline = []
for d in dates:
    wd = whale_by_date.get(d, {'count': 0, 'total_usd': 0})
    whale_timeline.append({
        'date': d,
        'count': wd['count'],
        'volume': round(wd['total_usd'], 0),
    })

output['whales'] = {
    'deposits': top_whales,
    'stats': {
        'total_count': len(whales),
        'total_volume': round(total_whale_vol, 2),
        'pct_of_total_volume': round(total_whale_vol / total_vol * 100, 1) if total_vol > 0 else 0,
        'avg_whale_size': round(total_whale_vol / len(whales), 2) if whales else 0,
        'biggest_single': round(max(w['usd'] for w in whales), 2) if whales else 0,
        'mega_count': sum(1 for w in whales if w['tag'] == 'MEGA'),
        'whale_count': sum(1 for w in whales if w['tag'] == 'WHALE'),
        'big_fish_count': sum(1 for w in whales if w['tag'] == 'BIG FISH'),
    },
    'by_casino': whale_casino_stats,
    'timeline': whale_timeline,
}

# === WALLET ANALYSIS ===
repeat_wallets = sum(1 for w, deps in wallet_deposits.items() if len(deps) > 1)
unique_wallets = len(wallet_deposits)
output['wallets'] = {
    'unique': unique_wallets,
    'repeat': repeat_wallets,
    'repeat_pct': round(repeat_wallets / unique_wallets * 100, 1) if unique_wallets > 0 else 0,
    'per_casino': {c: len(casino_wallets[c]) for c in casinos},
}

# === WRITE OUTPUT ===
with open('data/terminal-data.json', 'w') as f:
    json.dump(output, f)

print(f"✅ Terminal data generated: {len(sizes)} deposits, {len(casinos)} casinos, {len(dates)} days")
print(f"   Volume: ${output['summary']['total_volume_usd']:,.0f}")
print(f"   Unique wallets: {unique_wallets:,}")
print(f"   Repeat depositors: {repeat_wallets:,} ({output['wallets']['repeat_pct']}%)")
print(f"   Whale deposits (≥$5K): {len(whales):,} totaling ${total_whale_vol:,.0f} ({output['whales']['stats']['pct_of_total_volume']}% of volume)")
print(f"   Health scores computed for {len(health_scores)} casinos")
for c in casinos[:5]:
    h = health_scores.get(c, {})
    print(f"     {c}: {h.get('score', '?')}/100 [{h.get('light', '?').upper()}] wow={h.get('wow_volume_delta', 0):+.1f}%")
