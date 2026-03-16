'use strict';
// ══════════════════════════════════════════════════════
//  HELD MECHANICS
// ══════════════════════════════════════════════════════
function pickupCat(idx){
  // if already holding this cat, cancel
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const _cells0=rotC(cat.cells,0);
  H={kind:'cat',source:'hand',data:cat,cells:_cells0,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:Math.floor(_cells0.length/2),grabDc:Math.floor(_cells0[0].length/2),dragging:false};
  updateGhost();showHUD();renderHand();renderBP();
  const _tb=g('trash-badge');if(_tb)_tb.textContent=G.disc;
  const _te=g('trash-drop');if(_te)_te.classList.toggle('no-disc',G.disc<=0);
}

function pickupCatWithGrab(idx,grabDr,grabDc){
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const cells=rotC(cat.cells,0);
  // always snap to center of the shape
  const cDr=Math.floor(cells.length/2);
  const cDc=Math.floor(cells[0].length/2);
  H={kind:'cat',source:'hand',data:cat,cells,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:cDr,grabDc:cDc,dragging:true};
  updateGhost();showHUD();renderHand();renderBP();
  const _tb2=g('trash-badge');if(_tb2)_tb2.textContent=G.disc;
  const _te2=g('trash-drop');if(_te2)_te2.classList.toggle('no-disc',G.disc<=0);
}

function pickupCatFromBoard(r,c){
  const bd=G.board[r][c];
  if(!bd.filled||bd.kind!=='cat')return;
  const grp=G.cats.find(g=>g.cells.some(([gr,gc])=>gr===r&&gc===c));
  if(!grp)return;
  // lift all cells off board
  grp.cells.forEach(([gr,gc])=>G.board[gr][gc]=emptyCell());
  G.cats=G.cats.filter(g=>g.gid!==grp.gid);
  // put back in hand temporarily
  G.hand.push(grp.cat);
  const idx=G.hand.length-1;
  const _bCells=rotC(grp.cat.cells,0);
  H={kind:'cat',source:'board',data:grp.cat,cells:_bCells,rot:0,
     color:grp.cat.col,em:grp.cat.em,handIdx:idx,boardGid:grp.gid,bpGid:null,
     grabDr:Math.floor(_bCells.length/2),grabDc:Math.floor(_bCells[0].length/2),dragging:false};
  updateGhost();showHUD();renderAll();
}

function pickupTreat(){
  // called from "Place on board" button in treat tooltip
  if(!G.selBpGid)return;
  const grp=G.bpGroups.find(g=>g.gid===G.selBpGid);
  if(!grp)return;
  dropHeld();
  // remove from BP
  removeBpGid(G.selBpGid);
  G.selBpGid=null;hideTTP();
  H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
     color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:grp.gid,
     grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:false};
  updateGhost();showHUD();renderBP();
}

function dropHeld(){
  if(!H.kind)return;
  if(H.kind==='treat'&&(H.source==='bp'||H.source==='board')){
    bpAutoPlace(H.data);
  }
  H=resetH();
  updateGhost();hideHUD();renderHand();renderBP();
  if(g('shop-bpg'))renderShopFull();
  const _teDrop=g('trash-drop');if(_teDrop){_teDrop.classList.remove('drag-active');_teDrop._hover=false;}
}

function rotate(){
  if(!H.kind)return;
  H.rot=(H.rot+1)%4;
  if(H.kind==='cat'){
    H.cells=rotC(H.data.cells,H.rot);
    H.grabDr=Math.floor(H.cells.length/2);
    H.grabDc=Math.floor(H.cells[0].length/2);
  } else if(H.kind==='treat'||H.kind==='shop-treat'){
    H.cells=rotC(H.data.bpS,H.rot);
    H.grabDr=Math.floor(H.cells.length/2);
    H.grabDc=Math.floor(H.cells[0].length/2);
  }
  updateGhost();
  clrBoardPrev();clrBPPrev();
  // re-fire hover preview if we know last hovered cell
  if(H._lastBoardR!==undefined) onBoardEnter(H._lastBoardR,H._lastBoardC);
  if(H._lastBpR!==undefined) onBPEnter(H._lastBpR,H._lastBpC);
}

