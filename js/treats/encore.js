'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: encore
//  Retrigger one random non-x treat on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['encore'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const pool = ts.filter(t => t.tdef.id !== 'encore' && t.tdef.phase !== 'x');
      if (!pool.length) return { type: 'x', skip: true };
      const target = pool[Math.floor(Math.random() * pool.length)];
      const result = target.tdef.fn(b, cats, ts, target.cells, cs);
      // If retriggered treat returns a scoreMultiplier (Type B), propagate directly
      if (result.scoreMultiplier) return { scoreMultiplier: true, m: result.m, copiedFrom: target.tdef, laserCells: p };
      return { type: 'x', subPhase: target.tdef.phase, result, copiedFrom: target.tdef, laserCells: p };
    };
  },
};
