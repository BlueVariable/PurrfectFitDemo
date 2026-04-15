'use strict';
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    const decM = (addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      const amt = Math.max(0, baseAmt - dec * alreadyScored);
      return { scoreBonus: amt };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'big_bite');
    if (!td) return null;
    const baseAmt = extractNum(td.ef);
    const decM = (td.addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    const placed = G.cats.length;
    const cur = Math.max(0, baseAmt - dec * placed);
    return `Now: +${cur}`;
  },
};
