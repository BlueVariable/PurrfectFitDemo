'use strict';
// ══════════════════════════════════════════════════════
//  PROJECTION — side-effect-free score preview engine
//
//  projectScore(hypothetical) replicates doFit()'s scan computation exactly
//  (same trigger-cell sort via the shared scanCompare() — reversed under
//  mirror_mood/scan_reverse exactly like doFit() — same getAddBonusForCat/
//  getMulFactorForCat buffering, same Type B mul-then-add ordering, same
//  requirementFails skips, same catBaseScore/boardFillBonus + G.roundModifier) but commits
//  NOTHING: every persistent global it touches (directly, or indirectly via
//  a treat's tdef.fn side effects) is snapshotted before the scan and
//  restored in a finally block. See AGENT report for the full inventory.
//
//  Feature 2b (treat spot-rating) builds on top of projectScore via
//  sweepTreatPositions()/pawRatingForDelta() below.
// ══════════════════════════════════════════════════════

// Trigger cell = topmost then leftmost cell of a piece (mirrors doFit's local helper).
function _projTriggerCell(cells){
  return cells.reduce((best,[r,c])=>
    (r<best[0]||(r===best[0]&&c<best[1]))?[r,c]:best
  ,[Infinity,Infinity]);
}

// A fixed anchor gid for the hypothetical piece — collision with a real uid()
// (7 random base36 chars) is not a realistic concern.
const _PROJ_GID='__proj_hyp__';

