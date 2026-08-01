'use strict';
// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const BPS_DEFAULT=4;
const BOTTOMLESS_TOTE_ID='bottomless_tote';
function getBPR(){if(G._bpOverrideR)return G._bpOverrideR;return CFG.inventory_rows||CFG.backpack_grid_size||BPS_DEFAULT;}
// Base column count from config / branch override only — no treat bonuses.
function getBPCBase(){if(G._bpOverrideC)return G._bpOverrideC;return CFG.inventory_cols||CFG.backpack_grid_size||BPS_DEFAULT;}
// ── bottomless_tote ownership: anywhere in the player's possession counts —
// inventory (G.bpGroups), placed on the board (G.treats), parked in
// G.usedTreats mid-round, or currently on the cursor (H). A held SHOP copy
// counts too, deliberately: the bag pre-widens during the buy drag so the
// tote can be dropped into the very column it creates even when the bag was
// full (see shopPickupTreat); cancelling the drag reverts the width, and
// nothing else can have been placed in the phantom column meanwhile because
// H is the only thing placeable while it is held. Does NOT stack — a second
// copy adds no second column.
function bpToteOwned(){
  if(!G||typeof G!=='object')return false;
  if((G.bpGroups||[]).some(gr=>gr.tdef&&gr.tdef.id===BOTTOMLESS_TOTE_ID))return true;
  if((G.treats||[]).some(t=>t.tdef&&t.tdef.id===BOTTOMLESS_TOTE_ID))return true;
  if((G.usedTreats||[]).some(td=>td&&td.id===BOTTOMLESS_TOTE_ID))return true;
  // Overflow-parked tote still counts as owned: keeping its column alive is
  // exactly what gives the pending tote a chance to seat itself again.
  if((G.bpPending||[]).some(td=>td&&td.id===BOTTOMLESS_TOTE_ID))return true;
  if(typeof H==='object'&&H&&(H.kind==='treat'||H.kind==='shop-treat')&&H.data&&H.data.id===BOTTOMLESS_TOTE_ID)return true;
  return false;
}
// Single choke point for the effective backpack column count. Every reader
// (backpack.js, shop.js, held.js, render.js, sim/placement.js) already goes
// through here. G._bpGraceC keeps the bag temporarily wide after tote
// ownership ends when the doomed column's occupants can't be reflowed yet
// (see bpReconcileWidth in backpack.js).
function getBPC(){return getBPCBase()+Math.max(bpToteOwned()?1:0,(G&&G._bpGraceC)||0);}
let G={};
let gameInProgress=false;
let curDeck='classic';

// ── Shared helpers ──
function resetH(){return{kind:null,source:null,data:null,cells:null,rot:0,color:null,em:null,handIdx:null,boardGid:null,bpGid:null,grabDr:0,grabDc:0,dragging:false,bpOrigin:null};}
function emptyCell(){return{filled:false,col:null,kind:null,em:null,gid:null,shape:null,type:null,blocked:false,offShape:false};}

// Touch drag tracking — true once finger has moved enough to constitute a drag
let _touchMovedWhileHeld=false;
// Extract clientX/Y from mouse or touch event
function getCoords(e){const t=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{clientX:t.clientX,clientY:t.clientY};}

// HELD — what the cursor is currently carrying
// kind: null | 'cat' | 'treat'
// source: 'hand' | 'board' | 'bp'
let H=resetH();