// right-click = rotate
document.addEventListener('contextmenu',e=>{e.preventDefault();rotate();});
// R key = rotate
document.addEventListener('keydown',e=>{
  if(e.key==='r'||e.key==='R') rotate();
  if(e.key==='Escape') dropHeld();
});
// Global mouseup — unified drag-drop handler
document.addEventListener('mouseup',e=>{
  if(e.button!==0)return; // ignore right/middle clicks
  // Shop treat dropped on shop backpack grid
  if(H.kind==='shop-treat'){
    const bpEl=g('shop-bpg');
    if(!bpEl){H=resetH();updateGhost();hideHUD();return;}
    const rect=bpEl.getBoundingClientRect();
    const inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
    if(!inside){
      H=resetH();
      updateGhost();hideHUD();
      document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
    }
    // If inside, the shopBPEnter+shopDropOnBP click handler handles it
    return;
  }

  // Cat dragged to trash can — discard
  if(H.kind==='cat'){
    const trashEl=g('trash-drop');
    if(trashEl&&G.disc>0){
      const tr=trashEl.getBoundingClientRect();
      if(e.clientX>=tr.left&&e.clientX<=tr.right&&e.clientY>=tr.top&&e.clientY<=tr.bottom){
        trashEl._hover=false;trashEl.classList.remove('drag-active');
        doDiscard();return;
      }
    }
    trashEl&&(trashEl._hover=false,trashEl.classList.remove('drag-active'));
  }

  // Game treat dragged from BP — drop on board cell under mouse
  if(H.kind==='treat'){
    // If dropped on shop BP grid, shopDropOnBP cell handler may have already placed it.
    // If H was reset, we won't reach here. Otherwise (gap/failed placement), return to BP.
    const shopBpEl=g('shop-bpg');
    if(shopBpEl){
      const sr=shopBpEl.getBoundingClientRect();
      if(e.clientX>=sr.left&&e.clientX<=sr.right&&e.clientY>=sr.top&&e.clientY<=sr.bottom){
        if(!H.kind)return; // shopDropOnBP already handled it
        bpAutoPlace(H.data);H=resetH();updateGhost();hideHUD();renderShopFull();return;
      }
    }
    const boardEl=g('board');
    if(!boardEl){bpAutoPlace(H.data);H=resetH();updateGhost();hideHUD();renderBP();if(g('shop-bpg'))renderShopFull();return;}
    const boardRect=boardEl.getBoundingClientRect();
    const inside=e.clientX>=boardRect.left&&e.clientX<=boardRect.right&&e.clientY>=boardRect.top&&e.clientY<=boardRect.bottom;
    if(inside){
      // Find which cell we're over using element from point
      const el=document.elementFromPoint(e.clientX,e.clientY);
      const boardCells=boardEl.querySelectorAll('.cell');
      let anchorR=-1,anchorC=-1;
      boardCells.forEach((cell,idx)=>{
        if(cell===el||cell.contains(el)){
          anchorR=Math.floor(idx/G.bsc); anchorC=idx%G.bsc;
        }
      });
      let found=false;
      if(anchorR>=0){
        const or=anchorR-H.grabDr, oc=anchorC-H.grabDc;
        if(boardCanPlace(H.cells,or,oc)){
          placeTreatOnBoard(anchorR,anchorC); // handles H reset + renderAll
          found=true;
        }
      }
      if(found){
        // placeTreatOnBoard already reset H and rendered
      } else {
        // Can't place — return to BP
        bpAutoPlace(H.data);
        H=resetH();
        updateGhost();hideHUD();renderBP();clrBoardPrev();
      }
    } else {
      // Check if dropped on game backpack grid (rearrange)
      const bpGridEl=g('bpg');
      if(bpGridEl){
        const bpRect=bpGridEl.getBoundingClientRect();
        const onBP=e.clientX>=bpRect.left&&e.clientX<=bpRect.right&&e.clientY>=bpRect.top&&e.clientY<=bpRect.bottom;
        if(onBP){
          // If onBPMouseUp already placed the treat, H was reset and we never reach here.
          // Otherwise (gap between cells or placement failed), return treat to BP.
          bpAutoPlace(H.data);
          H=resetH();
          updateGhost();hideHUD();clrBoardPrev();renderBP();
          if(g('shop-bpg'))renderShopFull();return;
        }
      }
      // Outside board + not on BP — return to BP
      bpAutoPlace(H.data);
      H=resetH();
      updateGhost();hideHUD();renderBP();clrBoardPrev();
      if(g('shop-bpg'))renderShopFull();
    }
  }
});

