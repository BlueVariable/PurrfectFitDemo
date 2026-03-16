'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: sardine_tin
//  x-phase: destroy one random surrounding cat from deck
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['sardine_tin'] = {
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
      const matchIdx = G.deck.findIndex(card => card.type === grp.type);
      if (matchIdx === -1) return { type: 'x', skip: true };
      const removed = G.deck.splice(matchIdx, 1)[0];
      return { type: 'x', destroyedCat: { em: removed.em, name: removed.name, type: removed.type } };
    };
  },
};
