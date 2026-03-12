'use strict';
// ══════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════
let shopPool=[]; // current treat pool shown
let shopBoughtIds=new Set(); // treats bought this shop visit
// REROLL_COST now comes from CFG.reroll_cost (loaded from sheets)
const REROLL_COST_DEFAULT=1;
function getRerollCost(){return CFG.reroll_cost||REROLL_COST_DEFAULT;}

function generateShopPool(){
  const totalSellable=G.bpGroups.reduce((s,grp)=>s+grp.tdef.sp,0);
  const available=TDEFS.filter(td=>!G.purchasedTreatIds.has(td.id));
  const canAfford=available.filter(td=>G.cash>=td.pr);
  const canAffordWithSelling=available.filter(td=>G.cash<td.pr&&G.cash+totalSellable>=td.pr);
  const expensive=available.filter(td=>G.cash+totalSellable<td.pr);
  sfl(canAfford);sfl(canAffordWithSelling);sfl(expensive);
  return [...canAfford,...canAffordWithSelling,...expensive].slice(0,3);
}

function openShop(){
  const isFirst=G.round===1&&!G.visitedShop;
  G.visitedShop=true;
  G.shopVisitedThisRound=true;
  shopBoughtIds=new Set();
  g('shop-sub').textContent=isFirst?'"stock up before the round!"':'"back for more treats!"';
  g('shop-cash').textContent=G.cash;
  shopPool=generateShopPool();
  renderShopFull();
  show('s-shop');
}

function leaveShop(){
  // commit any pending shop treats (already in bpGroups — they were placed during drag)
  // cancel any held shop treat
  if(H.kind==='shop-treat'){
    H=resetH();
    updateGhost();hideHUD();
  }
  openRounds();
}

function rerollTreats(){
  if(G.cash<getRerollCost())return;
  G.cash-=getRerollCost();
  shopPool=generateShopPool();
  renderShopFull();
}

function renderShopFull(){
  const rcEl=g('reroll-cost');if(rcEl)rcEl.textContent='$'+getRerollCost();
  g('shop-cash').textContent=G.cash;
  renderShopBPGrid();
  renderShopBPList();
  renderTreatsRow();
  // reroll button disabled if broke
  const rr=g('treats-reroll');
  if(rr){rr.disabled=G.cash<getRerollCost();const rc=g('reroll-cost');if(rc)rc.textContent='$'+getRerollCost();}
}

// ── Backpack grid (mirror of game BP, shown in shop center) ──
function renderShopBPGrid(){
  const grid=g('shop-bpg');if(!grid)return;
  const cs=42;
  grid.style.gridTemplateColumns=`repeat(${getBPC()},${cs}px)`;
  grid.innerHTML='';
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++){
    const div=document.createElement('div');
    div.className='sp-bpc';
    div.style.width=cs+'px';div.style.height=cs+'px';
    const bd=G.bp[r][c];
    if(bd.filled){
      div.classList.add('ft');
      div.style.background=bd.col+'bb';
      div.style.borderColor=bd.col;
      div.style.position='relative';
      div.textContent=bd.em||'';
      // Rearrange: drag from shop BP
      div.addEventListener('mousedown',(e)=>{
        if(H.kind==='shop-treat')return;
        if(e.button!==0)return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        removeBpGid(gid);
        H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
        updateGhost();showHUD();renderShopBPGrid();
      });
      // Touch: drag from shop BP
      div.addEventListener('touchstart',(e)=>{
        if(H.kind==='shop-treat')return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.preventDefault();
        e.stopPropagation();
        _touchMovedWhileHeld=false;
        removeBpGid(gid);
        H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
        updateGhost();showHUD();renderShopBPGrid();
      },{passive:false});
    }
    div.addEventListener('mouseenter',(e)=>{shopBPEnter(r,c);showShopBPTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveShopBPTip(e));
    div.addEventListener('mouseleave',()=>{shopBPLeave();hideShopBPTip();});
    div.addEventListener('mouseup',()=>shopDropOnBP(r,c));
    div.addEventListener('click',()=>shopDropOnBP(r,c));
    grid.appendChild(div);
  }
}

