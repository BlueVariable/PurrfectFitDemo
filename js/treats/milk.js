'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: milk
//  +N per surrounding cat added to score (Type B)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['milk'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const { bonus } = surrAdd(b, p, extractNum(ef));
      return { scoreBonus: bonus };
    };
  },
};
