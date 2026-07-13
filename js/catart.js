'use strict';
// ══════════════════════════════════════════════════════
//  CAT ART — illustrated cat assets in place of colored blocks
// ══════════════════════════════════════════════════════
// Each file assets/cats/<Shape>_<Color>.png is ONE hand-drawn cat molded to a
// shape's bounding box (transparent background). We resolve a game cat's
// {shape,type} to an asset — plus an optional horizontal mirror (J is L
// mirrored, S is Z mirrored) and a base "draw rotation" for shapes the artist
// drew in a non-canonical orientation — then render it as a single <img>
// spanning the whole shape:
//   • on the board, an absolutely-positioned overlay across the placed
//     footprint, rotated with the piece;
//   • in the hand / deck preview, a thumbnail.
// Shapes/types with no asset (e.g. the 1×1 `uno`) fall back to the classic
// colored-block rendering via the null return.

// game cat type -> asset colour suffix. The `black` type was renamed to
// `siamese` in the sheet; `black` is kept here as a fallback so cats still get
// art while the published-CSV rename propagates (it lags a few minutes).
const CAT_ART_COLOR = { orange:'Orange', grey:'Gray', tabby:'Tabby', siamese:'Siamese', black:'Siamese' };

// game shape id -> asset stem (+ mirror flag). Shapes absent here fall back to
// blocks. J = L mirrored, S = Z mirrored (no dedicated art for the mirrors).
const CAT_ART_SHAPE = {
  duo:{a:'Duo'}, trio:{a:'Trio'}, corner:{a:'Corner'}, straight:{a:'Straight'},
  L:{a:'L'}, J:{a:'L',mirror:true}, Z:{a:'Z'}, S:{a:'Z',mirror:true}, T:{a:'T'},
  chonk:{a:'Chonk'}, cross:{a:'Cross'}, chonker:{a:'Chonker'}, chonkest:{a:'Chonkest'},
};

// The grid orientation each asset was DRAWN in (the one where its cat face is
// UPRIGHT). The shipped Shapes tab was re-oriented to match these exactly, so
// drawRot resolves to 0 and faces are upright. Computing drawRot from the LIVE
// grid (rather than hard-coding it) keeps the art aligned to the cells even if
// a grid is oriented differently — e.g. during the brief published-CSV lag
// after a Shapes edit — instead of spilling the cat into the wrong cells.
// Shapes not listed here were drawn in the same orientation as their grid.
const CAT_ART_ASSET_GRID = {
  T:       [[0,1,0],[1,1,1]],
  corner:  [[1,0],[1,1]],
  chonker: [[1,1,0],[1,1,1]],
};
// # of 90°-CW turns to bring the AS-DRAWN asset onto the live rot=0 grid.
function catArtDrawRot(shape){
  const a=CAT_ART_ASSET_GRID[shape];
  if(!a||typeof CSHAPES==='undefined'||!CSHAPES[shape])return 0;
  for(let k=0;k<4;k++){ if(catGridsEqual(rotC(a,k),CSHAPES[shape]))return k; }
  return 0;
}

function catArtInfo(shape,type){
  const s=CAT_ART_SHAPE[shape], color=CAT_ART_COLOR[type];
  if(!s||!color)return null;
  return { src:`assets/cats/${s.a}_${color}.png`, mirror:!!s.mirror, drawRot:catArtDrawRot(shape) };
}
function hasCatArt(shape,type){ return !!catArtInfo(shape,type); }

// True iff two rectangular 0/1 grids are identical.
function catGridsEqual(a,b){
  if(!a||!b||a.length!==b.length||a[0].length!==b[0].length)return false;
  for(let r=0;r<a.length;r++)for(let c=0;c<a[0].length;c++)if(a[r][c]!==b[r][c])return false;
  return true;
}

// Recover a placed cat's rotation (0..3, # of 90°-CW turns off the canonical
// grid) by matching its stored shapeGrid against rotations of CSHAPES[shape].
// Lets board art rotate exactly with the piece regardless of placement path.
function catArtDeriveRot(shape,shapeGrid){
  const base=(typeof CSHAPES!=='undefined')&&CSHAPES[shape];
  if(!base||!shapeGrid)return 0;
  for(let k=0;k<4;k++){ if(catGridsEqual(rotC(base,k),shapeGrid))return k; }
  return 0;
}

