'use strict';
TREAT_REGISTRY['poker_face'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'poker_face')?.tdef;
      if (selfTdef) { if (Math.random() >= 0.5) selfTdef._expired = true; else selfTdef._reappear = true; }
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
