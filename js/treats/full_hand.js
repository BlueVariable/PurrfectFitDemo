'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: full_hand
//  ×2 per card still in hand (linear) to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['full_hand'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const m = 2 * G.hand.length;
      if (!m) return { gids: [], m: 1 };
      return allMulCS(cats, cs, m);
    };
  },
};
