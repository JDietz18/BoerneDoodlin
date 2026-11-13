// Trail Scout presentation. Kept separate from the platform renderer so the
// top-down view can grow on its own. `view` is the shared AdventureRenderer:
// it supplies begin(), character(), prop(), sprites, rv/rvFrame, juice, insets.
//
// The world fills the whole canvas. A follow camera keeps the buddy inside the
// band left free by `view.insets`, and each tile is thumb sized. What the
// controller can rely on after every frame:
//   view.scoutLayout = {left, top, cell}   screen position of tile (0,0), CSS px
//   view.scoutCellAt(x, y) -> {x, y}|null  the tile under a canvas point, with
//                                          forgiving snapping; also understands
//                                          taps on the corner mini-map
// Nothing here changes the run: it only reads engine state and engine events.
import {hash01,ease} from './fx.js?v=24';
import {ABILITIES} from './characters.js?v=24';

const TAU=Math.PI*2,GROUND=.8,HOP=.13,LAND=.14;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// One look per world. `water` worlds draw land over an animated river; the
// others carve the trail out of raised ground with a front face.
const THEMES=[
  {name:'river',water:true,under:'#48a9b9',deep:'#3c97aa',wave:'#e4fbf7',floor:'#edd9a5',floorAlt:'#e6d097',speck:'#c9ad74',rim:'#b89a61',face:'#a98a55',shallow:'#a5e2dc',tuft:'#7fb85c',tuftTip:'#b7dd7c',print:'#b3945c',fog:'18,66,82',fogA:.74,decor:['lily','lily','rock','reed','lily',null,null],tree:['#3f8a4f','#56a35d','#79bd6c'],stone:['#8fa3a5','#b5c6c4','#6f8587'],mud:['#8d6b49','#5c4330','#b9966b'],wing:['#ffb45c','#ff7f6e'],ambient:null},
  {name:'redwood',under:'#b48a5e',floor:'#b98f63',floorAlt:'#b0865a',speck:'#8f6c48',top:'#2f6c49',topLight:'#3e8358',topDark:'#245139',rim:'#173a29',face:'#6a4631',faceDark:'#4b3023',faceStyle:'bark',tuft:'#5f9d55',tuftTip:'#9ccc74',print:'#8a6644',fog:'12,40,32',fogA:.76,decor:['pine','pine','fern','bush','mushroom','pine',null],tree:['#1f4d36','#2f6f48','#4b9560'],stone:['#7d8a7c','#a3b09f','#5e6b5f'],mud:['#6f5038','#473224','#9a7a58'],wing:['#ffd35c','#ff9a4a'],ambient:'leaf'},
  {name:'canyon',under:'#efd19d',floor:'#f1d5a3',floorAlt:'#ebcb94',speck:'#cfa56f',top:'#dc8c5e',topLight:'#eda776',topDark:'#c7764d',rim:'#994f33',face:'#b85f3d',faceDark:'#97472d',faceStyle:'strata',tuft:'#9bb267',tuftTip:'#cbd98a',print:'#cba069',fog:'84,42,30',fogA:.72,decor:['cactus','rock','sage','rock',null,null,'cactus'],tree:['#4f8a4c','#6aa55c','#94c474'],stone:['#b96a45','#e1986c','#8e4a2f'],mud:['#96603f','#683d27','#c48c63'],wing:['#7fd6e8','#4aa3d6'],ambient:'dust'},
  {name:'mesa',night:true,under:'#6f6890',floor:'#7a739d',floorAlt:'#716a93',speck:'#565079',top:'#3c4168',topLight:'#50578a',topDark:'#2e3257',rim:'#191c3a',face:'#292c4f',faceDark:'#1e2140',faceStyle:'strata',tuft:'#5f8f86',tuftTip:'#9ad0c0',print:'#544e77',fog:'10,14,40',fogA:.66,decor:['rock','sage','crystal','pine',null,'rock',null],tree:['#22394a','#2f5560','#467a7c'],stone:['#4b5080','#6d74a8','#33375e'],mud:['#4d3f5e','#2f2640','#7d6c93'],wing:['#d9f6ff','#9fe3ff'],ambient:null},
  {name:'boerne',under:'#f0e0b4',floor:'#f3e5bc',floorAlt:'#eddcab',speck:'#cdb984',top:'#6aa650',topLight:'#84bd65',topDark:'#588f44',rim:'#39682f',face:'#e8dcbd',faceDark:'#c5b48a',faceStyle:'stones',tuft:'#78b259',tuftTip:'#b9de86',print:'#c9b27c',fog:'24,58,46',fogA:.72,decor:['oak','bonnet','bonnet','bush','rock','oak',null],tree:['#3f7d3c','#5a9d4c','#86c267'],stone:['#cfc4a4','#efe6cb','#a79b7b'],mud:['#8f6f4c','#5d4531','#bb9a70'],wing:['#8f9bff','#5a6fd6'],ambient:'petal'}
];
// Popup colours climb with the live bonus stack.
const TIERS=[[30,'#ff9fd0'],[20,'#ffab5e'],[10,'#ffd75e'],[5,'#b8f28a'],[2,'#9fe8dc'],[0,'#fff4d7']];
const tierColor=total=>TIERS.find(([at])=>total>=at)[1];
const LAYER={chain:'#9fe8dc',frenzy:'#ffab5e',gold:'#ffd75e'};

