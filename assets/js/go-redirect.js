(function () {
  const CONFIG_URL = '/data/affiliate-tracking.json';

  function cleanHost(hostname) {
    return String(hostname || '').replace(/^www\./, '').toLowerCase();
  }

  function safeUrl(value) {
    try { return new URL(value, window.location.origin); } catch (_) { return null; }
  }

  function slugFromPath() {
    const match = window.location.pathname.match(/\/go\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function appendSubId(destination, operator, subid) {
    const url = safeUrl(destination);
    if (!url) return destination;
    const param = operator.subIdParam || 'subid';
    if (subid && !url.searchParams.has(param)) url.searchParams.set(param, subid);
    return url.toString();
  }

  function destinationFor(operator) {
    const params = new URLSearchParams(window.location.search);
    const supplied = params.get('u');
    const subid = params.get('subid') || '';
    const allowedHosts = (operator.allowedHosts || []).map(cleanHost);
    const suppliedUrl = supplied ? safeUrl(supplied) : null;
    if (suppliedUrl && allowedHosts.includes(cleanHost(suppliedUrl.hostname))) {
      return appendSubId(suppliedUrl.toString(), operator, subid);
    }
    return appendSubId(operator.affiliateUrl, operator, subid);
  }

  function eventPayload(operator, destination) {
    const params = new URLSearchParams(window.location.search);
    const dest = safeUrl(destination);
    return {
      casino: operator.name,
      operator: operator.slug,
      link_url: destination,
      outbound_url: destination,
      link_domain: dest ? cleanHost(dest.hostname) : '',
      page_path: params.get('source') || '',
      placement: params.get('placement') || '',
      live_rank: params.get('rank') || '',
      reward_estimate: params.get('estimate') || '',
      click_subid: params.get('subid') || '',
      redirect_path: window.location.pathname
    };
  }

  function redirect(destination) {
    const link = document.getElementById('fallback-link');
    if (link) link.href = destination;
    window.setTimeout(() => { window.location.replace(destination); }, 900);
  }

  function run(config) {
    const slug = slugFromPath();
    const operator = config.operators.find((item) => item.slug === slug);
    if (!operator) {
      document.body.classList.add('redirect-error');
      const title = document.getElementById('redirect-title');
      const copy = document.getElementById('redirect-copy');
      if (title) title.textContent = 'Tracking link unavailable';
      if (copy) copy.textContent = 'This casino link is not configured yet.';
      return;
    }
    const destination = destinationFor(operator);
    const payload = eventPayload(operator, destination);
    const title = document.getElementById('redirect-title');
    const copy = document.getElementById('redirect-copy');
    if (title) title.textContent = 'Opening ' + operator.name;
    if (copy) copy.textContent = 'We are recording the click, then sending you to the casino.';

    let redirected = false;
    const go = () => {
      if (redirected) return;
      redirected = true;
      redirect(destination);
    };

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'affiliate_redirect', Object.assign({}, payload, {
        event_callback: go,
        event_timeout: 700
      }));
      window.gtag('event', 'casino_choice_redirect', payload);
      window.setTimeout(go, 850);
    } else {
      go();
    }
  }

  fetch(CONFIG_URL, { cache: 'no-store' })
    .then((response) => response.json())
    .then(run)
    .catch(() => {
      const copy = document.getElementById('redirect-copy');
      if (copy) copy.textContent = 'Tracking config could not load. Try the casino link again.';
    });
})();
