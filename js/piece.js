'use strict';
// ══════════════════════════════════════════════════════
//  POLYOMINO SILHOUETTE (treat pieces)
// ══════════════════════════════════════════════════════
// A treat covers several grid cells but it is ONE object, so it has to LOOK
// like one: a domino is a 2×1 tetromino, not two tiles parked side by side.
// This paints a piece's skin so that
//   • neighbouring cells of the same piece bleed across the grid gap, and
//   • only the silhouette's OUTER corners round.
//
// The skin is painted INSIDE each existing cell element rather than as a
// floating overlay. That is deliberate: the board's pop / glow / affect-pulse
// animations and the ok-bad drop previews all target the real `.cell`, and a
// child inherits their transform and filter, so the piece keeps animating with
// the cell it lives in. An overlay layer would have gone quietly static.
//
// `has(r,c)` answers "is that cell part of the SAME piece?" — callers hand in a
// gid test on the board, a shape-grid lookup for a loose shape.

// Per-cell geometry, all four bleed regions included. Sizes are unitless so a
// caller working in cqw (the pet shop's card art) can pass its own unit.
function paintPieceCell(cellEl,has,r,c,cs,gap,opt){
  if(!cellEl)return;
  const o=opt||{};
  const u=o.unit||'px';
  const fill=o.fill||'#8a8a9a';
  const stroke=o.stroke||'transparent';
  const bw=o.bw==null?0:o.bw;
  const rad=o.rad==null?cs*0.16:o.rad;
  const has_=(rr,cc)=>!!has(rr,cc);
  const up=has_(r-1,c),down=has_(r+1,c),left=has_(r,c-1),right=has_(r,c+1);
  const ur=has_(r-1,c+1),dl=has_(r+1,c-1),dr=has_(r+1,c+1);
  // The caller owns `cellEl`'s positioning (every one of them already sets
  // relative/absolute) — reading it back here would be a style recalc per cell,
  // in the middle of a render loop.
  const side=on=>on?`${bw}${u} solid ${stroke}`:'0';
  const mk=(x,y,w,h,bt,br,bb,bl,radii)=>{
    if(!(w>0)||!(h>0))return;
    const d=document.createElement('div');
    d.className='pc-skin';
    d.style.cssText=`left:${x}${u};top:${y}${u};width:${w}${u};height:${h}${u};`+
      `background:${fill};`+
      `border-top:${side(bt)};border-right:${side(br)};`+
      `border-bottom:${side(bb)};border-left:${side(bl)}${radii?`;border-radius:${radii}`:''}`;
    cellEl.appendChild(d);
  };
  // Body. A corner rounds only when BOTH of its sides face open space, which is
  // what turns four separate rounded tiles into one rounded silhouette.
  const R=v=>`${v?rad:0}${u}`;
  mk(0,0,cs,cs,!up,!right,!down,!left,
     `${R(!up&&!left)} ${R(!up&&!right)} ${R(!down&&!right)} ${R(!down&&!left)}`);
  // Bleed into the gap on the sides that continue into the same piece. Each
  // bleed's own edges are open unless the piece wraps around them too — e.g.
  // the strip to the right is capped on top unless the row above is also a
  // continuous pair (up AND up-right), which is what keeps an L's inner corner
  // a clean right angle instead of a dotted seam.
  //
  // `ov` laps each strip a hair over the cells it joins. Butting them edge to
  // edge is exact in theory but the cell pitch is fractional, so the browser
  // antialiases both sides of the join and a pale hairline shows through the
  // piece — the very seam this whole file exists to remove. The lap only ever
  // covers cells of the same piece, whose corners on that side are square, so
  // nothing rounded gets painted over.
  const ov=cs*0.02;
  if(right)mk(cs-ov,0,gap+ov*2,cs,!(up&&ur),false,!(down&&dr),false,null);
  if(down) mk(0,cs-ov,cs,gap+ov*2,false,!(right&&dr),false,!(left&&dl),null);
  // The little gap×gap square only belongs to the piece inside a full 2×2 block.
  if(right&&down&&dr)mk(cs-ov,cs-ov,gap+ov*2,gap+ov*2,false,false,false,false,null);
}

