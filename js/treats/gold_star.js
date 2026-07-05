'use strict';
TREAT_REGISTRY['gold_star'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bonus = extractNum(ef) * (G.purrfectsThisRound || 0);
      return { scoreBonus: bonus };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'gold_star');
    if (!td) return null;
    const per = extractNum(td.ef);
    return `Now: +${per * (G.purrfectsThisRound || 0)}`;
  },
};
