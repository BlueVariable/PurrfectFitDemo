'use strict';
// Decay is measured from PURCHASE, not from the start of the run:
// G.bigBiteBuyCats snapshots G.catsScoredRun at buy time (shopDropOnBP, the
// purrfect_record idiom — undefined until first bought, wiped by newGame).
// Cats scored before the treat was owned never eat the bonus, so a late-run
// buy still opens at the full base amount.
function _bigBiteCatsSinceBuy() {
  const runNow = G.catsScoredRun || 0;
  const buyBase = G.bigBiteBuyCats === undefined ? runNow : G.bigBiteBuyCats;
  return Math.max(0, runNow - buyBase);
}

TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    const decM = (addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    return (b, cats, ts, p, cs) => {
      // Cats since purchase + cats scored earlier in THIS fit's scan. The run
      // counter has not yet folded in this fit (doFit adds it after the scan).
      const thisFit = G.cats.length - cats.length;
      const amt = Math.max(0, baseAmt - dec * (_bigBiteCatsSinceBuy() + thisFit));
      return { scoreBonus: amt };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'big_bite');
    if (!td) return null;
    const baseAmt = extractNum(td.ef);
    const decM = (td.addEf || '').match(/(\d+)/);
    const dec = decM ? parseInt(decM[1]) : 1;
    const placed = G.cats.length; // worst case: big_bite fires after every placed cat this fit
    const cur = Math.max(0, baseAmt - dec * (_bigBiteCatsSinceBuy() + placed));
    return `Now: +${cur}`;
  },
};
