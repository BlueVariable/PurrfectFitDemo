'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: mirror
//  Re-applies all add-phase treats a second time
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['mirror'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const addTreats = ts.filter(t => t.tdef.id !== 'mirror' && t.tdef.phase === 'add');
      if (!addTreats.length) return { type: 'x', skip: true };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = 0; });
      // Save play counts so mirror re-application doesn't double-increment (e.g. cathouse)
      const savedPlayCounts = Object.assign({}, G.treatPlayCounts);
      addTreats.forEach(at => {
        const res = at.tdef.fn(b, cats, ts, at.cells, cs);
        if (!res) return;
        if (res.bonusMap) {
          Object.entries(res.bonusMap).forEach(([gid, amt]) => {
            if (bonusMap[gid] !== undefined) bonusMap[gid] += amt;
          });
        } else if (res.bonus) {
          const ef2 = at.tdef.ef;
          const amt2 = extractNum(ef2);
          const [tRow, tCol] = at.cells[0];
          cats.forEach(grp => {
            let hit = false;
            if (ef2.includes('ALL')) hit = true;
            else if (ef2.includes('ROW')) hit = grp.cells.some(([r]) => r === tRow);
            else if (ef2.includes('COL')) hit = grp.cells.some(([,c]) => c === tCol);
            else if (ef2.includes('SURR') || ef2.includes('surrounding'))
              hit = at.cells.some(([tr,tc]) => grp.cells.some(([r,c]) => Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
            else hit = true;
            if (hit && bonusMap[grp.gid] !== undefined) bonusMap[grp.gid] += amt2;
          });
        }
      });
      // Restore play counts so mirror doesn't double-increment scaling treats
      Object.assign(G.treatPlayCounts, savedPlayCounts);
      // Apply to actual catScores
      Object.entries(bonusMap).forEach(([gid, amt]) => {
        if (cs[gid] !== undefined) cs[gid] += amt;
      });
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, totalBonus };
    };
  },
};
