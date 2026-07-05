'use strict';
TREAT_REGISTRY['poker_face'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bonus = extractNum(ef) * G.disc;
      return { scoreBonus: bonus };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'poker_face');
    if (!td) return null;
    const per = extractNum(td.ef);
    return `Now: +${per * (G.disc || 0)}`;
  },
};
