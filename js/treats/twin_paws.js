'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: twin_paws
//  ×N cats ADJACENT to a cat of the SAME SHAPE
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['twin_paws'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = cats.filter(cat => G.cats.some(other => {
        if (other.gid === cat.gid || other.shape !== cat.shape) return false;
        return cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
      })).map(cat => cat.gid);
      return { gids, m };
    };
  },
};
