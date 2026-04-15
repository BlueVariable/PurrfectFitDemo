'use strict';
TREAT_REGISTRY['purrfect_record'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const baseFits = G.purrfectRecordBuyFits || 0;
      const basePurrfects = G.purrfectRecordBuyPurrfects || 0;
      const fitsSince = (G.totalFits || 0) - baseFits;
      const purrfectsSince = (G.totalPurrfects || 0) - basePurrfects;
      const missesSince = Math.max(0, fitsSince - purrfectsSince);
      const net = purrfectsSince - missesSince;
      const m = Math.max(0.1, Math.round((baseM + 0.1 * net) * 100) / 100);
      return { scoreMultiplier: true, m };
    };
  },
};
