'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: corner_office
//  +N if this treat sits in a CORNER — its cell has at most
//  2 orthogonally-adjacent playable neighbours (blocked/
//  off-shape/out-of-bounds neighbours don't count).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['corner_office'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const [r, c] = p[0];
      let playableNeighbors = 0;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && !b[rr][cc].blocked && !b[rr][cc].offShape) playableNeighbors++;
      });
      return { scoreBonus: playableNeighbors <= 2 ? amt : 0 };
    };
  },
};
