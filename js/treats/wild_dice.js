'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: wild_dice
//  ×5 score multiplier — 1 in 6 trigger chance
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['wild_dice'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const triggered = Math.floor(Math.random() * 6) === 0;
      if (!triggered) return { scoreMultiplier: true, m: 1 };
      return { scoreMultiplier: true, m };
    };
  },
};