// Generate a random connected polyomino with exactly `targetCells` cells
// using weighted accretion: frontier cells closer to the center are more
// likely to be picked (pullStrength: 0 = uniform, 1.5 = soft center
// cluster, 3+ = strong round core with ragged edges).
function generatePolyomino(targetCells,pullStrength){
  const N=Math.max(1,targetCells);
  const side=Math.max(3,Math.ceil(Math.sqrt(N))+3);
  const rows=side,cols=side;
  const inShape=Array.from({length:rows},()=>Array(cols).fill(false));
  const startR=Math.floor(rows/2),startC=Math.floor(cols/2);
  inShape[startR][startC]=true;
  let count=1;
  const pull=pullStrength||0;
  // frontier stored as Map key→{r,c} for O(1) delete
  const frontier=new Map();
  const key=(r,c)=>r*cols+c;
  const addFrontier=(r,c)=>{
    for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const rr=r+dr,cc=c+dc;
      if(rr>=0&&rr<rows&&cc>=0&&cc<cols&&!inShape[rr][cc]) frontier.set(key(rr,cc),{r:rr,c:cc});
    }
  };
  addFrontier(startR,startC);
  while(count<N&&frontier.size>0){
    const arr=[...frontier.values()];
    let chosen;
    if(pull<=0){
      chosen=arr[Math.floor(Math.random()*arr.length)];
    }else{
      // Weight each frontier cell by 1/(1+d)^pull where d = distance from start
      const weights=arr.map(({r,c})=>{const d=Math.sqrt((r-startR)**2+(c-startC)**2);return 1/Math.pow(1+d,pull);});
      const total=weights.reduce((a,b)=>a+b,0);
      let rnd=Math.random()*total;
      chosen=arr[arr.length-1];
      for(let i=0;i<arr.length;i++){rnd-=weights[i];if(rnd<=0){chosen=arr[i];break;}}
    }
    frontier.delete(key(chosen.r,chosen.c));
    inShape[chosen.r][chosen.c]=true;count++;
    addFrontier(chosen.r,chosen.c);
  }
  let minR=rows,maxR=-1,minC=cols,maxC=-1;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(inShape[r][c]){
      if(r<minR)minR=r;if(r>maxR)maxR=r;
      if(c<minC)minC=c;if(c>maxC)maxC=c;
    }
  }
  const tRows=maxR-minR+1,tCols=maxC-minC+1;
  const trimmed=Array.from({length:tRows},(_,r)=>
    Array.from({length:tCols},(_,c)=>inShape[minR+r][minC+c])
  );
  return{rows:tRows,cols:tCols,shape:trimmed};
}

// Per-cell stochastic blocking — each in-shape cell rolls independently
// against `prob`. Off-shape cells stay unblocked here; the board cell's
// `offShape` flag handles their non-placeable status.
function buildBlockedMaskFromShape(shape,prob){
  const rows=shape.length,cols=shape[0].length;
  const mask=Array.from({length:rows},()=>Array(cols).fill(false));
  if(prob>0){
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      if(shape[r][c]&&Math.random()<prob) mask[r][c]=true;
    }
  }
  return mask;
}

// ── Round-modifier (boss round) pure effect helpers ──
// Each takes the plain base value plus G.roundModifier (or null) and is
// side-effect free, so they're reusable at every call site and easy to
// unit-test in isolation.
function modifiedBoardSize(baseSize,mod){
  if(mod&&mod.effect==='board_size_delta')return Math.max(12,baseSize+(mod.mag||0));
  return baseSize;
}
function modifiedBlockedProb(baseProb,mod){
  if(mod&&mod.effect==='blocked_mult')return baseProb*(mod.mag||1);
  return baseProb;
}
function applyHandsDelta(hands,mod){
  if(mod&&mod.effect==='hands_delta')return Math.max(1,hands+(mod.mag||0));
  return hands;
}
function applyHandSizeDelta(baseCount,mod){
  if(mod&&mod.effect==='hand_size_delta')return baseCount+(mod.mag||0);
  return baseCount;
}
function applyDiscardsZero(disc,mod){
  return(mod&&mod.effect==='discards_zero')?0:disc;
}
function applyTargetMult(baseTgt,mod){
  if(mod&&mod.effect==='target_mult')return Math.round(baseTgt*(mod.mag||1));
  return baseTgt;
}
function applyEarnMult(baseEarn,mod){
  if(mod&&mod.effect==='earn_mult')return Math.round(baseEarn*(mod.mag||1));
  return baseEarn;
}