// Global touchend — handle drops for touch drag gestures
document.addEventListener('touchend',e=>{
  if(!H.kind)return;
  if(!_touchMovedWhileHeld)return; // was a tap not a drag — let click/touchstart handle it
  _touchMovedWhileHeld=false;
  const{clientX,clientY}=getCoords(e);
  handleTouchDrop(clientX,clientY);
});

// ghost follows mouse
document.addEventListener('mousemove',e=>{
  if(!H.kind){g('ghost').style.display='none';return;}
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=e.clientX+'px';
  gh.style.top=e.clientY+'px';
  // trash can hover highlight
  const trashEl=g('trash-drop');
  if(trashEl&&H.kind==='cat'&&G.disc>0){
    const tr=trashEl.getBoundingClientRect();
    const over=e.clientX>=tr.left&&e.clientX<=tr.right&&e.clientY>=tr.top&&e.clientY<=tr.bottom;
    trashEl._hover=over;
    trashEl.classList.toggle('drag-active',over);
  }
});

// ghost follows touch + simulate hover over board/bp cells
document.addEventListener('touchmove',e=>{
  if(!H.kind)return;
  e.preventDefault();
  _touchMovedWhileHeld=true;
  const{clientX,clientY}=getCoords(e);
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=clientX+'px';
  gh.style.top=clientY+'px';
  simulateTouchHover(clientX,clientY);
},{passive:false});

// Simulate mouseenter/leave on board and BP cells during touch drag
function simulateTouchHover(cx,cy){
  const el=document.elementFromPoint(cx,cy);
  // Board cells
  const boardEl=g('board');
  if(boardEl){
    const cells=boardEl.querySelectorAll('.cell');
    let bR=-1,bC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){bR=Math.floor(idx/G.bsc);bC=idx%G.bsc;}});
    if(bR>=0&&(bR!==H._lastBoardR||bC!==H._lastBoardC)){
      H._lastBoardR=bR;H._lastBoardC=bC;delete H._lastBpR;onBoardEnter(bR,bC);
    }else if(bR<0&&H._lastBoardR!==undefined){
      delete H._lastBoardR;delete H._lastBoardC;onBoardLeave();
    }
  }
  // Game BP cells
  const bpEl=g('bpg');
  if(bpEl){
    const cells=bpEl.querySelectorAll('.bpc');
    let pR=-1,pC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){pR=Math.floor(idx/getBPC());pC=idx%getBPC();}});
    if(pR>=0&&(pR!==H._lastBpR||pC!==H._lastBpC)){
      H._lastBpR=pR;H._lastBpC=pC;delete H._lastBoardR;onBPEnter(pR,pC);
    }else if(pR<0&&H._lastBpR!==undefined){
      delete H._lastBpR;delete H._lastBpC;onBPLeave();
    }
  }
  // Shop BP cells
  const shopBpEl=g('shop-bpg');
  if(shopBpEl){
    const cells=shopBpEl.querySelectorAll('.sp-bpc');
    let sR=-1,sC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){sR=Math.floor(idx/getBPC());sC=idx%getBPC();}});
    if(sR>=0)shopBPEnter(sR,sC);else shopBPLeave();
  }
}

