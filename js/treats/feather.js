'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: feather
//  +N to cats in same column as treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['feather'] = {
  buildFn(ef, phase) {
    // Type B (mirrors catnip): +N per cat in the treat's column, all counted.
    return (b, c, ts, p) => {
      const { bonus } = colAdd(b, p, extractNum(ef));
      return { scoreBonus: bonus };
    };
  },
};
