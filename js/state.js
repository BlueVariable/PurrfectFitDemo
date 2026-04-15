'use strict';
// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const BPS_DEFAULT=4;
function getBPR(){if(G._bpOverrideR)return G._bpOverrideR;return CFG.inventory_rows||CFG.backpack_grid_size||BPS_DEFAULT;}
function getBPC(){if(G._bpOverrideC)return G._bpOverrideC;return CFG.inventory_cols||CFG.backpack_grid_size||BPS_DEFAULT;}
let G={};
let gameInProgress=false;
let curDeck='classic';

// ── Shared helpers ──
function resetH(){return{kind:null,source:null,data:null,cells:null,rot:0,color:null,em:null,handIdx:null,boardGid:null,bpGid:null,grabDr:0,grabDc:0,dragging:false};}
function emptyCell(){return{filled:false,col:null,kind:null,em:null,gid:null,shape:null,type:null,blocked:false};}

// Touch drag tracking — true once finger has moved enough to constitute a drag
let _touchMovedWhileHeld=false;
// Extract clientX/Y from mouse or touch event
function getCoords(e){const t=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{clientX:t.clientX,clientY:t.clientY};}

// HELD — what the cursor is currently carrying
// kind: null | 'cat' | 'treat'
// source: 'hand' | 'board' | 'bp'
let H=resetH();

// Given a target total grid area, pick a random (rows, cols) factorization.
// Prefers non-1 factors so the board has real 2D shape; randomly orients
// to allow asymmetric layouts like 2×11 or 11×2. If the exact total can't
// factor into rows,cols >= 2, scan upward for the nearest total that can.
function factorArea(total){
  for(let t=total;t<total+6;t++){
    const pairs=[];
    for(let r=2;r<=Math.floor(Math.sqrt(t));r++){
      if(t%r===0){const c=t/r;if(c>=2)pairs.push([r,c]);}
    }
    if(pairs.length){
      const [a,b]=pairs[Math.floor(Math.random()*pairs.length)];
      return Math.random()<0.5?{bsr:a,bsc:b,area:t}:{bsr:b,bsc:a,area:t};
    }
  }
  return{bsr:1,bsc:Math.max(1,total),area:Math.max(1,total)};
}

// Pick dims for a round where `playable` must fit exactly and additional
// cells get blocked per `prob`. Total area = ceil(playable/(1-prob)),
// factored into rows×cols. Blocked count = area - playable (exact).
function pickBoardDimsForPlayable(playable,prob){
  const p=Math.min(Math.max(prob||0,0),0.9);
  const targetArea=p>0?Math.max(playable,Math.ceil(playable/(1-p))):playable;
  return factorArea(targetArea);
}

// Build a blocked mask that marks exactly (area - playable) random cells as blocked.
function buildBlockedMask(rows,cols,playable){
  const area=rows*cols;
  const blockCount=Math.max(0,Math.min(area,area-playable));
  const idxs=Array.from({length:area},(_,i)=>i);
  for(let i=idxs.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [idxs[i],idxs[j]]=[idxs[j],idxs[i]];
  }
  const blockedSet=new Set(idxs.slice(0,blockCount));
  const mask=[];
  for(let r=0;r<rows;r++){
    mask.push([]);
    for(let c=0;c<cols;c++) mask[r].push(blockedSet.has(r*cols+c));
  }
  return mask;
}

// Configure the board for the current round: dims hold exactly `Board Size`
// playable cells, with extra cells blocked per `Blocked Cell Prob`.
function setupRoundBoard(){
  const c=rcfg(G.round);
  const playable=c.boardSize||16;
  const dims=pickBoardDimsForPlayable(playable,c.blockedProb||0);
  G.bsr=dims.bsr;G.bsc=dims.bsc;
  G.blockedMask=buildBlockedMask(G.bsr,G.bsc,playable);
}

function newGame(deckId){
  // Restore cat_phone if it was transformed in a previous game
  const cp=TDEFS.find(td=>td.id==='cat_phone');
  if(cp&&cp._origCatPhone){const o=cp._origCatPhone;cp.phase=o.phase;cp.ef=o.ef;cp.fn=o.fn;cp.req=o.req;cp.addEf=o.addEf;delete cp._origCatPhone;}
  const c=rcfg(1);
  const playable=c.boardSize||16;
  const dims=pickBoardDimsForPlayable(playable,c.blockedProb||0);
  G={
    round:1,score:0,tgt:c.tgt,bsr:dims.bsr,bsc:dims.bsc,blockedMask:buildBlockedMask(dims.bsr,dims.bsc,playable),earn:c.earn,hands:c.h||CFG.hand_count||3,disc:CFG.discard_count||3,cash:CFG.starting_cash||5,
    deckId,deck:[],hand:[],
    bp:mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null})),
    bpGroups:[],
    board:[],cats:[],treats:[],usedTreats:[],treatPlayCounts:{},
    lastScore:0,selBpGid:null,visitedShop:false,newCardIndices:new Set(),purchasedTreatIds:new Set(),
    branchId:null,modifiers:'',_bpOverrideR:0,_bpOverrideC:0,
  };
  mkDeck();dealHand();
}

// Apply per-round modifiers (hands, discard). Called each round after stats reset.
function applyModifiers(){
  if(!G.modifiers)return;
  const mods=G.modifiers.split('|').map(m=>m.trim()).filter(Boolean);
  mods.forEach(mod=>{
    if(mod==='hands-1')G.hands=Math.max(1,G.hands-1);
    if(mod.startsWith('hands+'))G.hands+=(parseInt(mod.slice(6))||0);
    if(mod==='no-discard')G.disc=0;
  });
}
// Apply one-time modifiers (backpack size, starting cash). Called only at game start.
function applyModifiersOnce(){
  if(!G.modifiers)return;
  const mods=G.modifiers.split('|').map(m=>m.trim()).filter(Boolean);
  mods.forEach(mod=>{
    if(mod==='bp-small'){G._bpOverrideR=3;G._bpOverrideC=3;G.bp=mk2d(3,3,()=>({filled:false,col:null,em:null,gid:null,tdef:null}));G.bpGroups=[];}
    if(mod==='bp-large'){G._bpOverrideR=5;G._bpOverrideC=5;G.bp=mk2d(5,5,()=>({filled:false,col:null,em:null,gid:null,tdef:null}));G.bpGroups=[];}
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
  applyModifiers();
  gameInProgress=true;
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
  const mods=G.modifiers?G.modifiers.split('|').map(m=>m.trim()):[];
  const noDiscard=mods.includes('no-discard');
  const discPlus=mods.filter(m=>m.startsWith('discards+')).reduce((s,m)=>s+parseInt(m.slice(9))||0,0);
  G.disc=noDiscard?0:((CFG.discard_count||3)+discPlus);
  G.newCardIndices=new Set();
  while(G.hand.length<(CFG.hand_dealt_count||7)&&G.deck.length>0){
    G.newCardIndices.add(G.hand.length);
    G.hand.push(G.deck.shift());
  }
  // return any board treats to backpack
  G.treats.forEach(bt=>bpAutoPlace(bt.tdef));
  G.cats=[];G.treats=[];
  H=resetH();
  mkBoard();
}

function mkBoard(){
  G.board=mk2d(G.bsr,G.bsc,()=>(emptyCell()));
  if(G.blockedMask){
    for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
      if(G.blockedMask[r]&&G.blockedMask[r][c]) G.board[r][c].blocked=true;
    }
  }
}
