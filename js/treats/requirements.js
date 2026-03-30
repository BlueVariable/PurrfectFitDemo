'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REQUIREMENTS
//  requirementFails(req) → true if the requirement is
//  NOT currently met (treat should show warning).
//  req is the string from the sheet's Requirement column.
// ══════════════════════════════════════════════════════
const REQUIREMENT_FNS = {
  'NO OTHER TREAT': () => G.treats.length > 1,
  'NEEDS ORANGE':   () => !G.cats.some(c => c.type === 'orange'),
  'ALL SAME TYPE':  () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'BOARD FULL': () => G.board.flat().filter(c=>c.filled).length < G.bsr*G.bsc,
  'LAST HAND':  () => G.hands > 1,
};

function requirementFails(req) {
  if (!req) return false;
  const fn = REQUIREMENT_FNS[req];
  return fn ? fn() : false;
}
