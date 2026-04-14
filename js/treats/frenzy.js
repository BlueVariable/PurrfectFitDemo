'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frenzy
//  +100 to score if all surrounding cats are same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['frenzy'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const adjGids = new Set();
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'cat' && b[rr][cc].gid)
            adjGids.add(b[rr][cc].gid);
        }
      });
      if (!adjGids.size) return {};
      const adjCats = [...adjGids].map(gid => G.cats.find(c => c.gid === gid)).filter(Boolean);
      if (!adjCats.length) return {};
      const types = [...new Set(adjCats.map(c => c.type))];
      if (types.length > 1) return {};
      return { scoreBonus: extractNum(ef) };
    };
  },
};
