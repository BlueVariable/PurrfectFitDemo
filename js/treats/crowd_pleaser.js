'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: crowd_pleaser
//  +N per cat placed on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['crowd_pleaser'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bonus = extractNum(ef) * G.cats.length;
      return { scoreBonus: bonus };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'crowd_pleaser');
    if (!td) return null;
    const per = extractNum(td.ef);
    return `Now: +${per * (G.cats.length || 0)}`;
  },
};
