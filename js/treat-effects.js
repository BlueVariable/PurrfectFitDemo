'use strict';
// ══════════════════════════════════════════════════════
//  TREAT EFFECTS
//  Add-treats return {bonus, desc} — bonus is added to affected catScores
//  Mul-treats return {gids:[], m:N} — engine multiplies those catScores by m
// ══════════════════════════════════════════════════════

// ── Add helpers — bonus is +amt per affected cat GROUP (flat, not per cell) ──
function surrAdd(b,cells,amt){
  // cells = array of [r,c] for all treat cells
  const allTCells=Array.isArray(cells[0])?cells:[cells];
  const adjGids=new Set();
  allTCells.forEach(([tr,tc])=>{
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=tr+dr,cc=tc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc&&b[rr][cc].kind==='cat'&&b[rr][cc].gid)
        adjGids.add(b[rr][cc].gid);
    }
  });
  const n=adjGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} adj cats`};
}
function rowAdd(b,cells,amt){
  const r=Array.isArray(cells[0])?cells[0][0]:cells[0];
  const affGids=new Set();
  for(let c=0;c<G.bsc;c++) if(b[r][c].kind==='cat'&&b[r][c].gid) affGids.add(b[r][c].gid);
  const n=affGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} cats in row`};
}
function colAdd(b,cells,amt){
  const col=Array.isArray(cells[0])?cells[0][1]:cells[1];
  const affGids=new Set();
  for(let rr=0;rr<G.bsr;rr++) if(b[rr][col].kind==='cat'&&b[rr][col].gid) affGids.add(b[rr][col].gid);
  const n=affGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} cats in col`};
}
function allAdd(cats,amt){
  return{bonus:cats.length*amt,desc:`+${amt}×${cats.length} cats`};
}

// ── Mul helpers — return {gids, m} so engine applies to real catScores ──
function allMulCS(cats,cs,m){
  return{gids:cats.map(c=>c.gid),m};
}
function colMul(b,cats,cells,m){
  const col=Array.isArray(cells[0])?cells[0][1]:cells[1];
  const gids=cats.filter(grp=>grp.cells.some(([,cc])=>cc===col)).map(grp=>grp.gid);
  return{gids,m};
}
function surrMulCS(b,cats,cells,m,cs){
  const allTCells=Array.isArray(cells[0])?cells:[cells];
  const adjGids=new Set();
  allTCells.forEach(([tr,tc])=>{
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=tr+dr,cc=tc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc&&b[rr][cc].kind==='cat'&&b[rr][cc].gid)
        adjGids.add(b[rr][cc].gid);
    }
  });
  return{gids:[...adjGids],m};
}
function shapeMul(cats,shapes,m){
  const gids=cats.filter(c=>shapes.includes(c.shape)).map(c=>c.gid);
  return{gids,m};
}
