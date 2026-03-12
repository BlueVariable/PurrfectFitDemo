'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: laser
//  Copies the ability of one random non-x treat, applied at laser's position
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['laser'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const pool = ts.filter(t => t.tdef.id !== 'laser' && t.tdef.phase !== 'x');
      if (!pool.length) return { type: 'x', skip: true };
      const target = pool[Math.floor(Math.random() * pool.length)];
      const result = target.tdef.fn(b, cats, ts, p, cs);
      return { type: 'x', subPhase: target.tdef.phase, result, copiedFrom: target.tdef, laserCells: p };
    };
  },
};
