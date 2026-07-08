'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frequent_flyer
//  ×1 +0.05 per ROUND WON this run — Type B mul. G.round
//  is the current 1-based round and only increments after
//  a round win (goShop), so rounds won = G.round − 1.
// ══════════════════════════════════════════════════════
function _frequentFlyerM(ef) {
  const bm = ef.match(/[×x]([\d.]+)/);
  const base = bm ? parseFloat(bm[1]) : 1;
  const sm = ef.match(/\+([\d.]+)\s*per/);
  const step = sm ? parseFloat(sm[1]) : 0.05;
  const won = Math.max(0, (G.round || 1) - 1);
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
