'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REQUIREMENTS
//  requirementFails(req) → true if the requirement is
//  NOT currently met (treat should show warning).
//  req is the string from the sheet's Requirement column.
// ══════════════════════════════════════════════════════
const REQUIREMENT_FNS = {
  'NO OTHER TREAT': () => G.treats.length > 1,
  'NO SAME TYPE ADJACENT': () => {
    for (const cat of G.cats) {
      for (const other of G.cats) {
        if (cat.gid === other.gid || cat.type !== other.type) continue;
        const adj = cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
        if (adj) return true;
      }
    }
    return false;
  },
  'NEEDS ORANGE':   () => !G.cats.some(c => c.type === 'orange'),
  'ALL SAME TYPE':  () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'BOARD FULL': () => G.board.flat().filter(c=>c.filled).length < G.bsr*G.bsc,
  'LAST HAND':            () => G.hands > 1,
  'NO DISCARDS REMAINING': () => G.disc > 0,
  "SAME TYPE cats can't be adjacent to each other": () => {
    for (const cat of G.cats) {
      for (const other of G.cats) {
        if (cat.gid === other.gid || cat.type !== other.type) continue;
        const adj = cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
        if (adj) return true;
      }
    }
    return false;
  },
  'All cats must be of the SAME TYPE': () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'All cats must be of the SAME SHAPE': () => {
    const shapes = [...new Set(G.cats.map(c => c.shape))];
    return shapes.length > 1;
  },
  'All BOARD cells are FULL': () => G.board.flat().filter(c=>c.filled).length < G.bsr*G.bsc,
  'LAST HAND only': () => G.hands > 1,
  'FIRST HAND only': () => G.hands !== G.maxHands,
};

function requirementFails(req) {
  if (!req) return false;
  const fn = REQUIREMENT_FNS[req];
  return fn ? fn() : false;
}
