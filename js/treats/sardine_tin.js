'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: sardine_tin
//  Destroys random surrounding cats from deck
//  +1 more cat destroyed per trigger
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['sardine_tin'] = {
  buildFn(ef, phase, addEf) {
    let increment = 1;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.sardine_tin || 0;
      const count = 1 + Math.round(plays * increment);
      G.treatPlayCounts.sardine_tin = plays + 1;
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
      let lastDestroyed = null;
      for (let i = 0; i < count; i++) {
        const chosenGid = gidArr[Math.floor(Math.random() * gidArr.length)];
        const grp = cats.find(c => c.gid === chosenGid) || G.cats.find(c => c.gid === chosenGid);
        if (!grp) continue;
        const matchIdx = G.deck.findIndex(card => card.type === grp.type);
        if (matchIdx === -1) continue;
        const removed = G.deck.splice(matchIdx, 1)[0];
        lastDestroyed = removed;
      }
      if (!lastDestroyed) return { type: 'x', skip: true };
      return { type: 'x', destroyedCat: { em: lastDestroyed.em, name: lastDestroyed.name, type: lastDestroyed.type } };
    };
  },
};
