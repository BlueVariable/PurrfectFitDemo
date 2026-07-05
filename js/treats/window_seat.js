'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: window_seat
//  +N per cat in the TOP ROW (topmost board row with any
//  playable — not blocked, not off-shape — cell)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['window_seat'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let topRow = -1;
      for (let r = 0; r < G.bsr; r++) {
        let hasPlayable = false;
        for (let c = 0; c < G.bsc; c++) {
          if (!b[r][c].blocked && !b[r][c].offShape) { hasPlayable = true; break; }
        }
        if (hasPlayable) { topRow = r; break; }
      }
      if (topRow === -1) return { scoreBonus: 0 };
      const gids = new Set();
      for (let c = 0; c < G.bsc; c++) {
        if (b[topRow][c].kind === 'cat' && b[topRow][c].gid) gids.add(b[topRow][c].gid);
      }
      return { scoreBonus: gids.size * amt };
    };
  },
};
