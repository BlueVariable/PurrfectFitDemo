'use strict';
// ══════════════════════════════════════════════════════
//  DEV MODE — Auto-fit
//
//  One-click branch-and-bound max-coverage solver + applier, ported from
//  AGENT_PLAYBOOK.md §7/§12 and js/sim/solver.js (REFERENCE ONLY — this file
//  has zero dependency on js/sim/*; it re-derives the same algorithm against
//  the live G/H the real UI uses). Placement is done exclusively through the
//  real game functions (pickupCat/pickupTreat/placeCatOnBoard/
//  placeTreatOnBoard) so the resulting board is indistinguishable from
//  manual play — scoring, the projected-score chip, and treat lifecycle all
//  stay authentic.
//
//  Scope simplifications (documented, not oversights):
//   - Only the FIRST HAND / LAST HAND *timing* requirements gate which
//     backpack treats are considered (matches js/sim/solver.js's
//     simEligibleTreats). Any other requirement (e.g. "ALL SAME TYPE") is
//     left for the real scoring pass to no-op if unmet — the treat still
//     helps fill the board even on a hand where its bonus text can't fire.
//   - The plan is computed once up front and applied in order. A treat with
//     an onPlace side effect that changes the board (zoomies unblocking
//     neighbours) can open cells mid-application that this run won't
//     backfill — a full re-solve-after-each-placement loop was judged not
//     worth the added complexity/risk for a dev tool.
// ══════════════════════════════════════════════════════

const DEVFIT_NODE_CAP=200000;
const DEVFIT_TIME_BUDGET_MS=1500;
const DEVFIT_MAX_TREAT_PIECES=4;

