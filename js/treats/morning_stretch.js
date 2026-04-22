'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: morning_stretch
//  ×2 score (FIRST HAND only)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['morning_stretch'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m };
    };
  },
};