// Single source of truth for round/hand board layout: irregular polyomino
// shape + stochastic blocking inside it. `mod` is the active G.roundModifier
// (or null) — passed explicitly rather than read off G so callers before G
// is (re)initialized (e.g. newGame's first board) can't pick up stale state.
function setupBoardLayout(round,mod){
  const c=rcfg(round||1);
  const playable=modifiedBoardSize(c.boardSize||16,mod);
  const blockedProb=modifiedBlockedProb(c.blockedProb||0,mod);
  const poly=generatePolyomino(playable,c.pullStrength);
  return{
    rows:poly.rows,cols:poly.cols,shape:poly.shape,
    mask:buildBlockedMaskFromShape(poly.shape,blockedProb)
  };
}

// Roll one random enabled modifier (weighted by sheet "Weight"). night_shift
// (type_mult) additionally rolls a random cat TYPE from the current deck
// and substitutes it into the "{TYPE}" placeholder of the description.
function rollRoundModifier(){
  const pool=(typeof MODIFIERS!=='undefined'?MODIFIERS:[]).filter(m=>m.enabled);
  if(!pool.length)return null;
  const picked=weightedSample(pool,1,m=>m.weight||1)[0];
  if(!picked)return null;
  const mod={id:picked.id,name:picked.name,em:picked.em,desc:picked.desc,effect:picked.effect,mag:picked.mag};
  if(mod.effect==='type_mult'){
    const deck=DECKS[G.deckId];
    const types=(deck&&deck.ty&&deck.ty.length)?deck.ty:['orange'];
    const type=types[Math.floor(Math.random()*types.length)];
    mod.type=type;
    mod.desc=mod.desc.replace(/\{TYPE\}/g,type.toUpperCase());
  }
  return mod;
}

// The week's deadlines are drawn ONCE, at run start, into G.modSchedule
// (round → modifier). A deadline is a scheduled condition you can see coming,
// so the work-week calendar names it a day or two ahead instead of only
// warning that one is due — and the round itself then reads the same object
// it advertised, never a fresh roll.
//
// SIM-SAFETY: drawing here keeps the number of RNG draws per run identical
// (one per modifier round, still exactly one weightedSample each) and keeps
// renderCalendar() free of Math.random, which is what the headless sim
// depends on. Both the sim and the real game reach this through newGame().
function rollModSchedule(){
  const sched={};
  modifierRoundsList().forEach(r=>{
    if(r<1||r>RCFG.length||sched[r])return;
    const mod=rollRoundModifier();
    if(mod)sched[r]=mod;
  });
  return sched;
}

// This round's modifier: the one the schedule already promised for a round
// listed in General!modifier_rounds; null otherwise. The live roll is only a
// fallback for a run whose schedule came up empty (e.g. the Modifiers tab
// failed to load before newGame ran).
function pickRoundModifier(round){
  if(!isModifierRound(round))return null;
  const sched=(typeof G!=='undefined'&&G)?G.modSchedule:null;
  if(sched&&sched[round])return sched[round];
  return rollRoundModifier();
}


function newGame(deckId){
  // Restore cat_phone if it was transformed in a previous game
  const cp=TDEFS.find(td=>td.id==='cat_phone');
  if(cp&&cp._origCatPhone){const o=cp._origCatPhone;cp.phase=o.phase;cp.ef=o.ef;cp.fn=o.fn;cp.req=o.req;cp.addEf=o.addEf;delete cp._origCatPhone;}
  const c=rcfg(1);
  const layout=setupBoardLayout(1,null); // round 1 is never in modifier_rounds — explicit null, not ambient G
  G={
    round:1,score:0,tgt:c.tgt,bsr:layout.rows,bsc:layout.cols,boardShape:layout.shape,blockedMask:layout.mask,earn:c.earn,hands:c.h||CFG.hand_count||3,disc:CFG.discard_count||3,cash:CFG.starting_cash||5,
    deckId,deck:[],hand:[],
    bp:mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null})),
    bpGroups:[],
    board:[],cats:[],treats:[],usedTreats:[],bpPending:[],bpHomes:[],bpSnapshot:null,treatLossEvents:[],treatPlayCounts:{},
    lastScore:0,selBpGid:null,visitedShop:false,shopClosed:false,newCardIndices:new Set(),purchasedTreatIds:new Set(),
    branchId:null,modifiers:'',_bpOverrideR:0,_bpOverrideC:0,_bpGraceC:0,discUsedRound:0,discUsedHand:0,purrfectsThisRound:0,catsScoredRun:0,
    roundModifier:null,roundLog:{},modSchedule:{},
  };
  // Draw the week's deadline conditions up front so the calendar can name them
  // before they land (rollModSchedule above). After the G literal — type_mult
  // reads G.deckId — and before mkDeck(), so the draw order is fixed.
  G.modSchedule=rollModSchedule();
  // The bp grid in the literal above was sized with getBPR()/getBPC() reading
  // the PREVIOUS game's G (tote ownership, bp-small/bp-large overrides), so it
  // can be stale-sized for this game — resync to this game's true width.
  bpReconcileWidth();
  mkDeck();dealHand();
}

