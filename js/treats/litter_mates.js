'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: litter_mates
//  ×N cats ADJACENT to a cat of the SAME TYPE — the type twin of
//  twin_paws (same 8-adjacency test, type instead of shape). Tuned a
//  tier below it: with 4 cat types vs 13 shapes, a same-type neighbour
//  is ~3× as common as a same-shape one, so the shape twin keeps the
//  legendary ×2 and this one is an epic ×1.5.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['litter_mates'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = cats.filter(cat => G.cats.some(other => {
        if (other.gid === cat.gid || other.type !== cat.type) return false;
        return cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
      })).map(cat => cat.gid);
      return { gids, m };
    };
  },
};
