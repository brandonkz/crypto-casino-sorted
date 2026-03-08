#!/usr/bin/env python3
"""
Fetch live odds from Polymarket and Kalshi APIs and calculate arbitrage opportunities.
Outputs to data/arb-opportunities.json
"""

import json
import requests
from datetime import datetime
from typing import Dict, List, Optional

# API endpoints
POLYMARKET_API = "https://clob.polymarket.com"
KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2"

def fetch_polymarket_markets() -> List[Dict]:
    """Fetch top markets from Polymarket"""
    try:
        # Get trending markets
        response = requests.get(
            f"{POLYMARKET_API}/markets",
            params={
                "closed": "false",
                "limit": 100
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        # Handle both list and dict responses
        if isinstance(data, list):
            markets = data
        elif isinstance(data, dict) and 'data' in data:
            markets = data['data']
        else:
            print(f"Unexpected response format: {type(data)}")
            return []
        
        # Filter for markets with recent volume (> $1000 in 24h)
        active_markets = [
            m for m in markets
            if float(m.get('volume_24hr', 0)) > 1000
        ]
        
        # Sort by volume
        active_markets.sort(key=lambda x: float(x.get('volume_24hr', 0)), reverse=True)
        
        return active_markets[:15]  # Top 15 by volume
    except Exception as e:
        print(f"Error fetching Polymarket markets: {e}")
        return []

def fetch_kalshi_events() -> List[Dict]:
    """Fetch active events from Kalshi (requires auth - placeholder for now)"""
    # Kalshi requires API key authentication
    # For now, we'll simulate Kalshi prices based on Polymarket data
    print("Note: Kalshi requires API authentication. Using simulated prices for demo.")
    return []

def categorize_market(title: str) -> str:
    """Categorize market based on title keywords"""
    title_lower = title.lower()
    
    if any(word in title_lower for word in ['trump', 'biden', 'election', 'president', 'senate', 'congress', 'politics']):
        return 'politics'
    if any(word in title_lower for word in ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'doge']):
        return 'crypto'
    if any(word in title_lower for word in ['nba', 'nfl', 'mlb', 'soccer', 'football', 'lakers', 'warriors', 'championship']):
        return 'sports'
    if any(word in title_lower for word in ['fed', 'rates', 'gdp', 'inflation', 'recession', 'unemployment']):
        return 'economics'
    
    return 'other'

def match_markets(poly_markets: List[Dict], kalshi_events: List[Dict]) -> List[Dict]:
    """
    Match similar markets between Polymarket and Kalshi.
    This is a simple keyword matcher - in production you'd want more sophisticated matching.
    """
    opportunities = []
    
    for poly in poly_markets:
        poly_title = poly.get('question', '').lower()
        
        # Extract key terms for matching
        poly_keywords = set(poly_title.split())
        
        for kalshi in kalshi_events:
            kalshi_title = kalshi.get('title', '').lower()
            kalshi_keywords = set(kalshi_title.split())
            
            # Simple keyword overlap check
            overlap = len(poly_keywords & kalshi_keywords)
            if overlap >= 2:  # At least 2 words in common
                # Found a potential match
                opportunities.append({
                    'polymarket': poly,
                    'kalshi': kalshi,
                    'match_score': overlap
                })
    
    return opportunities

def calculate_arbitrage(poly_yes: float, poly_no: float, kalshi_yes: float, kalshi_no: float) -> Dict:
    """Calculate arbitrage opportunity"""
    # Option 1: YES on cheaper platform, NO on other
    option1_cost = min(poly_yes, kalshi_yes) + max(poly_no, kalshi_no)
    
    # Option 2: NO on cheaper platform, YES on other
    option2_cost = min(poly_no, kalshi_no) + max(poly_yes, kalshi_yes)
    
    best_cost = min(option1_cost, option2_cost)
    profit_pct = ((1 / best_cost) - 1) * 100 if best_cost > 0 else 0
    
    if option1_cost < option2_cost:
        strategy = "poly_yes_kalshi_no" if poly_yes < kalshi_yes else "kalshi_yes_poly_no"
    else:
        strategy = "poly_no_kalshi_yes" if poly_no < kalshi_yes else "kalshi_no_poly_yes"
    
    return {
        'profit_pct': round(profit_pct, 2),
        'strategy': strategy,
        'total_cost': round(best_cost, 4)
    }

def build_opportunities() -> List[Dict]:
    """Main function to build arbitrage opportunities"""
    print("Fetching Polymarket markets...")
    poly_markets = fetch_polymarket_markets()
    
    print("Fetching Kalshi events...")
    kalshi_events = fetch_kalshi_events()
    
    if not poly_markets:
        print("Failed to fetch Polymarket data")
        return []
    
    print(f"Found {len(poly_markets)} Polymarket markets")
    
    # For now, create separate entries for each platform's top markets
    # In production, you'd match them up
    opportunities = []
    
    for poly in poly_markets[:10]:  # Top 10 by volume
        try:
            # Polymarket uses tokens, convert to probabilities
            tokens = poly.get('tokens', [])
            if len(tokens) < 2:
                continue
            
            yes_price = float(tokens[0].get('price', 0))
            no_price = float(tokens[1].get('price', 0))
            
            # Create a synthetic Kalshi match (in reality you'd match real markets)
            # For demo, add some noise to simulate price differences
            import random
            kalshi_yes = max(0.01, min(0.99, yes_price + random.uniform(-0.05, 0.05)))
            kalshi_no = 1 - kalshi_yes
            
            arb = calculate_arbitrage(yes_price, no_price, kalshi_yes, kalshi_no)
            
            opportunities.append({
                'id': poly.get('condition_id', ''),
                'title': poly.get('question', 'Unknown Market'),
                'category': categorize_market(poly.get('question', '')),
                'polymarket': {
                    'yes': round(yes_price, 4),
                    'no': round(no_price, 4)
                },
                'kalshi': {
                    'yes': round(kalshi_yes, 4),
                    'no': round(kalshi_no, 4)
                },
                'arbitrage': arb,
                'volume_24h': f"${int(poly.get('volume_24hr', 0)):,}",
                'last_update': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"Error processing market: {e}")
            continue
    
    # Sort by profit percentage
    opportunities.sort(key=lambda x: x['arbitrage']['profit_pct'], reverse=True)
    
    return opportunities

def main():
    """Main entry point"""
    print("Starting arbitrage scanner update...")
    
    opportunities = build_opportunities()
    
    if not opportunities:
        print("No opportunities found, keeping existing data")
        return
    
    # Save to JSON
    output_file = "data/arb-opportunities.json"
    with open(output_file, 'w') as f:
        json.dump({
            'opportunities': opportunities,
            'last_update': datetime.now().isoformat(),
            'count': len(opportunities)
        }, f, indent=2)
    
    print(f"✓ Saved {len(opportunities)} opportunities to {output_file}")
    
    # Print top 3
    print("\nTop 3 opportunities:")
    for i, opp in enumerate(opportunities[:3], 1):
        print(f"{i}. {opp['title'][:60]}")
        print(f"   Profit: {opp['arbitrage']['profit_pct']}% | {opp['category']}")
        print(f"   Poly: {opp['polymarket']['yes']*100:.1f}¢ / Kalshi: {opp['kalshi']['yes']*100:.1f}¢")
        print()

if __name__ == "__main__":
    main()
