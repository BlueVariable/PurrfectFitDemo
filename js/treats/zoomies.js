'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: zoomies
//  Removes surrounding blocked cells at placement time
//  (8-neighbour unblock around every treat cell).
//  Scoring fn just reports how many cells were cleared.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['zoomies'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const me = ts.find(t => t.cells === p);
      const n = me && me._zoomiesCleared || 0;
      return { type: 'x', zoomiesCleared: n };
    };
  },
  onPlace(treatInstance, board) {
    const cleared = [];
    treatInstance.cells.forEach(([r, c]) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= G.bsr || cc < 0 || cc >= G.bsc) continue;
        if (board[rr][cc].blocked) {
          board[rr][cc].blocked = false;
          if (G.blockedMask && G.blockedMask[rr]) G.blockedMask[rr][cc] = false;
          cleared.push([rr, cc]);
        }
      }
    });
    treatInstance._zoomiesCleared = cleared.length;
    return cleared;
  },
};
