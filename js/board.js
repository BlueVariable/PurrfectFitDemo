'use strict';
// ══════════════════════════════════════════════════════
//  BOARD INTERACTION
// ══════════════════════════════════════════════════════
function onBoardEnter(r,c){
  if(!H.kind)return;
  clrBoardPrev();
  if(H.kind==='treat'){
    const or=r-H.grabDr, oc=c-H.grabDc;
    const ok=boardCanPlace(H.cells,or,oc);
    H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
      if(!v)return;
      const rr=or+dr,cc=oc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc){
        const el=getBCell(rr,cc);
        if(el) el.classList.add(ok&&!G.board[rr][cc].filled?'ok':'bad');
      }
    }));
    return;
  }
  // offset placement by grab position
  const or=r-H.grabDr, oc=c-H.grabDc;
  const ok=boardCanPlace(H.cells,or,oc);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;
    const rr=or+dr,cc=oc+dc;
    if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc){
      const el=getBCell(rr,cc);
      if(el&&!G.board[rr][cc].filled) el.classList.add(ok?'ok':'bad');
    }
  }));
}
function onBoardLeave(){clrBoardPrev();}

function onBoardClick(r,c){
  if(!H.kind){
    // no held item — try to pick up
    const bd=G.board[r][c];
    if(bd.filled&&bd.kind==='cat'){pickupCatFromBoard(r,c);return;}
    if(bd.filled&&bd.kind==='treat'){
      // pick up treat for drag — clear board cells, hold in H
      const gid=bd.gid;
      const ti=G.treats.findIndex(t=>t.gid===gid);
      if(ti>=0){
        const treatGroup=G.treats[ti];
        treatGroup.cells.forEach(([tr,tc])=>{G.board[tr][tc]=emptyCell();});
        G.treats.splice(ti,1);
        const tdef=treatGroup.tdef;
        const pickedShape=treatGroup.shapeGrid||tdef.bpS;
        const gDr=Math.max(0,Math.min(pickedShape.length-1,r-(treatGroup.or??r)));
        const gDc=Math.max(0,Math.min(pickedShape[0].length-1,c-(treatGroup.oc??c)));
        H={kind:'treat',source:'board',data:tdef,cells:pickedShape,rot:0,
           color:tdef.col,em:tdef.em,handIdx:null,boardGid:gid,bpGid:null,
           grabDr:gDr,grabDc:gDc,dragging:false};
        updateGhost();showHUD();clrBoardPrev();renderAll();
      }
      return;
    }
    return;
  }

  if(H.kind==='cat')  { placeCatOnBoard(r,c); }
  if(H.kind==='treat') { placeTreatOnBoard(r,c); }
}

function placeCatOnBoard(r,c){
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!boardCanPlace(H.cells,or,oc))return;
  const gid=uid();const placed=[];
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    G.board[rr][cc]={filled:true,col:H.color,kind:'cat',em:H.em,gid,shape:H.data.shape,type:H.data.type};
    placed.push([rr,cc]);
  }));
  G.cats.push({cells:placed,col:H.color,shape:H.data.shape,type:H.data.type,cat:H.data,gid,or,oc,shapeGrid:H.cells});
  G.hand.splice(H.handIdx,1);
  H=resetH();updateGhost();hideHUD();clrBoardPrev();renderAll();checkBoardFull();
}
function placeTreatOnBoard(r,c){
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!boardCanPlace(H.cells,or,oc))return;
  const gid=uid();const placed=[];
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    G.board[rr][cc]={filled:true,col:H.color,kind:'treat',em:H.em,gid,shape:null,type:null};
    placed.push([rr,cc]);
  }));
  G.treats.push({cells:placed,gid,tdef:H.data,or,oc,shapeGrid:H.cells});
  H=resetH();updateGhost();hideHUD();clrBoardPrev();renderAll();checkBoardFull();
}

function boardCanPlace(cells,r,c){
  for(let dr=0;dr<cells.length;dr++) for(let dc=0;dc<cells[dr].length;dc++){
    if(!cells[dr][dc])continue;
    const rr=r+dr,cc=c+dc;
    if(rr>=G.bsr||cc>=G.bsc||rr<0||cc<0)return false;
    if(G.board[rr][cc].filled)return false;
    if(G.board[rr][cc].blocked)return false;
  }
  return true;
}

function clrBoardPrev(){document.querySelectorAll('.cell.ok,.cell.bad').forEach(c=>c.classList.remove('ok','bad'));}
function getBCell(r,c){return g('board').querySelectorAll('.cell')[r*G.bsc+c]||null;}

// ══════════════════════════════════════════════════════
//  BOARD ACTIONS
// ══════════════════════════════════════════════════════
function clearBoard(){
  G.cats.forEach(grp=>G.hand.push(grp.cat));
  G.treats.forEach(bt=>{
    // clear all board cells for this treat
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    bpAutoPlace(bt.tdef);
  });
  G.cats=[];G.treats=[];
  if(H.kind==='cat'||H.kind==='treat'){H=resetH();updateGhost();hideHUD();}
  mkBoard();renderAll();hideTTP();
}

function doDiscard(){
  if(H.kind!=='cat'||G.disc<=0)return;
  G.hand.splice(H.handIdx,1);
  G.disc--;
  H=resetH();updateGhost();hideHUD();
  if(G.deck.length>0)G.hand.push(G.deck.shift());
  renderAll();
}