// Does the ACTIVE branch's modifier string carry this token? Branch modifiers
// are pipe-separated ("discards+1|discard-refund"), so a substring test would
// false-positive across tokens — match whole trimmed tokens only.
function hasBranchMod(token){
  if(typeof G!=='object'||!G||!G.modifiers)return false;
  return G.modifiers.split('|').some(m=>m.trim()===token);
}

// Apply per-round modifiers (hands, discards). Called ONCE per round, after the
// caller has reset the raw stats (advanceRoundSetup in js/scoring.js; the G
// literal in newGame for round 1, via newGameFromBranch).
//
// This is the ONLY place G.disc is derived: hands and discards are both ROUND
// pools here, so `hands+N` / `discards+N` add on top of the base the caller just
// set and nothing re-derives either of them again until the next round setup.
// dealHand() deliberately leaves G.disc alone — a discard spent on hand 1 stays
// spent for the rest of the round.
//
// NOTE: no longer early-returns when G.modifiers is empty — G.maxHands must
// still get set (and the round modifier's hands_delta/discards_zero still
// need to run) even for branches/rounds with no branch-level modifier string.
function applyModifiers(){
  const mods=G.modifiers?G.modifiers.split('|').map(m=>m.trim()).filter(Boolean):[];
  mods.forEach(mod=>{
    if(mod==='hands-1')G.hands=Math.max(1,G.hands-1);
    if(mod.startsWith('hands+'))G.hands+=(parseInt(mod.slice(6))||0);
    if(mod.startsWith('discards+'))G.disc+=(parseInt(mod.slice(9))||0);
  });
  // no-discard beats any discards+N in the same string, whichever order the
  // sheet wrote them in — so it is settled after the loop, not inside it.
  if(mods.indexOf('no-discard')>=0)G.disc=0;
  // Round modifier (boss round) composes AFTER branch modifiers, e.g.
  // London's hands+1 then short_shift's -1 nets to +0.
  G.hands=applyHandsDelta(G.hands,G.roundModifier);
  G.disc=applyDiscardsZero(G.disc,G.roundModifier);
  G.maxHands=G.hands;
}
// Apply one-time modifiers (backpack size, starting cash). Called only at game start.
function applyModifiersOnce(){
  if(!G.modifiers)return;
  const mods=G.modifiers.split('|').map(m=>m.trim()).filter(Boolean);
  mods.forEach(mod=>{
    if(mod==='bp-small'){G._bpOverrideR=3;G._bpOverrideC=3;G.bp=mk2d(3,3,()=>({filled:false,col:null,em:null,gid:null,tdef:null}));G.bpGroups=[];}
    if(mod==='bp-large'){G._bpOverrideR=6;G._bpOverrideC=5;G.bp=mk2d(6,5,()=>({filled:false,col:null,em:null,gid:null,tdef:null}));G.bpGroups=[];}
    if(mod==='cash-2')G.cash=Math.max(1,G.cash-2);
    if(mod.startsWith('cash+'))G.cash+=(parseInt(mod.slice(5))||0);
  });
}

function newGameFromBranch(branchId){
  const branches=BRANCHES;
  const branch=branches.find(b=>b.id===branchId);
  if(!branch)return;
  newGame(branch.deck);
  G.branchId=branchId;
  G.modifiers=branch.mod||'';
  applyModifiersOnce();
  // Round 1's hand 1 was already dealt inside newGame(), but dealHand() no
  // longer touches G.disc — so applying the branch's discards+N here is what
  // makes round 1 hand 1 start with the full pool (Paris used to open its run
  // on 3 discards instead of 4 because dealHand() had derived it first).
  applyModifiers();
  gameInProgress=true;
  if(typeof pfTrackRunStart==='function')pfTrackRunStart(branchId,branch.deck);
  menuUpdateContinue();
}

