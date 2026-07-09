'use strict';
// ══════════════════════════════════════════════════════
//  BACKPACK INTERACTION
// ══════════════════════════════════════════════════════
function onBPEnter(r,c){
  if(H.kind!=='treat')return;
  clrBPPrev();
  const or=r-H.grabDr, oc=c-H.grabDc;
  const ok=bpCanAt(H.cells,or,oc);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    if(rr>=0&&rr<getBPR()&&cc>=0&&cc<getBPC()){
      const el=getBPCell(rr,cc);
      if(el)el.classList.add(ok?'ok':'bad');
    }
  }));
}
function onBPLeave(){clrBPPrev();}

function clrBPPrev(){document.querySelectorAll('.bpc.ok,.bpc.bad').forEach(c=>c.classList.remove('ok','bad'));}
function onBPMouseUp(r,c){
  if(H.kind!=='treat')return;
  // Use grab offset so treat anchors correctly
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!bpCanAt(H.cells,or,oc))return;
  bpPlaceAt(H.data,H.cells,or,oc);
  H=resetH();
  updateGhost();hideHUD();clrBPPrev();renderBP();
}
function getBPCell(r,c){return g('bpg').querySelectorAll('.bpc')[r*getBPC()+c]||null;}

// ── Dynamic backpack width (bottomless_tote) ──
// getBPC() (state.js) grows by one column while the tote is owned; these two
// helpers keep the physical G.bp arrays in sync with that effective width.

// Widen-only invariant repair: every insertion into the bag funnels through
// bpCanAt() (place, drop, autoplace, repack, sim buys, duplication treats),
// so widening lazily there guarantees the physical arrays can never be
// narrower than getBPC(), whichever path tote ownership arrived through.
function bpEnsureWidth(){
  if(!G.bp||!G.bp.length)return;
  const want=getBPC();
  if(G.bp[0].length>=want)return;
  G.bp.forEach(row=>{while(row.length<want)row.push({filled:false,col:null,em:null,gid:null,tdef:null});});
}

// Full reconciliation, including shrink when tote ownership ends (sold,
// destroyed by catnado, refunded at round end). Shrinking must never destroy
// a treat: if the doomed column is occupied we try a full repack at the
// narrow width, and if even that fails the bag temporarily STAYS WIDE
// (G._bpGraceC) and we retry at the next reconcile point (end of each score
// sequence, shop sell/pickup, round end, new game). Returns true if the
// physical width changed.
function bpReconcileWidth(){
  if(!G.bp||!G.bp.length)return false;
  // Target width deliberately IGNORES G._bpGraceC: grace is this function's
  // OUTPUT (how wide we were forced to stay), never an input — feeding it
  // back (via getBPC()) would make a pending grace column defeat every
  // later shrink retry.
  const want=getBPCBase()+(bpToteOwned()?1:0),have=G.bp[0].length;
  if(have===want){G._bpGraceC=0;return false;}
  if(have<want){
    G._bpGraceC=0;
    G.bp.forEach(row=>{while(row.length<want)row.push({filled:false,col:null,em:null,gid:null,tdef:null});});
    return true;
  }
  // Shrinking. Fast path: doomed column(s) empty — just truncate.
  const overflow=(G.bpGroups||[]).some(gr=>gr.cells.some(([,c])=>c>=want));
  if(!overflow){G.bp.forEach(row=>{row.length=want;});G._bpGraceC=0;return true;}
  // Occupied: reflow everything into the narrow bag via a full repack.
  const snapBp=G.bp,snapGroups=G.bpGroups;
  G._bpGraceC=0;
  const failed=bpRepackAll([]); // rebuilds G.bp at the now-narrow getBPC()
  if(!failed.length)return true;
  // Genuinely no room at the narrow width: restore the wide packing untouched
  // (bpRepackAll built fresh arrays/groups, so the snapshot is intact) and
  // keep the extra column alive until space frees up.
  G.bp=snapBp;G.bpGroups=snapGroups;
  G._bpGraceC=have-getBPCBase();
  return false;
}

// ── BP helpers ──
function bpAutoPlace(tdef){
  const shape=tdef.bpS;
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c)){bpPlaceAt(tdef,shape,r,c);return true;}
  return false;
}

