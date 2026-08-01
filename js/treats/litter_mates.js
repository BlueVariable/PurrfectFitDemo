'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: litter_mates
//  +N each cat ADJACENT to a cat of the SAME TYPE — the type twin of
//  twin_paws' same-shape test (8-adjacency), but as a Type A ADD:
//  the bonus lands on each matched cat's own score, so it rides any
//  multiplier that hits those cats later in the scan. Redesigned from
//  a ×1.5 mul 2026-08-01 (design owner call) — with 4 cat types a
//  same-type neighbour is common (~60% of packed cats), which suits a
//  wide flat better than a wide multiplier.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['litter_mates'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const bonusMap = {};
      cats.forEach(cat => {
        const matched = G.cats.some(other => {
          if (other.gid === cat.gid || other.type !== cat.type) return false;
          return cat.cells.some(([r, c]) =>
            other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
          );
        });
        if (matched) bonusMap[cat.gid] = amt;
      });
      return { bonusMap };
    };
  },
};
