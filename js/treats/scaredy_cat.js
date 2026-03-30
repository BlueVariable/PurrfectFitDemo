'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: scaredy_cat
//  +N to cats with NO adjacent cat neighbors (8-way)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['scaredy_cat'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const bonusMap = {};
      cats.forEach(grp => {
        const isolated = !grp.cells.some(([r, c]) => {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < G.bsr && nc >= 0 && nc < G.bsc) {
              const cell = b[nr][nc];
              if (cell.kind === 'cat' && cell.gid && cell.gid !== grp.gid) return true;
            }
          }
          return false;
        });
        if (isolated) bonusMap[grp.gid] = amt;
      });
      return { bonusMap };
    };
  },
};
