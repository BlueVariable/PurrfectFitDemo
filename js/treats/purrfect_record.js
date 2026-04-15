'use strict';
function _purrfectRecordCurrentM() {
  const td = TDEFS.find(t => t.id === 'purrfect_record');
  if (!td) return 1;
  const baseM = extractMul(td.ef);
  const baseFits = G.purrfectRecordBuyFits || 0;
  const basePurrfects = G.purrfectRecordBuyPurrfects || 0;
  const fitsSince = (G.totalFits || 0) - baseFits;
  const purrfectsSince = (G.totalPurrfects || 0) - basePurrfects;
  const missesSince = Math.max(0, fitsSince - purrfectsSince);
  const net = purrfectsSince - missesSince;
  return Math.max(0.1, Math.round((baseM + 0.1 * net) * 100) / 100);
}

TREAT_REGISTRY['purrfect_record'] = {
  buildFn(ef, phase, addEf) {
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m: _purrfectRecordCurrentM() };
    };
  },
  currentValue() {
    return `Now: ×${_purrfectRecordCurrentM()}`;
  },
};
