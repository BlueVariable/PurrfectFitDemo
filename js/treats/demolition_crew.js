'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: demolition_crew
//  +N per BLOCKED cell adjacent to this treat
//  Same 8-neighborhood convention as snack_stack / surrAdd.
//  Each blocked cell counts once, even if it touches
//  multiple treat cells.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['demolition_crew'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const adjBlocked = new Set();
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].blocked)
            adjBlocked.add(rr + ',' + cc);
        }
      });
      return { scoreBonus: amt * adjBlocked.size };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'demolition_crew');
    if (!td) return null;
    const bt = (G.treats || []).find(t => t.tdef && t.tdef.id === 'demolition_crew');
    if (!bt || !G.board || !G.board.length) return null;
    const adjBlocked = new Set();
    bt.cells.forEach(([tr, tc]) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = tr + dr, cc = tc + dc;
        if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && G.board[rr][cc].blocked)
          adjBlocked.add(rr + ',' + cc);
      }
    });
    return `Now: +${extractNum(td.ef) * adjBlocked.size}`;
  },
};
