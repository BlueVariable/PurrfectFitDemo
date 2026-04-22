'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: second_breakfast
//  Retrigger all cats (add base score for future cats).
//  1 in 2 chance disappear after use.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['second_breakfast'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'second_breakfast')?.tdef;
      if (Math.random() < 0.5 && selfTdef) selfTdef._expired = true;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = grp.cells.length * 10; });
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, totalBonus };
    };
  },
};