function mk2d(r,c,init){return Array.from({length:r},()=>Array.from({length:c},init));}

function mkDeck(){
  let cfg=DECKS[G.deckId];
  if(!cfg){console.error('Deck not found:',G.deckId);return;}
  console.log('[mkDeck] deckId:',G.deckId,'ty:',cfg.ty,'sh:',cfg.sh);
  console.log('[mkDeck] COLS:',JSON.stringify(COLS),'EMS:',JSON.stringify(EMS));
  G.deck=[];
  const validShapes=Object.entries(CSHAPES).filter(([k,v])=>{
    const total=v.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0);return total>1;
  }).map(([k])=>k);
  // Distribute shapes among types via round-robin: type i gets sh[i], sh[i+tyLen], ...
  const tyLen=cfg.ty.length;
  const typeShapes=cfg.ty.map((_,ti)=>{
    const chunk=cfg.sh.filter((_,si)=>si%tyLen===ti);
    return chunk.length?chunk:[cfg.sh[ti%cfg.sh.length]];
  });
  const typeCounts=cfg.ty.map(()=>0);
  for(let i=0;i<(CFG.deck_card_count||30);i++){
    const ti=i%tyLen;
    const type=cfg.ty[ti];
    const shapes=typeShapes[ti];
    const cnt=typeCounts[ti]++;
    let shape=shapes[cnt%shapes.length];
    if(!validShapes.includes(shape)||CSHAPES[shape].reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0)<=1)
      shape=validShapes[cnt%validShapes.length];
    G.deck.push({id:i+Date.now(),name:cap(type)+' Cat',type,shape,
      cells:CSHAPES[shape],col:COLS[type],em:EMS[type]});
  }
  sfl(G.deck);
}

function dealHand(){
  // Discards are a ROUND pool, not a per-hand allowance: G.disc is derived ONCE
  // per round in applyModifiers() (round setup / newGameFromBranch), goes down in
  // doDiscard(), and can go up from a SKIP bonus (breakConsumePending). dealHand()
  // deliberately does NOT re-derive it — a discard spent on hand 1 stays spent —
  // and does not re-apply the boss discards_zero either: the only writer that can
  // add discards after round setup is that SKIP bonus, which is granted on purpose
  // (breaks.js orders it after applyModifiers so it survives) and is exactly what
  // the calendar card advertised for the round. Re-zeroing here would have honoured
  // it on hand 1 and eaten it from hand 2 on. Only the per-HAND counter resets —
  // second_chance reads it; fence_sitter reads the per-ROUND one.
  G.discUsedHand=0;
  G.newCardIndices=new Set();
  const handTarget=applyHandSizeDelta(CFG.hand_dealt_count||7,G.roundModifier);
  while(G.hand.length<handTarget&&G.deck.length>0){
    G.newCardIndices.add(G.hand.length);
    G.hand.push(G.deck.shift());
  }
  // return any board treats to backpack — home pose first, never destroyed
  G.treats.forEach(bt=>bpReturnTreat(bt.tdef,bt.bpHome||null));
  G.cats=[];G.treats=[];
  H=resetH();
  // Board shape + block mask are rolled once per round at round start
  // (newGame for round 1, roundWin for later rounds), not per hand — every
  // hand in a round shares that fixed layout. mkBoard just rebuilds the board
  // on it, clearing placed cats between hands.
  mkBoard();
}

function mkBoard(){
  G.board=mk2d(G.bsr,G.bsc,()=>(emptyCell()));
  for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
    if(G.boardShape&&G.boardShape[r]&&!G.boardShape[r][c]) G.board[r][c].offShape=true;
    if(G.blockedMask&&G.blockedMask[r]&&G.blockedMask[r][c]) G.board[r][c].blocked=true;
  }
}
