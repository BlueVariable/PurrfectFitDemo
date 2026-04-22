'use strict';
TREAT_REGISTRY['mixed_company'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const bonusMap = {};
      for (const grp of cats) {
        let hasDiffNeighbor = false;
        for (const [r, c] of grp.cells) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= b.length || nc < 0 || nc >= b[0].length) continue;
              const cell = b[nr][nc];
              if (cell.filled && cell.kind === 'cat' && cell.type !== grp.type) {
                hasDiffNeighbor = true;
              }
            }
          }
        }
        if (hasDiffNeighbor) bonusMap[grp.gid] = amt;
      }
      return { bonusMap };
    };
  },
};
