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
  bpPlaceAt(H.data,H.cells,or,oc,H.rot);
  H=resetH();
  bpRetryPending(); // the rearrange may have defragged room for an overflowed treat
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
// a treat OR reshuffle the player's arrangement: if the doomed column is
// occupied we relocate only its occupants (rotation-aware), and if even that
// fails the bag temporarily STAYS WIDE (G._bpGraceC) and we retry at the
// next reconcile point (end of each score sequence, shop sell/pickup, round
// end, new game). Returns true if the physical width changed.
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
  // Occupied: relocate ONLY the groups overlapping the doomed column(s).
  // Everything else stays exactly where the player arranged it — the bag is
  // player-managed, so a width change must never trigger a full reshuffle.
  const snapBp=G.bp.map(row=>row.slice()),snapGroups=G.bpGroups.slice();
  G._bpGraceC=0;
  const doomed=G.bpGroups.filter(gr=>gr.cells.some(([,c])=>c>=want));
  doomed.forEach(gr=>removeBpGid(gr.gid));
  G.bp.forEach(row=>{row.length=want;});
  if(doomed.every(gr=>bpAutoPlaceRot(gr.tdef)))return true;
  // Genuinely no room at the narrow width: restore the wide packing untouched
  // (the snapshot rows/groups were copied before any mutation) and keep the
  // extra column alive until space frees up.
  G.bp=snapBp;G.bpGroups=snapGroups;
  G._bpGraceC=have-getBPCBase();
  return false;
}

// ── BP helpers ──
// Greedy, rotation-less first-fit. NOTE: callers must handle a false return
// — for returning an owned treat to the bag, use bpReturnTreat() instead
// (remembered pose first, overflow queue on failure, never destroys).
function bpAutoPlace(tdef){
  const shape=tdef.bpS;
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c)){bpPlaceAt(tdef,shape,r,c);return true;}
  return false;
}

// ── Rotation-aware auto-place: tries all 4 rotations of the stored shape
//    before giving up. Used by every automatic placement path so a treat
//    isn't lost just because its default orientation no longer fits. ──
function bpAutoPlaceRot(tdef){
  for(let rot=0;rot<4;rot++){
    const shape=rotC(tdef.bpS,rot);
    for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c)){bpPlaceAt(tdef,shape,r,c,rot);return true;}
  }
  return false;
}
function bpShapeCellCount(shape){return shape.reduce((s,row)=>s+row.filter(Boolean).length,0);}

// ── Full repack: clear the backpack and re-place every current group's tdef
//    plus `extraTdefs`, largest-first, with rotation support. Returns the
//    tdefs (from either source) that still would not fit anywhere.
//    NOTE: no game path calls this anymore — the backpack arrangement is
//    player-owned (see bpReturnTreat below) and must never be reshuffled.
//    Kept only as a manual/debug utility. ──
function bpRepackAll(extraTdefs){
  const all=[...G.bpGroups.map(gr=>gr.tdef),...extraTdefs];
  all.sort((a,b)=>bpShapeCellCount(b.bpS)-bpShapeCellCount(a.bpS));
  G.bp=mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null}));
  G.bpGroups=[];
  const failed=[];
  all.forEach(td=>{if(!bpAutoPlaceRot(td))failed.push(td);});
  return failed;
}

// ══════════════════════════════════════════════════════
//  PLAYER-MANAGED ARRANGEMENT
//  Every bpGroup remembers its pose: anchor (or,oc) + rotated shape grid +
//  rot index (bpPlaceAt below). When a treat leaves the bag its pose travels
//  with it — H.bpOrigin across a drag, tInst.bpHome across a board trip,
//  G.bpHomes across the usedTreats round-trip — and every return path is
//  exact-pose-first, so the game never reshuffles the player's arrangement.
//  A treat that truly cannot fit is parked in G.bpPending (NEVER destroyed)
//  and retried whenever space can free up.
// ══════════════════════════════════════════════════════
function bpPoseOf(grp){return{or:grp.or,oc:grp.oc,shape:grp.shape||grp.tdef.bpS,rot:grp.rot||0};}

// Exact remembered pose first, then rotation-aware auto-fit anywhere.
// Never repacks: every other treat stays exactly where the player put it.
function bpPlaceHomeOrAuto(tdef,home){
  if(home&&home.shape&&bpCanAt(home.shape,home.or,home.oc)){bpPlaceAt(tdef,home.shape,home.or,home.oc,home.rot);return true;}
  return bpAutoPlaceRot(tdef);
}

// Park an unplaceable treat in the overflow queue and log the event for a
// future notification UI. The treat stays owned and is retried by
// bpRetryPending() — this is the ONLY legal outcome for "no room".
function bpSendToPending(tdef){
  (G.bpPending=G.bpPending||[]).push(tdef);
  (G.treatLossEvents=G.treatLossEvents||[]).push({id:tdef.id,name:tdef.nm||tdef.id,em:tdef.em||'',reason:'no-room'});
  console.warn(`[backpack] no room for "${tdef.nm||tdef.id}" — parked in overflow (G.bpPending); it will return when space frees up.`);
  // Loss ceremony flush: announce the overflow the moment it happens, on
  // whichever screen the player is on (round-end restore, board clear, a
  // cancelled drag). Recording above stays a pure state push; the flush is
  // display-only, drains the queue, and no-ops under the headless sim.
  if(typeof treatLossFlush==='function')treatLossFlush();
}

