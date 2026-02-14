// Load casinos data
let casinos = [];
let filteredCasinos = [];

// Fetch casino data
fetch('data/casinos.json')
  .then(response => response.json())
  .then(data => {
    casinos = data;
    filteredCasinos = casinos;
    renderCasinos();
  })
  .catch(error => console.error('Error loading casinos:', error));

// Filter checkboxes
const filters = {
  instant: document.getElementById('filter-instant'),
  nokyc: document.getElementById('filter-nokyc'),
  provably: document.getElementById('filter-provably'),
  vpn: document.getElementById('filter-vpn'),
  token: document.getElementById('filter-token')
};

// Add event listeners to filters
Object.values(filters).forEach(filter => {
  filter.addEventListener('change', applyFilters);
});

// Apply filters
function applyFilters() {
  filteredCasinos = casinos.filter(casino => {
    // Instant withdrawals filter
    if (filters.instant.checked && casino.withdrawal_speed !== 'Instant') {
      return false;
    }
    
    // No KYC filter
    if (filters.nokyc.checked && casino.kyc_required !== 'No' && casino.kyc_required !== 'Optional') {
      return false;
    }
    
    // Provably fair filter
    if (filters.provably.checked && !casino.provably_fair) {
      return false;
    }
    
    // VPN allowed filter
    if (filters.vpn.checked && !casino.vpn_allowed) {
      return false;
    }
    
    // Has token filter
    if (filters.token.checked && !casino.has_token) {
      return false;
    }
    
    return true;
  });
  
  renderCasinos();
}

// Render casinos
function renderCasinos() {
  const grid = document.getElementById('casino-grid');
  const noResults = document.getElementById('no-results');
  
  if (filteredCasinos.length === 0) {
    grid.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  noResults.style.display = 'none';
  
  // Sort by featured first, then rating
  const sorted = [...filteredCasinos].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return b.rating - a.rating;
  });
  
  grid.innerHTML = sorted.map(casino => createCasinoCard(casino)).join('');
}

// Create casino card HTML
function createCasinoCard(casino) {
  const featuredBadge = casino.featured 
    ? '<span class="featured-badge">⭐ Featured</span>' 
    : '';
  
  const coins = casino.accepted_coins.slice(0, 8).map(coin => 
    `<span class="coin-badge">${coin}</span>`
  ).join('');
  
  const moreCoins = casino.accepted_coins.length > 8 
    ? `<span class="coin-badge">+${casino.accepted_coins.length - 8} more</span>`
    : '';
  
  const tokenBadge = casino.has_token 
    ? `<a href="https://www.coingecko.com/en/coins/${casino.coingecko_id}" target="_blank" rel="noopener noreferrer" class="token-badge">
         <span class="token-symbol">$${casino.token_symbol}</span>
         <span class="token-mcap">MC: ${casino.market_cap}</span>
         <span class="token-arrow">→</span>
       </a>`
    : '';
  
  return `
    <div class="casino-card ${casino.featured ? 'featured' : ''}">
      ${featuredBadge}
      
      <div class="casino-header">
        <h3 class="casino-name">${casino.name}</h3>
        <div class="casino-rating">
          <span class="star">⭐</span>
          <span>${casino.rating}/5</span>
        </div>
      </div>
      
      ${tokenBadge}
      
      <p class="casino-description">${casino.description}</p>
      
      <div class="reddit-quote" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-left: 3px solid #8b5cf6; padding: 12px 16px; margin: 16px 0; border-radius: 8px; font-style: italic; font-size: 0.9rem; color: #333;">
        💬 ${casino.reddit_quote || 'Trusted by the crypto gambling community'}
      </div>
      
      <div class="casino-bonus">
        🎁 ${casino.bonus}
      </div>
      
      <div class="casino-features">
        <div class="feature">
          <span class="feature-icon">⚡</span>
          <span>${casino.withdrawal_speed}</span>
        </div>
        <div class="feature">
          <span class="feature-icon">${casino.kyc_required === 'No' ? '🕵️' : '🆔'}</span>
          <span>KYC: ${casino.kyc_required}</span>
        </div>
        <div class="feature">
          <span class="feature-icon">${casino.provably_fair ? '✓' : '✗'}</span>
          <span>${casino.provably_fair ? 'Provably Fair' : 'Not Provably Fair'}</span>
        </div>
        <div class="feature">
          <span class="feature-icon">${casino.vpn_allowed ? '🌐' : '🚫'}</span>
          <span>VPN: ${casino.vpn_allowed ? 'Allowed' : 'Not Allowed'}</span>
        </div>
      </div>
      
      <div class="casino-coins">
        ${coins}
        ${moreCoins}
      </div>
      
      <div class="pros-cons">
        <div class="pros">
          <h4>Pros</h4>
          <ul>
            ${casino.pros.slice(0, 3).map(pro => `<li>${pro}</li>`).join('')}
          </ul>
        </div>
        <div class="cons">
          <h4>Cons</h4>
          <ul>
            ${casino.cons.slice(0, 3).map(con => `<li>${con}</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <a href="${casino.ref_url}" target="_blank" rel="noopener noreferrer" class="casino-cta">
        Visit ${casino.name} →
      </a>
    </div>
  `;
}

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});
