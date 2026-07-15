(function () {
  const CONFIG_URL = '/data/affiliate-tracking.json';
  const STORAGE_KEY = 'ccs_affiliate_clicks';

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function safeUrl(value) {
    try { return new URL(value, window.location.origin); } catch (_) { return null; }
  }

  function cleanHost(hostname) {
    return String(hostname || '').replace(/^www\./, '').toLowerCase();
  }

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'unknown';
  }

  function currentSource() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    if (path === '/') return 'home';
    return slug(path.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, ''));
  }

  function closestText(link, selector) {
    const el = link.closest(selector);
    return el ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  }

  function placementFor(link) {
    if (link.dataset.ccsPlacement) return slug(link.dataset.ccsPlacement);
    if (link.closest('.comparison-table')) return 'homepage_rewards_table';
    if (link.closest('.chapter-actions')) return 'reward_book_chapter';
    if (link.classList.contains('review-link')) return 'reviews_quick_table';
    if (link.classList.contains('review-card-cta')) return 'reviews_card';
    if (link.classList.contains('review-cta')) return 'review_cta';
    if (link.classList.contains('cta-button') || link.classList.contains('cta') || link.closest('.hero')) return 'primary_cta';
    if (link.closest('footer')) return 'footer';
    return 'content_link';
  }

  function rowRank(link) {
    const row = link.closest('tr');
    if (!row) return '';
    const rank = row.querySelector('.rank-pill, [data-rank], td:last-child');
    return rank ? rank.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
  }

  function rewardEstimate(link) {
    const row = link.closest('tr');
    if (!row) return '';
    const cell = row.querySelector('.incentive-cell');
    return cell ? cell.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  }

  function profileState() {
    const active = document.querySelector('.profile-btn.active');
    const input = document.getElementById('monthlyWager');
    const wager = input ? input.value : '';
    return {
      wager_profile: active ? active.dataset.profile || active.textContent.trim() : '',
      monthly_wager: wager
    };
  }

  function operatorFor(url, config) {
    const host = cleanHost(url.hostname);
    return config.operators.find((operator) => {
      const allowed = (operator.allowedHosts || []).map(cleanHost);
      if (allowed.includes(host)) return true;
      const affiliate = safeUrl(operator.affiliateUrl);
      if (affiliate && cleanHost(affiliate.hostname) === host) return true;
      return false;
    });
  }

  function addSubId(destination, operator, subid) {
    const url = safeUrl(destination);
    if (!url) return destination;
    const param = operator.subIdParam || 'subid';
    if (!url.searchParams.has(param)) url.searchParams.set(param, subid);
    return url.toString();
  }

  function storeClick(payload) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.unshift(Object.assign({ clicked_at: new Date().toISOString() }, payload));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch (_) {}
  }

  function sendAffiliateEvent(payload) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'affiliate_click', payload);
      window.gtag('event', 'casino_choice', payload);
    }
  }

  function buildPayload(link, operator, originalHref, finalHref, subid) {
    const profile = profileState();
    const url = safeUrl(finalHref) || safeUrl(originalHref);
    return {
      casino: operator.name,
      operator: operator.slug,
      link_url: originalHref,
      outbound_url: finalHref,
      link_domain: url ? cleanHost(url.hostname) : '',
      page_path: window.location.pathname,
      page_title: document.title,
      placement: placementFor(link),
      live_rank: rowRank(link),
      reward_estimate: rewardEstimate(link),
      click_subid: subid,
      link_text: link.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
      wager_profile: profile.wager_profile,
      monthly_wager: profile.monthly_wager
    };
  }

  function upgradeLinks(config) {
    if (!config || !Array.isArray(config.operators)) return;
    const source = currentSource();
    document.querySelectorAll('a[href]').forEach((link) => {
      if (link.dataset.ccsTracked === 'true') return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('/go/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const parsed = safeUrl(href);
      if (!parsed || parsed.origin === window.location.origin) return;
      const operator = operatorFor(parsed, config);
      if (!operator) return;
      const placement = placementFor(link);
      const rank = rowRank(link);
      const subid = [config.subIdPrefix || 'ccs', operator.slug, source, placement, slug(rank || 'na')].join('_').slice(0, 120);
      const finalHref = addSubId(parsed.toString(), operator, subid);
      const redirect = new URL('/go/' + operator.slug + '/', window.location.origin);
      redirect.searchParams.set('source', source);
      redirect.searchParams.set('placement', placement);
      if (rank) redirect.searchParams.set('rank', rank);
      const estimate = rewardEstimate(link);
      if (estimate) redirect.searchParams.set('estimate', estimate);
      redirect.searchParams.set('subid', subid);
      redirect.searchParams.set('u', finalHref);

      link.dataset.ccsTracked = 'true';
      link.dataset.operator = operator.slug;
      link.dataset.operatorName = operator.name;
      link.dataset.originalHref = parsed.toString();
      link.dataset.finalHref = finalHref;
      link.dataset.clickSubid = subid;
      link.href = redirect.toString();
      link.rel = Array.from(new Set(((link.rel || '') + ' sponsored nofollow noopener').trim().split(/\s+/))).join(' ');

      link.addEventListener('click', () => {
        const payload = buildPayload(link, operator, parsed.toString(), finalHref, subid);
        storeClick(payload);
        sendAffiliateEvent(payload);
      }, { capture: true });
    });
  }

  onReady(() => {
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then(upgradeLinks)
      .catch(() => {});
  });
})();
