// Filter checkboxes
const filters = {
  instant: document.getElementById('filter-instant'),
  nokyc: document.getElementById('filter-nokyc'),
  provably: document.getElementById('filter-provably'),
  vpn: document.getElementById('filter-vpn'),
  token: document.getElementById('filter-token')
};

// Get all casino cards
const allCards = document.querySelectorAll('.casino-card');
const noResults = document.getElementById('no-results');

// Add event listeners to filters
Object.values(filters).forEach(filter => {
  if (filter) {
    filter.addEventListener('change', applyFilters);
  }
});

// Apply filters function
function applyFilters() {
  const activeFilters = {
    instant: filters.instant?.checked || false,
    nokyc: filters.nokyc?.checked || false,
    provably: filters.provably?.checked || false,
    vpn: filters.vpn?.checked || false,
    token: filters.token?.checked || false
  };

  let visibleCount = 0;

  allCards.forEach(card => {
    const matchesFilters = 
      (!activeFilters.instant || card.dataset.instant === 'true') &&
      (!activeFilters.nokyc || card.dataset.nokyc === 'true') &&
      (!activeFilters.provably || card.dataset.provably === 'true') &&
      (!activeFilters.vpn || card.dataset.vpn === 'true') &&
      (!activeFilters.token || card.dataset.token === 'true');

    if (matchesFilters) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  // Show/hide no results message
  if (visibleCount === 0) {
    noResults.style.display = 'block';
  } else {
    noResults.style.display = 'none';
  }
}

// Initialize - show all cards
applyFilters();