// Normalize a 0/1 grid to its list of [dr,dc] cells, trimmed to (0,0)-origin
// and sorted row-major (dedupes rotations of symmetric shapes).
function devfitNormCells(cells){
  const flat=[];
  cells.forEach((row,dr)=>row.forEach((v,dc)=>{if(v)flat.push([dr,dc]);}));
  if(!flat.length)return[];
  const minR=Math.min(...flat.map(p=>p[0])),minC=Math.min(...flat.map(p=>p[1]));
  return flat.map(p=>[p[0]-minR,p[1]-minC]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
// All distinct rotations (0/90/180/270) of a shape, normalized + deduped.
function devfitRotationsFor(cellsBase){
  const seen=new Set(),out=[];
  for(let rot=0;rot<4;rot++){
    const nf=devfitNormCells(rotC(cellsBase,rot));
    const key=JSON.stringify(nf);
    if(!seen.has(key)){seen.add(key);out.push(nf);}
  }
  return out;
}
function devfitCellCount(cells){
  return cells.reduce((s,row)=>s+row.reduce((a,b)=>a+(b?1:0),0),0);
}

// Group identical-rotation-set hand cats into one piece + an id pool — kills
// duplicate-permutation branching (playbook §12 change #1).
function devfitGroupHandPieces(hand){
  const byKey=new Map(),order=[];
  hand.forEach(cat=>{
    const rots=devfitRotationsFor(cat.cells);
    const key=JSON.stringify(rots);
    if(!byKey.has(key)){
      const grp={kind:'cat',rots,ids:[],size:devfitCellCount(cat.cells)};
      byKey.set(key,grp);order.push(grp);
    }
    byKey.get(key).ids.push(cat.id);
  });
  order.sort((a,b)=>b.size-a.size); // try larger pieces first (playbook §12 change #2 helper)
  return order;
}

// Backpack treats eligible for the CURRENT hand — only the FIRST HAND/LAST
// HAND timing gates from js/treats/requirements.js are checked pre-solve.
function devfitEligibleTreats(){
  return(G.bpGroups||[]).filter(grp=>{
    const req=grp.tdef.req;
    if(req==='FIRST HAND only')return G.hands===G.maxHands;
    if(req==='LAST HAND only'||req==='LAST HAND')return G.hands===1;
    return true;
  });
}
function devfitBuildTreatPiece(grp){
  return{kind:'treat',gid:grp.gid,tdef:grp.tdef,rots:devfitRotationsFor(grp.tdef.bpS),size:devfitCellCount(grp.tdef.bpS),used:false};
}

// Solve the currently OPEN board cells with the remaining hand + backpack.
// Pre-existing filled cells (from earlier manual/auto placements this fit)
// are left untouched and simply excluded from the search.
// Returns {filled,total,placements} — placements: [{kind:'cat',id,abs}|{kind:'treat',gid,abs}]
// filled/total are counted against the WHOLE playable board (existing + new).
function devfitSolve(){
  const R=G.bsr,C=G.bsc,playable=[];
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){
    const b=G.board[r][c];
    if(!b.blocked&&!b.offShape)playable.push([r,c]);
  }
  const total=playable.length;
  const occ={};
  let alreadyFilled=0;
  playable.forEach(([r,c])=>{
    const isFilled=!!G.board[r][c].filled;
    occ[r+','+c]=isFilled;
    if(isFilled)alreadyFilled++;
  });

  const catPieces=devfitGroupHandPieces(G.hand||[]);
  const eligible=devfitEligibleTreats()
    .sort((a,b)=>devfitCellCount(b.tdef.bpS)-devfitCellCount(a.tdef.bpS))
    .slice(0,DEVFIT_MAX_TREAT_PIECES);
  // Scan-order bias (playbook §10/§12): add-phase treats tried FIRST so they
  // tend to land on the earliest open cells; mul-phase treats tried LAST so
  // they tend to land on whatever's left (bottom-right-ish). Approximated by
  // piece TRY ORDER, same simplification js/sim/solver.js documents.
  const earlyTreats=eligible.filter(g=>g.tdef.phase!=='mul').map(devfitBuildTreatPiece);
  const lateTreats=eligible.filter(g=>g.tdef.phase==='mul').map(devfitBuildTreatPiece);
  const pieces=[...earlyTreats,...catPieces,...lateTreats];

  const cur=[];
  let filled=alreadyFilled,resolved=alreadyFilled;
  let best={filled,placements:[]};
  let nodeCount=0,stop=false;
  const t0=Date.now();

  function firstOpen(){for(const[r,c]of playable){if(!occ[r+','+c])return[r,c];}return null;}
  function canPlace(abs){
    return abs.every(([r,c])=>r>=0&&c>=0&&r<R&&c<C&&!G.board[r][c].blocked&&!G.board[r][c].offShape&&!occ[r+','+c]);
  }
  function snapshot(){return cur.map(p=>({kind:p.kind,id:p.id,gid:p.gid,abs:p.abs.slice()}));}

  function dfs(){
    nodeCount++;
    if(nodeCount>DEVFIT_NODE_CAP){stop=true;return;}
    if((nodeCount&2047)===0&&Date.now()-t0>DEVFIT_TIME_BUDGET_MS){stop=true;return;}
    if(filled>best.filled)best={filled,placements:snapshot()};
    if(filled===total){stop=true;return;} // perfect fill found — stop the whole search
    if(filled+(total-resolved)<=best.filled)return; // bound: rest of board can't beat best
    const fu=firstOpen();if(!fu)return;
    const[r,c]=fu;

    for(const p of pieces){
      if(stop)return;
      const avail=p.kind==='cat'?p.ids.length>0:!p.used;
      if(!avail)continue;
      for(const rt of p.rots){
        const a=rt[0],or=r-a[0],oc=c-a[1];
        const abs=rt.map(([dr,dc])=>[or+dr,oc+dc]);
        if(!canPlace(abs))continue;
        abs.forEach(([rr,cc])=>{occ[rr+','+cc]=true;});
        filled+=abs.length;resolved+=abs.length;
        let placedId;
        if(p.kind==='cat'){placedId=p.ids.pop();}else{p.used=true;}
        cur.push({kind:p.kind,id:placedId,gid:p.gid,abs});

        dfs();

        cur.pop();
        if(p.kind==='cat'){p.ids.push(placedId);}else{p.used=false;}
        filled-=abs.length;resolved-=abs.length;
        abs.forEach(([rr,cc])=>{occ[rr+','+cc]=false;});
        if(stop)return;
      }
    }
    if(stop)return;
    // Branch: leave this cell empty (no piece fits, or all skipped for a better line).
    occ[r+','+c]=true;resolved+=1;
    dfs();
    occ[r+','+c]=false;resolved-=1;
  }

  dfs();
  return{filled:best.filled,total,placements:best.placements};
}

// Build a compact 0/1 grid (grab origin (0,0)) from absolute [r,c] board
// cells, plus the grid's top-left board coordinate — the "grab 0,0 + grid
// from absolute coordinates" trick from AGENT_PLAYBOOK.md §7 (sidesteps
// rotC sometimes returning a grid with leading empty rows/cols).
function devfitGridFromAbsCells(absCells){
  const rs=absCells.map(a=>a[0]),cs=absCells.map(a=>a[1]);
  const minR=Math.min(...rs),minC=Math.min(...cs);
  const maxR=Math.max(...rs),maxC=Math.max(...cs);
  const grid=Array.from({length:maxR-minR+1},()=>Array(maxC-minC+1).fill(0));
  absCells.forEach(([r,c])=>{grid[r-minR][c-minC]=1;});
  return{grid,minR,minC};
}

// Apply a solved plan via the REAL game functions — identical wiring to
// AGENT_PLAYBOOK.md §7's applier: re-find each hand cat by id (never a fixed
// index — placeCatOnBoard splices G.hand), and route treats through
// pickupTreat() first so they actually leave the backpack.
function devfitApply(solution){
  let catsPlaced=0,treatsPlaced=0;
  solution.placements.forEach(pl=>{
    if(pl.kind==='cat'){
      const idx=G.hand.findIndex(h=>h.id===pl.id);
      if(idx<0)return;
      pickupCat(idx);
      const{grid,minR,minC}=devfitGridFromAbsCells(pl.abs);
      H.cells=grid;H.grabDr=0;H.grabDc=0;
      placeCatOnBoard(minR,minC);
      catsPlaced++;
    }else{
      const grp=(G.bpGroups||[]).find(g=>g.gid===pl.gid);
      if(!grp)return;
      G.selBpGid=pl.gid;
      pickupTreat();
      const{grid,minR,minC}=devfitGridFromAbsCells(pl.abs);
      H.cells=grid;H.grabDr=0;H.grabDc=0;
      placeTreatOnBoard(minR,minC);
      treatsPlaced++;
    }
  });
  return{catsPlaced,treatsPlaced};
}

// ── Button feedback (existing-UI convention: swap text briefly, revert —
//    same pattern as config.js's #btn-reload-cfg status flash). No alert(). ──
function devfitShowFeedback(btn,text,isErr){
  if(!btn)return;
  if(btn._devfitTimer){clearTimeout(btn._devfitTimer);btn._devfitTimer=null;}
  if(btn._devfitOrigText===undefined)btn._devfitOrigText=btn.textContent;
  btn.textContent=text;
  btn.classList.toggle('devfit-err',!!isErr);
  btn._devfitTimer=setTimeout(()=>{
    btn.textContent=btn._devfitOrigText;
    btn.classList.remove('devfit-err');
    btn._devfitTimer=null;
  },2400);
}

// ── Entry point (bound to the button's onclick) ──
function devAutoFit(){
  const btn=g('btn-dev-autofit');
  if(!DEV_MODE)return;
  const gameScr=g('s-game');
  if(!gameScr||!gameScr.classList.contains('on'))return; // not on the game screen
  if(!gameInProgress)return; // no active run
  const seq=g('ov-score-seq');
  if(seq&&seq.classList.contains('active'))return; // mid score animation
  const wi=g('win-inline');
  if(wi&&wi.classList.contains('visible'))return; // round already won, waiting for goShop()
  if(!G||!G.board||!G.board.length||!G.hand)return;

  const solution=devfitSolve();
  if(solution.total<=0){devfitShowFeedback(btn,'no board',true);return;}
  if(!solution.placements.length){
    if(solution.filled>=solution.total)devfitShowFeedback(btn,`purrfect ${solution.total}/${solution.total}`);
    else devfitShowFeedback(btn,'no fit found',true);
    return;
  }
  devfitApply(solution);
  const label=solution.filled>=solution.total?'purrfect':'best';
  devfitShowFeedback(btn,`${label} ${solution.filled}/${solution.total}`);
}
