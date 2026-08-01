'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frequent_flyer
//  ×1 +0.05 per HAND WON this run — Type B mul.
//  G.handsWonRun is stamped in endScoreSequence AFTER the
//  scan, so the hand being scored doesn't count itself and
//  the scan matches the pre-SHIP projection exactly.
// ══════════════════════════════════════════════════════
function _frequentFlyerM(ef) {
  const bm = ef.match(/[×x]([\d.]+)/);
  const base = bm ? parseFloat(bm[1]) : 1;
  const sm = ef.match(/\+([\d.]+)\s*per/);
  const step = sm ? parseFloat(sm[1]) : 0.05;
  const won = Math.max(0, G.handsWonRun || 0);
  return Math.round((base + step * won) * 100) / 100;
}

TREAT_REGISTRY['frequent_flyer'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m: _frequentFlyerM(ef) };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'frequent_flyer');
    if (!td) return null;
    return `Now: ×${_frequentFlyerM(td.ef)}`;
  },
};
