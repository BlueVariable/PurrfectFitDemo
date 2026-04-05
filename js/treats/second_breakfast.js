'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: second_breakfast
//  Retrigger all cats (add base score for future cats).
//  Disappears after 3 uses.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['second_breakfast'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'second_breakfast')?.tdef;
      const plays = (G.treatPlayCounts.second_breakfast || 0) + 1;
      G.treatPlayCounts.second_breakfast = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = grp.cells.length * 10; });
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, totalBonus };
    };
  },
};