function shopBPEnter(r,c){
  if(H.kind!=='shop-treat'&&H.kind!=='treat')return;
  document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
  const anchorR=r-H.grabDr, anchorC=c-H.grabDc;
  const ok=bpCanAt(H.cells,anchorR,anchorC);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=anchorR+dr,cc=anchorC+dc;
    if(rr>=0&&rr<getBPR()&&cc>=0&&cc<getBPC()){
      const idx=rr*getBPC()+cc;
      const el=g('shop-bpg').querySelectorAll('.sp-bpc')[idx];
      if(el)el.classList.add(ok?'ok':'bad');
    }
  }));
}
function shopBPLeave(){
  document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
}
function showShopBPTip(e,r,c){
  if(H.kind==='shop-treat'||H.kind==='treat')return;
  const bd=G.bp[r][c];if(!bd.filled||!bd.tdef)return;
  const td=bd.tdef;
  const tip=g('board-tip');
  tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}`;
  tip.style.display='block';
  moveShopBPTip(e);
}
function moveShopBPTip(e){moveTip(e);}
function hideShopBPTip(){g('board-tip').style.display='none';}

// ── Backpack inventory list with sell buttons ──
function renderShopBPList(){
  const el=g('shop-bp-list');if(!el)return;
  el.innerHTML='';
  if(G.bpGroups.length===0){
    el.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,.35);font-style:italic;text-align:center;padding:6px;">Backpack is empty</div>';
    return;
  }
  G.bpGroups.forEach(grp=>{
    const t=grp.tdef;
    const d=document.createElement('div');
    d.className='sp-inv-row';
    d.innerHTML=`<span class="sp-inv-em">${t.em}</span>
      <span class="sp-inv-nm">${t.nm}</span>
      <button class="sp-inv-sell" onclick="sellTreatFromShop('${grp.gid}')">Sell $${t.sp}</button>`;
    el.appendChild(d);
  });
}

// ── Treat cards row ──
function renderTreatsRow(){
  const row=g('treats-row');if(!row)return;
  row.innerHTML='';
  // only show items not yet purchased, sorted: affordable first
  const totalSellable=G.bpGroups.reduce((s,grp)=>s+grp.tdef.sp,0);
  const available=shopPool.filter(td=>!shopBoughtIds.has(td.id)).sort((a,b)=>{
    const canA=G.cash>=a.pr;
    const canB=G.cash>=b.pr;
    const canSellA=G.cash+totalSellable>=a.pr;
    const canSellB=G.cash+totalSellable>=b.pr;
    if(canA!==canB) return canA?-1:1;
    if(canSellA!==canSellB) return canSellA?-1:1;
    return 0;
  });
  const flavors=available.filter(t=>t.fl).map(t=>t.fl);
  const flavorEl=g('treats-flavor');
  if(flavorEl) flavorEl.textContent=flavors[0]||'';
  available.forEach(td=>{
    const broke=G.cash<td.pr;
    const noSpc=!bpCanFit(td.bpS);
    const dis=broke||noSpc;
    const card=document.createElement('div');
    card.className='tc'+(dis?' tc-dis':'');

    // backpack shape mini grid
    const cols=td.bpS[0].length;
    let shapeHtml=`<div class="tc-shape"><div style="display:grid;grid-template-columns:repeat(${cols},16px);gap:2px;background:rgba(0,0,0,.07);padding:4px;border-radius:6px;">`;
    td.bpS.forEach(row=>row.forEach(v=>{
      shapeHtml+=`<div style="width:16px;height:16px;border-radius:3px;background:${v?td.col+'ee':'rgba(0,0,0,.08)'};border:1px solid ${v?td.col+'88':'rgba(0,0,0,.08)'}"></div>`;
    }));
    shapeHtml+='</div></div>';

    const priceClass=dis?'tc-price sold':'tc-price';
    card.innerHTML=`
      <div class="tc-em">${td.em}</div>
      ${shapeHtml}
      <div class="tc-info">
        <div class="tc-nm">${td.nm}</div>
        <div class="tc-ef">${td.ef}</div>
        ${td.req?`<div style="font-size:7px;color:var(--or);font-weight:800;margin-top:1px;">${td.req}</div>`:''}
        ${noSpc&&!broke?'<div style="font-size:7px;color:var(--re);">Bag full!</div>':''}
      </div>
      <div class="tc-right">
        <div class="${priceClass}"><div class="tc-price-coin">🪙</div>${td.pr}</div>
      </div>`;

    if(!dis){
      card.style.cursor='grab';
      card.addEventListener('mousedown',(e)=>{if(e.button===0)shopPickupTreat(td);});
      card.addEventListener('touchstart',(e)=>{
        e.preventDefault();
        _touchMovedWhileHeld=false;
        shopPickupTreat(td);
      },{passive:false});
    }
    row.appendChild(card);
  });
}

function shopPickupTreat(td){
  // Pick up a treat from shop to drag into backpack
  if(G.cash<td.pr)return;
  dropHeld();
  H={kind:'shop-treat',source:'shop',data:td,cells:td.bpS,rot:0,
     color:td.col,em:td.em,handIdx:null,boardGid:null,bpGid:null,
     grabDr:Math.floor(td.bpS.length/2),grabDc:Math.floor(td.bpS[0].length/2),dragging:true};
  updateGhost();showHUD();
}

function shopDropOnBP(r,c){
  if(H.kind==='treat'){
    const or=r-H.grabDr, oc=c-H.grabDc;
    if(!bpCanAt(H.cells,or,oc))return;
    bpPlaceAt(H.data,H.cells,or,oc);
    H=resetH();
    updateGhost();hideHUD();clrBPPrev();
    renderShopFull();
    return;
  }
  if(H.kind!=='shop-treat')return;
  const td=H.data;
  if(G.cash<td.pr){dropHeld();return;}
  // apply grab offset (same as rearrange)
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!bpCanAt(H.cells,or,oc)){dropHeld();return;}
  G.cash-=td.pr;
  bpPlaceAt(td,H.cells,or,oc);
  shopBoughtIds.add(td.id);
  G.purchasedTreatIds.add(td.id);
  H=resetH();
  updateGhost();hideHUD();
  renderShopFull();
}
