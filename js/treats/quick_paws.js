'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: quick_paws
//  +N per hand remaining this round (flat score bonus)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['quick_paws'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const scoreBonus = amt * G.hands;
      return { scoreBonus };
    };
  },
};
