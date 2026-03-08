#!/usr/bin/env python3
"""Generate pre-aggregated JSON for the Crypto Casino Terminal (CCT)."""

import csv
import json
from collections import defaultdict

daily = defaultdict(lambda: defaultdict(lambda: {'count': 0, 'volume_eth': 0, 'volume_usd': 0}))
hourly = defaultdict(lambda: defaultdict(int))
casino_totals = defaultdict(lambda: {'count': 0, 'volume_eth': 0, 'volume_usd': 0})
sizes = []

with open('data/deposits-all.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        date = row['Date']
        casino = row['Casino']
        amount = float(row['Amount'] or 0)
        usd = float(row['USD Value'] or 0)
        hour = row['Time'][:2] if row.get('Time') else '00'

        daily[date][casino]['count'] += 1
        daily[date][casino]['volume_eth'] += amount
        daily[date][casino]['volume_usd'] += usd

        hourly[date][hour] += 1

        casino_totals[casino]['count'] += 1
        casino_totals[casino]['volume_eth'] += amount
        casino_totals[casino]['volume_usd'] += usd

        sizes.append(usd)

dates = sorted(daily.keys())
casinos = sorted(casino_totals.keys(), key=lambda c: -casino_totals[c]['volume_usd'])

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
        'days_tracked': len(dates)
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

with open('data/terminal-data.json', 'w') as f:
    json.dump(output, f)

print(f"✅ Terminal data generated: {len(sizes)} deposits, {len(casinos)} casinos, {len(dates)} days")
print(f"   Volume: ${output['summary']['total_volume_usd']:,.0f}")
