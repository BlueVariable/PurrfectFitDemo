'use strict';
TREAT_REGISTRY['crowd_pleaser'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'crowd_pleaser')?.tdef;
      if (selfTdef) { if (Math.random() >= 0.5) selfTdef._expired = true; else selfTdef._reappear = true; }
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
