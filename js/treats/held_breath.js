'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: held_breath
//  ×(discards remaining + 1) ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['held_breath'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const m = G.disc + 1;
      return allMulCS(cats, cs, m);
    };
  },
};