// Computes what doFit() WOULD score for the CURRENT board, optionally with one
// extra hypothetical piece overlaid on top of it. Never leaves a trace: every
// global read by treat fns (G.board, G.cats, G.treats, G.cash, G.hands,
// G.deck, G.bp/G.bpGroups, G.treatPlayCounts, TDEFS, Math.random) is
// snapshotted up front and restored in `finally`, regardless of how the scan
// exits (including thrown errors from a misbehaving treat fn).
//
// hypothetical: null | {kind:'cat', catData, cells} | {kind:'treat', tdef, cells}
//   `cells` are ABSOLUTE board [r,c] pairs (already rotated + positioned —
//   same shape `placeCatOnBoard`/`placeTreatOnBoard` would write to G.board).
//
// Returns {total, boardBonus, boardFull, perPiece:[{kind,id,gid,contribution,affectedGids?}]}
function projectScore(hypothetical){
  if(!G||!G.board||!G.board.length) return {total:0,boardBonus:0,boardFull:false,perPiece:[]};

  // ── SNAPSHOT (restored in finally) ──────────────────────────────────────
  // Math.random — stubbed deterministic so coin-flip treats (lucky_penny,
  // crowd_pleaser, gold_star, poker_face, fence_sitter, second_breakfast,
  // treat_encore, siamese_twins, jumping_ball, brownies, sardine_tin,
  // catnado, standing_ovation, wild_dice…) project a single reproducible
  // outcome instead of a different one on every hover tick.
  const _origRandom=Math.random;
  Math.random=()=>0.999;

  // Scalars mutated by treat fns: G.cash (piggy_bank/lucky_penny/coin_purse/
  // crowd_pleaser doesn't touch cash but coin_purse/coin_purr read it),
  // G.hands (second_wind).
  const _cash0=G.cash,_hands0=G.hands;

  // G.deck — brownies pushes duplicate cards, sardine_tin splices cards out.
  const _deck0=G.deck.slice();

  // G.treatPlayCounts — every scaling treat (all_or_nothing incl. its
  // *_lastRound marker, sprint_finish, purr_fection, lone_kitty, purebred,
  // one_shot, cathouse, cardboard_box, shooting_star, whisker_fatigue,
  // brownies, sardine_tin, standing_ovation, final_feast…) increments a key
  // on this single shared object.
  const _tpc0=Object.assign({},G.treatPlayCounts);

  // G.bpGroups / G.bp — catnado (removeBpGid) and standing_ovation
  // (bpAutoPlace of a cloned treat) mutate the backpack inventory itself.
  const _bpGroups0=G.bpGroups.slice();
  const _bp0=G.bp.map(row=>row.slice());

  // G.board — siamese_twins mutates an existing filled cat cell's
  // col/em/type IN PLACE (not a wholesale replace), so every cell needs a
  // shallow per-object clone, not just an array-of-arrays reference copy.
  const _board0=G.board.map(row=>row.map(cell=>Object.assign({},cell)));

  // G.cats — siamese_twins mutates an existing group's `.type` in place;
  // we also temporarily push a hypothetical cat group onto this SAME array
  // (see overlay below) so we only need to remember the ORIGINAL length +
  // each original element's `.type` to restore it (no need to snapshot the
  // whole array — nothing else restructures it mid-scan).
  const _catsLen0=G.cats.length;
  const _catsTypes0=G.cats.map(c=>c.type);

  // G.treats — same idea: only ever appended-to (hypothetical push) during
  // our own scan, so length + this is enough to pop the hypothetical back off.
  const _treatsLen0=G.treats.length;

  // TDEFS — snapshotting EVERY entry (not just currently-placed ones) is
  // deliberately broader than "just the placed treats' _expired/_origReq":
  //  - cat_phone permanently overwrites {phase,ef,fn,req,addEf} on the
  //    TDEFS entry it finds via TDEFS.find(...) (same object a placed
  //    instance's `.tdef` points at — shop purchases never clone TDEFS
  //    entries, confirmed via shop.js's bpPlaceAt(td,...)), plus sets
  //    `_origCatPhone` the first time it ever fires.
  //  - jumping_ball disables ANOTHER placed treat's `.req` (saving it to
  //    `_origReq`) — that target is always in G.treats, covered either way.
  //  - doFit()'s own first line resets ANY TDEFS entry whose `_origReq` is
  //    still set (left over from a jumping_ball firing on a PREVIOUS real
  //    fit) before scanning — replicating that reset is required for the
  //    projection to be exact, so it must touch (and then restore) the
  //    whole TDEFS array, not just the pieces currently on the board.
  const _tdefs0=(typeof TDEFS!=='undefined'?TDEFS:[]).map(td=>({
    td,_expired:td._expired,_origReq:td._origReq,phase:td.phase,ef:td.ef,
    fn:td.fn,req:td.req,addEf:td.addEf,_origCatPhone:td._origCatPhone,
  }));

  let out;
  try{
    // Mirrors doFit()'s first line exactly — undoes any requirement disabled
    // by jumping_ball on a previous REAL fit, so the projection reflects
    // what FIT would score right now (restored in finally either way).
    (typeof TDEFS!=='undefined'?TDEFS:[]).forEach(td=>{
      if(td._origReq!==undefined){td.req=td._origReq;delete td._origReq;}
    });

    // ── Overlay the hypothetical piece (if any) onto the real G state ──
    if(hypothetical&&hypothetical.kind==='cat'){
      const cd=hypothetical.catData;
      G.cats.push({cells:hypothetical.cells,col:cd.col,shape:cd.shape,type:cd.type,cat:cd,gid:_PROJ_GID});
      hypothetical.cells.forEach(([r,c])=>{
        if(G.board[r]&&G.board[r][c]!==undefined)
          G.board[r][c]={filled:true,col:cd.col,kind:'cat',em:cd.em,gid:_PROJ_GID,shape:cd.shape,type:cd.type};
      });
    }else if(hypothetical&&hypothetical.kind==='treat'){
      G.treats.push({cells:hypothetical.cells,gid:_PROJ_GID,tdef:hypothetical.tdef});
      hypothetical.cells.forEach(([r,c])=>{
        if(G.board[r]&&G.board[r][c]!==undefined)
          G.board[r][c]={filled:true,col:hypothetical.tdef.col,kind:'treat',em:hypothetical.tdef.em,gid:_PROJ_GID,shape:null,type:null};
      });
    }

    // doFit() itself refuses to score a zero-cat board — mirror that exactly,
    // evaluated AFTER the overlay so a hypothetical cat still counts.
    if(!G.cats.length){ out={total:0,boardBonus:0,boardFull:false,perPiece:[]}; return out; }

    // ── Scan (mirrors doFit's allPieces/treatBuffer loop) ──
    const allPieces=[
      ...G.cats.map(cat=>({kind:'cat',piece:cat,trigger:_projTriggerCell(cat.cells)})),
      ...G.treats.map(treat=>({kind:'treat',piece:treat,trigger:_projTriggerCell(treat.cells)})),
    ];
    allPieces.sort((a,b)=>scanCompare(a,b,G.roundModifier));

    const catScores={};
    const scoredGids=new Set();
    const treatBuffer=[];
    const perPiece=[];
    let runningTotal=0;

    for(const item of allPieces){
      if(item.kind==='cat'){
        const cat=item.piece;
        const base=catBaseScore(cat.cells.length,cat.type,G.roundModifier);
        let addBonus=0,mulFactor=1;
        for(const buf of treatBuffer){
          addBonus+=getAddBonusForCat(buf,cat);
          const m=getMulFactorForCat(buf,cat);
          if(m!==1)mulFactor*=m;
        }
        const score=Math.round((base+addBonus)*mulFactor);
        catScores[cat.gid]=score;
        scoredGids.add(cat.gid);
        runningTotal+=score;
        perPiece.push({kind:'cat',id:(cat.cat&&cat.cat.id!==undefined)?cat.cat.id:null,gid:cat.gid,contribution:score});
      }else{
        const treat=item.piece;
        if(treat.tdef.req&&requirementFails(treat.tdef.req)){
          perPiece.push({kind:'treat',id:treat.tdef.id,gid:treat.gid,contribution:0,affectedGids:[],skipped:true});
          continue;
        }
        const futureCats=G.cats.filter(c=>!scoredGids.has(c.gid));
        const csCopy=Object.assign({},catScores);
        const before=runningTotal;
        const result=treat.tdef.fn(G.board,futureCats,G.treats,treat.cells,csCopy)||{};

        const hasImmediate=result.scoreMultiplier||result.scoreBonus!==undefined;
        if(result.scoreMultiplier) runningTotal=Math.round(runningTotal*result.m);
        if(result.scoreBonus!==undefined) runningTotal+=result.scoreBonus;

        let affectedGids=[];
        if(!hasImmediate||result._alsoBuffer){
          if(treat.tdef.phase==='add'){
            affectedGids=futureCats
              .filter(cat=>getAddBonusForCat({treat,result,phase:treat.tdef.phase},cat)>0)
              .map(cat=>cat.gid);
          }else if(treat.tdef.phase==='mul'&&result.gids){
            affectedGids=result.gids;
          }
          treatBuffer.push({treat,result,phase:treat.tdef.phase});
        }
        perPiece.push({kind:'treat',id:treat.tdef.id,gid:treat.gid,contribution:runningTotal-before,affectedGids});
      }
    }

    const filledCells=G.board.flat().filter(c=>c.filled).length;
    const playableCells=G.board.flat().filter(c=>!c.blocked&&!c.offShape).length;
    const boardFull=filledCells===playableCells&&playableCells>0;
    const boardBonus=boardFull?boardFillBonus(playableCells,CFG.board_fill_bonus||5,G.roundModifier):0;
    const total=runningTotal+boardBonus;

    out={total,boardBonus,boardFull,perPiece};
    return out;
  }finally{
    // ── RESTORE every snapshot above ──
    Math.random=_origRandom;
    G.cash=_cash0;G.hands=_hands0;
    G.deck=_deck0;
    G.treatPlayCounts=_tpc0;
    G.bpGroups=_bpGroups0;G.bp=_bp0;
    G.cats.length=_catsLen0;
    G.cats.forEach((c,i)=>{c.type=_catsTypes0[i];});
    G.treats.length=_treatsLen0;
    _board0.forEach((row,r)=>row.forEach((cell,c)=>{ if(G.board[r]) G.board[r][c]=cell; }));
    _tdefs0.forEach(s=>{
      s.td._expired=s._expired;s.td._origReq=s._origReq;s.td.phase=s.phase;
      s.td.ef=s.ef;s.td.fn=s.fn;s.td.req=s.req;s.td.addEf=s.addEf;s.td._origCatPhone=s._origCatPhone;
    });
  }
}