// Where to hang the piece's single emoji so it sits on the middle of the whole
// silhouette instead of being stamped once per cell. Returns the piece cell to
// hang it on plus the offset from that cell's top-left to the piece's centre.
function pieceLabelSpot(cells,cs,gap){
  if(!cells||!cells.length)return null;
  let minR=Infinity,maxR=-Infinity,minC=Infinity,maxC=-Infinity;
  cells.forEach(([r,c])=>{
    if(r<minR)minR=r; if(r>maxR)maxR=r;
    if(c<minC)minC=c; if(c>maxC)maxC=c;
  });
  const pitch=cs+gap;
  // Centre of the bounding box, measured from the grid origin (top-left of the
  // min-row/min-col cell), in the same units the caller draws in.
  const cx=((maxC-minC+1)*pitch-gap)/2;
  const cy=((maxR-minR+1)*pitch-gap)/2;
  // Hang it on the piece cell nearest that centre so the badge never floats in
  // a hole (an S / L / T piece has holes inside its bounding box).
  let best=cells[0],bestD=Infinity;
  cells.forEach(([r,c])=>{
    const dx=(c-minC)*pitch+cs/2-cx, dy=(r-minR)*pitch+cs/2-cy;
    const d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=[r,c];}
  });
  return{r:best[0],c:best[1],
         dx:cx-((best[1]-minC)*pitch),
         dy:cy-((best[0]-minR)*pitch)};
}

// The emoji itself: absolutely placed, non-interactive, above the skin.
function pieceLabelEl(em,dx,dy,size,unit){
  const u=unit||'px';
  const s=document.createElement('span');
  s.className='pc-em';
  s.textContent=em||'';
  s.style.cssText=`left:${dx}${u};top:${dy}${u};font-size:${size}${u};`;
  return s;
}

// Convenience for a loose shape grid (ghost, shop card): every filled cell of
// the grid belongs to the one piece.
function shapeHas(shape){
  return(r,c)=>!!(shape[r]&&shape[r][c]);
}

// ── The bag ────────────────────────────────────────────────────────────────
// The game scene's inventory grid and the pet shop's are the SAME bag and must
// draw identically, so both ask these three for their piece rendering rather
// than each carrying a copy that can quietly drift.
function bpPieceLayout(cs,gap){
  const cells={},label={};
  if(!G||!G.bp)return{cells,label};
  for(let r=0;r<G.bp.length;r++)for(let c=0;c<G.bp[r].length;c++){
    const b=G.bp[r][c];
    if(b&&b.filled&&b.gid)(cells[b.gid]=cells[b.gid]||[]).push([r,c]);
  }
  Object.keys(cells).forEach(gid=>{label[gid]=pieceLabelSpot(cells[gid],cs,gap);});
  return{cells,label};
}
function bpHasGid(gid){
  return(r,c)=>{const b=G.bp[r]&&G.bp[r][c];return!!(b&&b.filled&&b.gid===gid);};
}
// Opaque on purpose: the strips that bridge the grid gap lap a hair over the
// cells they join (see `ov`), and a translucent fill would double up there and
// draw the seam back in as a dark hairline.
function bpSkinOpts(cs,col){
  return{fill:col||'#8a8a9a',stroke:'rgba(20,18,28,.34)',
         bw:Math.max(1,Math.round(cs*0.018)),
         rad:Math.max(3,Math.round(cs*0.16))};
}
// Grids measure 0 while their screen is hidden; keep the bleed proportional so
// a piece rendered off-screen still looks whole when the screen comes up.
function gridGap(el,cs,fallbackRatio){
  const gp=el?parseFloat(getComputedStyle(el).columnGap):NaN;
  return gp>0?gp:Math.round(cs*(fallbackRatio||0.12));
}

// A standalone piece with no grid behind it — the shop card's shape art. Only
// the filled cells get a box, so the empty corners of an L stay empty instead
// of being drawn as faint placeholder tiles.
function paintShapePreview(host,shape,cs,gap,opt){
  if(!host||!shape||!shape.length)return null;
  const o=opt||{},u=o.unit||'px';
  const rows=shape.length,cols=shape[0].length,pitch=cs+gap;
  const box=document.createElement('div');
  box.className='pc-box';
  box.style.cssText=`width:${cols*pitch-gap}${u};height:${rows*pitch-gap}${u}`;
  const filled=[];
  shape.forEach((row,r)=>row.forEach((v,c)=>{
    if(!v)return;
    filled.push([r,c]);
    const cell=document.createElement('div');
    cell.className='pc-cell';
    cell.style.cssText=`left:${c*pitch}${u};top:${r*pitch}${u};width:${cs}${u};height:${cs}${u}`;
    paintPieceCell(cell,shapeHas(shape),r,c,cs,gap,o);
    box.appendChild(cell);
  }));
  if(o.em){
    const spot=pieceLabelSpot(filled,cs,gap);
    if(spot){
      const host2=box.children[filled.findIndex(([r,c])=>r===spot.r&&c===spot.c)];
      if(host2)host2.appendChild(pieceLabelEl(o.em,spot.dx,spot.dy,o.emSize||cs*0.5,u));
    }
  }
  host.appendChild(box);
  return box;
}
