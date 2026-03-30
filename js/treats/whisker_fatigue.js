'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: whisker_fatigue
//  +N to SURROUNDING cats, decreases by decrement each play (min 0)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['whisker_fatigue'] = {
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    let decrease = 0;
    if (addEf) {
      const im = addEf.match(/(\d+)/);
      if (im) decrease = parseInt(im[1]);
    }
    return (b, cats, ts, p) => {
      const plays = G.treatPlayCounts.whisker_fatigue || 0;
      const amt = Math.max(0, baseAmt - plays * decrease);
      G.treatPlayCounts.whisker_fatigue = plays + 1;
      if (!amt) return { bonusMap: {} };
      const adjGids = new Set();
      p.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = tr + dr, nc = tc + dc;
          if (nr >= 0 && nr < G.bsr && nc >= 0 && nc < G.bsc && b[nr][nc].kind === 'cat' && b[nr][nc].gid)
            adjGids.add(b[nr][nc].gid);
        }
      });
      const bonusMap = {};
      adjGids.forEach(gid => { bonusMap[gid] = amt; });
      return { bonusMap };
    };
  },
};