// ══════════════════════════════════════════════════════
//  FEATURE 2b — treat spot-rating (paw percentile sweep)
// ══════════════════════════════════════════════════════

// 0 = zero/negative contribution ("won't score here").
// 1/2/3 = bottom/middle/top third by percentile rank among the sweep's
// POSITIVE deltas (the single best spot always lands in the top third —
// callers additionally force it to exactly 3, see sweepTreatPositions).
function pawRatingForDelta(delta,positiveDeltasSorted){
  if(delta<=0||!positiveDeltasSorted||!positiveDeltasSorted.length) return 0;
  let countLE=0;
  for(const d of positiveDeltasSorted) if(d<=delta) countLE++;
  const rank=countLE/positiveDeltasSorted.length;
  if(rank<=1/3) return 1;
  if(rank<=2/3) return 2;
  return 3;
}

// Cache keyed by a cheap board-state fingerprint so a hover sweep across
// rotations only recomputes once per (board-state, treat) pair, not once
// per mouse-move tick.
let _pawSweepCache={key:null,sweeps:{}};

function _projBoardStateKey(){
  const catsKey=G.cats.map(c=>c.gid+':'+c.type+':'+c.cells.map(([r,cc])=>r+'-'+cc).join(',')).join('|');
  const treatsKey=G.treats.map(t=>t.gid+':'+t.tdef.id+':'+t.cells.map(([r,cc])=>r+'-'+cc).join(',')).join('|');
  const tpcKey=JSON.stringify(G.treatPlayCounts||{});
  const modKey=(G.roundModifier&&G.roundModifier.id)||'';
  // G.disc/G.hand.length aren't board state, but a couple of treats read them
  // (poker_face/fence_sitter -> G.disc, cardboard_box -> G.hand.length) — folded
  // into the key so discarding mid-hover doesn't serve a stale cached sweep.
  return catsKey+'~'+treatsKey+'~'+G.cash+'~'+G.hands+'~'+G.score+'~'+G.round+'~'+modKey+'~'+tpcKey+'~'+G.bsr+'x'+G.bsc+'~'+G.disc+'~'+(G.hand?G.hand.length:0);
}

