'use strict';
// ══════════════════════════════════════════════════════
//  SIM: batch aggregation + dashboard rendering
//  Plain HTML/CSS tables with hand-rolled inline bar divs — no canvas libs.
// ══════════════════════════════════════════════════════

function simMedian(nums){
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function simMean(nums){
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function simRound1(n){ return n === null || n === undefined ? null : Math.round(n * 10) / 10; }

// Build the full aggregate structure the dashboard renders from.
function simAggregate(results, maxRound){
  const profiles = [...new Set(results.map(r => r.profile))];
  const byProfile = {};

  profiles.forEach(profile => {
    const games = results.filter(r => r.profile === profile);
    const n = games.length;
    const wins = games.filter(g => g.result === 'won').length;
    const failCount = games.filter(g => g.result === 'failRound').length;
    const stuckCount = games.filter(g => g.result === 'stuck').length;
    const crashedCount = games.filter(g => g.result === 'crashed').length;

    const clearRateByRound = {};
    const handsUsedByRound = {};
    const cashByRound = {};
    const purrfectRateByRound = {};

    for (let round = 1; round <= maxRound; round++){
      const reached = games.filter(g => g.rounds.some(r => r.round === round));
      clearRateByRound[round] = n ? (reached.length / n) * 100 : null;

      const handsVals = reached.map(g => g.rounds.find(r => r.round === round).handsUsed).filter(v => v != null);
      handsUsedByRound[round] = { median: simMedian(handsVals), mean: simMean(handsVals), n: handsVals.length };

      const cashVals = reached.map(g => g.rounds.find(r => r.round === round).cashAfterShop).filter(v => v != null);
      cashByRound[round] = { median: simMedian(cashVals), n: cashVals.length };

      const purrfectRatios = reached.map(g => {
        const rr = g.rounds.find(r => r.round === round);
        return rr.handsUsed > 0 ? (rr.purrfectCount / rr.handsUsed) * 100 : null;
      }).filter(v => v != null);
      purrfectRateByRound[round] = { pct: simMean(purrfectRatios), n: purrfectRatios.length };
    }

    // Treat table: pick rate + avg fail/crash round for games that bought
    // this treat (at least once, any round) vs games that didn't. Only
    // failRound/stuck/crashed games have a meaningful "how far did it get"
    // number; 'won' games are excluded from that average (they didn't fail).
    const treatIds = new Set();
    games.forEach(g => g.rounds.forEach(r => {
      r.treatsBought.forEach(id => treatIds.add(id));
    }));
    const nonWinGames = games.filter(g => g.result !== 'won' && g.failRound != null);
    const treats = {};
    [...treatIds].sort().forEach(id => {
      const boughtGames = games.filter(g => g.rounds.some(r => r.treatsBought.includes(id)));
      const notBoughtGames = games.filter(g => !boughtGames.includes(g));
      const boughtFailRounds = nonWinGames.filter(g => boughtGames.includes(g)).map(g => g.failRound);
      const notBoughtFailRounds = nonWinGames.filter(g => notBoughtGames.includes(g)).map(g => g.failRound);
      treats[id] = {
        pickRate: n ? (boughtGames.length / n) * 100 : null,
        boughtGames: boughtGames.length,
        avgFailRoundBought: simMean(boughtFailRounds),
        avgFailRoundNotBought: simMean(notBoughtFailRounds)
      };
    });

    byProfile[profile] = {
      profile, n, wins, failCount, stuckCount, crashedCount,
      winRate: n ? (wins / n) * 100 : null,
      clearRateByRound, handsUsedByRound, cashByRound, purrfectRateByRound, treats
    };
  });

  return { profiles, maxRound, byProfile };
}

function simBarHtml(pct, label){
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const lbl = label != null ? label : (pct == null ? '—' : simRound1(pct) + '%');
  return '<div class="sim-bar-cell"><div class="sim-bar-track"><div class="sim-bar-fill" style="width:' + p + '%"></div></div><span class="sim-bar-label">' + lbl + '</span></div>';
}

function simEsc(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function simRenderSummary(agg){
  let html = '<div class="sim-card"><h3>Batch summary</h3><table class="sim-table"><thead><tr>' +
    '<th>Profile</th><th>Games</th><th>Won</th><th>Failed</th><th>Stuck</th><th>Crashed</th><th>Win rate</th>' +
    '</tr></thead><tbody>';
  agg.profiles.forEach(profile => {
    const p = agg.byProfile[profile];
    html += '<tr><td>' + simEsc(profile) + '</td><td>' + p.n + '</td><td>' + p.wins + '</td><td>' + p.failCount +
      '</td><td>' + p.stuckCount + '</td><td>' + p.crashedCount + '</td><td>' + simBarHtml(p.winRate) + '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function simRenderByRoundTable(agg, title, valueFn, formatFn){
  let html = '<div class="sim-card"><h3>' + simEsc(title) + '</h3><table class="sim-table"><thead><tr><th>Round</th>';
  agg.profiles.forEach(p => { html += '<th>' + simEsc(p) + '</th>'; });
  html += '</tr></thead><tbody>';
  for (let round = 1; round <= agg.maxRound; round++){
    html += '<tr><td>' + round + '</td>';
    agg.profiles.forEach(profile => {
      const v = valueFn(agg.byProfile[profile], round);
      html += '<td>' + formatFn(v) + '</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function simRenderTreatTables(agg){
  let html = '';
  agg.profiles.forEach(profile => {
    const p = agg.byProfile[profile];
    const ids = Object.keys(p.treats);
    html += '<div class="sim-card"><h3>Treats — ' + simEsc(profile) + '</h3>';
    if (!ids.length){
      html += '<div class="sim-muted">No treats were bought by this profile in this batch.</div></div>';
      return;
    }
    ids.sort((a, b) => (p.treats[b].pickRate || 0) - (p.treats[a].pickRate || 0));
    html += '<table class="sim-table"><thead><tr><th>Treat</th><th>Pick rate</th><th>Games bought</th>' +
      '<th>Avg fail/crash round (bought)</th><th>Avg fail/crash round (not bought)</th></tr></thead><tbody>';
    ids.forEach(id => {
      const t = p.treats[id];
      html += '<tr><td>' + simEsc(id) + '</td><td>' + simBarHtml(t.pickRate) + '</td><td>' + t.boughtGames + '</td>' +
        '<td>' + (t.avgFailRoundBought == null ? '—' : simRound1(t.avgFailRoundBought)) + '</td>' +
        '<td>' + (t.avgFailRoundNotBought == null ? '—' : simRound1(t.avgFailRoundNotBought)) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  return html;
}

function simRenderDashboard(containerEl, results, maxRound){
  if (!results.length){ containerEl.innerHTML = '<div class="sim-muted">No games run yet.</div>'; return; }
  const agg = simAggregate(results, maxRound);
  let html = '';
  html += simRenderSummary(agg);
  html += simRenderByRoundTable(agg, 'Clear rate per round (% of games still alive entering this round)',
    (p, r) => p.clearRateByRound[r], v => simBarHtml(v));
  html += simRenderByRoundTable(agg, 'Hands used per round (median / mean)',
    (p, r) => p.handsUsedByRound[r], v => (v && v.n) ? (simRound1(v.median) + ' / ' + simRound1(v.mean)) : '—');
  html += simRenderByRoundTable(agg, 'Cash after shop (median)',
    (p, r) => p.cashByRound[r], v => (v && v.n) ? ('$' + simRound1(v.median)) : '—');
  html += simRenderByRoundTable(agg, 'Purrfect rate per round (% of hands that fully filled the board)',
    (p, r) => p.purrfectRateByRound[r], v => (v && v.n) ? simBarHtml(v.pct) : '—');
  html += simRenderTreatTables(agg);
  containerEl.innerHTML = html;
}
