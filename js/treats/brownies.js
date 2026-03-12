'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: brownies
//  Adds a duplicate of one random surrounding cat to G.deck
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['brownies'] = {
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
      if (!adjGids.size) return { type: 'x', skip: true };
      const gidArr = [...adjGids];
      const chosenGid = gidArr[Math.floor(Math.random() * gidArr.length)];
      const grp = cats.find(c => c.gid === chosenGid);
      if (!grp) return { type: 'x', skip: true };
      G.deck.push({ ...grp.cat, id: uid() });
      return { type: 'x', addedCatEm: grp.cat.em, addedCatName: grp.cat.name };
    };
  },
};
