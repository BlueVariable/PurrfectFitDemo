'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cathouse
//  ×(1 + other treats) to SURROUNDING cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cathouse'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const m = ts.length; // 1 (self) + others = ts.length
      if (m <= 1) return { gids: [], m: 1 };
      return surrMulCS(b, cats, p, m, cs);
    };
  },
};
