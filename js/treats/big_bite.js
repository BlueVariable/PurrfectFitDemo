'use strict';
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    const decM = (addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    return (b, cats, ts, p, cs) => {
      // Cumulative over the RUN: cats scored in all prior fits (G.catsScoredRun,
      // persists across rounds) + cats scored earlier in THIS fit's scan. The
      // run counter has not yet folded in this fit (doFit adds it after the scan).
      const priorRun = G.catsScoredRun || 0;
      const thisFit = G.cats.length - cats.length;
      const amt = Math.max(0, baseAmt - dec * (priorRun + thisFit));
      return { scoreBonus: amt };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'big_bite');
    if (!td) return null;
    const baseAmt = extractNum(td.ef);
    const decM = (td.addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    const priorRun = G.catsScoredRun || 0;
    const placed = G.cats.length; // worst case: big_bite fires after every placed cat this fit
    const cur = Math.max(0, baseAmt - dec * (priorRun + placed));
    return `Now: +${cur}`;
  },
};