// ── Rotation-aware auto-place: tries all 4 rotations of the stored shape
//    before giving up. Used by the round-end restore path so a treat isn't
//    lost just because its default orientation no longer fits. ──
function bpAutoPlaceRot(tdef){
  for(let rot=0;rot<4;rot++){
    const shape=rotC(tdef.bpS,rot);
    for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c)){bpPlaceAt(tdef,shape,r,c);return true;}
  }
  return false;
}
function bpShapeCellCount(shape){return shape.reduce((s,row)=>s+row.filter(Boolean).length,0);}

// ── Full repack: clear the backpack and re-place every current group's tdef
//    plus `extraTdefs`, largest-first, with rotation support. Returns the
//    tdefs (from either source) that still would not fit anywhere. ──
function bpRepackAll(extraTdefs){
  const all=[...G.bpGroups.map(gr=>gr.tdef),...extraTdefs];
  all.sort((a,b)=>bpShapeCellCount(b.bpS)-bpShapeCellCount(a.bpS));
  G.bp=mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null}));
  G.bpGroups=[];
  const failed=[];
  all.forEach(td=>{if(!bpAutoPlaceRot(td))failed.push(td);});
  return failed;
}

// ── Round-end restore: rotation-aware placement first; if a treat still
//    doesn't fit, repack the whole backpack (a valid packing existed before
//    the round started, so this should nearly always succeed); if it STILL
//    can't fit, refund its sell price rather than silently destroying it. ──
function bpRestoreUsedTreats(tdefs){
  const unplaced=[];
  tdefs.forEach(td=>{if(!bpAutoPlaceRot(td))unplaced.push(td);});
  if(!unplaced.length)return;
  const stillFailed=bpRepackAll(unplaced);
  stillFailed.forEach(td=>{
    G.cash+=td.sp||0;
    console.warn(`[bpRestoreUsedTreats] "${td.nm||td.id}" would not fit back into the backpack even after a full repack — refunded $${td.sp||0} instead of destroying it.`);
  });
}
function bpCanAt(cells,r,c){
  bpEnsureWidth(); // physical G.bp may lag getBPC() right after tote ownership begins
  for(let dr=0;dr<cells.length;dr++) for(let dc=0;dc<cells[dr].length;dc++){
    if(!cells[dr][dc])continue;
    const rr=r+dr,cc=c+dc;
    if(rr>=getBPR()||cc>=getBPC()||rr<0||cc<0)return false;
    if(G.bp[rr][cc].filled)return false;
  }
  return true;
}
function bpCanFit(shape){for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c))return true;return false;}
// Rotation-aware "would it fit anywhere" check — mirrors bpAutoPlaceRot's
// search without placing anything. Used by the Coffee Break café draft
// cards' "no room" state (js/cafe.js) so a card is only selectable when the
// grant is guaranteed to succeed.
function bpCanFitRot(shape){for(let rot=0;rot<4;rot++)if(bpCanFit(rotC(shape,rot)))return true;return false;}
function bpPlaceAt(tdef,cells,r,c){
  const gid=uid();const placed=[];
  cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=r+dr,cc=c+dc;
    G.bp[rr][cc]={filled:true,col:tdef.col,em:tdef.em,gid,tdef};
    placed.push([rr,cc]);
  }));
  G.bpGroups.push({gid,tdef,cells:placed,or:r,oc:c,shape:cells});
}
function removeBpGid(gid){
  const grp=G.bpGroups.find(g=>g.gid===gid);if(!grp)return;
  grp.cells.forEach(([r,c])=>G.bp[r][c]={filled:false,col:null,em:null,gid:null,tdef:null});
  G.bpGroups=G.bpGroups.filter(g=>g.gid!==gid);
}

function sellTreatFromShop(gid){
  // Only callable from shop screen
  const grp=G.bpGroups.find(g=>g.gid===gid);if(!grp)return;
  G.cash+=grp.tdef.sp;
  G.purchasedTreatIds.delete(grp.tdef.id);
  removeBpGid(gid);
  // Selling the tote shrinks the bag (reflowing anything in the doomed
  // column); selling anything else may free the room a pending shrink
  // (G._bpGraceC) was waiting for.
  bpReconcileWidth();
  renderAll(); // update backpack display
  renderShopFull(); // refresh shop listing
  g('shop-cash').textContent=G.cash;
}
