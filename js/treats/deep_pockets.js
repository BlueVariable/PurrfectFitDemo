'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: deep_pockets
//  ×(cash held ÷ 5) ALL cats — minimum ×1
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['deep_pockets'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const m = Math.max(1, G.cash / 5);
      return allMulCS(cats, cs, m);
    };
  },
};
