'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: siamese_twins
//  Change one random cat's type to match an adjacent cat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['siamese_twins'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      if (cats.length < 2) return { type: 'x', skip: true };
      // find cat groups that have at least one neighbor of a different type
      const candidates = [];
      cats.forEach(grp => {
        const neighborTypes = new Set();
        grp.cells.forEach(([r, c]) => {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'cat' && b[rr][cc].gid && b[rr][cc].gid !== grp.gid) {
              const neighbor = cats.find(g => g.gid === b[rr][cc].gid);
              if (neighbor && neighbor.type !== grp.type) neighborTypes.add(neighbor.type);
            }
          }
        });
        if (neighborTypes.size > 0) candidates.push({ grp, neighborTypes: [...neighborTypes] });
      });
      if (!candidates.length) return { type: 'x', skip: true };
      // pick a random candidate and change its type to a random neighbor type
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const newType = pick.neighborTypes[Math.floor(Math.random() * pick.neighborTypes.length)];
      const oldType = pick.grp.type;
      pick.grp.type = newType;
      // update board cells to reflect new type
      pick.grp.cells.forEach(([r, c]) => {
        if (b[r][c].gid === pick.grp.gid) {
          b[r][c].col = COLS[newType] || b[r][c].col;
          b[r][c].em = EMS[newType] || b[r][c].em;
          b[r][c].type = newType;
        }
      });
      return { type: 'x', convertedGid: pick.grp.gid, oldType, newType, convertedEm: EMS[newType] || '🐱' };
    };
  },
};
