'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: gentle_giant
//  ×2 cats with 4+ cells
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['gentle_giant'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats) => {
      const gids = cats.filter(c => c.cells.length >= 4).map(c => c.gid);
      return { gids, m };
    };
  },
};