// --- tiny drawing helpers ---------------------------------------------------
function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fillStyle=fill;c.fill();}
function disc(c,x,y,r,fill){c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fillStyle=fill;c.fill();}
function rounded(c,x,y,w,h,r,fill,stroke,width=1.5){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function twinklePath(c,x,y,r){c.moveTo(x,y-r);c.quadraticCurveTo(x,y,x+r,y);c.quadraticCurveTo(x,y,x,y+r);c.quadraticCurveTo(x,y,x-r,y);c.quadraticCurveTo(x,y,x,y-r);}
function twinkle(c,x,y,r,fill){c.beginPath();twinklePath(c,x,y,r);c.fillStyle=fill;c.fill();}
function burr(c,x,y,r,fill,turn=0,points=9){c.beginPath();for(let i=0;i<points*2;i++){const a=i*Math.PI/points+turn,k=i%2?.72:1;c.lineTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k*.88);}c.closePath();c.fillStyle=fill;c.fill();}
function blob(c,x,y,r,fill,seed=0,points=7){c.beginPath();for(let i=0;i<points;i++){const a=i*TAU/points+seed,k=.8+hash01(i*7+Math.round(seed*90),points)*.3;c.lineTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k*.8);}c.closePath();c.fillStyle=fill;c.fill();}
function paw(c,x,y,r,rot,fill){
  c.save();c.translate(x,y);c.rotate(rot);c.beginPath();c.ellipse(0,r*.28,r*.5,r*.4,0,0,TAU);
  for(const [tx,ty] of PAW_TOES){c.moveTo(tx*r+r*.17,ty*r);c.arc(tx*r,ty*r,r*.17,0,TAU);}
  c.fillStyle=fill;c.fill();c.restore();
}
// One-shot reactions and how long each lasts.
const TIMERS=[['spin',.62],['hurt',.5],['joy',1.5],['talk',.5],['wave',.5],['rv',.5],['alert',1.1],['charged',.5],['radar',1.4]];
const PAW_TOES=[[-.47,-.2],[-.17,-.5],[.17,-.5],[.47,-.2]];
const DUST=['#fff4d68c','#e9dcc070'];
const MUD_SPOTS=[[-.22,.3,.1],[.18,.55,.12],[-.05,.8,.08],[.3,.22,.07]];
// Soft radial glow, drawn once per colour and reused.
const glows=new Map();
function glow(rgb){
  let sprite=glows.get(rgb);if(sprite)return sprite;
  sprite=document.createElement('canvas');sprite.width=sprite.height=96;const g=sprite.getContext('2d'),fill=g.createRadialGradient(48,48,0,48,48,48);
  fill.addColorStop(0,`rgba(${rgb},1)`);fill.addColorStop(.35,`rgba(${rgb},.62)`);fill.addColorStop(.7,`rgba(${rgb},.2)`);fill.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=fill;g.fillRect(0,0,96,96);
  glows.set(rgb,sprite);return sprite;
}
function drawGlow(c,rgb,x,y,r,alpha=1){if(alpha<=.01)return;const before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(glow(rgb),x-r,y-r,r*2,r*2);c.globalAlpha=before;}
const rgbOf=hex=>`${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;

// --- per-run view state -------------------------------------------------------
function fresh(run){
  return {runId:run.runId,run,t:0,anim:0,given:{},top:0,bottom:0,key:'',cam:null,ox:0,oy:0,cell:0,L:null,layer:null,fog:null,fogCur:null,seenCount:-1,mini:null,miniBox:null,
    prints:[],tufts:[],glints:[],flies:[],hop:0,land:0,sinceStep:9,dir:{dx:1,dy:0},bump:null,spin:0,hurt:0,joy:0,talk:0,wave:0,rv:0,locked:null,alert:0,charged:0,radar:0,
    opened:{},pending:null,say:null,aside:0,tag:{value:1,pop:0},objective:null,objectiveAt:-1,ambient:0,rushAt:-9,bumpAt:-9,basket:null,reduced:false,water:null};
}
function stateFor(view,run){
  let st=view._scout;
  if(!st||st.runId!==run.runId){
    // A new outing: hand the old canvases back first (iPhone keeps a tight budget for canvas memory).
    for(const canvas of [st?.layer?.canvas,st?.fog?.canvas,st?.mini,st?.light,st?.water])if(canvas)canvas.width=canvas.height=0;
    st=view._scout=fresh(run);view.juice.clear();
  }
  st.run=run;return st;
}

// --- layout and camera -----------------------------------------------------
function layout(view,st,run,insets){
  const w=view.width,h=view.height,cols=run.cols,rows=run.rows,g=st.given,it=insets?.top||0,ib=insets?.bottom||0,il=insets?.left||0,ir=insets?.right||0,dpr=view.dpr||1,props=!!view.props;
  // Nothing it depends on has changed: keep the layout from the last frame.
  if(st.L&&g.w===w&&g.h===h&&g.t===it&&g.b===ib&&g.l===il&&g.r===ir&&g.dpr===dpr&&g.props===props&&st.L.runId===run.runId)return st.L;
  // Hold on to the largest bands seen at this size so a HUD that hides for a moment does not make the map jump.
  if(g.w!==w||g.h!==h){st.top=0;st.bottom=0;st.cam=null;}
  g.w=w;g.h=h;g.t=it;g.b=ib;g.l=il;g.r=ir;g.dpr=dpr;g.props=props;
  st.top=Math.max(st.top,clamp(it,0,h*.45));st.bottom=Math.max(st.bottom,clamp(ib,0,h*.3));
  const left=clamp(il,0,w*.3),right=clamp(ir,0,w*.3),bandW=w-left-right,bandH=h-st.top-st.bottom;
  // Show the whole maze when its tiles would still be thumb sized; otherwise zoom in and follow.
  const fit=Math.min(bandW/cols,bandH/rows),comfy=clamp(Math.min(bandW/8.4,bandH/6.4),36,54),cell=Math.round(Math.max(Math.min(fit,78),comfy));
  const mapW=cols*cell,mapH=rows*cell,over=cell*.38,scrollX=mapW+over*2>bandW,scrollY=mapH+over*2>bandH;
  const minX=scrollX?bandW/2-over:mapW/2,maxX=scrollX?mapW-bandW/2+over:mapW/2,minY=scrollY?bandH/2-over:mapH/2,maxY=scrollY?mapH-bandH/2+over:mapH/2;
  const cx=left+bandW/2,cy=st.top+bandH/2,margin=px=>Math.ceil(Math.max(0,px)/cell)+1;
  const mL=margin(cx-minX),mR=margin(w-cx-(mapW-maxX)),mT=margin(cy-minY),mB=margin(h-cy-(mapH-maxY));
  return {runId:run.runId,w,h,cell,cols,rows,mapW,mapH,cx,cy,minX,maxX,minY,maxY,mL,mR,mT,mB,left,right,top:st.top,bottom:st.bottom,bandW,bandH,scroll:scrollX||scrollY,
    key:`${run.runId}|${cell}|${mL},${mT},${mR},${mB}|${dpr}|${props?1:0}`};
}
function camera(st,run,L,dt,dpr){
  const p=run.player,s=L.cell,ahead=st.reduced?0:.7;
  const tx=clamp(((p.renderX??p.x)+.5+st.dir.dx*ahead)*s,L.minX,L.maxX),ty=clamp(((p.renderY??p.y)+.5+st.dir.dy*ahead)*s,L.minY,L.maxY);
  if(!st.cam)st.cam={x:tx,y:ty};else{const k=1-Math.exp(-dt*6.5);st.cam.x+=(tx-st.cam.x)*k;st.cam.y+=(ty-st.cam.y)*k;}
  st.cam.x=clamp(st.cam.x,L.minX,L.maxX);st.cam.y=clamp(st.cam.y,L.minY,L.maxY);
  st.ox=Math.round((L.cx-st.cam.x)*dpr)/dpr;st.oy=Math.round((L.cy-st.cam.y)*dpr)/dpr;st.cell=s;st.L=L;
}
function cellAt(view,px,py){
  const st=view._scout,run=st?.run,L=st?.L;if(!run||!L||!Number.isFinite(px)||!Number.isFinite(py))return null;
  // A tap on the mini-map travels to that spot.
  const m=st.miniBox;if(m&&px>=m.x&&px<=m.x+m.w&&py>=m.y&&py<=m.y+m.h)return {x:clamp(Math.floor((px-m.x-m.pad)/m.cell),0,run.cols-1),y:clamp(Math.floor((py-m.y-m.pad)/m.cell),0,run.rows-1)};
  const s=L.cell,fx=(px-st.ox)/s,fy=(py-st.oy)/s,open=(x,y)=>run.grid[y]?.[x]===0;
  // The RV and the neighbour are drawn taller than their tile; tapping the picture counts.
  for(const e of run.entities){
    if(e.taken||!run.seen[e.y]?.[e.x])continue;
    if(e.type==='exit'&&Math.abs(fx-e.x-.5)<.95&&fy>e.y-.7&&fy<e.y+1)return {x:e.x,y:e.y};
    if(e.type==='npc'&&Math.abs(fx-e.x-.5)<.5&&fy>e.y-.5&&fy<e.y+1)return {x:e.x,y:e.y};
  }
  const x=Math.floor(fx),y=Math.floor(fy);if(open(x,y))return {x,y};
  // A thumb that lands on a hedge next to the trail meant the trail.
  let best=null,gap=.95;
  for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(open(xx,yy)){const d=Math.hypot(clamp(fx,xx,xx+1)-fx,clamp(fy,yy,yy+1)-fy);if(d<gap){gap=d;best={x:xx,y:yy};}}
  if(best)return best;
  return x>=-1&&y>=-1&&x<=run.cols&&y<=run.rows?{x:clamp(x,0,run.cols-1),y:clamp(y,0,run.rows-1)}:null;
}

// --- the painted world (built once per run and size) ---------------------------
const DECOR={
  pine(g,x,y,s,k,T){const r=s*(.36+k*.12);ellipse(g,x+r*.18,y+r*.12,r*.95,r*.36,'#0000002e');for(let i=0;i<3;i++)burr(g,x,y-s*.13-i*s*.2,r*(1-i*.27),T.tree[i],k*6+i);},
  oak(g,x,y,s,k,T){const r=s*(.3+k*.1);ellipse(g,x+r*.2,y+r*.1,r*1.2,r*.4,'#0000002a');rounded(g,x-s*.04,y-r*.7,s*.08,r*.75,2,'#7a5a3c');disc(g,x-r*.5,y-r*.85,r*.62,T.tree[0]);disc(g,x+r*.5,y-r*.9,r*.6,T.tree[0]);disc(g,x,y-r*1.25,r*.7,T.tree[1]);disc(g,x-r*.2,y-r*1.42,r*.36,T.tree[2]);disc(g,x+r*.42,y-r*1.05,r*.24,T.tree[2]);},
  bush(g,x,y,s,k,T){const r=s*(.15+k*.06);ellipse(g,x+r*.2,y+r*.3,r*1.5,r*.5,'#00000026');disc(g,x-r*.7,y-r*.3,r*.8,T.tree[0]);disc(g,x+r*.7,y-r*.35,r*.85,T.tree[1]);disc(g,x,y-r*.8,r*.9,T.tree[1]);disc(g,x-r*.2,y-r*1.05,r*.42,T.tree[2]);},
  fern(g,x,y,s,k,T){g.strokeStyle=T.tree[2];g.lineWidth=Math.max(1.5,s*.045);g.lineCap='round';g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.5;g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a)*s*.14,y+Math.sin(a)*s*.2,x+Math.cos(a)*s*.3,y+Math.sin(a)*s*.2+s*.04);}g.stroke();},
  mushroom(g,x,y,s){rounded(g,x-s*.035,y-s*.12,s*.07,s*.13,2,'#f3ead2');g.beginPath();g.ellipse(x,y-s*.12,s*.12,s*.09,0,Math.PI,TAU);g.fillStyle='#d9573f';g.fill();disc(g,x-s*.05,y-s*.16,s*.02,'#fff4dc');disc(g,x+s*.04,y-s*.15,s*.018,'#fff4dc');},
  rock(g,x,y,s,k,T){const r=s*(.17+k*.1);ellipse(g,x+r*.2,y+r*.25,r*1.2,r*.42,'#00000026');blob(g,x,y-r*.3,r,T.stone[0],k*5);blob(g,x-r*.14,y-r*.48,r*.62,T.stone[1],k*9,6);},
  cactus(g,x,y,s,k,T){const hgt=s*(.42+k*.2),wd=s*.15;ellipse(g,x+wd*.4,y+2,wd*1.3,wd*.4,'#00000026');g.strokeStyle=T.tree[0];g.lineWidth=wd*.55;g.lineCap='round';g.beginPath();g.moveTo(x-wd*1.1,y-hgt*.62);g.lineTo(x-wd*1.1,y-hgt*.4);g.lineTo(x,y-hgt*.4);g.moveTo(x+wd*1.1,y-hgt*.8);g.lineTo(x+wd*1.1,y-hgt*.55);g.lineTo(x,y-hgt*.55);g.stroke();rounded(g,x-wd/2,y-hgt,wd,hgt,wd/2,T.tree[1]);rounded(g,x-wd*.2,y-hgt*.92,wd*.22,hgt*.8,wd*.1,T.tree[2]);disc(g,x,y-hgt,wd*.24,'#ff9db0');},
  sage(g,x,y,s,k,T){g.strokeStyle=T.tree[k>.5?2:1];g.lineWidth=Math.max(1.5,s*.04);g.lineCap='round';g.beginPath();for(let i=0;i<7;i++){const a=-Math.PI/2+(i-3)*.33;g.moveTo(x+(i-3)*s*.025,y);g.lineTo(x+Math.cos(a)*s*.2,y+Math.sin(a)*s*.2);}g.stroke();},
  crystal(g,x,y,s,k){const hgt=s*(.26+k*.12);for(const [dx,scale,fill] of [[-.09,.7,'#7fd9e8'],[.08,.82,'#b79cf5'],[0,1,'#c9f4ff']]){const px=x+dx*s,ph=hgt*scale;g.beginPath();g.moveTo(px,y-ph);g.lineTo(px+s*.055,y-ph*.55);g.lineTo(px+s*.04,y);g.lineTo(px-s*.04,y);g.lineTo(px-s*.055,y-ph*.55);g.closePath();g.fillStyle=fill;g.fill();}},
  bonnet(g,x,y,s,k,T){for(let i=0;i<4;i++){const px=x+(i-1.5)*s*.11,hgt=s*(.16+hash01(i,Math.round(k*99))*.1);g.strokeStyle=T.tree[1];g.lineWidth=1.5;g.beginPath();g.moveTo(px,y);g.lineTo(px,y-hgt);g.stroke();for(let n=0;n<3;n++)disc(g,px,y-hgt*(.45+n*.27),s*.035*(1-n*.18),n===2?'#f4f6ff':'#5a6fd6');}},
  lily(g,x,y,s,k){const r=s*(.14+k*.08),turn=k*TAU;g.beginPath();g.moveTo(x,y);g.arc(x,y,r,turn+.35,turn+TAU-.35);g.closePath();g.fillStyle='#4f9a52';g.fill();g.beginPath();g.moveTo(x,y);g.arc(x,y,r*.66,turn+.6,turn+TAU-.6);g.closePath();g.fillStyle='#6bb863';g.fill();if(k>.55){disc(g,x+r*.2,y-r*.15,r*.3,'#ffd0dc');disc(g,x+r*.2,y-r*.15,r*.13,'#ffe98f');}},
  reed(g,x,y,s,k){g.lineCap='round';for(let i=0;i<3;i++){const px=x+(i-1)*s*.08,hgt=s*(.26+hash01(i,Math.round(k*77))*.16);g.strokeStyle='#5f9a55';g.lineWidth=2;g.beginPath();g.moveTo(px,y);g.lineTo(px+(i-1)*2,y-hgt);g.stroke();g.strokeStyle='#8a5a34';g.lineWidth=3.4;g.beginPath();g.moveTo(px+(i-1)*2,y-hgt);g.lineTo(px+(i-1)*2,y-hgt-s*.09);g.stroke();}}
};
const TALL=['pine','oak','cactus','crystal'];

function paintWorld(g,st,run,T,L){
  const s=L.cell,x0=-L.mL,y0=-L.mT,x1=L.cols+L.mR,y1=L.rows+L.mB,salt=run.seed%9973;
  const wall=(x,y)=>run.grid[y]?.[x]!==0,inMap=(x,y)=>x>=0&&y>=0&&x<L.cols&&y<L.rows,rnd=(x,y,i=0)=>hash01(x*73+i*19+salt,y*151+i*7+salt);
  const lift=T.water?0:Math.round(s*.2),walls=new Path2D(),land=new Path2D();
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)(wall(x,y)?walls:land).rect(x*s,y*s,s,s);
  st.tufts=[];st.glints=[];st.flies=[];st.lift=lift;
  g.lineJoin='round';g.lineCap='round';
  if(T.water){
    // Shallows, then the bank's front edge, then the sand itself.
    g.globalAlpha=.34;g.strokeStyle=T.shallow;g.lineWidth=s*.52;g.stroke(land);g.globalAlpha=.5;g.lineWidth=s*.22;g.stroke(land);g.globalAlpha=1;
    const edge=Math.round(s*.13);g.save();g.translate(0,edge);g.strokeStyle=T.face;g.lineWidth=5;g.stroke(land);g.fillStyle=T.face;g.fill(land);g.restore();
    g.strokeStyle=T.rim;g.lineWidth=5;g.stroke(land);g.fillStyle=T.floor;g.fill(land);
  }else{g.fillStyle=T.floor;g.fillRect(x0*s,y0*s,(x1-x0)*s,(y1-y0)*s);}
  // Trail texture: a quiet checker of pads, pebbles, and the odd flower.
  for(let y=0;y<L.rows;y++)for(let x=0;x<L.cols;x++){
    if(wall(x,y))continue;const px=x*s,py=y*s;
    if((x+y)%2)rounded(g,px+2.5,py+2.5,s-5,s-5,s*.2,T.floorAlt);
    for(let i=0;i<3;i++)disc(g,px+s*(.14+rnd(x,y,i)*.72),py+s*(.2+rnd(x,y,i+5)*.68),1+rnd(x,y,i+9)*1.4,T.speck);
    if(rnd(x,y,20)<.16){const fx=px+s*(.22+rnd(x,y,21)*.56),fy=py+s*(.3+rnd(x,y,22)*.5);if(T.name==='boerne'||T.name==='river'){disc(g,fx,fy,2.2,'#ffffff');disc(g,fx,fy,1,'#ffd75e');}else blob(g,fx,fy,s*.06,T.stone[1],rnd(x,y,23)*6,5);}
    if(!T.water){
      // Contact shadows under the wall above and beside the wall to the left.
      if(wall(x,y-1)){g.fillStyle='#00000024';g.fillRect(px,py,s,s*.1);g.fillStyle='#00000012';g.fillRect(px,py+s*.1,s,s*.09);}
      if(wall(x-1,y)){g.fillStyle='#00000014';g.fillRect(px,py,s*.09,s);}
    }
    if(wall(x,y-1)||T.water&&rnd(x,y,30)<.5)for(let i=0;i<2;i++)st.tufts.push({x:px+s*(.16+i*.42+rnd(x,y,31+i)*.24),y:py+(T.water?s*(.2+rnd(x,y,33+i)*.6):s*.13),h:s*(.13+rnd(x,y,35+i)*.09),ph:rnd(x,y,37+i)*TAU});
  }
  if(!T.water){
    // Raised ground: the front face first, then the top surface a little higher.
    g.strokeStyle=T.faceDark;g.lineWidth=3;g.stroke(walls);g.fillStyle=T.face;g.fill(walls);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      if(!wall(x,y)||wall(x,y+1))continue;const px=x*s,top=(y+1)*s-lift+2,bottom=(y+1)*s-1;g.strokeStyle=T.faceDark;g.lineWidth=1.5;g.beginPath();
      if(T.faceStyle==='strata'){g.moveTo(px+1,top+(bottom-top)*.45);g.lineTo(px+s-1,top+(bottom-top)*(.35+rnd(x,y,40)*.3));}
      else if(T.faceStyle==='bark'){for(let i=0;i<3;i++){const lx=px+s*(.18+i*.3+rnd(x,y,41+i)*.1);g.moveTo(lx,top);g.lineTo(lx,bottom);}}
      else{g.moveTo(px,top+(bottom-top)*.5);g.lineTo(px+s,top+(bottom-top)*.5);for(let i=0;i<2;i++){const lx=px+s*(.3+i*.42);g.moveTo(lx,top);g.lineTo(lx,top+(bottom-top)*.5);g.moveTo(lx-s*.2,top+(bottom-top)*.5);g.lineTo(lx-s*.2,bottom);}}
      g.stroke();
    }
    g.save();g.translate(0,-lift);g.strokeStyle=T.rim;g.lineWidth=3.5;g.stroke(walls);g.fillStyle=T.top;g.fill(walls);g.restore();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      if(!wall(x,y))continue;const px=x*s,py=y*s-lift;
      for(let i=0;i<3;i++){const ax=px+s*(.15+rnd(x,y,50+i)*.7),ay=py+s*(.18+rnd(x,y,53+i)*.66),r=s*(.07+rnd(x,y,56+i)*.07);g.beginPath();g.arc(ax,ay,r,Math.PI*1.1,Math.PI*1.9);g.strokeStyle=i%2?T.topLight:T.topDark;g.lineWidth=Math.max(1.5,s*.045);g.stroke();}
      if(T.night&&rnd(x,y,60)<.2)st.flies.push({x:px+s*rnd(x,y,61),y:py+s*rnd(x,y,62),ph:rnd(x,y,63)*TAU});
    }
  }
  // Scenery on top, back row first so nearer things overlap farther ones.
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    if(!wall(x,y))continue;const kind=T.decor[Math.floor(rnd(x,y,70)*T.decor.length)],k=rnd(x,y,71),cx=(x+.5+(rnd(x,y,72)-.5)*.42)*s,cy=(y+(T.water?.3+rnd(x,y,73)*.5:.74))*s-lift;
    if(T.water&&rnd(x,y,74)<.55)st.glints.push({x:(x+rnd(x,y,75))*s,y:(y+rnd(x,y,76))*s,ph:rnd(x,y,77)*TAU});
    if(!kind)continue;
    // Tall things only where they cannot hide the trail tile behind them.
    if(TALL.includes(kind)&&!wall(x,y-1)){DECOR[T.water?'lily':'bush'](g,cx,cy,s,k,T);continue;}
    if(kind==='reed'&&!(!wall(x,y-1)||!wall(x-1,y)||!wall(x+1,y)||!wall(x,y+1))){DECOR.lily(g,cx,cy,s,k,T);continue;}
    DECOR[kind](g,cx,cy,s,k,T);
    // The forest thickens away from the trail.
    if(!inMap(x,y)&&!T.water&&rnd(x,y,78)<.6)DECOR[T.decor[0]](g,(x+.5+(rnd(x,y,79)-.5)*.5)*s,cy-s*.36,s,rnd(x,y,80),T);
  }
}
function build(view,st,run,T,L){
  const s=L.cell,W=L.cols+L.mL+L.mR,H=L.rows+L.mT+L.mB,k=Math.min(view.dpr||1,Math.sqrt(4.4e6/(W*s*H*s)));
  const canvas=st.layer?.canvas||document.createElement('canvas');canvas.width=Math.ceil(W*s*k);canvas.height=Math.ceil(H*s*k);
  const g=canvas.getContext('2d');g.setTransform(k,0,0,k,L.mL*s*k,L.mT*s*k);g.clearRect(-L.mL*s,-L.mT*s,W*s,H*s);
  paintWorld(g,st,run,T,L);st.layer={canvas,k,x:-L.mL*s,y:-L.mT*s,w:W*s,h:H*s};
  // Mist: two pixels per tile, stretched with smoothing so its edge is soft.
  const fog=st.fog?.canvas||document.createElement('canvas');fog.width=W*2;fog.height=H*2;const f=fog.getContext('2d');f.clearRect(0,0,W*2,H*2);f.fillStyle=`rgb(${T.fog})`;f.globalAlpha=.9;f.fillRect(0,0,W*2,H*2);
  if(!st.fogCur){st.fogCur=new Float32Array(L.cols*L.rows);for(let y=0;y<L.rows;y++)for(let x=0;x<L.cols;x++)st.fogCur[y*L.cols+x]=run.seen[y][x]?0:1;}
  st.fog={canvas:fog,ctx:f,W,H};for(let y=0;y<L.rows;y++)for(let x=0;x<L.cols;x++)fogPixel(st,L,x,y,st.fogCur[y*L.cols+x]);
  if(T.water&&!st.water){
    // A small tile of wave marks, repeated and drifted in two layers.
    const tile=document.createElement('canvas');tile.width=tile.height=128;const wg=tile.getContext('2d');wg.strokeStyle=T.wave;wg.lineWidth=2;wg.lineCap='round';
    for(let i=0;i<9;i++){const wx=hash01(i,3)*128,wy=hash01(i,8)*128,len=10+hash01(i,13)*14;for(const ox of [-128,0,128])for(const oy of [-128,0,128]){wg.globalAlpha=.3+hash01(i,21)*.3;wg.beginPath();wg.moveTo(wx+ox,wy+oy);wg.quadraticCurveTo(wx+ox+len/2,wy+oy-4,wx+ox+len,wy+oy);wg.stroke();}}
    st.water=tile;st.waterFill=null;
  }
  st.key=L.key;st.seenCount=-1;st.mini=null;
}
function fogPixel(st,L,x,y,a){const f=st.fog.ctx,px=(x+L.mL)*2,py=(y+L.mT)*2;f.clearRect(px,py,2,2);if(a>.004){f.globalAlpha=Math.min(1,a);f.fillRect(px,py,2,2);}}
function liftFog(st,run,L,dt){
  // Mist lifts outward from the buddy: a tile farther away starts a moment later (values above 1 are that wait).
  let seen=0;const cur=st.fogCur,rate=st.reduced?99:dt*2.8,p=run.player;
  for(let y=0;y<L.rows;y++)for(let x=0;x<L.cols;x++){
    const i=y*L.cols+x,target=run.seen[y][x]?0:1;if(!target)seen++;if(cur[i]===target)continue;
    if(!target&&cur[i]===1&&!st.reduced)cur[i]=1+Math.min(8,Math.abs(x-p.x)+Math.abs(y-p.y))*.11;
    cur[i]=target<cur[i]?Math.max(target,cur[i]-rate):Math.min(target,cur[i]+rate);if(cur[i]<1||target)fogPixel(st,L,x,y,cur[i]);
  }
  if(seen!==st.seenCount){st.seenCount=seen;st.mini=null;st.objectiveAt=-1;}
}

// A popup in world space, nudged so its whole label stays on screen.
function pop(view,st,text,x,y,options={}){
  const L=st.L,half=String(text).length*(options.size||15)*.31+6;
  if(L){x=clamp(x,-st.ox+L.left+half,-st.ox+L.w-L.right-half);y=Math.max(y,-st.oy+L.top+(options.size||15));}
  return view.juice.popup(text,x,y,options);
}

// --- events ------------------------------------------------------------------
// Called by the controller for every Trail Scout engine event.
export function scoutEvent(view,e,run){
  if(!run||!e)return;const st=stateFor(view,run),j=view.juice,s=st.cell||46,T=THEMES[run.worldIndex]||THEMES[0],calm=view.reducedMotion||j.reducedMotion;
  const x=Number.isFinite(e.x)?(e.x+.5)*s:0,y=Number.isFinite(e.y)?(e.y+.5)*s:0,p=run.player,bx=(p.x+.5)*s,by=(p.y+GROUND)*s;
  const toHud=()=>({x:(st.L?st.L.w-46:300)-st.ox,y:Math.max(26,(st.L?.top||60)*.3)-st.oy}),toBuddy=()=>({x:((run.player.renderX??run.player.x)+.5)*s,y:((run.player.renderY??run.player.y)+.3)*s});
  const say=st.say||(st.say={chain:0,frenzy:false,gold:false,any:false}),label=(text,lx,ly,options)=>pop(view,st,text,lx,ly,options);
  st.objectiveAt=-1;
  switch(e.type){
    case 'start':case 'restore':st.cam=null;st.fogCur=null;st.key='';st.L=null;break;
    case 'step':{
      st.hop=1;st.land=0;st.sinceStep=0;st.dir={dx:e.dx||0,dy:e.dy||0};
      const fromX=(p.previousX+.5)*s,fromY=(p.previousY+GROUND)*s,side=run.steps%2?1:-1;
      st.prints.push({x:fromX+(e.dy?side*s*.13:0),y:fromY-s*.12+(e.dx?side*s*.1:0),rot:Math.atan2(e.dy||0,e.dx||0)+Math.PI/2,t:st.t});if(st.prints.length>14)st.prints.shift();
      j.burst('dust',fromX-(e.dx||0)*s*.18,fromY-(e.dy||0)*s*.18,{count:3,scale:.5,speed:.5,colors:DUST});
      if(run.powerTime>0&&run.characterId==='griffin')j.burst('spark',fromX,fromY-s*.3,{count:3,color:'#ffe38c',speed:.5});
      break;
    }
    // Holding a direction against a wall repeats the bump: answer the first one, then rest.
    case 'bump':if(st.t-st.bumpAt<.42)break;st.bumpAt=st.t;st.bump={dx:e.dx||0,dy:e.dy||0,t:1};j.kick((e.dx||0)*2.5,(e.dy||0)*2.5);j.burst('dust',bx+(e.dx||0)*s*.42,by-s*.2+(e.dy||0)*s*.4,{count:2,scale:.5,speed:.4});break;
    case 'collect':{
      const total=e.totalMultiplier||1;
      if(e.kind==='key'){j.ring(x,y,{color:'#ffe38c',radius:s*1.5,life:.55,width:5});j.ring(x,y,{color:'#fff8d8',radius:s*.9,life:.4,width:3});j.burst('star',x,y,{count:10,speed:.7});label('GATE KEY!',x,y-s*.7,{color:'#ffe38c',size:17});j.hitStop(.04);
        j.fly({x,y,target:toHud,life:.7,arc:s*1.2,draw:(c,fx,fy,t)=>drawKey(c,fx,fy,s*.3*(1-t*.3),t*5)});}
      else{
        if(!st.pending)st.pending={value:0,count:0,total,gold:false};st.pending.value+=e.value||0;st.pending.count++;st.pending.total=Math.max(st.pending.total,total);if(e.kind==='gold')st.pending.gold=true;
        if(st.pending.count<4)j.burst('crumb',x,y,{count:e.trail?5:4,speed:.6,colors:e.trail?['#ffb35c','#ffe38c','#fff2c9']:undefined});
      }
      break;
    }
    // Stack layers that switch on together are announced together, once, by the frame.
    case 'combo':say.chain=e.multiplier;j.ring(bx,by,{color:LAYER.chain,radius:s*1.1,life:.4,width:3});st.tag.pop=1;break;
    case 'fever':say.frenzy=true;j.ring(bx,by,{color:LAYER.frenzy,radius:s*2.2,life:.6,width:6});j.zoomPunch(.045);if(!calm)j.flash('#ffb35c',.22,.3);j.burst('stomp',bx,by-s*.4,{count:12,speed:.6});st.tag.pop=1;break;
    case 'gold-rush':if(st.t-st.rushAt>1.4){st.rushAt=st.t;say.gold=true;j.ring(bx,by,{color:LAYER.gold,radius:s*1.6,life:.5,width:4});}st.tag.pop=1;break;
    case 'charged':st.charged=1;j.ring(bx,by-s*.3,{color:ABILITIES[run.characterId]?.color||'#fff2ab',radius:s*1.2,life:.6,width:4});j.burst('spark',bx,by-s*.4,{count:8,speed:.5,color:ABILITIES[run.characterId]?.color});break;
    case 'power':{
      const color=ABILITIES[e.characterId]?.color||'#fff2ab';st.tag.pop=1;j.zoomPunch(.05);if(!calm)j.flash(color,.2,.3);
      j.ring(bx,by-s*.3,{color,radius:s*2.4,life:.6,width:7});j.burst('power',bx,by-s*.4,{count:20,speed:.6,color});
      if(e.characterId==='kevin'){st.radar=1;for(const r of [3.2,5.2])j.ring(bx,by-s*.3,{color:'#a8e8fb',radius:s*r,life:.9+r*.08,width:3});}
      else if(e.characterId==='mittens'){j.burst('heart',bx,by-s*.5,{count:6});label('+1 HEART',bx,by-s*1.5,{color:'#ffc3df',size:16});}
      else if(e.characterId==='spike'){j.burst('debris',bx,by-s*.2,{count:8,speed:.6,colors:['#aedd80','#d9f0b5','#7fb85c']});label('SHELL UP!',bx,by-s*1.5,{color:'#aedd80',size:16});}
      else label('ZOOMIES ×1.5!',bx,by-s*1.5,{color:'#ffd56d',size:18});
      break;
    }
    case 'chest':{
      st.spin=1;st.opened[e.y*64+e.x]=st.t;j.hitStop(.05);j.zoomPunch(.04);j.shake(.14);
      j.ring(x,y,{color:'#ffe38c',radius:s*1.9,life:.55,width:6});j.burst('gold',x,y-s*.1,{count:16,speed:.62});j.burst('poof',x,y,{count:6,scale:.7,speed:.6});
      for(let i=0;i<7;i++)j.fly({x:x+(i-3)*s*.09,y:y-s*.2,target:toHud,life:.5+i*.07,arc:s*(.8+i%3*.5),draw:(c,fx,fy,t)=>{if(!view.prop(c,'biscuit',fx,fy,s*.5*(1-t*.35),{rotate:t*7+i}))disc(c,fx,fy,s*.1,'#ffe38c');}});
      break;
    }
    case 'parcel':st.basket={t:st.t};j.fly({x,y:y-s*.2,target:toBuddy,life:.55,arc:s*1.1,draw:(c,fx,fy)=>drawBasket(c,fx,fy,s*.34)});break;
    case 'deliver':{
      st.joy=1;st.basket=null;j.slowMo(.5,.4);j.zoomPunch(.05);if(!calm)j.flash('#fff4d7',.22,.3);
      j.fly({x:bx,y:by-s*.6,target:()=>({x,y:y-s*.3}),life:.4,arc:s*.8,draw:(c,fx,fy)=>drawBasket(c,fx,fy,s*.34)});
      j.ring(x,y-s*.2,{color:'#ffb4a3',radius:s*2,life:.6,width:6});j.burst('heart',x,y-s*.6,{count:7});j.burst('confetti',x,y-s*.5,{count:22,speed:.55});label(`+${e.value||250}`,x,y-s*1.5,{color:'#ffd75e',size:21,life:1.3});
      break;
    }
    case 'dialog':st.talk=1;break;
    case 'greet':st.wave=1;j.burst('heart',x,y-s*.8,{count:2});break;
    case 'locked':st.rv=1;st.locked={t:st.t,treasures:e.treasures||0,keys:e.keys||0,delivered:!!e.deliveryDone};j.kick(0,-3);break;
    case 'hit':st.hurt=1;j.hitStop(.07);j.shake(.5);if(!calm)j.flash('#7a4a32',.3,.28);j.burst('debris',x,y,{count:12,speed:.7,colors:T.mud});j.burst('splash',x,y,{count:10,speed:.5,colors:[T.mud[0],T.mud[2]]});j.ring(x,y,{color:T.mud[2],radius:s*1.3,life:.4,width:5});label('SPLAT!',x,y-s*.9,{color:'#ffb19c',size:19});break;
    case 'shield':j.ring(x,y,{color:'#b7edff',radius:s*1.4,life:.5,width:6});j.burst('bubble',x,y,{count:8,speed:.7});label('SHIELD!',x,y-s*.9,{color:'#b7edff',size:17});break;
    case 'hint':j.ring(bx,by-s*.3,{color:'#fff09c',radius:s*1.5,life:.6,width:4});if(e.target)j.ring((e.target.x+.5)*s,(e.target.y+.5)*s,{color:'#fff09c',radius:s*1.2,life:.9,width:4});break;
    case 'walk':j.ring(x,y,{color:'#ffffff',radius:s*.62,life:.38,width:3,from:s*.12});break;
    case 'walk-end':if(e.reason==='hazard'){st.alert=1;j.ring(x,y,{color:'#ffb19c',radius:s*.8,life:.5,width:4});label('WAIT!',bx,by-s*1.4,{color:'#ffb19c',size:15});}break;
    case 'walk-wait':st.alert=1;break;
    case 'trail':j.ring(x,y,{color:'#ffb35c',radius:s*1.3,life:.5,width:3});break;
    case 'trail-complete':label('TRAIL DASH!',x,y-s*1.6,{color:'#ffb35c',size:19,life:1.3});j.ring(x,y,{color:'#ffd75e',radius:s*1.8,life:.55,width:5});j.burst('gold',x,y,{count:12,speed:.6});j.zoomPunch(.03);break;
    case 'trail-fade':j.burst('poof',x,y,{count:3,scale:.5,speed:.5});break;
    case 'critter':j.hitStop(.04);say.chain=e.multiplier;if(!st.pending)st.pending={value:0,count:0,total:1,gold:false};st.pending.value+=e.value||0;st.pending.count++;st.pending.total=Math.max(st.pending.total,e.totalMultiplier||1);j.ring(x,y,{color:T.wing[0],radius:s*1.5,life:.5,width:5});j.burst('star',x,y-s*.3,{count:12,speed:.6,colors:[T.wing[0],T.wing[1],'#ffffff']});st.tag.pop=1;break;
    case 'critter-back':j.burst('spark',x,y,{count:4,speed:.3,color:T.wing[0]});break;
    case 'paw-reveal':j.ring(x,y,{color:'#ffe38c',radius:s*.9,life:.7,width:3});j.burst('star',x,y,{count:5,speed:.4});break;
    case 'paw':j.hitStop(.06);j.zoomPunch(.05);if(!calm)j.flash('#ffe38c',.24,.32);j.ring(x,y,{color:'#ffe38c',radius:s*2.3,life:.7,width:7});j.burst('gold',x,y,{count:20,speed:.7});label('GOLDEN PAW!',x,y-s*1.7,{color:'#ffd75e',size:21,life:1.5});if(!st.pending)st.pending={value:0,count:0,total:1,gold:true};st.pending.value+=e.value||0;st.pending.count+=3;st.pending.total=Math.max(st.pending.total,e.totalMultiplier||1);st.spin=1;break;
    case 'won':j.burst('confetti',bx,by-s,{count:30,speed:.7});j.slowMo(.5,.4);break;
    case 'lost':j.shake(.3);break;
  }
}

// --- things in the world --------------------------------------------------
function drawKey(c,x,y,r,turn=0){
  c.save();c.translate(x,y);c.rotate(-.55+turn);c.lineJoin='round';c.strokeStyle='#8a6230';c.lineWidth=Math.max(1.5,r*.2);c.fillStyle='#ffdf7e';
  c.beginPath();c.rect(-r*.05,-r*.16,r*1.25,r*.32);c.rect(r*.72,r*.1,r*.2,r*.34);c.rect(r*1.02,r*.1,r*.18,r*.26);c.stroke();c.fill();
  c.beginPath();c.arc(-r*.5,0,r*.52,0,TAU);c.stroke();c.fill();disc(c,-r*.5,0,r*.2,'#8a6230');c.restore();
}
function drawBasket(c,x,y,r){
  c.save();c.translate(x,y);c.strokeStyle='#7a4f2b';c.lineWidth=Math.max(1.5,r*.16);c.beginPath();c.arc(0,-r*.1,r*.72,Math.PI*1.08,Math.PI*1.92);c.stroke();
  rounded(c,-r*.85,-r*.1,r*1.7,r*.95,r*.25,'#c98f52','#7a4f2b',Math.max(1.2,r*.12));c.fillStyle='#e8544c';c.beginPath();c.moveTo(-r*.85,-r*.1);c.lineTo(r*.85,-r*.1);c.lineTo(r*.55,r*.28);c.lineTo(0,r*.05);c.lineTo(-r*.55,r*.28);c.closePath();c.fill();
  c.fillStyle='#fff4e0';c.fillRect(-r*.3,-r*.1,r*.2,r*.2);c.fillRect(r*.1,-r*.1,r*.2,r*.2);c.restore();
}
function drawChest(c,x,y,s,open,wiggle){
  const w=s*.62,h=s*.42;c.save();c.translate(x,y);ellipse(c,0,h*.52,w*.58,h*.2,'#0000002e');c.rotate(wiggle);
  if(open){
    rounded(c,-w/2,-h*.9,w,h*.55,3,'#6d4526','#3f2a1a');rounded(c,-w*.42,-h*.82,w*.84,h*.34,2,'#2c1d12');
    rounded(c,-w/2,-h*.38,w,h*.86,4,'#b47a43','#5d3f25');c.fillStyle='#e0b25e';c.fillRect(-w/2,-h*.02,w,h*.12);
  }else{
    rounded(c,-w/2,-h*.3,w,h*.8,4,'#b47a43','#5d3f25');c.beginPath();c.roundRect(-w/2,-h*.78,w,h*.56,[h*.34,h*.34,2,2]);c.fillStyle='#cf9451';c.fill();c.strokeStyle='#5d3f25';c.lineWidth=1.5;c.stroke();
    c.fillStyle='#e0b25e';c.fillRect(-w*.34,-h*.78,w*.1,h*1.28);c.fillRect(w*.24,-h*.78,w*.1,h*1.28);c.fillRect(-w/2,-h*.28,w,h*.1);rounded(c,-w*.08,-h*.36,w*.16,h*.3,2,'#ffe38c','#8a6230',1.2);
    c.fillStyle='#ffffff55';c.fillRect(-w*.42,-h*.68,w*.3,h*.08);
  }
  c.restore();
}
function drawMud(c,e,x,y,s,T,time,calm){
  const warn=e.warn&&!e.active,pulse=calm?0:Math.sin(time*(e.active?9:warn?16:2)+e.x),r=s*(e.active?.4:.34)*(1+(e.active?pulse*.05:warn?pulse*.07:0));
  if(warn||e.active){
    c.strokeStyle=e.active?'#ff8f6e':'#ffc27a';c.lineWidth=3.5;c.globalAlpha=e.active?.85:.6+(calm?0:pulse*.3);c.beginPath();c.ellipse(x,y,r*1.28,r*.92,0,0,TAU);c.stroke();
    // While it warns, a second ring keeps rolling outward.
    if(warn&&!calm){const k=(time*2.8)%1;c.globalAlpha=(1-k)*.7;c.lineWidth=2.5;c.beginPath();c.ellipse(x,y,r*(1.3+k*.6),r*(.94+k*.42),0,0,TAU);c.stroke();}
    c.globalAlpha=1;
  }
  ellipse(c,x,y,r*1.08,r*.76,T.mud[1]);ellipse(c,x,y-r*.06,r*.94,r*.62,e.active?T.mud[1]:T.mud[0]);ellipse(c,x-r*.3,y-r*.22,r*.3,r*.13,T.mud[2]+'88');
  if(e.active)for(let i=0;i<3;i++){const ph=calm?.5:(time*1.7+i*.37+e.y*.2)%1,bx=x+(i-1)*r*.48,by=y+((i*7)%3-1)*r*.2;c.strokeStyle=T.mud[2];c.lineWidth=2;c.globalAlpha=1-ph;c.beginPath();c.arc(bx,by-ph*r*.3,r*(.08+ph*.2),0,TAU);c.stroke();c.globalAlpha=1;}
  else{disc(c,x+r*.3,y+r*.1,r*.09,T.mud[2]);disc(c,x-r*.1,y+r*.24,r*.06,T.mud[2]);}
}
function drawNeighbour(c,e,x,gy,s,run,st,time,calm){
  const world=run.worldIndex,near=Math.abs(run.player.x-e.x)+Math.abs(run.player.y-e.y)<=2,joy=st.joy,jump=joy>0?Math.abs(Math.sin(joy*Math.PI*3))*s*.3:st.talk>0?Math.sin(st.talk*Math.PI)*s*.08:0;
  const bob=calm?0:Math.sin(time*2.6)*1.2,hgt=s*.92,y=gy-jump,coat=['#3f8f9a','#4f8a4f','#d9763f','#5b5fb0','#d85a7a'][world],hat=['#2b6672','#7a5a3c','#b98a55','#34386e','#f1d27a'][world],skin=['#f2c9a0','#d9a377','#f2c9a0','#c98f6a','#e9b890'][world];
  ellipse(c,x,gy+2,s*.26*(1-jump/s),s*.08,'#00000030');
  c.save();c.translate(x,y+bob);
  // Body, scarf, and a waving arm.
  c.beginPath();c.roundRect(-hgt*.2,-hgt*.5,hgt*.4,hgt*.5,[hgt*.16,hgt*.16,hgt*.05,hgt*.05]);c.fillStyle=coat;c.fill();
  c.fillStyle='#fff4d7';c.fillRect(-hgt*.2,-hgt*.5,hgt*.4,hgt*.07);
  const lift=joy>0?-2.3:near||st.wave>0?-1.9+(calm?0:Math.sin(time*9)*.45):-.5;c.strokeStyle=coat;c.lineWidth=hgt*.1;c.lineCap='round';
  c.beginPath();c.moveTo(hgt*.17,-hgt*.4);c.lineTo(hgt*.17+Math.cos(lift)*hgt*.24,-hgt*.4+Math.sin(lift)*hgt*.24);if(joy>0){c.moveTo(-hgt*.17,-hgt*.4);c.lineTo(-hgt*.17-Math.cos(lift)*hgt*.24,-hgt*.4+Math.sin(lift)*hgt*.24);}c.stroke();
  disc(c,hgt*.17+Math.cos(lift)*hgt*.27,-hgt*.4+Math.sin(lift)*hgt*.27,hgt*.055,skin);
  // Head and hat.
  disc(c,0,-hgt*.66,hgt*.2,skin);disc(c,-hgt*.07,-hgt*.67,hgt*.026,'#2a3b3d');disc(c,hgt*.07,-hgt*.67,hgt*.026,'#2a3b3d');
  c.strokeStyle='#8a4a3a';c.lineWidth=1.5;c.beginPath();c.arc(0,-hgt*.63,hgt*.08,.2,Math.PI-.2);c.stroke();
  if(world===3){c.beginPath();c.moveTo(-hgt*.22,-hgt*.79);c.lineTo(hgt*.04,-hgt*1.2);c.lineTo(hgt*.22,-hgt*.79);c.closePath();c.fillStyle=hat;c.fill();twinkle(c,hgt*.02,-hgt*.95,hgt*.07,'#ffe38c');}
  else{ellipse(c,0,-hgt*.8,hgt*.3,hgt*.07,hat);c.beginPath();c.roundRect(-hgt*.16,-hgt*.97,hgt*.32,hgt*.18,[hgt*.1,hgt*.1,0,0]);c.fillStyle=hat;c.fill();if(world===4)disc(c,hgt*.12,-hgt*.84,hgt*.045,'#5a6fd6');}
  c.restore();
  // A small bubble says what the neighbour is thinking.
  const by=y-hgt*1.42+(calm?0:Math.sin(time*3.2)*2),br=s*.2;
  if(e.delivered){c.save();c.translate(x,by+br*.2);c.scale(br/9,br/9);c.beginPath();c.moveTo(0,7);c.bezierCurveTo(-11,-2,-5,-10,0,-4);c.bezierCurveTo(5,-10,11,-2,0,7);c.fillStyle='#ff8f9f';c.fill();c.restore();}
  else{
    disc(c,x,by,br,'#fff8e6');c.beginPath();c.moveTo(x-br*.35,by+br*.8);c.lineTo(x,by+br*1.5);c.lineTo(x+br*.35,by+br*.8);c.fillStyle='#fff8e6';c.fill();
    if(run.questStarted)drawBasket(c,x,by+br*.05,br*.55);else{c.fillStyle='#e0703f';c.fillRect(x-br*.12,by-br*.6,br*.24,br*.75);disc(c,x,by+br*.45,br*.15,'#e0703f');}
  }
}
function drawRv(view,c,x,gy,s,st,time,calm,ready,night){
  const f=view.rvFrame,w=s*1.72,shake=st.rv>0?Math.sin(st.rv*Math.PI*6)*.05*st.rv:0,idle=calm?0:Math.sin(time*11)*.5;
  ellipse(c,x,gy+2,w*.5,s*.11,'#0000003a');
  if(ready)drawGlow(c,'255,227,140',x,gy-s*.3,s*(1.5+(calm?0:Math.sin(time*4)*.12)),.5);
  c.save();c.translate(x,gy);c.rotate(shake);
  if(view.rv&&f){const hgt=w*f.h/f.w;c.drawImage(view.rv,f.x,f.y,f.w,f.h,-w/2,-hgt+idle+s*.06,w,hgt);}
  else{rounded(c,-w/2,-w*.5,w,w*.44,6,'#f3e4c2','#6b5a3e');c.fillStyle='#3f6b4c';c.fillRect(-w/2,-w*.18,w,w*.1);disc(c,-w*.25,-w*.04,w*.08,'#2d2a26');disc(c,w*.28,-w*.04,w*.08,'#2d2a26');}
  c.restore();
  if(night)drawGlow(c,'255,236,170',x+w*.48,gy-s*.22,s*.5,.7);
}
function drawButterfly(c,x,y,s,T,time,calm,night){
  const flap=calm?.7:Math.abs(Math.sin(time*13)),r=s*.16;
  if(night)drawGlow(c,'190,240,255',x,y,s*.5,.55);
  c.save();c.translate(x,y);c.rotate(calm?0:Math.sin(time*2.3)*.25);
  for(const side of [-1,1]){c.save();c.scale(side*(.25+flap*.75),1);ellipse(c,r*.72,-r*.3,r*.8,r*.62,T.wing[0]);ellipse(c,r*.56,r*.42,r*.52,r*.42,T.wing[1]);disc(c,r*.8,-r*.32,r*.2,'#ffffffaa');c.restore();}
  rounded(c,-r*.1,-r*.6,r*.2,r*1.2,r*.1,'#3b2f2a');c.restore();
}
function drawTreat(view,c,kind,x,y,w,rot){if(!view.prop(c,kind,x,y,w,{rotate:rot})){c.save();c.translate(x,y);c.rotate(rot-.5);rounded(c,-w*.4,-w*.12,w*.8,w*.24,w*.1,kind==='chicken'?'#f0a24a':'#f3d9a0','#a67f48',1.2);c.restore();}}

function findObjective(run){
  const seen=e=>run.seen[e.y]?.[e.x],p=run.player;let npc=null,exit=null,key=null,chest=null,gap=1e9;
  for(const e of run.entities){
    if(e.type==='npc')npc=e;else if(e.type==='exit')exit=e;else if(e.type==='key'&&!e.taken)key=e;
    else if(e.type==='chest'&&!e.taken&&seen(e)){const d=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);if(d<gap){gap=d;chest=e;}}
  }
  const known=e=>e&&seen(e)?e:null;
  if(run.parcel&&!run.deliveryDone)return known(npc);
  if(!run.questStarted&&known(npc))return npc;
  if(run.treasures<3)return chest;
  if(run.keys<1)return known(key);
  if(!run.deliveryDone)return known(npc);
  return known(exit);
}

// --- frame ------------------------------------------------------------------
// Draws one frame. Sets view.scoutLayout={left,top,cell} (CSS px), which the
// controller uses to map canvas taps to grid cells.
export function drawScout(view,run,{time=0,dt=0,reducedMotion=false,insets}={}){
  view.reducedMotion=reducedMotion;view.time=reducedMotion?0:time;
  const c=view.begin(),w=view.width,h=view.height,j=view.juice,T=THEMES[run.worldIndex]||THEMES[0],st=stateFor(view,run),calm=reducedMotion;
  if(!view.scoutCellAt)view.scoutCellAt=(x,y)=>cellAt(view,x,y);
  st.reduced=calm;j.update(dt);
  // View clocks run on real time and stop with the game (dt is 0 while paused).
  st.t+=dt;if(!calm)st.anim+=dt;const clock=st.anim;
  for(const [name,seconds] of TIMERS)if(st[name]>0)st[name]=Math.max(0,st[name]-dt/seconds);
  if(st.hop>0){st.hop=Math.max(0,st.hop-dt/HOP);if(!st.hop)st.land=1;}else if(st.land>0)st.land=Math.max(0,st.land-dt/LAND);
  st.sinceStep+=dt;if(st.bump){st.bump.t-=dt/.16;if(st.bump.t<=0)st.bump=null;}if(st.tag.pop>0)st.tag.pop=Math.max(0,st.tag.pop-dt/.3);
  const L=layout(view,st,run,insets||view.insets);if(st.key!==L.key)build(view,st,run,T,L);
  camera(st,run,L,dt,view.dpr||1);liftFog(st,run,L,dt);
  const s=L.cell,ox=st.ox,oy=st.oy,at=view.scoutLayout||(view.scoutLayout={});at.left=ox;at.top=oy;at.cell=s;
  const p=run.player,prx=p.renderX??p.x,pry=p.renderY??p.y,px=(prx+.5)*s,pgy=(pry+GROUND)*s;
  const vx0=-ox-s*1.5,vx1=-ox+w+s*1.5,vy0=-oy-s*1.5,vy1=-oy+h+s*1.5,shown=(x,y)=>x>vx0&&x<vx1&&y>vy0&&y<vy1,seen=e=>run.seen[e.y]?.[e.x];

  c.fillStyle=T.under;c.fillRect(0,0,w,h);
  const o=j.offset,enterWorld=()=>{c.save();if(o.zoom!==1||o.rot){c.translate(L.cx,L.cy);c.rotate(o.rot);c.scale(o.zoom,o.zoom);c.translate(-L.cx,-L.cy);}c.translate(ox+o.x,oy+o.y);};
  enterWorld();
  if(T.water){
    // Two drifting layers of wave marks make the river move.
    if(!st.waterFill)st.waterFill=c.createPattern(st.water,'repeat');
    for(let i=0;i<2;i++){const dx=((clock*(i?-7:11))%128+128)%128,dy=((clock*(i?5:3)+i*40)%128+128)%128;c.save();c.translate(dx,dy);c.globalAlpha=i?.5:.8;c.fillStyle=st.waterFill;c.fillRect(-ox-dx-140,-oy-dy-140,w+280,h+280);c.restore();}
  }
  // The painted world, cropped to what is on screen.
  const layer=st.layer,sx=Math.max(layer.x,Math.floor(-ox-12)),sy=Math.max(layer.y,Math.floor(-oy-12)),ex=Math.min(layer.x+layer.w,Math.ceil(-ox+w+12)),ey=Math.min(layer.y+layer.h,Math.ceil(-oy+h+12));
  if(ex>sx&&ey>sy)c.drawImage(layer.canvas,(sx-layer.x)*layer.k,(sy-layer.y)*layer.k,(ex-sx)*layer.k,(ey-sy)*layer.k,sx,sy,ex-sx,ey-sy);
  if(T.water&&!calm){c.beginPath();for(const g of st.glints){if(!shown(g.x,g.y))continue;const tw=Math.sin(clock*2.2+g.ph);if(tw>.55)twinklePath(c,g.x,g.y,(tw-.55)*s*.26);}c.fillStyle='#ffffffcc';c.fill();}
  // Grass sways at the foot of the walls: one path, two strokes.
  c.lineCap='round';c.lineWidth=Math.max(1.6,s*.045);
  for(let pass=0;pass<2;pass++){c.beginPath();for(const tuft of st.tufts){if(!shown(tuft.x,tuft.y))continue;const sway=calm?0:Math.sin(clock*2.1+tuft.ph)*tuft.h*.34;for(let b=-1;b<=1;b++){if((b===0)!==(pass===1))continue;c.moveTo(tuft.x+b*2.4,tuft.y);c.quadraticCurveTo(tuft.x+b*3.4,tuft.y-tuft.h*.6,tuft.x+b*4.6+sway,tuft.y-tuft.h*(b?0.8:1.1));}}c.strokeStyle=pass?T.tuftTip:T.tuft;c.stroke();}

  // Ground marks: fading pawprints and a tap-to-walk route.
  for(const print of st.prints){const age=st.t-print.t,a=clamp(1-age/3.4,0,1)*.42;if(a>.01){c.globalAlpha=a;paw(c,print.x,print.y,s*.12,print.rot,T.print);}}c.globalAlpha=1;
  const route=run.route,goal=run.walkTarget;
  if(goal){
    c.fillStyle='#ffffffb8';c.beginPath();for(const at of route||[])if(at.x!==goal.x||at.y!==goal.y){const rx=(at.x+.5)*s,ry=(at.y+.56)*s;c.moveTo(rx+s*.06,ry);c.arc(rx,ry,s*.06,0,TAU);}c.fill();
    const gx=(goal.x+.5)*s,gy=(goal.y+.56)*s,beat=calm?0:Math.sin(clock*7)*.08;c.strokeStyle='#ffffffd9';c.lineWidth=3;c.beginPath();c.ellipse(gx,gy,s*(.3+beat),s*(.2+beat*.7),0,0,TAU);c.stroke();disc(c,gx,gy,s*.07,'#ffffff');
  }

  // Things on the ground.
  let npc=null,exit=null,critter=null;
  for(const e of run.entities){
    const x=(e.x+.5)*s,y=(e.y+.5)*s;
    if(e.type==='npc'){npc=e;continue;}if(e.type==='exit'){exit=e;continue;}if(e.type==='critter'){critter=e;continue;}
    if(!shown(x,y))continue;
    if(e.type==='chest'){
      if(!seen(e))continue;const since=st.opened[e.y*64+e.x],near=Math.abs(p.x-e.x)+Math.abs(p.y-e.y)<=2,wiggle=e.taken||calm?0:near?Math.sin(clock*14)*.07:Math.max(0,Math.sin(clock*1.6+e.x))**8*Math.sin(clock*18)*.09;
      if(!e.taken)drawGlow(c,'255,227,140',x,y,s*(.74+(calm?0:Math.sin(clock*3+e.y)*.06)),.5);else if(since!==undefined)drawGlow(c,'255,227,140',x,y-s*.2,s*.9,clamp(1-(st.t-since)/1.2,0,1)*.8);
      drawChest(c,x,y+s*.12,s,e.taken,wiggle);continue;
    }
    if(e.taken||!seen(e))continue;
    const bob=calm?0:Math.sin(clock*3.1+e.x*1.7+e.y*2.3);
    if(e.type==='bone'){ellipse(c,x,y+s*.2,s*.2,s*.06,'#00000022');drawTreat(view,c,'biscuit',x,y-s*.02+bob*s*.035,s*.56,-.35+bob*.08);}
    else if(e.type==='trail'){
      const age=run.time-e.born-e.order*.07,left=e.expires-run.time;if(age<0)continue;const pop=calm?1:ease.outBack(clamp(age/.25,0,1)),blink=left<2&&!calm?.45+.55*Math.abs(Math.sin(clock*12)):1;
      c.globalAlpha=blink;drawGlow(c,'255,190,110',x,y,s*.5,.6);ellipse(c,x,y+s*.2,s*.18,s*.05,'#00000022');drawTreat(view,c,'chicken',x,y-s*.04+bob*s*.04,s*.58*pop,.3+bob*.12);c.globalAlpha=1;
    }
    else if(e.type==='key'){drawGlow(c,'255,227,140',x,y,s*.62,.6);ellipse(c,x,y+s*.24,s*.17,s*.05,'#00000022');drawKey(c,x-s*.04,y-s*.03+bob*s*.05,s*.25,calm?0:Math.sin(clock*2.2)*.12);}
    else if(e.type==='hazard')drawMud(c,e,x,y+s*.08,s,T,clock,calm);
    else if(e.type==='paw'){
      if(e.revealed){drawGlow(c,'255,215,94',x,y,s*(.7+bob*.05),.75);paw(c,x,y+s*.03,s*.26,0,'#b8862e');paw(c,x,y,s*.25,0,'#ffd75e');}
      else if(!calm){const tw=Math.sin(clock*1.5+e.x*2.1);if(tw>.86)twinkle(c,x+s*.1,y-s*.05,(tw-.86)*s*1.6,'#fff4c0');}
    }
  }

  // The hint: a glowing line of pawprints that ripples toward the goal, drawn over the treats so it is never hidden.
  const hint=run.hintPath;
  if(hint?.length>1)for(let i=1;i<hint.length;i++){
    const at=hint[i],hx=(at.x+.5+(i%2?.15:-.15))*s,hy=(at.y+.66)*s;if(!shown(hx,hy))continue;const next=hint[i+1]||at,before=hint[i-1],wave=calm?.8:Math.max(0,Math.sin(clock*5.5-i*.75)),fade=clamp(run.hintTime,0,1);
    const size=s*(.17+wave*.05),turn=Math.atan2(next.y-before.y,next.x-before.x)+Math.PI/2;
    drawGlow(c,'255,224,122',hx,hy,s*.46,(.3+wave*.5)*fade);c.globalAlpha=clamp(.6+wave*.4,0,1)*fade;paw(c,hx,hy+1.5,size*1.22,turn,'#1d3f44c0');paw(c,hx,hy,size,turn,wave>.5?'#fff6c4':'#ffd24a');
  }
  c.globalAlpha=1;

  // Actors, back to front: whoever stands lower on the screen is drawn later.
  if(npc){const aside=p.x===npc.x&&p.y===npc.y?.44:0;st.aside+=(aside-st.aside)*(calm?1:Math.min(1,dt*10));}
  const npcGy=npc?(npc.y+.62)*s:0,npcX=npc?(npc.x+.5-st.aside)*s:0,exitGy=exit?(exit.y+.6)*s:0,ready=run.treasures>=3&&run.keys>=1&&run.deliveryDone;
  const showNpc=npc&&seen(npc)&&shown(npcX,npcGy),showExit=exit&&seen(exit)&&shown((exit.x+.5)*s,exitGy);
  if(showExit&&exitGy<=pgy)drawRv(view,c,(exit.x+.5)*s,exitGy,s,st,clock,calm,ready,T.night);
  if(showNpc&&npcGy<=pgy)drawNeighbour(c,npc,npcX,npcGy,s,run,st,clock,calm);
  drawBuddy(view,c,run,st,T,s,px,pgy,clock,calm);
  if(showNpc&&npcGy>pgy)drawNeighbour(c,npc,npcX,npcGy,s,run,st,clock,calm);
  if(showExit&&exitGy>pgy)drawRv(view,c,(exit.x+.5)*s,exitGy,s,st,clock,calm,ready,T.night);
  if(critter&&!critter.hidden&&run.seen[critter.y]?.[critter.x]){const bx=((critter.renderX??critter.x)+.5)*s,by=((critter.renderY??critter.y)+.34)*s+(calm?0:Math.sin(clock*5.1)*s*.07);if(shown(bx,by)){ellipse(c,bx,by+s*.36,s*.1,s*.035,'#00000022');drawButterfly(c,bx,by,s,T,clock,calm,T.night);}}

  // Mist over everything not yet explored.
  const fog=st.fog;c.globalAlpha=T.fogA;c.imageSmoothingEnabled=true;c.drawImage(fog.canvas,layer.x,layer.y,layer.w,layer.h);c.globalAlpha=1;
  if(T.night){
    drawNight(view,c,st,run,L,T,px,pgy,clock,calm,ox+o.x,oy+o.y);
    // Fireflies drift over the whole mesa, explored or not.
    for(const fly of st.flies){const fx=fly.x+(calm?0:Math.sin(clock*.7+fly.ph)*s*.3),fy=fly.y+(calm?0:Math.cos(clock*.9+fly.ph*1.7)*s*.24);if(shown(fx,fy))drawGlow(c,'214,255,170',fx,fy,s*.2,calm?.5:.3+.6*Math.max(0,Math.sin(clock*2.3+fly.ph*3)));}
  }
  // Hidden treasure glints through the mist, and trail treats show where they lead.
  for(const e of run.entities){
    if(e.taken||seen(e))continue;const x=(e.x+.5)*s,y=(e.y+.5)*s;if(!shown(x,y))continue;
    if(e.type==='chest'){const tw=calm?.6:Math.sin(clock*2.4+e.x*1.3+e.y);if(tw>.2){c.globalAlpha=clamp((tw-.2)*1.6,0,1);twinkle(c,x,y-s*.1,s*(.1+tw*.14),'#fff4c0');twinkle(c,x+s*.22,y+s*.12,s*tw*.1,'#ffe38c');c.globalAlpha=1;}}
    else if(e.type==='trail'&&run.time-e.born-e.order*.07>=0){const tw=calm?.7:.6+.4*Math.sin(clock*6+e.order);c.globalAlpha=tw;drawGlow(c,'255,190,110',x,y,s*.34,.9);twinkle(c,x,y,s*.14,'#ffe38c');c.globalAlpha=1;}
  }
  // The current goal gets a bouncing marker.
  if(st.objectiveAt<0||st.t-st.objectiveAt>.4){st.objective=findObjective(run);st.objectiveAt=st.t;}
  const target=st.objective;let edge=null;
  if(target&&!target.taken){
    const tx=(target.x+.5)*s,ty=(target.y+(target.type==='npc'?-.95:target.type==='exit'?-.75:-.42))*s,screenX=tx+ox,screenY=(target.y+.5)*s+oy;
    if(screenX<L.left+s*.3||screenX>w-L.right-s*.3||screenY<L.top+s*.2||screenY>h-L.bottom-s*.2)edge={x:screenX,y:screenY,type:target.type};
    else if(!(target.type==='npc'&&!target.delivered)&&Math.abs(p.x-target.x)+Math.abs(p.y-target.y)>1){const bounce=calm?0:Math.abs(Math.sin(clock*4.2))*s*.16,my=ty-bounce;c.beginPath();c.moveTo(tx-s*.17,my-s*.26);c.lineTo(tx+s*.17,my-s*.26);c.lineTo(tx,my);c.closePath();c.fillStyle='#ffe07a';c.strokeStyle='#1d3f44';c.lineWidth=2.5;c.lineJoin='round';c.stroke();c.fill();}
  }
  if(st.locked&&st.t-st.locked.t<2.6&&exit)drawLocked(c,(exit.x+.5)*s,(exit.y-.95)*s,s,st.locked,clamp((2.6-(st.t-st.locked.t))*3,0,1));
  // One popup for everything picked up this frame, coloured by the live stack.
  let lineY=pgy-s*1.25;
  if(st.pending){const q=st.pending,big=q.count>2||q.gold,size=big?22:q.total>=10?18:q.total>=2?16:14;pop(view,st,`+${Math.round(q.value)}`,px,lineY,{color:tierColor(q.total),size,life:big?1.3:.8});lineY-=size+8;st.pending=null;}
  if(st.say){
    const q=st.say,count=(q.chain?1:0)+(q.frenzy?1:0)+(q.gold?1:0),total=run.totalMultiplier||1;
    if(count>1)pop(view,st,`STACK ×${Number(total.toFixed(1))}!`,px,lineY,{color:tierColor(total),size:total>=20?25:21,life:1.4});
    else if(q.frenzy)pop(view,st,'FRENZY ×2!',px,lineY,{color:LAYER.frenzy,size:21,life:1.3});
    else if(q.gold)pop(view,st,'GOLD RUSH ×2',px,lineY,{color:LAYER.gold,size:18,life:1.2});
    else if(q.chain)pop(view,st,`CHAIN ×${q.chain}`,px,lineY,{color:LAYER.chain,size:17,life:1.1});
    st.say=null;
  }
  c.restore();
  // Screen space: the way-finder and the mini-map sit under the sparks and score popups.
  if(edge)drawEdge(c,edge,L,w,h,s,clock,calm);
  if(L.scroll)drawMini(c,st,run,L,T,w,clock,calm);else st.miniBox=null;
  j.ceiling=st.top+4-(oy+o.y);enterWorld();j.draw(c);c.restore();
  j.drawOverlay(c,w,h);
  ambient(view,st,T,L,dt,calm);
}

function drawBuddy(view,c,run,st,T,s,px,pgy,time,calm){
  const p=run.player,art=view.sprites[run.characterId],hopT=st.hop>0?1-st.hop:1,arc=st.hop>0&&!calm?Math.sin(hopT*Math.PI):0,spin=calm?0:st.spin,spinArc=spin>0?Math.sin((1-spin)*Math.PI):0;
  const lunge=st.bump&&!calm?Math.sin(clamp(st.bump.t,0,1)*Math.PI)*s*.14:0,x=px+(st.bump?st.bump.dx*lunge:0),gy=pgy+(st.bump?st.bump.dy*lunge:0),up=arc*s*.2+spinArc*s*.55;
  const total=run.totalMultiplier||1,power=run.powerTime>0,ability=ABILITIES[run.characterId]?.color||'#fff2ab';
  // The bonus stack lives under the buddy: one ring per layer, each draining with its timer.
  if(total>1||power){const rgb=rgbOf(power?ability:tierColor(total));drawGlow(c,rgb,x,gy-s*.05,s*(.7+Math.min(.5,Math.log2(total+1)*.11))*(1+(calm?0:Math.sin(time*6)*.04)),.3+Math.min(.3,total*.015));}
  c.lineCap='round';
  const ring=(radius,fraction,color,width,blink)=>{if(fraction<=0)return;c.globalAlpha=blink&&!calm?.45+.55*Math.abs(Math.sin(time*11)):1;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,gy,radius,radius*.44,0,-Math.PI/2,-Math.PI/2+TAU*clamp(fraction,0,1));c.stroke();c.globalAlpha=1;};
  if(run.multiplier>1)ring(s*.5,run.comboTime/8,LAYER.chain,2+run.multiplier*.6,run.comboTime<2.5);
  if(run.goldRushTime>0)ring(s*.62,run.goldRushTime/6,LAYER.gold,3.5,run.goldRushTime<1.5);
  if(run.feverTime>0)ring(s*.74,run.feverTime/8,LAYER.frenzy,3.5,run.feverTime<1.5);
  if(power)ring(s*.86,run.powerTime/(run.powerDuration||5),ability,3.5,run.powerTime<1.2);
  if(st.charged>0){c.globalAlpha=st.charged;c.strokeStyle=ability;c.lineWidth=3;c.beginPath();c.ellipse(x,gy,s*(.5+(1-st.charged)*.5),s*(.22+(1-st.charged)*.22),0,0,TAU);c.stroke();c.globalAlpha=1;}
  ellipse(c,x,gy+1,s*.3*(1-up/s*.5),s*.085*(1-up/s*.5),'#00000038');
  if(!art)return;
  const moving=st.hop>0||st.sinceStep<.3||spin>0,front=art.frames[3],side=art.frames[run.steps%2],pose=spin>0?2:moving?run.steps%2:3;
  // Stretch on the way up, squash on landing, and breathe while waiting.
  let sx=1,sy=1;
  if(!calm){if(st.hop>0){sy=1+arc*.1;sx=1-arc*.06;}else if(st.land>0){const k=Math.sin(st.land*Math.PI);sy=1-k*.15;sx=1+k*.11;}else if(!moving)sy=1+Math.sin(time*2.6)*.018;}
  const sideScale=Math.min(s*1.18/art.runWidth,s*.94/Math.max(side.h,1)),frontScale=Math.min(s*1.05/front.h,s*1/front.w),width=pose===3?front.w*frontScale:art.runWidth*sideScale,height=(pose===3?front.h*frontScale:side.h*sideScale);
  const blink=run.invincible>0&&!power?(calm?.7:Math.floor(time*10)%2?.45:1):1,tilt=moving&&pose!==3&&!calm?st.dir.dy*.16:0;
  // Griffin's zoomies leave a streak of afterimages.
  if(power&&run.characterId==='griffin'&&moving&&!calm)for(let i=1;i<=2;i++){c.save();c.translate(x-st.dir.dx*i*s*.26,gy-up-st.dir.dy*i*s*.26);c.scale(p.facing<0?-1:1,1);view.character(c,run.characterId,pose,0,0,width,{alpha:.26/i,portrait:pose===3});c.restore();}
  c.save();c.translate(x,gy-up);
  if(spin>0){c.translate(0,-height*.5);c.rotate((1-spin)*TAU*(p.facing<0?-1:1));c.translate(0,height*.5);}
  c.scale((p.facing<0?-1:1)*sx,sy);c.rotate(tilt);
  view.character(c,run.characterId,pose,0,0,width,{alpha:blink,portrait:pose===3});c.restore();
  if(st.hurt>0){c.globalAlpha=clamp(st.hurt*1.6,0,1);for(const [mx,my,mr] of MUD_SPOTS)blob(c,x+mx*width,gy-up-height*my,s*mr,T.mud[mx>0?0:1],mx*9,6);c.globalAlpha=1;}
  if(run.shieldCharges>0||power&&run.characterId==='spike'){c.strokeStyle=power&&run.characterId==='spike'?'#aedd80cc':'#b7edffcc';c.lineWidth=3;c.beginPath();c.ellipse(x,gy-up-height*.48,width*.62,height*.66,0,0,TAU);c.stroke();}
  if(st.radar>0&&!calm){c.globalAlpha=st.radar*.7;c.strokeStyle='#a8e8fb';c.lineWidth=2.5;c.beginPath();c.arc(x,gy-s*.3,s*(1+(1-st.radar)*4.6),0,TAU);c.stroke();c.globalAlpha=1;}
  // The picnic bundle rides along until it is delivered.
  if(run.parcel&&!run.deliveryDone&&st.t-(st.basket?.t??-9)>.5)drawBasket(c,x-(p.facing<0?-1:1)*width*.16,gy-up-height*(pose===3?.98:.92)-s*.1+(calm?0:Math.sin(time*5)*1.5),s*.2);
  if(st.alert>0){const ay=gy-up-height-s*.34;disc(c,x,ay,s*.19,'#fff8e6');c.fillStyle='#e0703f';c.fillRect(x-s*.035,ay-s*.12,s*.07,s*.15);disc(c,x,ay+s*.1,s*.04,'#e0703f');}
  // The live multiplier rides beside the buddy.
  const shownTotal=Number(total.toFixed(1));if(shownTotal!==st.tag.value){if(shownTotal>st.tag.value)st.tag.pop=1;st.tag.value=shownTotal;}
  if(total>1){const size=Math.round(14+Math.min(8,total*.3)+st.tag.pop*6);c.font=`900 ${size}px system-ui,-apple-system,sans-serif`;c.textAlign='left';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=4;c.strokeStyle='#133b3dd9';const text=`×${shownTotal}`,tx=x+width*.42,ty=gy-up-height*.88;c.strokeText(text,tx,ty);c.fillStyle=tierColor(total);c.fillText(text,tx,ty);}
}
function drawLocked(c,x,y,s,info,alpha){
  // Three chests, a key, and the bundle: what is done is bright, what is missing is hollow.
  const r=s*.19,gap=s*.46,items=[info.treasures>=1,info.treasures>=2,info.treasures>=3,info.keys>=1,info.delivered],x0=x-gap*2;c.globalAlpha=alpha;
  rounded(c,x0-gap*.62,y-r*1.7,gap*5.24,r*3.4,r*1.7,'#143c3be6');
  items.forEach((done,i)=>{const ix=x0+i*gap;c.globalAlpha=alpha*(done?1:.42);if(i<3){rounded(c,ix-r,y-r*.7,r*2,r*1.4,2,done?'#ffd75e':null,done?'#8a6230':'#fff4d7',1.5);}else if(i===3)drawKey(c,ix-r*.2,y,r*.8);else drawBasket(c,ix,y-r*.1,r*.9);if(done){c.strokeStyle='#1d3f44';c.lineWidth=2;c.beginPath();c.moveTo(ix-r*.45,y);c.lineTo(ix-r*.1,y+r*.35);c.lineTo(ix+r*.5,y-r*.4);c.stroke();}});
  c.globalAlpha=1;
}
function drawNight(view,c,st,run,L,T,px,pgy,time,calm,ox,oy){
  // Darkness with holes punched by lanterns, built small and stretched soft.
  const q=4,lw=Math.ceil(L.w/q),lh=Math.ceil(L.h/q),s=L.cell;let light=st.light;
  if(!light||light.width!==lw||light.height!==lh){light=st.light=document.createElement('canvas');light.width=lw;light.height=lh;}
  const g=light.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,lw,lh);g.fillStyle='rgba(8,10,32,.46)';g.fillRect(0,0,lw,lh);g.globalCompositeOperation='destination-out';
  const hole=(x,y,r,a=1)=>{g.globalAlpha=a;g.drawImage(glow('255,255,255'),(x+ox-r)/q,(y+oy-r)/q,r*2/q,r*2/q);},flicker=calm?1:1+Math.sin(time*7.3)*.025+Math.sin(time*12.1)*.015;
  hole(px,pgy-s*.3,s*4.2*flicker*(run.powerTime>0?1.25:1));hole(px,pgy-s*.3,s*2.2*flicker);
  for(const e of run.entities){if(e.taken||!run.seen[e.y]?.[e.x])continue;const x=(e.x+.5)*s,y=(e.y+.5)*s;if(e.type==='npc')hole(x,y-s*.3,s*1.9);else if(e.type==='exit')hole(x,y-s*.2,s*2.3);else if(e.type==='chest'||e.type==='key'||e.type==='trail'||e.type==='paw'&&e.revealed)hole(x,y,s*1.05,.85);else if(e.type==='hazard'&&(e.active||e.warn))hole(x,y,s*.95,.7);}
  if(run.hintPath?.length>1)for(let i=1;i<run.hintPath.length;i+=2)hole((run.hintPath[i].x+.5)*s,(run.hintPath[i].y+.6)*s,s*.9,.6*clamp(run.hintTime,0,1));
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
  c.save();c.setTransform(view.dpr||1,0,0,view.dpr||1,0,0);c.imageSmoothingEnabled=true;c.drawImage(light,0,0,lw*q,lh*q);c.restore();
  drawGlow(c,'255,214,140',px,pgy-s*.3,s*2.6*flicker,.2);
}
function drawEdge(c,edge,L,w,h,s,time,calm){
  // The goal is off screen: a chip on the nearest edge points the way.
  const pad=24,x=clamp(edge.x,L.left+pad,w-L.right-pad),y=clamp(edge.y,L.top+pad,h-L.bottom-pad),angle=Math.atan2(edge.y-y,edge.x-x),nudge=calm?0:Math.sin(time*5)*3;
  c.save();c.translate(x+Math.cos(angle)*nudge,y+Math.sin(angle)*nudge);disc(c,0,0,17,'#143c3be6');c.strokeStyle='#ffe07a';c.lineWidth=2.5;c.beginPath();c.arc(0,0,17,0,TAU);c.stroke();
  c.rotate(angle);c.beginPath();c.moveTo(9,0);c.lineTo(-4,-7);c.lineTo(-1,0);c.lineTo(-4,7);c.closePath();c.fillStyle='#ffe07a';c.fill();c.restore();
}
function drawMini(c,st,run,L,T,w,time,calm){
  const m=clamp(Math.floor(84/L.cols),5,8),pad=5,mw=L.cols*m+pad*2,mh=L.rows*m+pad*2,x=w-L.right-mw-10,y=L.top+10;st.miniBox={x,y,w:mw,h:mh,cell:m,pad};
  if(!st.mini){
    // Redrawn only when more of the map has been seen.
    const k=2,canvas=document.createElement('canvas');canvas.width=mw*k;canvas.height=mh*k;const g=canvas.getContext('2d');g.scale(k,k);rounded(g,0,0,mw,mh,9,'#10292dd9','#fff4d733',1.5);
    for(let yy=0;yy<L.rows;yy++)for(let xx=0;xx<L.cols;xx++){if(!run.seen[yy][xx])continue;g.fillStyle=run.grid[yy][xx]===0?'#f3e7c4':'#ffffff26';g.fillRect(pad+xx*m+.5,pad+yy*m+.5,m-1,m-1);}
    st.mini=canvas;
  }
  c.drawImage(st.mini,x,y,mw,mh);
  for(const e of run.entities){
    if(e.taken||!run.seen[e.y]?.[e.x]||e.type==='paw'&&!e.revealed)continue;const color=e.type==='chest'?'#ffb62e':e.type==='key'?'#ffe38c':e.type==='npc'?'#ff8f9f':e.type==='exit'?'#7fe0a0':e.type==='paw'?'#ffd75e':null;if(!color)continue;
    disc(c,x+pad+(e.x+.5)*m,y+pad+(e.y+.5)*m,m*.42,color);
  }
  const p=run.player,px=x+pad+((p.renderX??p.x)+.5)*m,py=y+pad+((p.renderY??p.y)+.5)*m,pulse=calm?0:Math.abs(Math.sin(time*4));
  c.strokeStyle='#ffffff';c.globalAlpha=.75-pulse*.5;c.lineWidth=1.5;c.beginPath();c.arc(px,py,m*(.6+pulse*.7),0,TAU);c.stroke();c.globalAlpha=1;disc(c,px,py,m*.5,'#ffffff');disc(c,px,py,m*.28,'#e0703f');
  // What the camera is looking at.
  const vx=clamp((-st.ox+L.left)/L.cell,0,L.cols),vy=clamp((-st.oy+L.top)/L.cell,0,L.rows),vw=clamp((-st.ox+L.w-L.right)/L.cell,0,L.cols)-vx,vh=clamp((-st.oy+L.h-L.bottom)/L.cell,0,L.rows)-vy;
  c.strokeStyle='#ffffff8c';c.lineWidth=1.2;c.strokeRect(x+pad+vx*m,y+pad+vy*m,vw*m,vh*m);
}
function ambient(view,st,T,L,dt,calm){
  // A few drifting leaves, petals, or dust motes. Purely decorative.
  if(calm||!T.ambient||dt<=0)return;st.ambient-=dt;if(st.ambient>0)return;st.ambient=.5+Math.random()*.6;
  const j=view.juice,x=-st.ox+Math.random()*L.w,y=-st.oy+L.top+Math.random()*L.bandH*.5;
  if(T.ambient==='dust')j.emit({x:-st.ox-10,y:-st.oy+L.top+Math.random()*L.bandH,vx:70+Math.random()*50,vy:-6+Math.random()*12,drag:.1,life:3.4,size:1.6+Math.random()*1.6,color:'#fff3d688',shape:'dot'});
  else j.emit({x,y,vx:14+Math.random()*18,vy:16+Math.random()*14,gravity:5,drag:.3,life:3.2,size:4+Math.random()*2.5,spin:(Math.random()-.5)*4,rot:Math.random()*TAU,sway:22,phase:Math.random()*TAU,color:T.ambient==='petal'?(Math.random()<.5?'#8f9bffcc':'#ffffffcc'):(Math.random()<.5?'#8fb866cc':'#d9a857cc'),shape:'leaf'});
}
