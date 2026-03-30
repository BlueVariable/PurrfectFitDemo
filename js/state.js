'use strict';
// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const BPS_DEFAULT=4;
function getBPR(){if(G._bpOverrideR)return G._bpOverrideR;return CFG.backpack_rows||CFG.backpack_grid_size||BPS_DEFAULT;}
function getBPC(){if(G._bpOverrideC)return G._bpOverrideC;return CFG.backpack_cols||CFG.backpack_grid_size||BPS_DEFAULT;}
let G={};
let gameInProgress=false;
let curDeck='classic';

// ── Shared helpers ──
function resetH(){return{kind:null,source:null,data:null,cells:null,rot:0,color:null,em:null,handIdx:null,boardGid:null,bpGid:null,grabDr:0,grabDc:0,dragging:false};}
function emptyCell(){return{filled:false,col:null,kind:null,em:null,gid:null,shape:null,type:null};}

// Touch drag tracking — true once finger has moved enough to constitute a drag
let _touchMovedWhileHeld=false;
// Extract clientX/Y from mouse or touch event
function getCoords(e){const t=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{clientX:t.clientX,clientY:t.clientY};}

// HELD — what the cursor is currently carrying
// kind: null | 'cat' | 'treat'
// source: 'hand' | 'board' | 'bp'
let H=resetH();

function newGame(deckId){
  // Restore cat_phone if it was transformed in a previous game
  const cp=TDEFS.find(td=>td.id==='cat_phone');
  if(cp&&cp._origCatPhone){const o=cp._origCatPhone;cp.phase=o.phase;cp.ef=o.ef;cp.fn=o.fn;cp.req=o.req;cp.addEf=o.addEf;delete cp._origCatPhone;}
  const c=rcfg(1);
  G={
    round:1,score:0,tgt:c.tgt,bsr:c.bsr,bsc:c.bsc,earn:c.earn,hands:c.h||CFG.hand_count||3,disc:CFG.discard_count||3,cash:CFG.starting_cash||5,
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
    if(mod==='no-discard')G.disc=0;
  });
}
// Apply one-time modifiers (backpack size, starting cash). Called only at game start.
function applyModifiersOnce(){
  if(!G.modifiers)return;
  const mods=G.modifiers.split('|').map(m=>m.trim()).filter(Boolean);
  mods.forEach(mod=>{
    if(mod==='bp-small'){G._bpOverrideR=3;G._bpOverrideC=3;G.bp=mk2d(3,3,()=>({filled:false,col:null,em:null,gid:null,tdef:null}));G.bpGroups=[];}
    if(mod==='cash-2')G.cash=Math.max(1,G.cash-2);
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
  // Filter out 1x1 shapes for cats
  const validShapes=Object.entries(CSHAPES).filter(([k,v])=>{
    const total=v.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0);return total>1;
  }).map(([k])=>k);
  for(let i=0;i<(CFG.deck_card_count||30);i++){
    const type=cfg.ty[i%cfg.ty.length];
    let shape=cfg.sh[i%cfg.sh.length];
    if(!validShapes.includes(shape)||CSHAPES[shape].reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0)<=1)
      shape=validShapes[i%validShapes.length];
    G.deck.push({id:i+Date.now(),name:cap(type)+' Cat',type,shape,
      cells:CSHAPES[shape],col:COLS[type],em:EMS[type]});
  }
  sfl(G.deck);
}

function dealHand(){
  const noDiscard=G.modifiers&&G.modifiers.split('|').some(m=>m.trim()==='no-discard');
  G.disc=noDiscard?0:(CFG.discard_count||3);
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
}
