'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: treat_encore
//  Retrigger all treats (add + mul phase).
//  1 in 2 chance disappear after use.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['treat_encore'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'treat_encore')?.tdef;
      if (Math.random() < 0.5 && selfTdef) selfTdef._expired = true;
      const pool = ts.filter(t => t.tdef.id !== 'treat_encore' && (t.tdef.phase === 'add' || t.tdef.phase === 'mul'));
      if (!pool.length) return { type: 'x', skip: true };
      const bonusMap = {};
      const mulMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = 0; mulMap[grp.gid] = 1; });
      const savedPlayCounts = Object.assign({}, G.treatPlayCounts);
      pool.forEach(t => {
        const res = t.tdef.fn(b, cats, ts, t.cells, cs);
        if (!res) return;
        if (t.tdef.phase === 'add') {
          if (res.bonusMap) {
            Object.entries(res.bonusMap).forEach(([gid, amt]) => {
              if (bonusMap[gid] !== undefined) bonusMap[gid] += amt;
            });
          } else if (res.bonus) {
            const ef2 = t.tdef.ef;
            const amt2 = extractNum(ef2);
            const [tRow, tCol] = t.cells[0];
            cats.forEach(grp => {
              let hit = false;
              if (ef2.includes('ALL')) hit = true;
              else if (ef2.includes('ROW')) hit = grp.cells.some(([r]) => r === tRow);
              else if (ef2.includes('COL')) hit = grp.cells.some(([, c]) => c === tCol);
              else if (ef2.includes('SURR') || ef2.includes('surrounding'))
                hit = t.cells.some(([tr, tc]) => grp.cells.some(([r, c]) => Math.abs(r - tr) <= 1 && Math.abs(c - tc) <= 1));
              else hit = true;
              if (hit && bonusMap[grp.gid] !== undefined) bonusMap[grp.gid] += amt2;
            });
          }
        } else if (t.tdef.phase === 'mul') {
          if (res.gids && res.m) {
            res.gids.forEach(gid => { if (mulMap[gid] !== undefined) mulMap[gid] *= res.m; });
          }
        }
      });
      Object.assign(G.treatPlayCounts, savedPlayCounts);
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, mulMap, totalBonus };
    };
  },
};