// Single safe entry point for returning a treat to the inventory.
// Order: remembered pose → rotation-aware auto-fit → pending queue.
function bpReturnTreat(tdef,home){
  if(bpPlaceHomeOrAuto(tdef,home))return true;
  bpSendToPending(tdef);
  return false;
}

// Re-attempt overflowed treats. Called wherever space can free up: a sell,
// a player rearrange drop, and the round-end restore. Returns count seated.
function bpRetryPending(){
  if(!G.bpPending||!G.bpPending.length)return 0;
  const still=[];let placed=0;
  G.bpPending.forEach(td=>{if(bpAutoPlaceRot(td))placed++;else still.push(td);});
  G.bpPending=still;
  return placed;
}

// Claim (and consume) the remembered home for this tdef instance, if any.
// Duplicate copies share a tdef reference; each claim consumes one record,
// so two copies of the same treat each get a home (order may swap — they
// are identical, so it doesn't matter).
function bpClaimHome(tdef){
  if(!G.bpHomes||!G.bpHomes.length)return null;
  const i=G.bpHomes.findIndex(h=>h.tdef===tdef);
  return i<0?null:G.bpHomes.splice(i,1)[0];
}

// ── Round-end restore: every used treat goes back to its REMEMBERED home
//    cells at its remembered rotation (claimed from G.bpHomes). Its home is
//    normally still free — nothing auto-fills it — but if occupied (player
//    rearranged mid-round, standing_ovation clone squatted it, new buy over
//    the gap) it falls back to rotation-aware auto-fit; if even that fails
//    it is parked in G.bpPending. Never repacked, never destroyed.
//    NOTE: this per-treat path is now only the FALLBACK for goShop(); the
//    normal restore rebuilds the whole bag from the round-start snapshot
//    (bpCaptureSnapshot / bpRestoreSnapshot below). ──
function bpRestoreUsedTreats(tdefs){
  tdefs.forEach(td=>{bpReturnTreat(td,bpClaimHome(td));});
}

// ══════════════════════════════════════════════════════
//  ROUND-START ARRANGEMENT SNAPSHOT (freeze / reapply)
//  The bag is player-managed, so its arrangement is FROZEN the moment a round
//  begins (startRound). The game never reorganizes it mid-round on the way to
//  round end: instead the round-end restore rebuilds the bag to EXACTLY the
//  frozen poses. Used treats leaving the bag, REAPPEAR bounces, mid-round
//  hand-screen rearranges — all of it is wiped and reapplied from the freeze.
//  Only the roster changes carry over: treats the player no longer owns
//  (catnado destroyed, self-expired) are simply absent, and treats gained
//  mid-round (standing_ovation clones) have no frozen pose and auto-fit into
//  whatever space is left. Never destroys.
// ══════════════════════════════════════════════════════
function bpCaptureSnapshot(){
  G.bpSnapshot={
    width:getBPC(), // round-start effective width (base + tote column, if owned)
    poses:(G.bpGroups||[]).map(gr=>({
      tdef:gr.tdef,or:gr.or,oc:gr.oc,
      shape:(gr.shape||gr.tdef.bpS).map(row=>row.slice()),rot:gr.rot||0,
    })),
  };
}

// Rebuild the bag to the round-start snapshot. `owned` is the multiset of treat
// DEFS the player still holds (bag survivors + non-expired used + overflow):
// each claims a frozen pose of the same id and is dropped there exactly; a
// treat with no matching frozen pose (a clone, or something parked in overflow
// at round start) takes the normal safe return path (auto-fit → overflow).
function bpRestoreSnapshot(owned){
  const snap=G.bpSnapshot||{width:getBPC(),poses:[]};
  const poses=snap.poses.slice();
  // Rebuild at the round-start width so every frozen pose is in-bounds; if the
  // tote was lost this round the caller's bpReconcileWidth() shrinks the bag
  // afterwards (relocating any occupant stranded in the doomed column).
  G._bpGraceC=Math.max(0,snap.width-getBPCBase());
  G.bp=mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null}));
  G.bpGroups=[];
  const leftovers=[];
  owned.forEach(td=>{
    const i=poses.findIndex(p=>p.tdef.id===td.id);
    if(i<0){leftovers.push(td);return;}
    const pose=poses.splice(i,1)[0];
    if(bpCanAt(pose.shape,pose.or,pose.oc))bpPlaceAt(td,pose.shape,pose.or,pose.oc,pose.rot);
    else leftovers.push(td); // frozen cell no longer valid (bag shrank) — auto-fit
  });
  leftovers.forEach(td=>bpReturnTreat(td,null));
  G.bpSnapshot=null;
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
// `rot` (0-3, optional) records which rotation of tdef.bpS `cells` is, so a
// later pickup can resume the rotate cycle from the saved orientation.
function bpPlaceAt(tdef,cells,r,c,rot){
  const gid=uid();const placed=[];
  cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=r+dr,cc=c+dc;
    G.bp[rr][cc]={filled:true,col:tdef.col,em:tdef.em,gid,tdef};
    placed.push([rr,cc]);
  }));
  G.bpGroups.push({gid,tdef,cells:placed,or:r,oc:c,shape:cells,rot:rot||0});
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
  bpRetryPending(); // the sale may have freed room for an overflowed treat
  renderAll(); // update backpack display
  renderShopFull(); // refresh shop listing
  g('shop-cash').textContent=G.cash;
}
