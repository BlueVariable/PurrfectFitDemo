'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnip
//  +N to cats in same row as treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnip'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const { bonus } = rowAdd(b, p, extractNum(ef));
      return { scoreBonus: bonus };
    };
  },
};
