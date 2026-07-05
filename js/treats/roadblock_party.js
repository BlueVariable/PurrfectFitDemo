'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: roadblock_party
//  +N per BLOCKED cell on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['roadblock_party'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let count = 0;
      for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++) if (b[r][c].blocked) count++;
      return { scoreBonus: amt * count };
    };
  },
};
