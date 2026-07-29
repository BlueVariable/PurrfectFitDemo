'use strict';
// ══════════════════════════════════════════════════════
//  HELD MECHANICS
// ══════════════════════════════════════════════════════
function snapGrab(cells,dr,dc){
  if(cells[dr]&&cells[dr][dc])return[dr,dc];
  let best=null,bestD=Infinity;
  for(let r=0;r<cells.length;r++)for(let c=0;c<cells[0].length;c++)
    if(cells[r][c]){const d=(r-dr)**2+(c-dc)**2;if(d<bestD){bestD=d;best=[r,c];}}
  return best||[dr,dc];
}
function pickupCat(idx){
  // if already holding this cat, cancel
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const _cells0=rotC(cat.cells,0);
  const[_gDr,_gDc]=snapGrab(_cells0,Math.floor(_cells0.length/2),Math.floor(_cells0[0].length/2));
  H={kind:'cat',source:'hand',data:cat,cells:_cells0,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:_gDr,grabDc:_gDc,dragging:false};
  updateGhost();showHUD();renderHand();renderBP();
  updateTrashZone();
}

function pickupCatWithGrab(idx,grabDr,grabDc){
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const cells=rotC(cat.cells,0);
  const[cDr,cDc]=snapGrab(cells,Math.floor(cells.length/2),Math.floor(cells[0].length/2));
  H={kind:'cat',source:'hand',data:cat,cells,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:cDr,grabDc:cDc,dragging:true};
  updateGhost();showHUD();renderHand();renderBP();
  updateTrashZone();
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
  const pickedShape=grp.shapeGrid||rotC(grp.cat.cells,0);
  // `pickedShape` is the grid the cat was PLACED with, so H.rot must be the
  // rotation that produced it — not 0. The ghost draws the illustration at
  // H.rot (updateGhost) and `rotate()` continues from it, so claiming 0 for a
  // cat lifted back off the board drew the art off-axis inside its own
  // footprint and made the first R press snap it back to the base pose.
  const pickedRot=rotOfGrid(grp.cat.cells,pickedShape);
  const gDr=Math.max(0,Math.min(pickedShape.length-1,r-(grp.or??r)));
  const gDc=Math.max(0,Math.min(pickedShape[0].length-1,c-(grp.oc??c)));
  H={kind:'cat',source:'board',data:grp.cat,cells:pickedShape,rot:pickedRot,
     color:grp.cat.col,em:grp.cat.em,handIdx:idx,boardGid:grp.gid,bpGid:null,
     grabDr:gDr,grabDc:gDc,dragging:false};
  updateGhost();showHUD();renderAll();
}

function pickupTreat(){
  // called from "Place on board" button in treat tooltip
  if(!G.selBpGid)return;
  const grp=G.bpGroups.find(g=>g.gid===G.selBpGid);
  if(!grp)return;
  dropHeld();
  // remove from BP, remembering the player's saved pose (spot + rotation)
  const pose=bpPoseOf(grp);
  removeBpGid(G.selBpGid);
  G.selBpGid=null;hideTTP();
  const[_tDr,_tDc]=snapGrab(pose.shape,Math.floor(pose.shape.length/2),Math.floor(pose.shape[0].length/2));
  H={kind:'treat',source:'bp',data:grp.tdef,cells:pose.shape,rot:pose.rot,
     color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:grp.gid,
     grabDr:_tDr,grabDc:_tDc,dragging:false,bpOrigin:pose};
  updateGhost();showHUD();renderBP();
}

function dropHeld(){
  if(!H.kind)return;
  if(H.kind==='treat'&&(H.source==='bp'||H.source==='board')){
    // Revert to the exact cells/rotation it was picked up from (its origin
    // cells stay free while it is held); auto-fit only if that spot is gone.
    bpReturnTreat(H.data,H.bpOrigin||null);
  }
  H=resetH();
  updateGhost();hideHUD();renderHand();renderBP();
  clrBoardPrev(); // also clears the Feature 2b paw tip / affected-cell pulse (e.g. ESC-cancel mid-hover)
  if(g('shop-bpg'))renderShopFull();
  const _teDrop=g('trash-drop');if(_teDrop)_teDrop._hover=false;
  updateTrashZone();
}

