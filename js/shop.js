'use strict';
// ══════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════
let shopPool=[]; // current treat pool shown
// Treats bought off the CURRENT stock. Their card stays on the shelf stamped
// SOLD instead of vanishing, so a purchase never reflows the shelf under the
// player's cursor. Cleared on restock — fresh stock never opens stamped.
let shopBoughtIds=new Set();
let rerollExtraCost=0; // count of rerolls purchased this round; resets each round
// REROLL_COST now comes from CFG.reroll_cost (loaded from sheets).
// reroll_cost is an escalating comma-separated list (e.g. "3,5,8,12"): each
// reroll in a round costs the next value; rerolls past the list clamp to the
// last value. A single number ("3") is treated as a one-element list.
const REROLL_COST_DEFAULT=1;
function rerollCostList(){
  const raw=CFG.reroll_cost;
  if(raw===undefined||raw===null||raw==='')return[REROLL_COST_DEFAULT];
  const list=String(raw).split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  return list.length?list:[REROLL_COST_DEFAULT];
}
function getRerollCost(){const list=rerollCostList();return list[Math.min(rerollExtraCost,list.length-1)];}

function generateShopPool(){
  const available=TDEFS.filter(td=>td.enabled);
  const totalSellable=G.bpGroups.reduce((s,grp)=>s+grp.tdef.sp,0);
  const budget=G.cash+totalSellable;
  const affordable=available.filter(td=>td.pr<=budget);
  const stockCount=CFG.shop_stock_count||3;  // deck page 6 shows exactly three
  const pool=affordable.length>=stockCount?affordable:available;
  return weightedSample(pool,stockCount,td=>RARITY_WEIGHTS[td.rar]??1);
}

// The single way to put new stock on the shelf: draw a pool and wipe the SOLD
// stamps that belonged to the old one.
function restockShopPool(){shopPool=generateShopPool();shopBoughtIds=new Set();}

function rerollTreats(){
  if(G.shopClosed)return; // Coffee Break: shop is closed this prep — no rerolling
  if(G.cash<getRerollCost())return;
  G.cash-=getRerollCost();
  rerollExtraCost++;
  restockShopPool();
  renderShopFull();
}

function renderShopFull(){
  const rcEl=g('reroll-cost');if(rcEl)rcEl.textContent='$'+getRerollCost();
  g('shop-cash').textContent=G.cash;
  const dk=g('ps-deck-n'); if(dk)dk.textContent=(G.deck?G.deck.length:0);
  const rs=g('ps-restock-cost'); if(rs)rs.textContent=getRerollCost();
  renderShopBPGrid();
  renderShopBPList();
  renderTreatsRow();
  if(typeof shopSellLabel==='function')shopSellLabel();
  // Coffee Break: café-flavored boarded-up styling while the shop is closed
  const sec=g('treats-section');
  if(sec)sec.classList.toggle('shop-closed-sec',!!G.shopClosed);
  // reroll button disabled if broke (or the shop is closed after a skip)
  const rr=g('treats-reroll');
  if(rr){rr.disabled=!!G.shopClosed||G.cash<getRerollCost();const rc=g('reroll-cost');if(rc)rc.textContent='$'+getRerollCost();}
}

