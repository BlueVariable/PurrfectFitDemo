'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: one_shot
//  ×2 score multiplier — fires only once per round
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['one_shot'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    let lastUsedRound = -1;
    return (b, cats, ts, p, cs) => {
      if (G.round === lastUsedRound) return {};
      lastUsedRound = G.round;
      return { scoreMultiplier: true, m };
    };
  },
};