function rotate(){
  if(!H.kind)return;
  H.rot=(H.rot+1)%4;
  if(H.kind==='cat'){
    H.cells=rotC(H.data.cells,H.rot);
    [H.grabDr,H.grabDc]=snapGrab(H.cells,Math.floor(H.cells.length/2),Math.floor(H.cells[0].length/2));
  } else if(H.kind==='treat'||H.kind==='shop-treat'){
    H.cells=rotC(H.data.bpS,H.rot);
    [H.grabDr,H.grabDc]=snapGrab(H.cells,Math.floor(H.cells.length/2),Math.floor(H.cells[0].length/2));
  }
  updateGhost();
  clrBoardPrev();clrBPPrev();shopBPLeave();
  // re-fire hover preview if we know last hovered cell
  if(H._lastBoardR!==undefined) onBoardEnter(H._lastBoardR,H._lastBoardC);
  if(H._lastBpR!==undefined) onBPEnter(H._lastBpR,H._lastBpC);
  if(H._lastShopBpR!==undefined) shopBPEnter(H._lastShopBpR,H._lastShopBpC);
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
        trashEl._hover=false;
        doDiscard();return;
      }
    }
    if(trashEl){trashEl._hover=false;updateTrashZone();}
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
        bpReturnTreat(H.data,H.bpOrigin||null);H=resetH();updateGhost();hideHUD();renderShopFull();return;
      }
    }
    const boardEl=g('board');
    if(!boardEl){bpReturnTreat(H.data,H.bpOrigin||null);H=resetH();updateGhost();hideHUD();renderBP();if(g('shop-bpg'))renderShopFull();return;}
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
        // Can't place — revert to its remembered backpack spot
        bpReturnTreat(H.data,H.bpOrigin||null);
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
          // Otherwise (gap between cells or illegal spot), revert to where it was.
          bpReturnTreat(H.data,H.bpOrigin||null);
          H=resetH();
          updateGhost();hideHUD();clrBoardPrev();renderBP();
          if(g('shop-bpg'))renderShopFull();return;
        }
      }
      // Outside board + not on BP — revert to its remembered backpack spot
      bpReturnTreat(H.data,H.bpOrigin||null);
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

// A held treat is drawn at the pitch of whatever it is about to drop into, and
// the board and the inventory are different sizes — so crossing between them
// has to redraw the ghost. Only fires on the crossing, not on every pixel.
function ghostRetarget(cx,cy){
  if(H.kind!=='treat')return;
  const b=g('board');
  let over=false;
  if(b){
    const r=b.getBoundingClientRect();
    over=r.width>0&&cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom;
  }
  if(over===!!H._overBoard)return;
  H._overBoard=over;
  updateGhost();
}

// ghost follows mouse
document.addEventListener('mousemove',e=>{
  if(!H.kind){g('ghost').style.display='none';return;}
  ghostRetarget(e.clientX,e.clientY);
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=e.clientX+'px';
  gh.style.top=e.clientY+'px';
  // discard pill hover highlight
  trashHoverAt(e.clientX,e.clientY);
});

// Keeps the discard pill's hover state in step with the pointer, mouse or touch.
function trashHoverAt(cx,cy){
  const trashEl=g('trash-drop');
  if(!trashEl)return;
  if(H.kind==='cat'&&G.disc>0){
    const tr=trashEl.getBoundingClientRect();
    trashEl._hover=cx>=tr.left&&cx<=tr.right&&cy>=tr.top&&cy<=tr.bottom;
  } else trashEl._hover=false;
  updateTrashZone();
}

