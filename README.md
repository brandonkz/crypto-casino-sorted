# CryptoCasinoSorted

A clean, fast comparison site for crypto casinos. Built to help gamblers find the best crypto casinos with instant withdrawals, provably fair games, and no KYC requirements.

**Status:** MVP Complete ✅

---

## Features

- 🎰 **10 Crypto Casinos** - Top platforms reviewed and compared
- ⚡ **Smart Filtering** - Filter by instant withdrawals, no KYC, provably fair, VPN support
- 📊 **Comparison Cards** - Quick overview of pros, cons, bonuses, supported coins
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🎨 **Clean Design** - Fast, simple, no clutter

---

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern design with CSS Grid and Flexbox
- **Vanilla JavaScript** - No frameworks, fast loading
- **Google Fonts** - Inter font family

---

## Project Structure

```
/
├── index.html          # Homepage
├── style.css           # All styles
├── app.js              # JavaScript for filtering and rendering
├── data/
│   └── casinos.json    # Casino data
└── README.md
```

---

## Running Locally

1. Clone or download the project
2. Start a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

3. Open http://localhost:8000 in your browser

---

## Deploying to GitHub Pages

1. Create a new repository on GitHub
2. Push this code to the repository
3. Go to **Settings** → **Pages**
4. Select `main` branch and `/ (root)` folder
5. Click **Save**
6. Your site will be live at `https://yourusername.github.io/repo-name/`

### Custom Domain

1. Register your domain (e.g., `cryptocasinosorted.com`)
2. Add a `CNAME` file with your domain:
   ```
   cryptocasinosorted.com
   ```
3. In your DNS settings, add these A records:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
4. Wait for DNS propagation (2-24 hours)

---

## Updating Casinos

### Edit casinos.json

Open `data/casinos.json` and add/edit casino entries:

```json
{
  "id": 11,
  "name": "New Casino",
  "slug": "new-casino",
  "url": "https://newcasino.com",
  "ref_url": "https://newcasino.com?ref=yourid",
  "description": "Description here",
  "bonus": "100% up to $500",
  "accepted_coins": ["BTC", "ETH"],
  "provably_fair": true,
  "kyc_required": "Optional",
  "withdrawal_speed": "Instant",
  "vpn_allowed": true,
  "rating": 4.5,
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "featured": false
}
```

Save the file and reload the page - changes appear instantly.

---

## Adding Affiliate Links

1. Open `data/casinos.json`
2. Find the casino entry
3. Update the `ref_url` field with your affiliate link:
   ```json
   "ref_url": "https://stake.com?ref=your-affiliate-id"
   ```
4. Save and push to GitHub

**Before applying to affiliate programs:**
- Get 500-1,000 monthly visitors first
- Most programs require existing traffic

---

## SEO Optimization

**Already included:**
- Meta tags (description, keywords, Open Graph)
- Semantic HTML
- Mobile-responsive design
- Fast loading (no frameworks, minimal JS)

**TODO:**
- [ ] Create and submit `sitemap.xml`
- [ ] Add `robots.txt`
- [ ] Submit to Google Search Console
- [ ] Add Schema.org markup
- [ ] Create blog content (guides, reviews)

---

## Affiliate Programs to Apply For

Once you have 500-1,000 monthly visitors:

1. **Stake Affiliates** - Up to 40% rev share
2. **BC.Game Partners** - Up to 50% rev share
3. **Rollbit Affiliates** - 25-35% rev share
4. **Roobet Partners** - 30-40% rev share
5. **BitStarz Affiliates** - Varies
6. **Cloudbet Affiliates** - 30% rev share

---

## Next Steps

**Week 1:**
- [x] Build MVP
- [ ] Register domain
- [ ] Deploy to GitHub Pages
- [ ] Submit to search engines

**Week 2-3:**
- [ ] Create blog content (guides, how-tos)
- [ ] Start social media promotion
- [ ] Submit to crypto forums/communities

**Week 4-8:**
- [ ] Reach 500-1,000 monthly visitors
- [ ] Apply to affiliate programs
- [ ] Add affiliate links once approved

---

## Revenue Projections

**Month 1-2:** $0 (building traffic)
**Month 3:** $500-1,000 (first affiliate commissions)
**Month 6:** $5,000-10,000 (scaling traffic)
**Month 12:** $10,000-20,000+ (established site)

**Key:** Crypto casino affiliates have 30-50% lifetime revenue share. One whale player can generate $1k-10k+/month in ongoing commissions.

---

## License

MIT License - feel free to fork and adapt!
