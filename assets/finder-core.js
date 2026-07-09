/* Shared reward math. Used by the browser widget and the Node build script
   so the finder, the static table and the bracket pages all agree.
   Formula per spec. Numbers are modeled estimates; see /methodology.html. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.FinderCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var HOUSE_EDGE = { slots: 0.04, originals: 0.01, live: 0.015, sports: 0.05 };
  var HAIRCUT = 0.5;

  function fmtUSD(n) {
    if (n >= 100) return '$' + Math.round(n).toLocaleString('en-US');
    return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) { return (Math.round(n * 1000) / 10) + '%'; }

  function pickTier(casino, wager) {
    var tiers = (casino.rakeback_tiers || []).slice().sort(function (a, b) {
      return a.monthly_wager_threshold - b.monthly_wager_threshold;
    });
    var chosen = null;
    for (var i = 0; i < tiers.length; i++) {
      if (wager >= tiers[i].monthly_wager_threshold) chosen = tiers[i];
    }
    return chosen || (tiers[0] || { tier: '-', rate: 0 });
  }

  function compute(casino, wager, gameType) {
    var edge = HOUSE_EDGE[gameType];
    var theo = wager * edge;
    var tier = pickTier(casino, wager);
    var rakeback = 0, mathParts = [];
    if (casino.payout_model === 'edge_based') {
      rakeback = wager * edge * tier.rate;
      if (tier.rate > 0) mathParts.push(fmtUSD(wager) + ' wagered x ' + pct(edge) + ' edge x ' + pct(tier.rate) + ' rakeback');
    } else if (casino.payout_model === 'wager_based') {
      rakeback = wager * tier.rate;
      if (tier.rate > 0) mathParts.push(fmtUSD(wager) + ' wagered x ' + pct(tier.rate) + ' rakeback');
    }
    var cashbackVal = 0;
    if (casino.cashback && casino.cashback.rate) {
      cashbackVal = theo * casino.cashback.rate;
      mathParts.push(fmtUSD(theo) + ' theo loss x ' + pct(casino.cashback.rate) + ' cashback');
    }
    var flat = 0;
    (casino.flat_bonuses || []).forEach(function (b) {
      var v = b.value || 0; if (b.wagering_required) v *= HAIRCUT; flat += v;
      if (v) mathParts.push(fmtUSD(v) + (b.wagering_required ? ' bonus (x0.5 WR)' : ' bonus'));
    });
    var evBack = rakeback + cashbackVal + flat;
    var returnRate = theo > 0 ? evBack / theo : 0;
    var capped = returnRate > 1;
    var mathString = (mathParts.join(' + ') || 'no modeled reward at this volume') + ' = ' + fmtUSD(evBack) + '/mo';
    return {
      slug: casino.slug, name: casino.name, tierName: tier.tier,
      theo: theo, evBack: evBack, returnRate: returnRate, capped: capped,
      evText: fmtUSD(evBack), rateText: capped ? '>100%' : pct(returnRate),
      math: mathString,
      test: casino.withdrawal_test || null, ref: casino.ref_url || null,
      assumed: !!casino.payout_model_assumed
    };
  }

  function rank(casinos, wager, gameType) {
    return casinos.map(function (c) { return compute(c, wager, gameType); })
      .sort(function (a, b) { return b.returnRate - a.returnRate; });
  }

  return { HOUSE_EDGE: HOUSE_EDGE, fmtUSD: fmtUSD, pct: pct, compute: compute, rank: rank };
});
