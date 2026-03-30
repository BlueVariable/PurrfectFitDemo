'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: empty_nest
//  ×floor(empty backpack cells ÷ 4) ALL cats
//  e.g. 12 empty cells → ×3, 8 empty → ×2
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['empty_nest'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const emptyCells = G.bp.flat().filter(c => !c.filled).length;
      const m = Math.floor(emptyCells / 4);
      if (!m) return { gids: [], m: 1 };
      return allMulCS(cats, cs, m);
    };
  },
};
