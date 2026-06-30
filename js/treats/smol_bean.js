'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: smol_bean
//  ×N cats with 3 or fewer cells (mirror of gentle_giant)
//  Affects small cats that fire at/after this treat in scan order.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['smol_bean'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats) => {
      const gids = cats.filter(c => c.cells.length <= 3).map(c => c.gid);
      return { gids, m };
    };
  },
};
