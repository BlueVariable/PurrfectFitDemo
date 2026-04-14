'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: laser
//  Copies the ability of 1 random treat from inventory
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['laser'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const pool = G.bpGroups.filter(grp =>
        grp.tdef.id !== 'laser' &&
        grp.tdef.phase !== 'x' &&
        grp.tdef.phase !== 'misc'
      );
      if (!pool.length) return { type: 'x', skip: true };
      const target = pool[Math.floor(Math.random() * pool.length)];
      const result = target.tdef.fn(b, cats, ts, p, cs);
      if (result.scoreMultiplier) return { scoreMultiplier: true, m: result.m, copiedFrom: target.tdef, laserCells: p };
      return { type: 'x', subPhase: target.tdef.phase, result, copiedFrom: target.tdef, laserCells: p };
    };
  },
};
