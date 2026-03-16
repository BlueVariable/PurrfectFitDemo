'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_nap_stack
//  ×1.5 per treat on board (including self)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_nap_stack'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const treatCount = ts.length;
      if (treatCount <= 0) return { gids: [], m: 1 };
      const m = 1 + 0.5 * treatCount;
      return allMulCS(cats, cs, m);
    };
  },
};