// Find a grid cell under point by checking bounding rects
function cellAtPoint(cells,cx,cy){
  let found=-1;
  cells.forEach((cell,idx)=>{const r=cell.getBoundingClientRect();if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom)found=idx;});
  return found;
}

// Handle touch-based drop: place held piece at the finger's lifted position
function handleTouchDrop(cx,cy){
  if(H.kind==='shop-treat'){
    const bpEl=g('shop-bpg');
    if(!bpEl){H=resetH();updateGhost();hideHUD();return;}
    const cells=bpEl.querySelectorAll('.sp-bpc');
    const idx=cellAtPoint(cells,cx,cy);
    if(idx>=0){shopDropOnBP(Math.floor(idx/getBPC()),idx%getBPC());}
    else{H=resetH();updateGhost();hideHUD();document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));}
    return;
  }
  if(H.kind==='treat'){
    // Try shop BP first
    const shopBpEl=g('shop-bpg');
    if(shopBpEl){
      const cells=shopBpEl.querySelectorAll('.sp-bpc');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){shopDropOnBP(Math.floor(idx/getBPC()),idx%getBPC());return;}
    }
    // Try game board
    const boardEl=g('board');
    if(boardEl){
      const cells=boardEl.querySelectorAll('.cell');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){
        const r=Math.floor(idx/G.bsc),c=idx%G.bsc;
        const or=r-H.grabDr,oc=c-H.grabDc;
        if(boardCanPlace(H.cells,or,oc)){placeTreatOnBoard(r,c);return;}
      }
    }
    // Try game BP
    const bpEl=g('bpg');
    if(bpEl){
      const cells=bpEl.querySelectorAll('.bpc');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){const r=Math.floor(idx/getBPC()),c=idx%getBPC();onBPMouseUp(r,c);if(!H.kind)return;}
    }
    // Fall back: return treat to BP
    bpAutoPlace(H.data);H=resetH();updateGhost();hideHUD();renderBP();clrBoardPrev();
    if(g('shop-bpg'))renderShopFull();
    return;
  }
  if(H.kind==='cat'){
    // Check trash drop first
    const trashEl=g('trash-drop');
    if(trashEl&&G.disc>0){
      const tr=trashEl.getBoundingClientRect();
      if(cx>=tr.left&&cx<=tr.right&&cy>=tr.top&&cy<=tr.bottom){
        trashEl._hover=false;trashEl.classList.remove('drag-active');
        doDiscard();return;
      }
    }
    const boardEl=g('board');
    if(boardEl){
      const cells=boardEl.querySelectorAll('.cell');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){onBoardClick(Math.floor(idx/G.bsc),idx%G.bsc);return;}
    }
    dropHeld();
  }
}

function updateGhost(){
  if(!H.kind){g('ghost').style.display='none';return;}
  const cells=H.cells;
  const cols=cells[0].length;
  const cs=H.kind==='cat'?38:26;
  const grid=g('gh-grid');
  grid.style.gridTemplateColumns=`repeat(${cols},${cs}px)`;
  grid.style.gap='3px';
  grid.innerHTML='';
  cells.forEach(row=>row.forEach(v=>{
    const d=document.createElement('div');
    d.className='gh-cell';
    d.style.width=cs+'px';d.style.height=cs+'px';
    if(v){d.style.background=H.color;d.style.borderColor='rgba(255,255,255,.55)';}
    else{d.style.background='transparent';d.style.border='none';}
    grid.appendChild(d);
  }));
}

function showHUD(){g('ihud').classList.add('on');}
function hideHUD(){g('ihud').classList.remove('on');}
