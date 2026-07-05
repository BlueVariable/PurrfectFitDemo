'use strict';
TREAT_REGISTRY['fence_sitter'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bonus = extractNum(ef) * (G.discUsedRound || 0);
      return { scoreBonus: bonus };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'fence_sitter');
    if (!td) return null;
    const per = extractNum(td.ef);
    return `Now: +${per * (G.discUsedRound || 0)}`;
  },
};
