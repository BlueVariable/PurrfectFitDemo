'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnado
//  ×N all cats (ALL SAME TYPE req handled by requirementFails)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnado'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, extractMul(ef));
  },
};
