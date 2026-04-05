'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: bench_warmer
//  +N per remaining cat in hand (flat score bonus)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['bench_warmer'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const scoreBonus = amt * G.hand.length;
      return { scoreBonus };
    };
  },
};
