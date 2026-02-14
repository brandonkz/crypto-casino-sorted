# Live Bets Feed - Documentation

## What It Does

Real-time display of big bets across major crypto casinos. Shows:
- Bet amount in crypto + USD value
- Casino name + logo
- Cryptocurrency used
- Timestamp (seconds/minutes ago)
- Live stats: total bets, 24h volume, biggest bet, active users

## Current Implementation

**Mock data** with realistic:
- Bet amounts (>$1,000 USD minimum)
- Multiple cryptos (BTC, ETH, USDT, LTC, DOGE)
- 5 casinos (Stake, BC.Game, Rollbit, Shuffle, Jackbit)
- Timing (new bet every 3-8 seconds)
- Animation (slide in, pulse, hover effects)

Perfect for **Digi Outsource interview** - shows you understand the concept and can build the UI/UX.

## How to Connect Real Data

### Option 1: Casino WebSocket Feeds (Best)

Most crypto casinos have WebSocket connections for live data. To find them:

1. **Open DevTools** on casino site (F12)
2. **Network tab** → Filter "WS" (WebSocket)
3. **Refresh page** and look for connections
4. **Click connection** → Messages tab to see data format

Example (Stake.com):
```javascript
const ws = new WebSocket('wss://stake.com/socket.io/?transport=websocket');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'bet') {
    addBet({
      casino: { name: 'Stake', id: 'stake', icon: '🎰' },
      crypto: { symbol: data.currency, icon: getCryptoIcon(data.currency) },
      amount: data.amount,
      usdValue: data.amount * data.rate,
      timestamp: new Date()
    });
  }
};
```

### Option 2: Casino APIs (If Available)

Some casinos offer public APIs:

**Stake.com:**
- GraphQL endpoint: `https://stake.com/api/graphql`
- Query: `{ recentBets { amount currency game user } }`

**BC.Game:**
- REST API: `https://api.bc.game/bets/recent`
- Requires API key (sign up for affiliate program)

**Rollbit:**
- WebSocket: `wss://api.rollbit.com/v1/bets`
- Public endpoint (no auth needed)

### Option 3: Scraping with Clawpod

For casinos without public APIs:

```javascript
// Use Clawpod (Massive Unblocker) to bypass Cloudflare
const response = await fetch('https://clawpod.joinmassive.com/unblock', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MASSIVE_UNBLOCKER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://stake.com',
    method: 'GET'
  })
});

const html = await response.text();
// Parse HTML for live bets section
```

### Option 4: Server-Side Proxy (Production)

For production, run a Node.js server:

```javascript
// server.js
const express = require('express');
const WebSocket = require('ws');
const app = express();

// Connect to multiple casino WebSockets
const stakeWs = new WebSocket('wss://stake.com/...');
const bcgameWs = new WebSocket('wss://bc.game/...');

// Relay to frontend clients
const clients = new Set();

app.get('/api/bets/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  clients.add(res);
  
  req.on('close', () => clients.delete(res));
});

stakeWs.on('message', (data) => {
  clients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
});

app.listen(3000);
```

Then update `live-feed.html`:

```javascript
const eventSource = new EventSource('/api/bets/stream');

eventSource.onmessage = (event) => {
  const bet = JSON.parse(event.data);
  addBet(bet);
};
```

## Data Sources to Research

1. **Stake.com** - Look for `/socket.io/` connections
2. **BC.Game** - Check `/ws/` endpoints
3. **Rollbit** - API docs: https://rollbit.com/api (if available)
4. **Shuffle** - DevTools → Network → WS
5. **Roobet** - WebSocket in console logs

## Interview Tips

When showing this at Digi Outsource:

1. **Explain the concept**: "This tracks big bets in real-time across casinos"
2. **Show the mock data**: "Currently using realistic mock data"
3. **Explain next steps**: "Would connect to casino WebSocket feeds here"
4. **Highlight engagement**: "Keeps users watching - FOMO effect"
5. **Mention provably fair**: "Each bet can be verified - that's how we access the data"

## Filter Feature

Users can filter by casino:
- All Casinos (default)
- Stake only
- BC.Game only
- Rollbit only
- Shuffle only

## Stats Tracking

Live counters:
- **Total bets today**: Increments with each bet
- **24h volume**: Running sum in USD
- **Biggest bet**: Tracks max USD value
- **Active users**: Simulated (200-700 range)

## Future Enhancements

1. **Sound effects** - Cha-ching for big bets
2. **Win/loss indicator** - Show if bet won or lost
3. **Game type filter** - Slots, table games, dice
4. **Leaderboard** - Biggest winners today
5. **Social features** - Click username to see user stats
6. **Notifications** - Alert for huge bets (>$100k)
7. **Historical view** - Last 24h timeline chart

## Technical Stack

- **Frontend only** (no backend needed for demo)
- **Vanilla JavaScript** (no framework dependencies)
- **CSS animations** (smooth, performant)
- **Responsive design** (mobile + desktop)
- **Real-time updates** (new bet every 3-8s)

## File Location

`/Users/brandonkatz/.openclaw/workspace/crypto-casinos/site/live-feed.html`

Live URL (once deployed): `https://cryptocasinosorted.com/live-feed.html`

## Maintenance

Mock data parameters in `live-feed.html`:
- Line 360: `const casinos = [...]` - Add/remove casinos
- Line 367: `const cryptos = [...]` - Add/remove cryptocurrencies
- Line 376: `const toUSD = {...}` - Update conversion rates
- Line 437: `const delay = Math.random() * 5000 + 3000` - Adjust bet frequency

## Analytics

Track engagement:
- Time on page (should be high - people love watching)
- Filter usage (which casinos are popular)
- Bounce rate (should be low - sticky content)
- Return visits (addictive FOMO effect)

Add to Google Analytics:
```javascript
// Track big bet views
if (bet.usdValue > 50000) {
  gtag('event', 'big_bet_viewed', {
    casino: bet.casino.name,
    amount_usd: bet.usdValue,
    crypto: bet.crypto.symbol
  });
}
```
