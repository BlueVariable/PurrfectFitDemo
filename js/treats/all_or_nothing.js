'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: all_or_nothing
//  ×1.5 score multiplier, +0.2 per trigger — req: board full
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['all_or_nothing'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const counts = G.treatPlayCounts;
      // Scale once per ROUND, not per trigger: duplicate copies fired in the
      // same fit read the same multiplier instead of laddering each other
      // (per-trigger counting let two copies reach ×2.7 × ×2.8 by round 14).
      let plays = counts.all_or_nothing || 0;
      if (counts.all_or_nothing_lastRound === G.round) plays -= 1;
      const m = Math.round((baseM + plays * increment) * 100) / 100;
      if (counts.all_or_nothing_lastRound !== G.round) {
        counts.all_or_nothing = (counts.all_or_nothing || 0) + 1;
        counts.all_or_nothing_lastRound = G.round;
      }
      return { scoreMultiplier: true, m };
    };
  },
};