// ghost follows touch + simulate hover over board/bp cells
document.addEventListener('touchmove',e=>{
  if(!H.kind)return;
  e.preventDefault();
  _touchMovedWhileHeld=true;
  const{clientX,clientY}=getCoords(e);
  ghostRetarget(clientX,clientY);
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=clientX+'px';
  gh.style.top=clientY+'px';
  simulateTouchHover(clientX,clientY);
  trashHoverAt(clientX,clientY);
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
    // Fall back: revert treat to its remembered backpack spot
    bpReturnTreat(H.data,H.bpOrigin||null);H=resetH();updateGhost();hideHUD();renderBP();clrBoardPrev();
    if(g('shop-bpg'))renderShopFull();
    return;
  }
  if(H.kind==='cat'){
    // Check trash drop first
    const trashEl=g('trash-drop');
    if(trashEl&&G.disc>0){
      const tr=trashEl.getBoundingClientRect();
      if(cx>=tr.left&&cx<=tr.right&&cy>=tr.top&&cy<=tr.bottom){
        trashEl._hover=false;
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

// The pitch of the grid the held piece is about to drop into, so what you hold
// is exactly the size of the hole it is heading for. Cats always mean the
// board. Treats used to be pinned to a 26px doll's-house copy no matter what,
// which read as a different, much smaller object than the slot it was aimed at
// — most obviously while dragging a purchase into the pet shop's inventory,
// whose cells are four times that. They now measure the same way: the board
// while the cursor is over it, otherwise whichever inventory grid is on screen.
function heldPitch(){
  const board=g('board');
  const bGap=board?parseFloat(getComputedStyle(board).columnGap):NaN;
  const boardPitch={cs:window._boardCellSize||38,gap:isFinite(bGap)?bGap:3};
  if(H.kind==='cat')return boardPitch;
  if(H._overBoard&&board&&board.getBoundingClientRect().width>0)return boardPitch;
  // A grid on a hidden screen measures 0 — that is how we tell which of the two
  // inventories (game scene / pet shop) is the live one.
  for(const[id,sel]of[['shop-bpg','.sp-bpc'],['bpg','.bpc']]){
    const grid=g(id);if(!grid)continue;
    const cell=grid.querySelector(sel);if(!cell)continue;
    const w=cell.getBoundingClientRect().width;
    if(w>1){
      const gp=parseFloat(getComputedStyle(grid).columnGap);
      return{cs:w,gap:isFinite(gp)?gp:3};
    }
  }
  return boardPitch;
}

// Skin styling for the carried treat: a bold rim so the piece stays legible
// over a busy board, sized off the pitch so it holds up at every cell size.
function ghostSkinOpts(cs){
  return{fill:H.color,stroke:'rgba(255,255,255,.66)',
         bw:Math.max(2,Math.round(cs*0.028)),
         rad:Math.max(4,Math.round(cs*0.16))};
}

function updateGhost(){
  // Every H change funnels through here (mouse and touch, pickup and drop, on
  // every screen), so the pet shop's SELL BACK plate keeps itself in step from
  // this one seam rather than from each individual pickup site.
  if(typeof shopSellLabel==='function')shopSellLabel();
  if(!H.kind){g('ghost').style.display='none';return;}
  const cells=H.cells;
  const cols=cells[0].length;
  const isTreat=H.kind==='treat'||H.kind==='shop-treat';
  const{cs,gap}=heldPitch();
  const grid=g('gh-grid');
  grid.style.gridTemplateColumns=`repeat(${cols},${cs}px)`;
  grid.style.gap=gap+'px';
  grid.style.position='relative';
  grid.innerHTML='';
  // Resolve cat art so the drag ghost shows the illustration (not blocks),
  // matching the board/hand rendering. Treats (no shape/type) return null.
  const catInfo=(H.kind==='cat'&&typeof catArtInfo==='function')?catArtInfo(H.data&&H.data.shape,H.data&&H.data.type):null;
  cells.forEach((row,r)=>row.forEach((v,c)=>{
    const d=document.createElement('div');
    d.className='gh-cell';
    d.style.width=cs+'px';d.style.height=cs+'px';
    if(isTreat){
      // One solid tetromino: the cell is only a spacer, the silhouette is
      // painted into it and bleeds across the gap (js/piece.js).
      d.style.background='transparent';d.style.border='none';d.style.position='relative';
      if(v)paintPieceCell(d,shapeHas(cells),r,c,cs,gap,ghostSkinOpts(cs));
    }
    else if(v){d.style.background=catInfo?H.color+'33':H.color;d.style.borderColor=catInfo?'rgba(255,255,255,.35)':'rgba(255,255,255,.55)';}
    else{d.style.background='transparent';d.style.border='none';}
    grid.appendChild(d);
  }));
  // …and one emoji, sitting on the middle of the whole piece rather than being
  // stamped once per cell.
  if(isTreat&&H.em){
    const filled=[];
    cells.forEach((row,r)=>row.forEach((v,c)=>{if(v)filled.push([r,c]);}));
    const spot=pieceLabelSpot(filled,cs,gap);
    const host=spot&&grid.children[spot.r*cols+spot.c];
    if(host)host.appendChild(pieceLabelEl(H.em,spot.dx,spot.dy,Math.round(cs*0.5)));
  }
  // Illustration overlay across the (already-rotated) ghost bounding box.
  if(catInfo){
    const rows=cells.length;
    const fullW=cols*cs+(cols-1)*gap, fullH=rows*cs+(rows-1)*gap;
    const total=(catInfo.drawRot+(H.rot||0))%4;
    const odd=total%2===1;
    const imgW=odd?fullH:fullW, imgH=odd?fullW:fullH;
    const wrap=document.createElement('div');
    wrap.className='cat-art-board';
    wrap.style.cssText=`left:0;top:0;width:${fullW}px;height:${fullH}px;`;
    const img=document.createElement('img');
    img.className='cat-art-img';img.src=catInfo.src;img.alt='';
    img.style.cssText=`width:${imgW}px;height:${imgH}px;transform:rotate(${total*90}deg)${catInfo.mirror?' scaleX(-1)':''};`;
    wrap.appendChild(img);grid.appendChild(wrap);
  }
  // Position ghost so the (grabDr, grabDc) cell sits exactly at the cursor.
  const offX=H.grabDc*(cs+gap)+cs/2;
  const offY=H.grabDr*(cs+gap)+cs/2;
  g('ghost').style.transform=`translate(${-offX}px,${-offY}px)`;
}

function showHUD(){g('ihud').classList.add('on');}
function hideHUD(){g('ihud').classList.remove('on');}