// Sweeps every legal (rotation, anchor) placement of `tdef` on the CURRENT
// board and returns [{rot,r,c,delta,affectedGids,paws}, ...]. `delta` is
// projectScore(withTreat).total - projectScore(null).total. Cached per
// (board-state, tdef.id) — call this freely from a hover handler.
function sweepTreatPositions(tdef){
  const key=_projBoardStateKey();
  if(_pawSweepCache.key!==key) _pawSweepCache={key,sweeps:{}};
  if(_pawSweepCache.sweeps[tdef.id]) return _pawSweepCache.sweeps[tdef.id];

  const baseline=projectScore(null).total;
  const positions=[];
  for(let rot=0;rot<4;rot++){
    const cells=rotC(tdef.bpS,rot);
    for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
      if(!boardCanPlace(cells,r,c)) continue;
      const absCells=[];
      cells.forEach((row,dr)=>row.forEach((v,dc)=>{ if(v) absCells.push([r+dr,c+dc]); }));
      const proj=projectScore({kind:'treat',tdef,cells:absCells});
      const hyp=proj.perPiece.find(p=>p.gid===_PROJ_GID);
      positions.push({rot,r,c,delta:proj.total-baseline,affectedGids:(hyp&&hyp.affectedGids)||[]});
    }
  }
  const positive=positions.map(p=>p.delta).filter(d=>d>0).sort((a,b)=>a-b);
  const maxDelta=positive.length?positive[positive.length-1]:null;
  positions.forEach(p=>{
    p.paws=pawRatingForDelta(p.delta,positive);
    if(maxDelta!==null&&p.delta===maxDelta) p.paws=3; // best spot(s) always rate 3
  });

  _pawSweepCache.sweeps[tdef.id]=positions;
  return positions;
}

// Looks up one sweep entry by (rotation, anchor row, anchor col) — the same
// coordinates boardCanPlace/placeTreatOnBoard use.
function findSweepEntry(tdef,rot,r,c){
  const sweep=sweepTreatPositions(tdef);
  for(const p of sweep) if(p.rot===rot&&p.r===r&&p.c===c) return p;
  return null;
}
