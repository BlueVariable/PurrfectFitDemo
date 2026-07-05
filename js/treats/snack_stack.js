'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: snack_stack
//  +N per OTHER TREAT adjacent to this one
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['snack_stack'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const adjGids = new Set();
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'treat' && b[rr][cc].gid)
            adjGids.add(b[rr][cc].gid);
        }
      });
      const me = ts.find(t => t.cells === p);
      if (me) adjGids.delete(me.gid);
      return { scoreBonus: amt * adjGids.size };
    };
  },
};
