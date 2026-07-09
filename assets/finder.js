/* Rewards Finder widget behaviour. Progressive enhancement:
   the page is build-rendered with a default result, this makes it live.
   Depends on window.REWARDS and window.FinderCore. Vanilla JS, no deps. */
(function () {
  if (!window.REWARDS || !window.FinderCore) return;
  var FC = window.FinderCore;
  var casinos = window.REWARDS.casinos;
  var BRACKETS = [250, 1000, 2500, 5000, 10000, 25000];

  var wager = document.getElementById('wager');
  var range = document.getElementById('wager-range');
  var seg = document.getElementById('game-seg');
  var out = document.getElementById('finder-results');
  var blink = document.getElementById('bracket-link');
  if (!wager || !out) return;
  var game = 'slots';

  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}

  function rowHTML(r, i) {
    var rankClass = i === 0 ? 'rank-1' : (i < 3 ? 'rank-' + (i + 1) : '');
    var stamp = r.test && r.test.date ? '<span class="tested">Tested <span class="num">' + r.test.date + '</span>' + (r.test.time ? ' &middot; <span class="num">' + esc(r.test.time) + '</span>' : '') + '</span>' : '';
    var cta = r.ref ? '<a class="btn-primary" href="' + esc(r.ref) + '" rel="sponsored noopener" target="_blank">Go to ' + esc(r.name) + '</a>' : '<a class="btn-secondary" href="/reviews/">Read review</a>';
    var flag = r.capped ? '<div class="flag">Promo value exceeds expected losses at this volume. Read the terms.</div>' : '';
    return '<div class="result-row ' + rankClass + '">' +
      '<div><div class="result-head"><span class="result-rank">#' + (i + 1) + '</span><span class="result-name">' + esc(r.name) + '</span>' + (r.assumed ? '<span class="assumed-tag">modeled</span>' : '') + ' ' + stamp + '</div>' +
      '<div class="result-rate"><span class="num">' + r.rateText + '</span> of expected losses returned</div>' +
      '<div class="result-math">' + esc(r.math) + '</div>' +
      '<div class="result-tier">Tier at this volume: ' + esc(r.tierName) + '</div></div>' +
      '<div class="result-cta"><div class="result-ev"><span class="num">' + r.evText + '</span><small>/mo back</small></div>' + cta + '</div>' +
      flag + '</div>';
  }

  function nearestBracket(v) {
    var best = BRACKETS[0];
    for (var i = 0; i < BRACKETS.length; i++) if (Math.abs(BRACKETS[i] - v) < Math.abs(best - v)) best = BRACKETS[i];
    return best;
  }

  function render() {
    var v = Math.max(50, parseInt(wager.value, 10) || 0);
    var ranked = FC.rank(casinos, v, game);
    out.innerHTML = ranked.slice(0, 3).map(rowHTML).join('');
    if (blink) {
      var b = nearestBracket(v);
      blink.href = '/best-rewards/' + b + '-monthly/';
      blink.textContent = '$' + b.toLocaleString('en-US') + '/month breakdown';
    }
    updateBar(ranked[0]);
  }

  wager.addEventListener('input', function () { if (range) range.value = Math.min(range.max, wager.value); render(); });
  if (range) range.addEventListener('input', function () { wager.value = range.value; render(); });
  if (seg) seg.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-game]'); if (!b) return;
    game = b.getAttribute('data-game');
    seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    render();
  });

  /* mobile conversion bar */
  var bar = document.getElementById('mobile-bar');
  var mbName = document.getElementById('mb-name');
  var mbCta = document.getElementById('mb-cta');
  var mbClose = document.getElementById('mb-close');
  var dismissed = false;
  if (mbClose) mbClose.addEventListener('click', function () { dismissed = true; bar.classList.remove('show'); document.body.classList.remove('has-bar'); });
  function updateBar(top) {
    if (!bar || dismissed || !top) return;
    mbName.innerHTML = '#1 ' + esc(top.name) + ' &middot; <span class="num">' + top.evText + '</span>/mo';
    if (top.ref) { mbCta.href = top.ref; mbCta.textContent = 'Go'; mbCta.style.display = ''; }
    else { mbCta.href = '/reviews/'; mbCta.textContent = 'Review'; }
    bar.classList.add('show');
  }

  render();
})();
