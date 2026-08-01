'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: alley_gang
//  ×N cats ENTIRELY on the board EDGE — every cell of the cat must be an
//  edge cell. Edge cell = playable cell on the grid boundary, OR
//  orthogonally adjacent to an offShape cell (irregular "Wildcat Chaos"
//  silhouettes). Blocked cells sit inside the silhouette and do NOT
//  create edges. Retuned 2026-08-01 from "touching the edge" (.some):
//  on these small polyomino boards 80-100% of placed cats touch the rim,
//  which made the old wording an unconditional ×2-all-cats.
//  Affects rim-hugging cats that fire at/after this treat in scan order.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['alley_gang'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats) => {
      const isEdge = (r, c) => {
        if (r === 0 || c === 0 || r === G.bsr - 1 || c === G.bsc - 1) return true;
        // Interior cell: all 4 orthogonal neighbours are in-grid.
        return b[r - 1][c].offShape || b[r + 1][c].offShape ||
               b[r][c - 1].offShape || b[r][c + 1].offShape;
      };
      const gids = cats.filter(cat => cat.cells.every(([r, c]) => isEdge(r, c))).map(cat => cat.gid);
      return { gids, m };
    };
  },
};