// Widest bounding-box span (in cells) across every shape that has art — 4 for
// `straight`. Read from the LIVE CSHAPES so a Shapes-tab edit can't silently
// break the scale.
function catArtMaxSpan(){
  if(typeof CSHAPES==='undefined')return 1;
  let m=1;
  for(const s in CAT_ART_SHAPE){
    const grid=CSHAPES[s];
    if(!grid||!grid.length)continue;
    m=Math.max(m,grid.length,grid[0].length);
  }
  return m;
}

// Thumbnail HTML for hand cards / deck preview. `maxDim` bounds the LONGEST
// shape (straight); every other cat is drawn at the same px-per-cell, so a duo
// is genuinely half the length of a straight instead of being blown up to the
// same box. Sizing per-shape (maxDim / that shape's own span) is what made some
// cats look bigger than others.
// Returns null when the cat has no art, so callers can fall back to shpHTML.
function catArtHTML(shape,type,maxDim){
  const info=catArtInfo(shape,type);
  if(!info||typeof CSHAPES==='undefined')return null;
  const base=CSHAPES[shape]; if(!base)return null;
  const bR=base.length, bC=base[0].length;
  const cell=maxDim/catArtMaxSpan();
  const odd=info.drawRot%2===1;
  const wrapW=bC*cell, wrapH=bR*cell;
  const imgW=(odd?bR:bC)*cell, imgH=(odd?bC:bR)*cell;
  const tf=`rotate(${info.drawRot*90}deg)`+(info.mirror?' scaleX(-1)':'');
  return `<div class="cat-art-wrap" style="width:${wrapW}px;height:${wrapH}px;">`+
         `<img class="cat-art-img" src="${info.src}" alt="" style="width:${imgW}px;height:${imgH}px;transform:${tf};"></div>`;
}

// Board overlay layer. Called at the end of renderBoard(): clears prior
// overlays and lays one <img> per placed cat across its pixel footprint,
// rotated to match the piece. Reads real cell offsets so it stays exact
// through the per-round board reshaping and any gap/padding.
function renderCatArtLayer(){
  const board=(typeof g==='function')&&g('board');
  if(!board)return;
  board.querySelectorAll('.cat-art-board').forEach(n=>n.remove());
  if(typeof G==='undefined'||!G.cats)return;
  G.cats.forEach(grp=>{
    if(typeof _PROJ_GID!=='undefined'&&grp.gid===_PROJ_GID)return; // skip projection ghosts
    const info=catArtInfo(grp.shape,grp.type);
    if(!info)return;                                                // no art -> keep block
    const cells=grp.cells;
    if(!cells||!cells.length)return;
    // Pixel bounding box of the occupied cells (robust to gap/padding/reshape).
    let L=Infinity,T=Infinity,R=-Infinity,B=-Infinity,ok=true;
    cells.forEach(([r,c])=>{
      const cell=getBCell(r,c);
      if(!cell){ok=false;return;}
      const x=cell.offsetLeft,y=cell.offsetTop,w=cell.offsetWidth,h=cell.offsetHeight;
      if(x<L)L=x; if(y<T)T=y; if(x+w>R)R=x+w; if(y+h>B)B=y+h;
    });
    if(!ok||L===Infinity)return;
    const fw=R-L, fh=B-T;
    const rot=catArtDeriveRot(grp.shape,grp.shapeGrid);
    const total=(info.drawRot+rot)%4;
    const odd=total%2===1;
    // As-drawn img box (pre-rotation) so rotating by `total` fills the footprint.
    const imgW=odd?fh:fw, imgH=odd?fw:fh;
    const wrap=document.createElement('div');
    wrap.className='cat-art-board';
    wrap.style.cssText=`position:absolute;left:${L}px;top:${T}px;width:${fw}px;height:${fh}px;`;
    const img=document.createElement('img');
    img.className='cat-art-img';
    img.src=info.src; img.alt='';
    img.style.cssText=`width:${imgW}px;height:${imgH}px;transform:rotate(${total*90}deg)${info.mirror?' scaleX(-1)':''};`;
    wrap.appendChild(img);
    board.appendChild(wrap);
  });
}