// ── Backpack grid (mirror of game BP, shown in shop center) ──
function renderShopBPGrid(){
  const grid=g('shop-bpg');if(!grid)return;
  // Same measured fit as the game scene's grid, so the two inventories are the
  // same object on both screens (bpFitCellSize, js/backpack.js).
  const cs=bpFitCellSize(grid,document.querySelector('.ps-invcard'),getBPC(),getBPR());
  grid.style.gridTemplateColumns=`repeat(${getBPC()},${cs}px)`;
  grid.innerHTML='';
  // Treats draw as one silhouette per piece, exactly as the game scene's grid
  // does — see bpPieceLayout (js/piece.js).
  const bgap=gridGap(grid,cs);
  const piece=bpPieceLayout(cs,bgap);
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++){
    const div=document.createElement('div');
    div.className='sp-bpc';
    div.style.width=cs+'px';div.style.height=cs+'px';
    const bd=G.bp[r][c];
    if(bd.filled){
      div.classList.add('ft');
      div.style.background='transparent';
      div.style.border='none';
      div.style.position='relative';
      paintPieceCell(div,bpHasGid(bd.gid),r,c,cs,bgap,bpSkinOpts(cs,bd.col));
      const spot=piece.label[bd.gid];
      if(spot&&spot.r===r&&spot.c===c)div.appendChild(pieceLabelEl(bd.em,spot.dx,spot.dy,Math.round(cs*0.45)));
      // Rearrange: drag from shop BP — keeps the treat's saved rotation, and
      // remembers its origin pose so an illegal drop reverts it exactly there
      div.addEventListener('mousedown',(e)=>{
        if(H.kind==='shop-treat')return;
        if(e.button!==0)return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        const pose=bpPoseOf(grp);
        removeBpGid(gid);
        const gDr=Math.max(0,Math.min(pose.shape.length-1,r-pose.or));
        const gDc=Math.max(0,Math.min(pose.shape[0].length-1,c-pose.oc));
        H={kind:'treat',source:'bp',data:grp.tdef,cells:pose.shape,rot:pose.rot,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:gDr,grabDc:gDc,dragging:true,bpOrigin:pose};
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
        const pose=bpPoseOf(grp);
        removeBpGid(gid);
        const gDr=Math.max(0,Math.min(pose.shape.length-1,r-pose.or));
        const gDc=Math.max(0,Math.min(pose.shape[0].length-1,c-pose.oc));
        H={kind:'treat',source:'bp',data:grp.tdef,cells:pose.shape,rot:pose.rot,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:gDr,grabDc:gDc,dragging:true,bpOrigin:pose};
        updateGhost();showHUD();renderShopBPGrid();
      },{passive:false});
    }
    div.addEventListener('mouseenter',(e)=>{H._lastShopBpR=r;H._lastShopBpC=c;delete H._lastBpR;delete H._lastBoardR;shopBPEnter(r,c);showShopBPTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveShopBPTip(e));
    div.addEventListener('mouseleave',()=>{delete H._lastShopBpR;delete H._lastShopBpC;shopBPLeave();hideShopBPTip();});
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
  tlShow(e,treatTipHTML(bd.tdef));
}
function moveShopBPTip(e){moveTip(e);}
function hideShopBPTip(){g('board-tip').style.display='none';}

// ── Backpack inventory list with sell buttons ──
function renderShopBPList(){
  const el=g('shop-bp-list');if(!el)return;
  el.innerHTML='';
  const pending=G.bpPending||[];
  if(G.bpGroups.length===0&&pending.length===0){
    el.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.35);font-style:italic;text-align:center;padding:6px;">Backpack is empty</div>';
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
  // Overflowed treats (G.bpPending): still owned, waiting for room. They hop
  // back in automatically after a sell / rearrange frees space.
  pending.forEach(t=>{
    const d=document.createElement('div');
    d.className='sp-inv-row';
    d.style.opacity='.55';
    d.innerHTML=`<span class="sp-inv-em">${t.em}</span>
      <span class="sp-inv-nm">${t.nm}</span>
      <span style="font-family:'Fredoka One',cursive;font-size:10px;color:#ffd27a;font-style:italic;white-space:nowrap;">no room — make space</span>`;
    el.appendChild(d);
  });
}

// ── Treat cards row ──
// The shelf card's shape art keeps the stylesheet's own cqw sizing (2.9cqw
// cells, .35cqw gaps against .ps-stage's container) rather than a measured
// pixel size: renderShopFull runs while the screen is still hidden, where every
// measurement reads 0, and cqw also stays responsive with no resize hook.
const SHOP_SHAPE_CELL=2.9, SHOP_SHAPE_GAP=0.35;

function renderTreatsRow(){
  const row=g('treats-row');if(!row)return;
  row.innerHTML='';
  // Coffee Break: the prep right after a skipped round has NO shop — cards
  // are boarded up behind a café "closed" sign. Buying and rerolling are
  // disabled; SELLING from the backpack (renderShopBPList) stays open.
  if(G.shopClosed){
    row.innerHTML=`<div class="shop-closed-sign">
      <div class="scs-em">☕🪧</div>
      <div class="scs-title">GONE FOR COFFEE</div>
      <div class="scs-desc">You took a round off — so did the shopkeeper. No buying or rerolls this visit. Selling from your backpack is still open.</div>
    </div>`;
    const flavorEl=g('treats-flavor');
    if(flavorEl)flavorEl.textContent='"back next round — the espresso machine won\'t clean itself"';
    return;
  }
  // Bought treats keep their card (stamped SOLD) — only what is still for sale
  // sorts, affordable first, into the slots the sold cards left free. A purchase
  // therefore never makes the shelf jump around.
  const totalSellable=G.bpGroups.reduce((s,grp)=>s+grp.tdef.sp,0);
  const forSale=shopPool.filter(td=>!shopBoughtIds.has(td.id)).sort((a,b)=>{
    const canA=G.cash>=a.pr;
    const canB=G.cash>=b.pr;
    const canSellA=G.cash+totalSellable>=a.pr;
    const canSellB=G.cash+totalSellable>=b.pr;
    if(canA!==canB) return canA?-1:1;
    if(canSellA!==canSellB) return canSellA?-1:1;
    return 0;
  });
  let nextForSale=0;
  const shelf=shopPool.map(td=>shopBoughtIds.has(td.id)?td:forSale[nextForSale++]);
  const flavors=forSale.filter(t=>t.fl).map(t=>t.fl);
  const flavorEl=g('treats-flavor');
  if(flavorEl) flavorEl.textContent=flavors[0]||'';
  shelf.forEach(td=>{
    const sold=shopBoughtIds.has(td.id);
    const broke=G.cash<td.pr;
    // bottomless_tote: buying an unowned tote widens the bag by a whole column
    // of empty cells, which its uno shape always fits — so a full bag must not
    // disable its card (the buy-check would otherwise run before the ownership
    // it grants). An already-owned duplicate adds no column: normal check.
    // Rotation-aware: the player can rotate (R / right-click) while dragging
    // the purchase, so any orientation that fits keeps the card buyable.
    const noSpc=!sold&&!bpCanFitRot(td.bpS)&&!(td.id===BOTTOMLESS_TOTE_ID&&!bpToteOwned());
    const dis=sold||broke||noSpc;
    const card=document.createElement('div');
    card.className='tc'+(sold?' tc-bought':dis?' tc-dis':'');
    card.addEventListener('mouseenter',e=>shopTreatTip(e,td.id));
    card.addEventListener('mousemove',shopTreatTipMove);
    card.addEventListener('mouseleave',shopTreatTipHide);

    const shapeHtml='<div class="tc-shape"></div>';

    const priceClass=dis?'tc-price sold':'tc-price';
    card.innerHTML=`
      <div class="tc-em">${td.em}</div>
      ${shapeHtml}
      <div class="tc-info">
        <div class="tc-nm">${td.nm}</div>
        <div class="tc-ef">${td.ef}</div>
        ${td.addEf?`<div style="font-size:12px;color:#9a7ed7;font-weight:800;margin-top:1px;">${td.addEf}</div>`:''}
        ${td.req?`<div style="font-size:12px;color:var(--or);font-weight:800;margin-top:1px;">${td.req}</div>`:''}
        ${noSpc&&!broke?'<div style="font-size:7px;color:var(--re);">Bag full!</div>':''}
      </div>
      <div class="tc-right">
        <div class="${priceClass}"><div class="tc-price-coin">🪙</div>${td.pr}</div>
      </div>
      ${sold?'<div class="tc-stamp">SOLD</div>':''}`;

    // The card shows the shape you are about to carry, so it is drawn by the
    // same silhouette painter as the ghost and the bag: one solid tetromino,
    // and no faint placeholder tiles in the empty corners of an L.
    paintShapePreview(card.querySelector('.tc-shape'),td.bpS,SHOP_SHAPE_CELL,SHOP_SHAPE_GAP,{
      unit:'cqw',fill:td.col,stroke:'rgba(20,18,28,.34)',bw:0.17,rad:0.5});

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
  if(G.shopClosed)return; // Coffee Break: unreachable via UI (no cards render) — defensive
  if(G.cash<td.pr)return;
  dropHeld();
  H={kind:'shop-treat',source:'shop',data:td,cells:td.bpS,rot:0,
     color:td.col,em:td.em,handIdx:null,boardGid:null,bpGid:null,
     grabDr:Math.floor(td.bpS.length/2),grabDc:Math.floor(td.bpS[0].length/2),dragging:true};
  updateGhost();showHUD();
  // bottomless_tote: a held shop copy already counts as owned (bpToteOwned in
  // state.js), so the bag pre-widens NOW — resync the physical grid and
  // re-render so the new column is a live drop target even when the bag was
  // full. A cancelled drag reverts the width; the extra rendered column goes
  // stale but inert (hover/drop on it no-op) until the next renderShopFull().
  if(bpReconcileWidth())renderShopBPGrid();
}

function shopDropOnBP(r,c){
  if(H.kind==='treat'){
    const or=r-H.grabDr, oc=c-H.grabDc;
    if(!bpCanAt(H.cells,or,oc))return;
    bpPlaceAt(H.data,H.cells,or,oc,H.rot);
    H=resetH();
    bpRetryPending(); // the rearrange may have defragged room for an overflowed treat
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
  bpPlaceAt(td,H.cells,or,oc,H.rot);
  shopBoughtIds.add(td.id);
  if(td.id==='purrfect_record'&&G.purrfectRecordBuyFits===undefined){
    G.purrfectRecordBuyFits=G.totalFits||0;
    G.purrfectRecordBuyPurrfects=G.totalPurrfects||0;
  }
  G.purchasedTreatIds.add(td.id);
  H=resetH();
  updateGhost();hideHUD();
  renderShopFull();
}

// ── Pet shop (deck page 6) extras ───────────────────────────────────────────
// Treat cards carry their own hover card, and the SELL BACK plate is a drop
// target rather than a button: drag a treat out of the inventory and let go
// over it. It reads "SELL BACK" while idle and shows the price mid-drag.
function shopTreatTip(e,id){
  if(H.kind) return;                       // never cover the thing being dragged
  const td=TDEFS.find(t=>t.id===id); if(!td) return;
  tlShow(e,treatTipHTML(td),true);   // the shelf reads at the larger scale
}
function shopTreatTipMove(e){ if(typeof moveTip==='function')moveTip(e); }
function shopTreatTipHide(){ const t=g('board-tip'); if(t){t.style.display='none';t.classList.remove('tip-lg');} }

// Label the plate for whatever is (or is not) in hand.
function shopSellLabel(){
  const scr=document.getElementById('s-rounds');
  if(!scr||!scr.classList.contains('on')) return;
  const el=g('ps-sell-lbl'); if(!el) return;
  const plate=g('ps-sell');
  // Price comes off the held tdef, NOT a bpGroups lookup: the shop grid removes
  // the group at pickup, so while a treat is in hand it is not in G.bpGroups.
  const held=(H.kind==='treat'&&H.bpGid&&H.data);
  el.innerHTML=held
    ? ('SELL FOR '+H.data.sp+'<img src="assets/ui/coin.png" alt="">')
    : 'SELL BACK';
  if(plate)plate.classList.toggle('armed',!!held);
}
function shopSellDrop(){
  if(H.kind!=='treat'||!H.bpGid||!H.data) return;
  const gid=H.bpGid, td=H.data;
  const stillInBag=G.bpGroups.some(x=>x.gid===gid);
  H=resetH(); hideHUD();
  const plate=g('ps-sell'); if(plate)plate.classList.remove('over');
  if(stillInBag){
    sellTreatFromShop(gid);          // normal path: group still seated
  }else{
    // Dragged out of the grid — removeBpGid already ran at pickup, so finish
    // the sale from the held tdef instead of re-looking it up.
    G.cash+=td.sp;
    G.purchasedTreatIds.delete(td.id);
    bpReconcileWidth();
    bpRetryPending();
    renderAll();
    renderShopFull();
    const c=g('shop-cash'); if(c)c.textContent=G.cash;
  }
  updateGhost();
}

// Hover feedback on the sell plate — only meaningful while a treat is held.
function shopSellOver(on){
  const plate=g('ps-sell'); if(!plate) return;
  plate.classList.toggle('over', !!on && H.kind==='treat' && !!H.bpGid);
}
