'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: fat_cat
//  ×1 +0.1 per $10 of CASH held — Type B mul evaluated at
//  scoring time against G.cash (cash converts to score
//  only while held; spending it in the shop weakens this)
// ══════════════════════════════════════════════════════
function _fatCatM(ef) {
  const bm = ef.match(/[×x]([\d.]+)/);
  const base = bm ? parseFloat(bm[1]) : 1;
  const sm = ef.match(/\+([\d.]+)\s*per/);
  const step = sm ? parseFloat(sm[1]) : 0.1;
  const dm = ef.match(/\$(\d+)/);
  const per = dm ? parseInt(dm[1], 10) : 10;
  const steps = Math.floor((G.cash || 0) / per);
  return Math.round((base + step * steps) * 100) / 100;
}

TREAT_REGISTRY['fat_cat'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m: _fatCatM(ef) };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'fat_cat');
    if (!td) return null;
    return `Now: ×${_fatCatM(td.ef)}`;
  },
};
