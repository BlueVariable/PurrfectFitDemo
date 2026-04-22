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

// Single source of truth for round/hand board layout: irregular polyomino
// shape + stochastic blocking inside it.
function setupBoardLayout(round){
  const c=rcfg(round||1);
  const playable=c.boardSize||16;
  const poly=generatePolyomino(playable,c.pullStrength);
  return{
    rows:poly.rows,cols:poly.cols,shape:poly.shape,
    mask:buildBlockedMaskFromShape(poly.shape,c.blockedProb||0)
  };
}


function newGame(deckId){
  // Restore cat_phone if it was transformed in a previous game
  const cp=TDEFS.find(td=>td.id==='cat_phone');
  if(cp&&cp._origCatPhone){const o=cp._origCatPhone;cp.phase=o.phase;cp.ef=o.ef;cp.fn=o.fn;cp.req=o.req;cp.addEf=o.addEf;delete cp._origCatPhone;}
  const c=rcfg(1);
  const layout=setupBoardLayout(1);
  G={
    round:1,score:0,tgt:c.tgt,bsr:layout.rows,bsc:layout.cols,boardShape:layout.shape,blockedMask:layout.mask,earn:c.earn,hands:c.h||CFG.hand_count||3,disc:CFG.discard_count||3,cash:CFG.starting_cash||5,
    deckId,deck:[],hand:[],
    bp:mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null})),
    bpGroups:[],
    board:[],cats:[],treats:[],usedTreats:[],treatPlayCounts:{},
    lastScore:0,selBpGid:null,visitedShop:false,newCardIndices:new Set(),purchasedTreatIds:new Set(),
    branchId:null,modifiers:'',_bpOverrideR:0,_bpOverrideC:0,discUsedRound:0,purrfectsThisRound:0,
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
  // Re-roll the polyomino board shape and stochastic block mask each hand.
  const layout=setupBoardLayout(G.round);
  G.bsr=layout.rows;G.bsc=layout.cols;G.boardShape=layout.shape;G.blockedMask=layout.mask;
  mkBoard();
}

function mkBoard(){
  G.board=mk2d(G.bsr,G.bsc,()=>(emptyCell()));
  for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
    if(G.boardShape&&G.boardShape[r]&&!G.boardShape[r][c]) G.board[r][c].offShape=true;
    if(G.blockedMask&&G.blockedMask[r]&&G.blockedMask[r][c]) G.board[r][c].blocked=true;
  }
}
