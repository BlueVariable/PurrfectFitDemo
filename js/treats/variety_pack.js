'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: variety_pack
//  ×(unique cat shape count) ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['variety_pack'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const m = new Set(cats.map(c => c.shape)).size;
      if (!m) return { gids: [], m: 1 };
      return allMulCS(cats, cs, m);
    };
  },
};
