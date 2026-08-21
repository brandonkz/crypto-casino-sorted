(function () {
  const ROUTE_URL = 'https://cryptocasinosorted.com/tier-list/';
  const TILE_WIDTH = 131;
  const TILE_HEIGHT = 122;
  const TILE_DISC_RADIUS = 44;
  const TILE_DISC_SIZE = TILE_DISC_RADIUS * 2;
  const EXPORT_COLUMNS = 8;
  const EXPORT_MARGIN = 10;
  const EXPORT_GAP = 4;
  const EXPORT_LABEL_WIDTH = 110;
  const EXPORT_HEADER_HEIGHT = 92;
  const EXPORT_FOOTER_HEIGHT = 74;
  const TAP_THRESHOLD = 6;

  const TIERS = [
    { id: 'S', label: 'S', color: '#F26D6D' },
    { id: 'A', label: 'A', color: '#F5A25A' },
    { id: 'B', label: 'B', color: '#F5D66E' },
    { id: 'C', label: 'C', color: '#D7E58A' },
    { id: 'D', label: 'D', color: '#7FC66B' },
    { id: 'NP', label: 'Not Played', color: '#C463D8' },
    { id: 'UNRANKED', label: 'Unranked', color: '#4A4A52', uiOnly: true }
  ];

  const DEFAULT_RANKING = {
    S: ['stake', 'duel'],
    A: ['xtp', 'shuffle', 'roobet', 'gamdom', 'rainbet', 'thrill'],
    B: ['degen', 'gamba', 'rollbit', 'betbolt', 'goated'],
    C: ['razed', 'c500', 'bcgame', 'yeet', 'metawin', 'duelbits', 'shock'],
    D: ['chips', 'bitfortune', 'metaspins', 'acebet', 'spartans', 'dicey', 'winna'],
    NP: ['onewin', 'fortunejack', 'degencity', 'rolly']
  };

  const OPERATORS = [
    { id: 'stake', name: 'Stake', mark: 'STK', color: '#1ED760', ink: '#05161f', url: 'https://stake.com/?c=OYTAREab' },
    { id: 'duel', name: 'Duel', mark: 'DUEL', color: '#ffffff', ink: '#111111', url: 'https://duel.com/r/durinsbane' },
    { id: 'xtp', name: 'XTP', mark: 'XTP', color: '#F5F1D5', ink: '#1b2440', url: 'https://xtp.com/signup?utm_campaign=Durinsbane_New&utm_source=p2p_affiliate&utm_medium=referral' },
    { id: 'shuffle', name: 'Shuffle', mark: 'SHFL', color: '#ff6eb6', ink: '#1b0f1d', url: 'https://shuffle.com?r=cl46Ld1iQb' },
    { id: 'roobet', name: 'Roobet', mark: 'ROO', color: '#f4a300', ink: '#271301', url: 'https://roobet.com/?ref=brandonkz' },
    { id: 'gamdom', name: 'Gamdom', mark: 'GDM', color: '#2d2d36', ink: '#f7fbff', url: 'https://gamdom.com' },
    { id: 'rainbet', name: 'Rainbet', mark: 'RAIN', color: '#5aa7ff', ink: '#081523', url: 'https://rainbet.com' },
    { id: 'thrill', name: 'Thrill', mark: 'THRL', color: '#ff5c47', ink: '#210909', url: 'https://thrillcasino.io/td4msjnft' },
    { id: 'degen', name: 'Degen', mark: 'DGN', color: '#8ef16c', ink: '#0d1b0b', url: 'https://degen.com' },
    { id: 'gamba', name: 'Gamba', mark: 'GMBA', color: '#43d7ff', ink: '#07202a', url: 'https://gamba.com' },
    { id: 'rollbit', name: 'Rollbit', mark: 'RLBT', color: '#32b8ff', ink: '#071521', url: 'https://rollbit.com/referral/brandonkz' },
    { id: 'betbolt', name: 'BetBolt', mark: 'BOLT', color: '#ebf26d', ink: '#24260a', url: 'https://betbolt.com' },
    { id: 'goated', name: 'Goated', mark: 'GOAT', color: '#ffe28a', ink: '#241804', url: 'https://www.goated.com/' },
    { id: 'razed', name: 'Razed', mark: 'RAZD', color: '#ff8f6c', ink: '#2b0d05', url: 'https://www.razed.com/' },
    { id: 'c500', name: '500 Casino', mark: '500', color: '#ffe271', ink: '#211905', url: 'https://500.casino' },
    { id: 'bcgame', name: 'BC.Game', mark: 'BCG', color: '#20d89f', ink: '#05201a', url: 'https://partnerbcgame.com/vu2nxqkm6' },
    { id: 'yeet', name: 'Yeet', mark: 'YEET', color: '#ffb86d', ink: '#261202', url: 'https://yeet.com/register?aff=betsorted' },
    { id: 'metawin', name: 'MetaWin', mark: 'META', color: '#69f0d3', ink: '#06221d', url: 'https://metawin.com' },
    { id: 'duelbits', name: 'Duelbits', mark: 'DBIT', color: '#a999ff', ink: '#110d28', url: 'https://duelbits.io/?a=sorted' },
    { id: 'shock', name: 'Shock', mark: 'SHCK', color: '#fff27a', ink: '#272205', url: 'https://www.shock.com/' },
    { id: 'chips', name: 'Chips.gg', mark: 'CHPS', color: '#f7f7f7', ink: '#151515', url: 'https://chips.gg' },
    { id: 'bitfortune', name: 'BitFortune', mark: 'BFTN', color: '#ff9f8d', ink: '#240d08', url: 'https://bitfortune.com' },
    { id: 'metaspins', name: 'Metaspins', mark: 'MSPN', color: '#cb8bff', ink: '#1b0d24', url: 'https://metaspins.com' },
    { id: 'acebet', name: 'Acebet', mark: 'ACE', color: '#9cd8ff', ink: '#071e2c', url: 'https://www.acebet.io/' },
    { id: 'spartans', name: 'Spartans', mark: 'SPRT', color: '#ffc16e', ink: '#281602', url: 'https://spartans.com/' },
    { id: 'dicey', name: 'Dicey', mark: 'DICY', color: '#75ffe0', ink: '#06231d', url: 'https://dicey.com' },
    { id: 'winna', name: 'Winna', mark: 'WINA', color: '#ff91c7', ink: '#260713', url: 'https://winna.com' },
    { id: 'onewin', name: '1win', mark: '1WIN', color: '#7fb9ff', ink: '#071523', url: 'https://1win.com' },
    { id: 'fortunejack', name: 'FortuneJack', mark: 'FJ', color: '#c3ff8b', ink: '#102406', url: 'https://fortunejack.com' },
    { id: 'degencity', name: 'DegenCity', mark: 'DGCY', color: '#ffa6f4', ink: '#25091d', url: 'https://degencity.com' },
    { id: 'rolly', name: 'Rolly', mark: 'ROLY', color: '#ffd38f', ink: '#241202', url: 'https://rolly.io/' }
  ];

  const state = {
    ranking: null,
    bylineState: 'ours',
    selectedId: null,
    hoveredTierId: null,
    drag: {
      active: false,
      pointerId: null,
      operatorId: null,
      originTierId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      moved: false
    },
    extras: []
  };

  const operatorMap = new Map(OPERATORS.map((operator) => [operator.id, operator]));
  const tierMap = new Map(TIERS.map((tier) => [tier.id, tier]));

  const elements = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    elements.tierList = document.getElementById('tier-list');
    elements.byline = document.getElementById('tierlist-byline');
    elements.statPlaced = document.getElementById('stat-placed');
    elements.statUnranked = document.getElementById('stat-unranked');
    elements.statS = document.getElementById('stat-s');
    elements.toast = document.getElementById('toast');
    elements.dragGhost = document.getElementById('drag-ghost');
    elements.exportCanvas = document.getElementById('export-canvas');
    elements.boardAlert = document.getElementById('board-alert');

    elements.copyLinkBtn = document.getElementById('copy-link-btn');
    elements.exportBtn = document.getElementById('export-btn');
    elements.shareBtn = document.getElementById('share-btn');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.clearSelectionBtn = document.getElementById('clear-selection-btn');

    const decoded = decodeShareCode(new URLSearchParams(window.location.search).get('r'));
    const initial = decoded.hasPlacements ? decoded.ranking : createDefaultRanking();
    state.ranking = ensureCompleteRanking(initial);
    state.bylineState = decoded.hasPlacements ? 'visitor' : 'ours';
    state.extras = findUnexpectedOperators(state.ranking);

    bindToolbar();
    bindGlobalDragListeners();
    render();
  }

  function createDefaultRanking() {
    return ensureRankingShape(cloneRanking(DEFAULT_RANKING));
  }

  function ensureRankingShape(ranking) {
    const next = {};
    for (const tier of TIERS) next[tier.id] = [];
    for (const [tierId, ids] of Object.entries(ranking || {})) {
      if (!next[tierId]) next[tierId] = [];
      next[tierId] = Array.isArray(ids) ? ids.slice() : [];
    }
    return next;
  }

  function ensureCompleteRanking(ranking) {
    const next = ensureRankingShape(ranking);
    const seen = new Set();

    for (const tier of TIERS) {
      next[tier.id] = (next[tier.id] || []).filter((id) => {
        if (!operatorMap.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }

    for (const operator of OPERATORS) {
      if (!seen.has(operator.id)) next.UNRANKED.push(operator.id);
    }

    return next;
  }

  function findUnexpectedOperators(ranking) {
    const expected = new Set(Object.values(DEFAULT_RANKING).flat());
    const extras = [];
    for (const id of ranking.UNRANKED) {
      if (!expected.has(id)) extras.push(id);
    }
    return extras;
  }

  function cloneRanking(ranking) {
    return JSON.parse(JSON.stringify(ranking));
  }

  function bindToolbar() {
    elements.copyLinkBtn.addEventListener('click', onCopyShareLink);
    elements.exportBtn.addEventListener('click', onExportPng);
    elements.shareBtn.addEventListener('click', onShareToX);
    elements.resetBtn.addEventListener('click', onResetRanking);
    elements.clearSelectionBtn.addEventListener('click', () => {
      state.selectedId = null;
      render();
    });
  }

  function bindGlobalDragListeners() {
    document.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
    document.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
    document.addEventListener('pointercancel', onGlobalPointerCancel, { passive: false });
    document.addEventListener('keydown', onGlobalKeyDown);
  }

  function render() {
    renderByline();
    renderStats();
    renderAlert();
    renderTierRows();
  }

  function renderByline() {
    const bylineCopy = {
      ours: 'Ranked by CryptoCasinoSorted',
      you: 'Ranked by a visitor',
      visitor: "A visitor's ranking"
    };
    elements.byline.textContent = bylineCopy[state.bylineState];
  }

  function renderStats() {
    const placed = TIERS.filter((tier) => tier.id !== 'UNRANKED')
      .reduce((sum, tier) => sum + state.ranking[tier.id].length, 0);
    elements.statPlaced.textContent = String(placed);
    elements.statUnranked.textContent = String(state.ranking.UNRANKED.length);
    elements.statS.textContent = String(state.ranking.S.length);
  }

  function renderAlert() {
    if (!state.extras.length) {
      elements.boardAlert.style.display = 'none';
      elements.boardAlert.textContent = '';
      return;
    }
    const names = state.extras.map((id) => operatorMap.get(id)?.name || id).join(', ');
    elements.boardAlert.style.display = 'block';
    elements.boardAlert.textContent = 'Unranked because no editorial default tier was supplied: ' + names + '.';
  }

  function renderTierRows() {
    const fragment = document.createDocumentFragment();

    for (const tier of TIERS) {
      const row = document.createElement('section');
      row.className = 'tier-row';

      const label = document.createElement('div');
      label.className = 'tier-label';
      label.textContent = tier.label;
      label.style.background = tier.color;
      row.appendChild(label);

      const zone = document.createElement('div');
      zone.className = 'tier-zone';
      zone.dataset.zone = tier.id;
      zone.dataset.label = tier.label;
      zone.tabIndex = 0;
      zone.setAttribute('role', 'button');
      zone.setAttribute('aria-label', 'Place selected operator in ' + tier.label);
      if (state.hoveredTierId === tier.id) zone.classList.add('is-hovered');

      zone.addEventListener('click', onZoneClick);
      zone.addEventListener('keydown', onZoneKeyDown);

      const ids = state.ranking[tier.id];
      if (!ids.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-note';
        empty.textContent = tier.id === 'UNRANKED' ? 'Empty on first load. Drop here to remove a placement.' : 'Tap or drop here.';
        zone.appendChild(empty);
      } else {
        ids.forEach((id, index) => zone.appendChild(renderOperatorCard(id, tier.id, index)));
      }

      row.appendChild(zone);
      fragment.appendChild(row);
    }

    elements.tierList.innerHTML = '';
    elements.tierList.appendChild(fragment);
  }

  function renderOperatorCard(operatorId, tierId, index) {
    const operator = operatorMap.get(operatorId);
    const card = document.createElement('article');
    card.className = 'operator-card';
    if (state.selectedId === operatorId) card.classList.add('is-selected');
    card.dataset.operatorId = operatorId;
    card.dataset.tierId = tierId;

    const rank = document.createElement('div');
    rank.className = 'operator-rank';
    rank.textContent = String(index + 1);
    card.appendChild(rank);

    const nameSlot = operator.url ? document.createElement('a') : document.createElement('div');
    nameSlot.className = operator.url ? 'operator-name' : 'operator-name--plain';
    nameSlot.textContent = operator.name.toUpperCase();
    if (operator.url) {
      nameSlot.href = buildOutboundUrl(operator.url, operator.id);
      nameSlot.target = '_blank';
      nameSlot.rel = 'sponsored nofollow noopener noreferrer';
      nameSlot.dataset.operatorId = operator.id;
      nameSlot.addEventListener('pointerdown', onNamePointerDown);
      nameSlot.addEventListener('click', onNameClick);
    }
    card.appendChild(nameSlot);

    const disc = document.createElement('div');
    disc.className = 'operator-disc';
    disc.dataset.operatorId = operator.id;
    disc.dataset.tierId = tierId;
    disc.setAttribute('role', 'button');
    disc.tabIndex = 0;
    disc.setAttribute('aria-label', 'Move ' + operator.name);
    disc.addEventListener('pointerdown', onDiscPointerDown);
    disc.addEventListener('keydown', onDiscKeyDown);
    disc.appendChild(renderLogoContent(operator));

    const watermark = document.createElement('div');
    watermark.className = 'operator-watermark';
    watermark.textContent = 'CCS';
    disc.appendChild(watermark);

    card.appendChild(disc);
    return card;
  }

  function renderLogoContent(operator) {
    const wrapper = document.createElement('div');
    wrapper.style.width = '76px';
    wrapper.style.height = '76px';
    wrapper.style.position = 'relative';

    const img = document.createElement('img');
    img.alt = operator.name + ' logo';
    img.src = '/logos/' + operator.id + '.png';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.style.display = 'block';

    const fallback = document.createElement('div');
    fallback.className = 'operator-fallback';
    fallback.textContent = operator.mark;
    fallback.style.background = operator.color;
    fallback.style.color = operator.ink;
    fallback.hidden = true;

    img.addEventListener('error', () => {
      img.remove();
      fallback.hidden = false;
    }, { once: true });
    img.addEventListener('load', () => {
      fallback.hidden = true;
    }, { once: true });

    wrapper.appendChild(img);
    wrapper.appendChild(fallback);
    requestAnimationFrame(() => {
      if (!img.complete) return;
      if (img.naturalWidth === 0) {
        img.remove();
        fallback.hidden = false;
      }
    });
    return wrapper;
  }

  function onNamePointerDown(event) {
    event.stopPropagation();
  }

  function onNameClick(event) {
    event.stopPropagation();
    const operatorId = event.currentTarget.dataset.operatorId;
    const tierId = findTierForOperator(operatorId);
    trackEvent('tierlist_clickout', {
      operator_id: operatorId,
      tier_id: tierId || 'UNRANKED'
    });
  }

  function onDiscPointerDown(event) {
    const operatorId = event.currentTarget.dataset.operatorId;
    const tierId = event.currentTarget.dataset.tierId;

    state.drag.pointerId = event.pointerId;
    state.drag.operatorId = operatorId;
    state.drag.originTierId = tierId;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;
    state.drag.currentX = event.clientX;
    state.drag.currentY = event.clientY;
    state.drag.active = false;
    state.drag.moved = false;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onDiscKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const operatorId = event.currentTarget.dataset.operatorId;
    state.selectedId = state.selectedId === operatorId ? null : operatorId;
    render();
  }

  function onGlobalPointerMove(event) {
    if (event.pointerId !== state.drag.pointerId || !state.drag.operatorId) return;

    state.drag.currentX = event.clientX;
    state.drag.currentY = event.clientY;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!state.drag.active && distance > TAP_THRESHOLD) {
      state.drag.active = true;
      state.drag.moved = true;
      state.selectedId = null;
      showDragGhost(state.drag.operatorId);
    }

    if (!state.drag.active) return;

    event.preventDefault();
    updateDragGhost(event.clientX, event.clientY);
    updateHoveredTier(event.clientX, event.clientY);
  }

  function onGlobalPointerUp(event) {
    if (event.pointerId !== state.drag.pointerId || !state.drag.operatorId) return;
    const operatorId = state.drag.operatorId;
    const originTierId = state.drag.originTierId;
    const wasDrag = state.drag.active;

    if (wasDrag) {
      event.preventDefault();
      const targetTierId = findTierAtPoint(event.clientX, event.clientY);
      if (targetTierId) {
        placeOperator(operatorId, targetTierId);
        trackEvent('tierlist_place', {
          operator_id: operatorId,
          from_tier: originTierId,
          to_tier: targetTierId
        });
      }
    } else {
      state.selectedId = state.selectedId === operatorId ? null : operatorId;
      render();
    }

    cleanupDragState();
  }

  function onGlobalPointerCancel(event) {
    if (event.pointerId !== state.drag.pointerId) return;
    cleanupDragState();
  }

  function onGlobalKeyDown(event) {
    if (event.key === 'Escape') {
      if (state.drag.operatorId) cleanupDragState();
      if (state.selectedId) {
        state.selectedId = null;
        render();
      }
    }
  }

  function onZoneClick(event) {
    if (!state.selectedId) return;
    const tierId = event.currentTarget.dataset.zone;
    const fromTier = findTierForOperator(state.selectedId) || 'UNRANKED';
    placeOperator(state.selectedId, tierId);
    trackEvent('tierlist_place', {
      operator_id: state.selectedId,
      from_tier: fromTier,
      to_tier: tierId
    });
  }

  function onZoneKeyDown(event) {
    if (!state.selectedId) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const tierId = event.currentTarget.dataset.zone;
    const fromTier = findTierForOperator(state.selectedId) || 'UNRANKED';
    placeOperator(state.selectedId, tierId);
    trackEvent('tierlist_place', {
      operator_id: state.selectedId,
      from_tier: fromTier,
      to_tier: tierId
    });
  }

  function cleanupDragState() {
    state.drag.active = false;
    state.drag.pointerId = null;
    state.drag.operatorId = null;
    state.drag.originTierId = null;
    state.drag.moved = false;
    state.hoveredTierId = null;
    hideDragGhost();
    render();
  }

  function updateHoveredTier(clientX, clientY) {
    state.hoveredTierId = findTierAtPoint(clientX, clientY);
    renderTierRows();
  }

  function findTierAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const zone = el ? el.closest('[data-zone]') : null;
    return zone ? zone.dataset.zone : null;
  }

  function showDragGhost(operatorId) {
    const operator = operatorMap.get(operatorId);
    elements.dragGhost.innerHTML = '';
    const name = document.createElement('div');
    name.className = 'operator-name--plain';
    name.textContent = operator.name.toUpperCase();
    elements.dragGhost.appendChild(name);

    const disc = document.createElement('div');
    disc.className = 'operator-disc';
    disc.style.cursor = 'grabbing';
    disc.appendChild(renderLogoContent(operator));
    const watermark = document.createElement('div');
    watermark.className = 'operator-watermark';
    watermark.textContent = 'CCS';
    disc.appendChild(watermark);
    elements.dragGhost.appendChild(disc);
    elements.dragGhost.style.display = 'flex';
    updateDragGhost(state.drag.currentX, state.drag.currentY);
  }

  function updateDragGhost(clientX, clientY) {
    elements.dragGhost.style.left = clientX - 65 + 'px';
    elements.dragGhost.style.top = clientY - 61 + 'px';
  }

  function hideDragGhost() {
    elements.dragGhost.style.display = 'none';
    elements.dragGhost.innerHTML = '';
  }

  function placeOperator(operatorId, tierId) {
    for (const key of Object.keys(state.ranking)) {
      state.ranking[key] = state.ranking[key].filter((id) => id !== operatorId);
    }
    state.ranking[tierId].push(operatorId);
    state.selectedId = null;
    state.bylineState = 'you';
    render();
    updateShareState();
  }

  function findTierForOperator(operatorId) {
    for (const tier of TIERS) {
      if (state.ranking[tier.id].includes(operatorId)) return tier.id;
    }
    return null;
  }

  function updateShareState() {
    const url = new URL(window.location.href);
    const code = encodeShareCode(state.ranking);
    if (code) url.searchParams.set('r', code);
    else url.searchParams.delete('r');
    window.history.replaceState({}, '', url.toString());
    syncRobotsMeta(Boolean(code));
  }

  function onResetRanking() {
    state.ranking = createDefaultRanking();
    state.selectedId = null;
    state.bylineState = 'ours';
    state.extras = findUnexpectedOperators(state.ranking);
    const url = new URL(window.location.href);
    url.searchParams.delete('r');
    window.history.replaceState({}, '', url.toString());
    syncRobotsMeta(false);
    render();
    toast('Reset complete', 'The editorial ranking is back in place.');
  }

  async function onCopyShareLink() {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied', 'Anyone opening it will see this exact ranking.');
    } catch (_) {
      toast('Copy failed', 'Your browser blocked clipboard access. Copy the URL manually from the address bar.');
    }
  }

  async function onExportPng() {
    try {
      const blob = await exportRankingPng();
      downloadBlob(blob, 'crypto-casino-tier-list.png');
      toast('PNG ready', 'Your tier list exported with branding and footer disclosure.');
    } catch (error) {
      toast('Export failed', 'The PNG could not be generated. Try again after the page finishes loading.');
    }
  }

  async function onShareToX() {
    try {
      const blob = await exportRankingPng();
      const shareUrl = buildShareUrl();
      const sNames = state.ranking.S.map((id) => operatorMap.get(id)?.name).filter(Boolean);
      const text = 'S tier: ' + (sNames.length ? sNames.join(', ') : 'none') + '. Build your own:';
      const file = new File([blob], 'crypto-casino-tier-list.png', { type: 'image/png' });
      const tierDistribution = TIERS.filter((tier) => tier.id !== 'UNRANKED')
        .map((tier) => tier.id + ':' + state.ranking[tier.id].length)
        .join('|');

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: text,
          url: shareUrl,
          title: 'Crypto Casino Tier List'
        });
        trackEvent('tierlist_share', { method: 'native_share', tier_distribution: tierDistribution });
        return;
      }
      const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(shareUrl);

      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          window.open(intent, '_blank', 'noopener');
          toast('PNG copied', 'X opened in a new tab. Paste the image into the composer.');
          trackEvent('tierlist_share', { method: 'clipboard_image', tier_distribution: tierDistribution });
          return;
        } catch (_) {}
      }

      downloadBlob(blob, 'crypto-casino-tier-list.png');
      window.open(intent, '_blank', 'noopener');
      toast('File downloaded', 'X opened in a new tab. Attach the PNG manually if paste is unavailable.');
      trackEvent('tierlist_share', { method: 'download_fallback', tier_distribution: tierDistribution });
    } catch (_) {
      toast('Share failed', 'The PNG could not be prepared yet. Try again after the page finishes loading.');
    }
  }

  function buildShareUrl() {
    const url = new URL(ROUTE_URL);
    const code = encodeShareCode(state.ranking);
    if (code) url.searchParams.set('r', code);
    return url.toString();
  }

  function encodeShareCode(ranking) {
    return TIERS
      .filter((tier) => tier.id !== 'UNRANKED')
      .map((tier) => {
        const ids = ranking[tier.id];
        return ids.length ? tier.id + ':' + ids.join(',') : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function decodeShareCode(raw) {
    if (!raw) return { ranking: createDefaultRanking(), hasPlacements: false };
    const ranking = ensureRankingShape({});
    const seen = new Set();
    let placements = 0;

    String(raw).split('|').forEach((part) => {
      const bits = part.split(':');
      if (bits.length !== 2) return;
      const tierId = bits[0];
      if (!tierMap.has(tierId) || tierId === 'UNRANKED') return;
      bits[1].split(',').forEach((id) => {
        if (!operatorMap.has(id) || seen.has(id)) return;
        ranking[tierId].push(id);
        seen.add(id);
        placements += 1;
      });
    });

    return {
      ranking: ensureCompleteRanking(ranking),
      hasPlacements: placements > 0
    };
  }

  function buildOutboundUrl(rawUrl, operatorId) {
    const url = new URL(rawUrl, window.location.origin);
    url.searchParams.set('utm_source', 'ccs');
    url.searchParams.set('utm_medium', 'tierlist');
    url.searchParams.set('utm_campaign', 'ranker');
    url.searchParams.set('utm_content', operatorId);
    return url.toString();
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    }
  }

  function toast(title, body) {
    elements.toast.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const span = document.createElement('span');
    span.textContent = body;
    elements.toast.appendChild(strong);
    elements.toast.appendChild(span);
    elements.toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2600);
  }

  function syncRobotsMeta(hasShareCode) {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = hasShareCode ? 'noindex, nofollow' : 'index, follow';
  }

  async function exportRankingPng() {
    const canvas = elements.exportCanvas;
    const context = canvas.getContext('2d');
    const rows = TIERS.filter((tier) => tier.id !== 'UNRANKED' || state.ranking.UNRANKED.length);
    const rowHeights = rows.map((tier) => {
      const count = Math.max(state.ranking[tier.id].length, 1);
      const lines = Math.max(1, Math.ceil(count / EXPORT_COLUMNS));
      return (lines * TILE_HEIGHT) + ((lines - 1) * EXPORT_GAP);
    });

    const gridWidth = EXPORT_LABEL_WIDTH + EXPORT_GAP + (EXPORT_COLUMNS * TILE_WIDTH) + ((EXPORT_COLUMNS - 1) * EXPORT_GAP);
    const width = (EXPORT_MARGIN * 2) + gridWidth;
    const gridHeight = rowHeights.reduce((sum, height) => sum + height, 0) + ((rows.length - 1) * EXPORT_GAP);
    const height = EXPORT_HEADER_HEIGHT + EXPORT_MARGIN + gridHeight + EXPORT_MARGIN + EXPORT_FOOTER_HEIGHT;

    canvas.width = width * 2;
    canvas.height = height * 2;
    context.setTransform(2, 0, 0, 2, 0, 0);

    drawBackground(context, width, height);
    drawHeader(context, width);

    let y = EXPORT_HEADER_HEIGHT + EXPORT_MARGIN;
    for (let i = 0; i < rows.length; i += 1) {
      const tier = rows[i];
      drawTierRow(context, tier, y, rowHeights[i]);
      y += rowHeights[i] + EXPORT_GAP;
    }

    drawFooter(context, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('toBlob failed'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  }

  function drawBackground(context, width, height) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#06152f');
    gradient.addColorStop(0.55, '#0b2148');
    gradient.addColorStop(1, '#06152f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255,255,255,0.03)';
    for (let x = 0; x < width; x += 34) {
      context.fillRect(x, 0, 1, height);
    }
    for (let y = 0; y < height; y += 34) {
      context.fillRect(0, y, width, 1);
    }
  }

  function drawHeader(context, width) {
    context.fillStyle = 'rgba(9, 30, 67, 0.96)';
    context.fillRect(0, 0, width, EXPORT_HEADER_HEIGHT);
    context.fillStyle = '#f7fbff';
    context.font = '900 34px Inter, sans-serif';
    context.fillText('CRYPTO CASINO TIER LIST', EXPORT_MARGIN, 40);

    context.fillStyle = '#ff9d00';
    context.font = '700 14px "JetBrains Mono", monospace';
    context.fillText(getExportBylineText(), EXPORT_MARGIN, 62);
    context.fillText(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), EXPORT_MARGIN + 290, 62);

    context.fillStyle = '#9fb1d1';
    context.font = '12px Inter, sans-serif';
    context.fillText('Criteria: rewards, withdrawal trust, VIP transparency, friction, and whether the brand still looks good after actual use.', EXPORT_MARGIN, 82);
  }

  function drawTierRow(context, tier, y, rowHeight) {
    roundRect(context, EXPORT_MARGIN, y, EXPORT_LABEL_WIDTH, rowHeight, 6, tier.color);

    context.fillStyle = '#09121d';
    context.font = '900 26px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const labelLines = tier.label === 'Not Played' ? ['NOT', 'PLAYED'] : [tier.label];
    if (labelLines.length === 1) {
      context.fillText(labelLines[0], EXPORT_MARGIN + (EXPORT_LABEL_WIDTH / 2), y + (rowHeight / 2));
    } else {
      context.font = '900 20px Inter, sans-serif';
      context.fillText(labelLines[0], EXPORT_MARGIN + (EXPORT_LABEL_WIDTH / 2), y + (rowHeight / 2) - 14);
      context.fillText(labelLines[1], EXPORT_MARGIN + (EXPORT_LABEL_WIDTH / 2), y + (rowHeight / 2) + 14);
    }

    roundRect(context, EXPORT_MARGIN + EXPORT_LABEL_WIDTH + EXPORT_GAP, y, (EXPORT_COLUMNS * TILE_WIDTH) + ((EXPORT_COLUMNS - 1) * EXPORT_GAP), rowHeight, 6, 'rgba(9, 30, 67, 0.88)', 'rgba(255,255,255,0.1)');

    const ids = state.ranking[tier.id];
    ids.forEach((operatorId, index) => {
      const column = index % EXPORT_COLUMNS;
      const line = Math.floor(index / EXPORT_COLUMNS);
      const x = EXPORT_MARGIN + EXPORT_LABEL_WIDTH + EXPORT_GAP + (column * (TILE_WIDTH + EXPORT_GAP));
      const tileY = y + (line * (TILE_HEIGHT + EXPORT_GAP));
      drawTile(context, operatorMap.get(operatorId), x, tileY, index + 1);
    });

    context.textAlign = 'start';
    context.textBaseline = 'alphabetic';
  }

  function drawTile(context, operator, x, y, rank) {
    roundRect(context, x, y, TILE_WIDTH, TILE_HEIGHT, 8, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');

    context.fillStyle = '#f7fbff';
    context.font = '700 15px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    drawWrappedName(context, operator.name.toUpperCase(), x + (TILE_WIDTH / 2), y + 18, 118);

    context.fillStyle = 'rgba(6, 21, 47, 0.9)';
    context.beginPath();
    context.arc(x + 17, y + 18, 11, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.15)';
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = '#f7fbff';
    context.font = '900 10px "JetBrains Mono", monospace';
    context.textBaseline = 'middle';
    context.fillText(String(rank), x + 17, y + 18 + 0.5);

    const cx = x + (TILE_WIDTH / 2);
    const cy = y + 68;
    context.fillStyle = operator.color;
    context.beginPath();
    context.arc(cx, cy, TILE_DISC_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = operator.ink;
    context.font = '900 16px Inter, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(operator.mark, cx, cy + 1);

    context.fillStyle = 'rgba(255,255,255,0.16)';
    context.font = '900 9px "JetBrains Mono", monospace';
    context.textBaseline = 'alphabetic';
    context.fillText('CCS', x + TILE_WIDTH - 18, y + TILE_HEIGHT - 8);
  }

  function drawWrappedName(context, text, centerX, y, maxWidth) {
    if (context.measureText(text).width <= maxWidth) {
      context.fillText(text, centerX, y);
      return;
    }
    const parts = text.split(' ');
    const lines = [];
    let current = '';
    for (const part of parts) {
      const test = current ? current + ' ' + part : part;
      if (context.measureText(test).width <= maxWidth || !current) {
        current = test;
      } else {
        lines.push(current);
        current = part;
      }
    }
    if (current) lines.push(current);
    lines.slice(0, 2).forEach((line, index) => {
      context.fillText(line, centerX, y + (index * 14) - (lines.length > 1 ? 5 : 0));
    });
  }

  function drawFooter(context, width, height) {
    const footerTop = height - EXPORT_FOOTER_HEIGHT;
    context.fillStyle = 'rgba(4, 16, 38, 0.92)';
    context.fillRect(0, footerTop, width, EXPORT_FOOTER_HEIGHT);
    context.fillStyle = 'rgba(255,255,255,0.45)';
    context.font = '15px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText('cryptocasinosorted.com', width / 2, footerTop + 22);
    context.font = '10px Inter, sans-serif';
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillText('Commercial links • Byline distinguishes editorial from visitor rankings • 18+ only', width / 2, footerTop + 40);
    context.fillStyle = 'rgba(255,255,255,0.42)';
    context.fillText('XTP is operated by a company the site owner works for • Logos belong to their owners', width / 2, footerTop + 56);
    context.textAlign = 'start';
  }

  function roundRect(context, x, y, width, height, radius, fill, stroke) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function getExportBylineText() {
    if (state.bylineState === 'ours') return 'RANKED BY CRYPTOCASINOSORTED';
    if (state.bylineState === 'visitor') return "A VISITOR'S RANKING";
    return 'RANKED BY A VISITOR';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
})();
