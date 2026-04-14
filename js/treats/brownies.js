'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: brownies
//  Adds duplicates of random surrounding cats to G.deck
//  +1 more cat added per trigger
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['brownies'] = {
  buildFn(ef, phase, addEf) {
    let increment = 1;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.brownies || 0;
      const count = 1 + Math.round(plays * increment);
      G.treatPlayCounts.brownies = plays + 1;
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
      if (!adjGids.size) return { type: 'x', skip: true };
      const gidArr = [...adjGids];
      let lastAdded = null;
      for (let i = 0; i < count; i++) {
        const chosenGid = gidArr[Math.floor(Math.random() * gidArr.length)];
        const grp = cats.find(c => c.gid === chosenGid) || G.cats.find(c => c.gid === chosenGid);
        if (!grp) continue;
        G.deck.push({ ...grp.cat, id: uid() });
        lastAdded = grp;
      }
      if (!lastAdded) return { type: 'x', skip: true };
      return { type: 'x', addedCatEm: lastAdded.cat.em, addedCatName: lastAdded.cat.name };
    };
  },
};
