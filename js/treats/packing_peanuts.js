'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: packing_peanuts
//  +N flat score bonus (trio shape is the point; nothing
//  special in the scoring code).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['packing_peanuts'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => ({ scoreBonus: extractNum(ef) });
  },
};
