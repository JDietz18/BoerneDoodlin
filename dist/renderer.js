import {CHARACTER_ART,ABILITIES} from './characters.js?v=20';
import {WORLD} from './adventure-engine.js?v=20';
import {Juice,hash01,ease} from './fx.js?v=20';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;
const COLORS=[
  {sky:'#a9ded8',soil:'#c7a777',edge:'#77a251',dark:'#315d3a',glow:'#ffdc78',image:0},
  {sky:'#abc9ab',soil:'#a98462',edge:'#698844',dark:'#2b4c36',glow:'#ffdf8f',image:0},
  {sky:'#9ddbdc',soil:'#d59869',edge:'#d5ae6e',dark:'#a4573e',glow:'#ffd476',image:2},
  {sky:'#1c344a',soil:'#796675',edge:'#9c8490',dark:'#3c4358',glow:'#c6deff',image:1},
  {sky:'#bddfd6',soil:'#d3af7c',edge:'#91ad57',dark:'#526f37',glow:'#ffdf75',image:3}
];
const imageLoad=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
function cleanImage(im){
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
  const data=x.getImageData(0,0,c.width,c.height),d=data.data;
  if(d[0]>220&&d[1]<45&&d[2]>220&&d[3]>240){
    for(let p=0;p<d.length;p+=4){const spill=Math.max(0,Math.min(d[p],d[p+2])-d[p+1]);if(spill<25)continue;const a=spill>180?0:1-spill/220;d[p+3]*=a;if(a){d[p]=clamp((d[p]-spill)/a,0,255);d[p+1]=clamp(d[p+1]/a,0,255);d[p+2]=clamp((d[p+2]-spill)/a,0,255);}}
    x.putImageData(data,0,0);
  }
  return c;
}
function frames(im,columns=2,rows=2,regions){
  const ctx=im.getContext('2d',{willReadFrequently:true}),d=ctx.getImageData(0,0,im.width,im.height).data;
  return Array.from({length:columns*rows},(_,i)=>{
    const r=regions?.[i]||[(i%columns)/columns,Math.floor(i/columns)/rows,(i%columns+1)/columns,(Math.floor(i/columns)+1)/rows];
    const x0=Math.floor(r[0]*im.width),y0=Math.floor(r[1]*im.height),x1=Math.floor(r[2]*im.width),y1=Math.floor(r[3]*im.height);
    let left=x1,right=x0,top=y1,bottom=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*im.width+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return {x:left,y:top,w:Math.max(1,right-left+1),h:Math.max(1,bottom-top+1)};
  });
}
function rounded(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function star(c,x,y,r,color,rotation=0){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5+rotation,rr=i%2?r*.48:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fillStyle=color;c.fill();}
function bone(c,x,y,w=30,color='#fff6d8'){
  c.save();c.translate(x,y);c.rotate(-.48);c.fillStyle=color;c.strokeStyle='#a3773a';c.lineWidth=1.8;
  c.beginPath();c.moveTo(-w*.32,-w*.12);c.lineTo(w*.32,-w*.12);c.bezierCurveTo(w*.55,-w*.4,w*.7,-w*.06,w*.45,0);c.bezierCurveTo(w*.7,w*.23,w*.43,w*.42,w*.29,w*.13);c.lineTo(-w*.29,w*.13);c.bezierCurveTo(-w*.43,w*.42,-w*.7,w*.23,-w*.45,0);c.bezierCurveTo(-w*.7,-w*.06,-w*.55,-w*.4,-w*.32,-w*.12);c.fill();c.stroke();c.restore();
}

// ---------------------------------------------------------------------
// Snack Storm and camp scene look. Gradients, glows, and painted pieces
// are drawn once into small offscreen sprites, then blitted every frame.
// ---------------------------------------------------------------------
const STORM_W=1120,HEAD=82,BLEED=24,HOME_BLEED=16;
// One backdrop per world: which painting, where to frame it, and where the pet stands in it.
const STORM_LOOK=[
  {image:0,focus:.1,stand:.72,sky:['#7cc7e6','#f5e7be'],tuft:'#5f9146',lane:'#fff2b9'},
  {image:0,focus:.6,stand:.7,sky:['#8fbfa5','#e9e2b5'],tuft:'#3f7044',lane:'#f1e6b0'},
  {image:2,focus:.08,stand:.76,sky:['#8fd6e4','#ffe0b0'],tuft:'#c58a4c',lane:'#ffe6b8'},
  {image:1,focus:.02,stand:.74,sky:['#0c1b3c','#3b3a6b'],tuft:'#55628a',lane:'#c6d6ff',night:true},
  {image:3,focus:.12,stand:.8,sky:['#86cdea','#f8ecc4'],tuft:'#6f9a45',lane:'#fff2b9'}
];
const TWIST_TIP=['Tennis balls bounce once!','The breeze sways the treats','Hold tight for canyon gusts','Catch the golden comets','Bluebonnets burst into treats'];
const SECTION_BANNER=['','STORM RISING!','DOWNPOUR!'];
const fmt=n=>String(Number((Number(n)||0).toFixed(1)));
// Popups and the chain meter share one colour ramp, so a glance says how big the stack is.
const multColor=total=>total>=30?'#fffbe0':total>=20?'#ff9fc4':total>=10?'#ffb347':total>=5?'#ffe066':total>=4?'#cdbcff':total>=3?'#9be8f4':total>=2?'#bff3c6':'#fff4d7';
const multStroke=total=>total>=30?'#b02a78f0':total>=20?'#6b1f47e6':total>=10?'#6b3a10e6':'#133b3dd9';
function sprite(w,h,dpr,paint){
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.ceil(w*dpr));cv.height=Math.max(1,Math.ceil(h*dpr));
  const c=cv.getContext('2d');c.scale(dpr,dpr);paint(c,w,h);return {cv,w,h};
}
// Centred blit with optional uniform scale and alpha. No save/restore.
function put(c,s,x,y,scale=1,alpha=1){
  if(!s||alpha<=.004)return;const w=s.w*scale,h=s.h*scale;
  if(alpha<1){const before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(s.cv,x-w/2,y-h/2,w,h);c.globalAlpha=before;}
  else c.drawImage(s.cv,x-w/2,y-h/2,w,h);
}
// Centred blit with rotation and squash.
function spin(c,s,x,y,rotation=0,scaleX=1,scaleY=scaleX,alpha=1){
  if(!s||alpha<=.004)return;c.save();c.translate(x,y);if(rotation)c.rotate(rotation);c.scale(scaleX,scaleY);if(alpha<1)c.globalAlpha*=alpha;
  c.drawImage(s.cv,-s.w/2,-s.h/2,s.w,s.h);c.restore();
}
const glowSprite=(dpr,color,core='cc')=>sprite(64,64,dpr,c=>{const g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,color+core);g.addColorStop(.4,color+'55');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,64,64);});
function sparkle(c,x,y,r,color){c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,k=i%2?.28:1;c.lineTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k);}c.closePath();c.fill();}
// A true crescent (clipped, not painted over), so it sits on any sky.
function crescent(c,x,y,r,color){c.save();c.beginPath();c.rect(x-r*2,y-r*2,r*4,r*4);c.arc(x+r*.38,y-r*.2,r*.94,0,TAU);c.clip('evenodd');c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();}
function heartPath(c,r){c.beginPath();c.moveTo(0,r*.52);c.bezierCurveTo(-r*.82,r*.02,-r*.44,-r*.66,0,-r*.22);c.bezierCurveTo(r*.44,-r*.66,r*.82,r*.02,0,r*.52);c.closePath();}
// Mud is the one thing to avoid: a scowling glob with a pale rim so it reads on any backdrop.
function paintMud(c,side,r){
  c.translate(side/2,side/2);
  const lumps=[[0,0,1],[-.6,-.2,.52],[.6,-.24,.48],[-.44,.5,.46],[.46,.48,.5],[0,-.6,.52],[-.04,.66,.4]];
  const body=(grow,fill)=>{c.fillStyle=fill;c.beginPath();for(const [x,y,k] of lumps){c.moveTo(x*r+k*r*.8+grow,y*r);c.arc(x*r,y*r,k*r*.8+grow,0,TAU);}c.fill();};
  body(r*.2,'#fff1d055');body(r*.1,'#2a1a16');body(0,'#5d4030');
  c.fillStyle='#805d45';c.beginPath();c.ellipse(-r*.3,-r*.5,r*.3,r*.14,-.5,0,TAU);c.fill();
  c.fillStyle='#fff8ea';for(const side of [-1,1]){c.beginPath();c.ellipse(side*r*.3,-r*.02,r*.19,r*.22,0,0,TAU);c.fill();}
  c.fillStyle='#231512';for(const side of [-1,1]){c.beginPath();c.arc(side*r*.25,r*.04,r*.09,0,TAU);c.fill();}
  c.strokeStyle='#231512';c.lineWidth=r*.13;c.lineCap='round';c.beginPath();c.moveTo(-r*.56,-r*.42);c.lineTo(-r*.12,-r*.22);c.moveTo(r*.56,-r*.42);c.lineTo(r*.12,-r*.22);c.stroke();
  c.lineWidth=r*.1;c.beginPath();c.arc(0,r*.56,r*.2,Math.PI*1.15,Math.PI*1.85);c.stroke();
}
// Power-ups are round badges with a white rim: shield, magnet, heart.
function paintBadge(c,side,r,kind){
  c.translate(side/2,side/2);const fill={shield:'#3f9df0',magnet:'#22ad9e',heart:'#ff6688'}[kind]||'#ffc94f';
  c.fillStyle='#12383bcc';c.beginPath();c.arc(0,0,r*1.08,0,TAU);c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
  c.fillStyle=fill;c.beginPath();c.arc(0,0,r*.82,0,TAU);c.fill();
  c.fillStyle='#ffffff40';c.beginPath();c.ellipse(-r*.2,-r*.42,r*.44,r*.22,-.45,0,TAU);c.fill();
  c.fillStyle='#ffffff';c.strokeStyle='#ffffff';c.lineJoin='round';
  if(kind==='shield'){
    c.beginPath();c.moveTo(0,-r*.5);c.lineTo(r*.42,-r*.32);c.lineTo(r*.42,r*.04);c.quadraticCurveTo(r*.4,r*.4,0,r*.56);c.quadraticCurveTo(-r*.4,r*.4,-r*.42,r*.04);c.lineTo(-r*.42,-r*.32);c.closePath();c.fill();
    c.fillStyle=fill;c.beginPath();c.moveTo(0,-r*.28);c.lineTo(r*.22,-r*.18);c.lineTo(r*.22,r*.04);c.quadraticCurveTo(r*.2,r*.24,0,r*.32);c.closePath();c.fill();
  }else if(kind==='magnet'){
    c.lineWidth=r*.3;c.lineCap='butt';c.beginPath();c.moveTo(-r*.33,r*.46);c.lineTo(-r*.33,-r*.04);c.arc(0,-r*.04,r*.33,Math.PI,0);c.lineTo(r*.33,r*.46);c.stroke();
    c.fillStyle='#ff5a4a';c.fillRect(-r*.48,r*.26,r*.3,r*.2);c.fillRect(r*.18,r*.26,r*.3,r*.2);
  }else if(kind==='heart'){heartPath(c,r*.92);c.fill();}
  else{c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?.26:.56;c.lineTo(Math.cos(a)*r*k,Math.sin(a)*r*k);}c.closePath();c.fill();}
}
// A bluebonnet spike: blue florets, white tip. With a stem it stands in the grass.
function paintBluebonnet(c,w,h,stem){
  const cx=w/2,top=stem?.04:.08,span=stem?.52:.84;
  if(stem){
    c.strokeStyle='#4f8a3c';c.lineWidth=Math.max(1.5,w*.1);c.lineCap='round';c.beginPath();c.moveTo(cx,h);c.quadraticCurveTo(cx+w*.08,h*.78,cx,h*.5);c.stroke();
    c.fillStyle='#5f9e48';c.beginPath();c.ellipse(cx-w*.24,h*.84,w*.26,w*.1,.6,0,TAU);c.fill();c.beginPath();c.ellipse(cx+w*.24,h*.78,w*.26,w*.1,-.6,0,TAU);c.fill();
  }
  for(let row=0;row<5;row++){
    const y=h*(top+span*(1-row/5)-span*.08),half=w*(.34-.06*row),count=row<2?3:row<4?2:1;
    for(let i=0;i<count;i++){
      const x=cx+(count===1?0:(i/(count-1)-.5)*2*half);
      c.fillStyle=(row+i)%2?'#5a7cf0':'#3d5bd0';c.beginPath();c.ellipse(x,y,w*.2,w*.16,0,0,TAU);c.fill();
      c.fillStyle=row>2?'#f4f6ff':'#b9c8ff';c.beginPath();c.arc(x,y-w*.03,w*.06,0,TAU);c.fill();
    }
  }
  c.fillStyle='#f4f6ff';c.beginPath();c.ellipse(cx,h*(top+.02),w*.12,w*.13,0,0,TAU);c.fill();
}
function paintCloud(c,w,h,night){
  const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,night?'#5a6a9cf0':'#fffffff2');g.addColorStop(1,night?'#2a3462d0':'#c4dce8d8');c.fillStyle=g;
  c.beginPath();c.roundRect(w*.1,h*.5,w*.8,h*.36,h*.18);
  for(const [x,y,r] of [[.2,.6,.2],[.36,.42,.28],[.58,.36,.33],[.8,.58,.22]]){c.moveTo(x*w+r*h,y*h);c.arc(x*w,y*h,r*h,0,TAU);}
  c.fill();
}
function paintRays(c,color){
  c.translate(128,128);const g=c.createRadialGradient(0,0,8,0,0,128);g.addColorStop(0,color+'b0');g.addColorStop(.55,color+'48');g.addColorStop(1,color+'00');c.fillStyle=g;
  for(let i=0;i<12;i++){const a=i*TAU/12;c.beginPath();c.moveTo(0,0);c.arc(0,0,128,a,a+TAU/24);c.closePath();c.fill();}
}
function paintTrunk(c,x,width,top,bottom,seed,far=false){
  const g=c.createLinearGradient(x-width/2,0,x+width/2,0);
  if(far){g.addColorStop(0,'#2c4638b0');g.addColorStop(.4,'#47604fb0');g.addColorStop(1,'#263d31b0');}
  else{g.addColorStop(0,'#2b1d18f4');g.addColorStop(.35,'#5b3a2af4');g.addColorStop(.7,'#4a2f23f4');g.addColorStop(1,'#241813f4');}
  c.fillStyle=g;c.beginPath();c.moveTo(x-width*.42,top);c.lineTo(x+width*.42,top);c.lineTo(x+width*.62,bottom);c.lineTo(x-width*.62,bottom);c.closePath();c.fill();
  c.strokeStyle='#1c120e66';c.lineWidth=Math.max(1,width*.04);
  for(let i=0;i<5;i++){const xx=x+(hash01(seed,i)-.5)*width*.8;c.beginPath();c.moveTo(xx,top);c.lineTo(xx+(hash01(seed,i+9)-.5)*width*.3,bottom);c.stroke();}
}

export class Renderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.sprites={};this.particles=[];this.labels=[];this.shake=0;this.time=0;this.assetsReady=false;this.reducedMotion=false;
    // Shared game-feel state for whichever activity is on screen, and the
    // screen edges currently covered by the HUD and touch controls (CSS px).
    this.juice=new Juice();this.insets={top:0,right:0,bottom:0,left:0};this.props=null;
    // Touch-first devices get no control wording in anything drawn on the canvas. The controller may set this.
    this.touchFirst=Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches)||(globalThis.navigator?.maxTouchPoints||0)>0;this._mouth={x:0,y:0};
    this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.dpr=dpr;}
  async load(){
    await Promise.all(Object.entries(CHARACTER_ART).map(async([id,art])=>{const im=cleanImage(await imageLoad(art.src+'?v=20'));const regions=art.regions||(id==='mittens'?[[0,0,.53,.445],[.53,0,1,.445],[0,.445,.52,1],[.52,.445,1,1]]:undefined);const f=frames(im,2,2,regions);this.sprites[id]={image:im,frames:f,runWidth:Math.max(...f.slice(0,3).map(a=>a.w))};}));
    const decorative=await Promise.allSettled([imageLoad('/assets/route-biomes.jpg'),imageLoad('/assets/family-rv.png'),imageLoad('/assets/griffin-atlas.png')]);
    if(decorative[0].status==='fulfilled')this.biomes=decorative[0].value;
    if(decorative[1].status==='fulfilled'){this.rv=cleanImage(decorative[1].value);this.rvFrame=frames(this.rv,1,1)[0];}
    // Painted props only. Cells 0-3 of this sheet hold retired dog art and are never read.
    if(decorative[2].status==='fulfilled'){const sheet=cleanImage(decorative[2].value),cells=frames(sheet,3,3);this.props={image:sheet,log:cells[4],can:cells[5],biscuit:cells[6],chicken:cells[7],ball:cells[8]};}
    this.assetsReady=true;
  }
  // Draws a painted prop centred on x,y at the given width. Returns false when the sheet is unavailable.
  prop(c,name,x,y,width,{rotate=0,alpha=1}={}){
    const f=this.props?.[name];if(!f||name==='image')return false;const scale=width/f.w;
    c.save();c.globalAlpha*=alpha;c.translate(x,y);if(rotate)c.rotate(rotate);c.drawImage(this.props.image,f.x,f.y,f.w,f.h,-width/2,-f.h*scale/2,width,f.h*scale);c.restore();return true;
  }
  character(c,id,pose,x,y,width,{alpha=1,rotate=0,squash=1,portrait=false}={}){
    const a=this.sprites[id];if(!a)return;const f=a.frames[pose%4],scale=width/(portrait?f.w:a.runWidth);
    c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(rotate);c.scale(1,squash);
    c.drawImage(a.image,f.x,f.y,f.w,f.h,-f.w*scale/2,-f.h*scale,f.w*scale,f.h*scale);c.restore();
  }
  portrait(canvas,id){
    if(!this.assetsReady)return;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);const a=this.sprites[id],f=a.frames[3];
    const scale=Math.min((canvas.width-12)/f.w,(canvas.height-10)/f.h);c.drawImage(a.image,f.x,f.y,f.w,f.h,(canvas.width-f.w*scale)/2,canvas.height-f.h*scale-3,f.w*scale,f.h*scale);
  }
  begin(){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);return c;}
  scene(c,theme,distance=0,home=false){
    const p=COLORS[theme%5],w=this.width,h=this.height,ground=home?h*.82:this.ground;
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,p.sky);sky.addColorStop(1,theme===3?'#736384':'#f5e7be');c.fillStyle=sky;c.fillRect(0,0,w,h);
    if(this.biomes){
      const index=p.image,sw=this.biomes.width/2,sh=this.biomes.height/2,tileH=Math.max(h,ground/.8),tileW=tileH*1.28,shift=home?0:(distance*.055)% (tileW*2);
      const top=ground-tileH*.79;
      c.save();c.globalAlpha=theme===3?.57:.92;
      for(let n=-1;n<Math.ceil(w/tileW)+3;n++){
        const x=n*tileW-shift;c.save();c.translate(x,top);if(n%2!==0){c.translate(tileW,0);c.scale(-1,1);}c.drawImage(this.biomes,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,0,0,tileW,tileH);c.restore();
      }c.restore();
    }
    if(theme===1){c.fillStyle='#28433033';c.fillRect(0,0,w,h);for(let i=0;i<7;i++){const x=((i*317-distance*.18)%(w+400)+w+400)%(w+400)-200;this.tree(c,x,ground,w*.009+10,ground*.9,i);}}
    if(theme===3){c.fillStyle='#13254488';c.fillRect(0,0,w,h);for(let i=0;i<50;i++){const x=(i*173.51+41)%w,y=(i*47.71+17)%(Math.max(50,ground*.54));c.globalAlpha=.35+(Math.sin(this.time*.6+i)*.25+.25);c.fillStyle='#fff4ca';c.beginPath();c.arc(x,y,i%6?1:1.8,0,TAU);c.fill();}c.globalAlpha=1;crescent(c,w*.83,ground*.19,24,'#f8e9b8');}
    if(!home){
      const top=c.createLinearGradient(0,0,0,Math.min(200,h*.4));top.addColorStop(0,'#09272edc');top.addColorStop(1,'#09272e00');c.fillStyle=top;c.fillRect(0,0,w,h*.55);
      c.fillStyle=p.soil;c.fillRect(0,ground,w,h-ground);c.fillStyle=p.edge;c.fillRect(0,ground-5,w,10);c.fillStyle='#fff2b94d';c.fillRect(0,ground+9,w,3);
      for(let i=-1;i<w/74+1;i++){const x=i*74-(distance*.65)%74,y=ground+29+(i%3)*14;c.fillStyle=i%2?'#644d3324':'#fff1c937';rounded(c,x,y,13+(i%3)*7,3,2,c.fillStyle);}
      for(let i=0;i<w/108+2;i++){const x=i*108-(distance*.8)%108;c.fillStyle=p.edge;c.beginPath();c.moveTo(x,ground);c.lineTo(x-5,ground-12);c.lineTo(x+2,ground-4);c.lineTo(x+5,ground-17);c.lineTo(x+9,ground);c.fill();}
      const shade=c.createLinearGradient(0,ground+30,0,h);shade.addColorStop(0,'#102f3400');shade.addColorStop(1,'#102f3480');c.fillStyle=shade;c.fillRect(0,ground,w,h-ground);
    }
    return p;
  }
  tree(c,x,ground,width,height,i){
    c.fillStyle=i%2?'#36473788':'#463b2eaa';rounded(c,x,ground-height,width,height,4,c.fillStyle);
    c.fillStyle=i%2?'#1b513c55':'#31634677';for(let n=0;n<4;n++){c.beginPath();c.ellipse(x+width/2+(n%2?30:-30),ground-height+n*70,110-n*12,54,0,0,TAU);c.fill();}
  }
  // ----- cached sprites shared by Snack Storm and the camp scene ----------
  _ambient(){
    const dpr=this.dpr;if(this._amb?.dpr===dpr)return this._amb;
    const a={dpr},soft=dpr>1?1.5:1;
    a.glowGold=glowSprite(dpr,'#ffd24a');a.glowWarm=glowSprite(dpr,'#ff9a3d');a.glowCool=glowSprite(dpr,'#8fd4ff');a.glowWhite=glowSprite(dpr,'#fff6d6');a.glowBlue=glowSprite(dpr,'#7f97ff');a.shadow=glowSprite(dpr,'#06201f','b0');
    a.cloud=sprite(170,74,dpr,(c,w,h)=>paintCloud(c,w,h,false));a.cloudNight=sprite(170,74,dpr,(c,w,h)=>paintCloud(c,w,h,true));
    a.rays=sprite(256,256,soft,c=>paintRays(c,'#fff3c4'));a.raysHot=sprite(256,256,soft,c=>paintRays(c,'#ff9fd0'));
    const band=(x0,y0,x1,y1)=>sprite(x0||x1?64:4,y0||y1?64:4,1,(c,w,h)=>{const g=c.createLinearGradient(x0*64,y0*64,x1*64,y1*64);g.addColorStop(0,'#ffa63df0');g.addColorStop(.45,'#ff8a2a55');g.addColorStop(1,'#ff8a2a00');c.fillStyle=g;c.fillRect(0,0,w,h);});
    a.heatLeft=band(0,0,1,0);a.heatRight=band(1,0,0,0);a.heatTop=band(0,0,0,1);a.heatBottom=band(0,1,0,0);
    a.dusk=sprite(4,64,1,c=>{const g=c.createLinearGradient(0,0,0,64);g.addColorStop(0,'#ff6f61c0');g.addColorStop(.5,'#ffb34740');g.addColorStop(1,'#ffb34700');c.fillStyle=g;c.fillRect(0,0,4,64);});
    a.haze=sprite(4,64,1,c=>{const g=c.createLinearGradient(0,0,0,64);g.addColorStop(0,'#ffd24ab8');g.addColorStop(1,'#ffd24a00');c.fillStyle=g;c.fillRect(0,0,4,64);});
    a.streak=sprite(6,54,dpr,c=>{const g=c.createLinearGradient(0,0,0,54);g.addColorStop(0,'#ffe58a00');g.addColorStop(1,'#fff0b0e6');c.fillStyle=g;c.beginPath();c.roundRect(1.5,0,3,54,1.5);c.fill();});
    a.tail=sprite(30,170,dpr,c=>{const g=c.createLinearGradient(0,0,0,170);g.addColorStop(0,'#ffe58a00');g.addColorStop(.7,'#ffe58a88');g.addColorStop(1,'#fffbe0f0');c.fillStyle=g;c.beginPath();c.moveTo(15,0);c.lineTo(29,158);c.quadraticCurveTo(15,174,1,158);c.closePath();c.fill();});
    const leaf=(fill,rib)=>sprite(18,10,dpr,c=>{c.fillStyle=fill;c.beginPath();c.ellipse(9,5,8.5,4.2,0,0,TAU);c.fill();c.strokeStyle=rib;c.lineWidth=1;c.beginPath();c.moveTo(1.5,5);c.lineTo(16.5,5);c.stroke();});
    a.leafA=leaf('#8fb866','#5f8a44');a.leafB=leaf('#dba24f','#a8742f');
    a.spark=sprite(24,24,dpr,c=>sparkle(c,12,12,11,'#fff6cf'));
    a.flower=sprite(18,44,dpr,(c,w,h)=>paintBluebonnet(c,w,h,true));
    a.tumble=sprite(40,40,dpr,c=>{c.strokeStyle='#8a6a43';c.lineWidth=1.6;for(let i=0;i<9;i++){c.beginPath();c.ellipse(20,20,17-hash01(i,3)*6,10+hash01(i,4)*7,i*.7,0,TAU);c.stroke();}});
    return this._amb=a;
  }
  // Falling things, painted once at the size this screen needs.
  _kit(size){
    const dpr=this.dpr,key=`${size}|${dpr}|${this.props?1:0}`;if(this._kitCache?.key===key)return this._kitCache;
    const k={key,size},P=this.props;
    const painted=(name,width,halo)=>{
      const f=P?.[name];if(!f)return null;const height=width*f.h/f.w,pad=Math.ceil(width*.3);
      return sprite(width+pad*2,height+pad*2,dpr,(c,w,h)=>{
        const g=c.createRadialGradient(w/2,h/2,width*.1,w/2,h/2,w/2);g.addColorStop(0,halo+'90');g.addColorStop(.6,halo+'38');g.addColorStop(1,halo+'00');c.fillStyle=g;c.fillRect(0,0,w,h);
        c.shadowColor='#06201f88';c.shadowBlur=3*dpr;c.drawImage(P.image,f.x,f.y,f.w,f.h,pad,pad,width,height);
      });
    };
    k.biscuit=painted('biscuit',size*1.2,'#fff3cf')||sprite(size*1.5,size*1.5,dpr,(c,w)=>bone(c,w/2,w/2,size*.9,'#fff2c4'));
    k.chicken=painted('chicken',size*1.5,'#ffd24a')||sprite(size*1.6,size*1.6,dpr,(c,w)=>{star(c,w/2,w/2,size*.7,'#ffcd55');star(c,w/2,w/2,size*.4,'#fff0ab');});
    k.ball=painted('ball',size*.88,'#eafff8')||sprite(size*1.2,size*1.2,dpr,(c,w)=>{c.fillStyle='#35c9b5';c.beginPath();c.arc(w/2,w/2,size*.42,0,TAU);c.fill();});
    const side=size*1.8;
    k.mud=sprite(side,side,dpr,c=>paintMud(c,side,size*.5));
    for(const kind of ['shield','magnet','heart'])k[kind]=sprite(side,side,dpr,c=>paintBadge(c,side,size*.56,kind));
    k.bloom=sprite(size*.9,size*1.35,dpr,(c,w,h)=>paintBluebonnet(c,w,h,false));
    return this._kitCache=k;
  }
  // The camp backdrop is the shared scene painted once, a little larger than the screen so it can drift.
  _homeBackdrop(theme){
    const w=this.width,h=this.height,key=`${theme}|${w}|${h}|${this.dpr}|${this.biomes?1:0}`;if(this._hb?.key===key)return this._hb;
    if(this._hb)this._hb.cv.width=this._hb.cv.height=0; // release the old one now; iPhone Safari keeps a tight canvas budget
    const W=w+HOME_BLEED*2,H=h+HOME_BLEED,mobile=w<=736,keepW=this.width,keepH=this.height,keepT=this.time;
    this.width=W;this.height=H;this.time=0;
    const s=sprite(W,H,this.dpr,c=>{
      this.scene(c,theme,0,true);
      if(mobile){const top=165+HOME_BLEED*.5,shade=c.createLinearGradient(0,top,0,Math.min(H,450+HOME_BLEED*.5));shade.addColorStop(0,'#123c3500');shade.addColorStop(.6,'#123c35ed');shade.addColorStop(1,'#123c35');c.fillStyle=shade;c.fillRect(0,top,W,H-top);}
    });
    this.width=keepW;this.height=keepH;this.time=keepT;s.key=key;return this._hb=s;
  }
  // Camp hero scene. Everything is a function of `time`, so reduced motion (time 0) is a still picture.
  drawHome({characterId='griffin',time=0,theme=0,reducedMotion=false}={}){
    time=reducedMotion?0:time;this.time=time;this.reducedMotion=reducedMotion;
    const c=this.begin(),w=this.width,h=this.height,mobile=w<=736,compact=h<430&&!mobile,t=time,still=reducedMotion,amb=this._ambient(),world=((theme%5)+5)%5,night=world===3;
    const bg=this._homeBackdrop(world);c.drawImage(bg.cv,-HOME_BLEED+Math.sin(t*.11)*HOME_BLEED*.6,-HOME_BLEED*.5+Math.cos(t*.09)*HOME_BLEED*.3,bg.w,bg.h);
    // slow clouds by day, more twinkles by night
    if(!night){const cs=mobile?.62:1,span=w+170*cs;for(let i=0;i<3;i++){const cx=((hash01(i,91)*span+t*(4+i*1.8))%span)-85*cs;put(c,amb.cloud,cx,(mobile?30:h*.1)+i*(mobile?24:h*.085),cs*(.8+hash01(i,92)*.5),.78);}}
    for(let i=0;i<(night?10:5);i++){const h1=hash01(i,93),h2=hash01(i,94),glint=still?.6:.2+.8*Math.abs(Math.sin(t*(.8+h1)+i*1.9));put(c,amb.spark,w*(night?h1:.52+h1*.44),12+h2*(mobile?150:h*.5),(mobile?.4:.6)+h2*.4,glint*(night?1:.75));}
    if(world===1&&!still)for(let i=0;i<5;i++){const h1=hash01(i,95),h2=hash01(i,96),fall=mobile?230:h*.8;spin(c,i%2?amb.leafA:amb.leafB,((h1*w+t*12+Math.sin(t*.9+i)*20)%(w+30))-15,(h2*fall+t*(16+h1*14))%fall,t*(.7+h1)+i,1.2,Math.cos(t*1.2+i)*.5+.7,.85);}
    const x=mobile?w*.54:w*.735,y=mobile?255:h*.78;
    if(this.rv){
      // the RV idles: a tiny engine shiver, a slow suspension sway, and soft puffs from the tailpipe
      const rw=mobile?137:compact?170:250,f=this.rvFrame,s=rw/f.w,rh=f.h*s,rx=(mobile?w*.03:w*.48)+Math.sin(t*.11)*2,ry=(mobile?188:y-92)-rh+(still?0:Math.sin(t*15)*.45+Math.sin(t*1.9)*.9);
      if(!still){c.fillStyle='#ffffff';for(let i=0;i<3;i++){const puff=(t*.55+i/3)%1;c.globalAlpha=(1-puff)*.4;c.beginPath();c.arc(rx+rw*.03-puff*rw*.17,ry+rh*.87-puff*rh*.24,rw*(.018+puff*.046),0,TAU);c.fill();}}
      c.globalAlpha=.9;c.drawImage(this.rv,f.x,f.y,f.w,f.h,rx,ry,rw,rh);c.globalAlpha=1;
    }
    const a=this.sprites[characterId],f=a?.frames[3],heroWidth=mobile?151:compact?180:Math.min(285,w*.27),maxHeight=mobile?220:compact?245:h*.66,width=f?Math.min(heroWidth,maxHeight*f.w/f.h):heroWidth;
    // the buddy breathes, and every few seconds gives a happy hop (a double hop now and then)
    let lift=0,squash=1;
    if(!still){
      const cycle=t%5.6,round=Math.floor(t/5.6),hop=cycle<.5?cycle/.5:round%3===2&&cycle<1?(cycle-.5)/.5:-1;
      if(hop>=0){lift=Math.sin(hop*Math.PI)*(mobile?13:20);squash=hop<.14?.94:hop>.86?.93:1.035;}
      else squash=1+Math.sin(t*2.1)*.013+(cycle>5.35?-(cycle-5.35)*.24:0);
    }
    c.fillStyle='#122a2555';c.beginPath();c.ellipse(x,y+1,(mobile?80:130)*(1-lift/110),15*(1-lift/70),0,0,TAU);c.fill();
    this.character(c,characterId,3,x,y-lift,width,{portrait:true,squash});
    // treats bob beside the buddy
    for(let i=0;i<3;i++){
      const name=i===0?'biscuit':i===1?'chicken':'ball',size=i===2?(mobile?22:32):(mobile?31:46);
      const bx=mobile?w*(i===0?.86:i===1?.905:.815):x+width*.6+(i===1?38:0),by=(mobile?64+i*58+(night&&i?50:0):y-width*.75-i*68)+(still?0:Math.sin(t*1.6+i*1.4)*(mobile?5:7));
      put(c,i===1?amb.glowGold:amb.glowWhite,bx,by,size/21,.6);
      if(!this.prop(c,name,bx,by,size,{rotate:(i===0?-.5:0)+(still?0:Math.sin(t*.9+i*2)*.28)}))bone(c,bx,by,size*.8,'#ffdc80');
    }
  }
  worldPosition(x,y){return {x:x*this.scale,y:this.ground-y*this.scale};}
  updateEffects(dt){
    this.shake=Math.max(0,this.shake-dt);for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=240*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
    for(const t of this.labels){t.y+=30*dt;t.life-=dt;}this.labels=this.labels.filter(p=>p.life>0);
  }
  drawRun(run,{time=0,dt=0,reducedMotion=false}={}){
    this.time=reducedMotion?0:time;this.reducedMotion=reducedMotion;this.updateEffects(dt);const c=this.begin(),w=this.width,h=this.height;
    const viewWidth=w<700?780:Math.max(1000,Math.min(1280,w/h*630));this.scale=w/viewWidth;this.ground=h-clamp(h*.2,78,130);const s=this.scale;
    let theme=run.runMode==='endless'?Math.min(4,Math.floor(run.distance/6500)):run.stage;
    const palette=this.scene(c,theme,run.distance);
    c.save();if(this.shake&&!reducedMotion)c.translate(Math.sin(time*94)*this.shake*18,Math.cos(time*113)*this.shake*10);
    c.translate(0,this.ground);c.scale(s,s);
    if(run.powerTime>0&&!reducedMotion){for(let i=0;i<11;i++){const x=(time*770+i*137)%viewWidth,y=-45-(i%5)*48;c.strokeStyle=i%2?'#fff1a877':'#ffffff55';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x-30-i*3,y);c.stroke();}}
    for(const e of run.entities){if(e.x<-100||e.x>viewWidth+120||e.taken)continue;this.entity(c,e,reducedMotion?0:time,palette,run);}
    if(Number.isFinite(run.goal)&&run.goal-run.distance<viewWidth+300){const x=WORLD.playerX+run.goal-run.distance;if(this.rv){const f=this.rvFrame,rw=260,rh=f.h/f.w*rw;c.drawImage(this.rv,f.x,f.y,f.w,f.h,x+25,-rh-4,rw,rh);}c.strokeStyle='#fff4cf';c.lineWidth=6;c.beginPath();c.moveTo(x,-160);c.lineTo(x,0);c.stroke();for(let i=0;i<4;i++)for(let j=0;j<3;j++){c.fillStyle=(i+j)%2?'#fff8e5':'#183e3f';c.fillRect(x+i*16,-160+j*16,16,16);}c.font='bold 14px system-ui';c.fillStyle='#123b38';c.fillText('SNACK STOP',x+10,-178);}
    const p=run.player,x=p.x,y=-p.y;
    c.fillStyle='#1d352943';c.beginPath();c.ellipse(x,5,Math.max(20,64-p.y*.08),Math.max(5,13-p.y*.025),0,0,TAU);c.fill();
    const art=CHARACTER_ART[run.characterId],pose=p.grounded?(Math.floor(time*art.cadence)%2):2,bob=p.grounded&&!p.sliding&&!reducedMotion?Math.sin(time*art.cadence*TAU)*2:0;
    if(run.powerTime>0){c.save();c.shadowColor=palette.glow;c.shadowBlur=30;c.fillStyle='#ffdf9a23';c.beginPath();c.ellipse(x,y-45,100,65,0,0,TAU);c.fill();c.restore();if(!reducedMotion)this.character(c,run.characterId,pose,x-34,y+bob,art.runnerWidth,{alpha:.23,squash:p.sliding?.5:1});}
    const alpha=run.invincible>0&&run.powerTime<=0&&Math.floor(time*9)%2?.52:1;
    this.character(c,run.characterId,pose,x,y+bob,art.runnerWidth,{alpha,squash:p.sliding?.45:1,rotate:p.drop?.11:0});
    if(run.shieldCharges>0){c.strokeStyle='#b6ecffb0';c.lineWidth=3;c.beginPath();c.ellipse(x,y-44,83,62,0,0,TAU);c.stroke();}
    for(const p of this.particles){c.globalAlpha=Math.min(1,p.life/.25);c.fillStyle=p.color;c.beginPath();c.arc(p.x,-p.y,p.r,0,TAU);c.fill();}c.globalAlpha=1;
    c.textAlign='center';c.font='900 17px system-ui';for(const l of this.labels){c.globalAlpha=Math.min(1,l.life*2);c.lineWidth=4;c.strokeStyle='#193c3d';c.strokeText(l.text,l.x,-l.y);c.fillStyle=l.color;c.fillText(l.text,l.x,-l.y);}c.globalAlpha=1;c.textAlign='left';c.restore();
    if(run.feverTime>0){c.save();const glow=c.createRadialGradient(w/2,h/2,h*.4,w/2,h/2,w*.7);glow.addColorStop(0,'#ffdc8500');glow.addColorStop(1,'#ffdc8540');c.fillStyle=glow;c.fillRect(0,0,w,h);c.restore();}
  }
  // ----- Snack Storm ---------------------------------------------------
  // Screen layout for this frame. The pet stands above the bottom inset (touch
  // controls) and the fall fills the space under the top inset (HUD). The lane
  // the pet can reach (world x 80..1040) is fitted between small side pads so
  // the pet never hangs off the edge; stormWorldX() is the matching inverse.
  _stormLayout(run,insets){
    const w=this.width,h=this.height,ins=insets||this.insets||{},short=h<480,L=this._L||(this._L={});
    let top=Math.max(0,Number(ins.top)||0),bottom=Math.max(0,Number(ins.bottom)||0);
    if(!top&&!bottom){top=short?58:92;bottom=short?84:0;} // no insets reported: assume the usual HUD and landscape controls
    top=Math.min(top,h*.35);bottom=Math.min(bottom,h*.45);
    L.w=w;L.h=h;L.short=short;
    L.ground=Math.round(h-Math.max(bottom+(short?26:36),clamp(h*.15,65,110)));
    L.skyTop=top+(short?2:6);L.playH=Math.max(60,L.ground-L.skyTop);L.sy=Math.max(.85,L.playH/455);
    const front=this.sprites[run.characterId]?.frames[3],aspect=front?front.w/front.h:.8,widest=Math.max(58,154*w/STORM_W*1.35);
    let petH=HEAD*L.sy*1.1*clamp(w/700,1,1.4)/Math.sqrt(Math.max(1,aspect));if(petH*aspect>widest)petH=widest/aspect; // broad buddies (Spike, Kevin) sit a little lower so every pet fills a similar space
    L.petH=petH;L.petW=petH*aspect;L.size=Math.round(clamp(Math.min(w*.074,petH*.44),26,44));
    const pad=Math.max(80*w/STORM_W,Math.min(w*.095,L.petW*.5+4)),side=value=>Math.max(pad,Math.min(w*.2,(Number(value)||0)+L.petW*.5)),padLeft=side(ins.left),padRight=side(ins.right);
    L.sx=(w-padLeft-padRight)/960;L.x0=padLeft-80*L.sx;L.runW=Math.max(L.petW,pad*2.3);
    return L;
  }
  // World x under a CSS-pixel x measured from the canvas's left edge. Use it for pointer input so the pet sits under the finger.
  stormWorldX(canvasX){
    const L=this._L;return L?.sx?(Number(canvasX)-L.x0)/L.sx:Number(canvasX)/this.width*STORM_W;
  }
  _stormState(run){
    let s=this._sv;
    if(!s||s.runId!==run.runId)s=this._sv={runId:run.runId,clock:0,storm:0,dust:0,vx:0,lastX:run.player.x,face:1,moving:false,squash:1,squashV:0,hop:0,hopV:0,recoil:0,pip:0,bump:0,lost:0,heat:0,gold:0,zoom:0,push:0,rays:0,windX:0,bloomKick:0,banner:null,bannerNext:null,sub:null,decals:[],tumble:null,stackAt:[-9,-9,-9,-9],lostAt:-9,maxed:false};
    return s;
  }
  _stormBackdrop(L,world){
    const key=`${world}|${L.w}|${L.h}|${L.ground}|${this.dpr}|${this.biomes?1:0}`;if(this._bd?.key===key)return this._bd;
    if(this._bd)this._bd.cv.width=this._bd.cv.height=0;
    const W=L.w+BLEED*2,H=L.h+BLEED*2,ground=L.ground+BLEED,look=STORM_LOOK[world];
    const s=sprite(W,H,this.dpr,c=>{
      const sky=c.createLinearGradient(0,0,0,ground);sky.addColorStop(0,look.sky[0]);sky.addColorStop(1,look.sky[1]);c.fillStyle=sky;c.fillRect(0,0,W,H);
      if(this.biomes){
        // One painting, framed so the pet stands on its path and the art runs on under the touch controls.
        const k=look.stand,sw=this.biomes.width/2,sh=this.biomes.height/2,tileH=Math.max(ground/k,(H-ground)/(1-k),W/1.5),tileW=Math.max(W,tileH*1.28);
        c.drawImage(this.biomes,(look.image%2)*sw+1,Math.floor(look.image/2)*sh+1,sw-2,sh-2,-(tileW-W)*look.focus,ground-tileH*k,tileW,tileH);
      }else{c.fillStyle='#c7a777';c.fillRect(0,ground,W,H-ground);}
      if(world===1){
        // Redwood Run: cool shade, great trunks, and slanting light.
        c.fillStyle='#17352470';c.fillRect(0,0,W,H);
        // distant trunks sit back in the haze; two giants frame the lane from just off the edges
        const far=Math.max(2,Math.round(W/300));
        for(let i=0;i<far;i++){const x=(i+.5+(hash01(i,41)-.5)*.5)*W/far;paintTrunk(c,x,clamp(W*.04,16,40)*(.8+hash01(i,42)*.5),0,ground-6-hash01(i,43)*18,i+3,true);}
        const giant=clamp(W*.16,60,150);paintTrunk(c,BLEED-giant*.12,giant,0,H,11);paintTrunk(c,W-BLEED+giant*.16,giant*.9,0,H,12);
        c.fillStyle='#fff6c814';for(let i=0;i<3;i++){const x=W*(.12+i*.34);c.beginPath();c.moveTo(x,0);c.lineTo(x+W*.1,0);c.lineTo(x+W*.1-ground*.32,ground);c.lineTo(x-W*.05-ground*.32,ground);c.closePath();c.fill();}
      }
      if(look.night){
        // Starlight Mesa: the same desert after dark.
        c.globalCompositeOperation='multiply';c.fillStyle='#4c5ca8';c.fillRect(0,0,W,H);c.globalCompositeOperation='source-over';
        const dark=c.createLinearGradient(0,0,0,H);dark.addColorStop(0,'#060d2ad8');dark.addColorStop(.55,'#141d4a55');dark.addColorStop(1,'#0a123070');c.fillStyle=dark;c.fillRect(0,0,W,H);
        c.fillStyle='#fff4d0';for(let i=0;i<80;i++){c.globalAlpha=.35+hash01(i,8)*.6;c.beginPath();c.arc(hash01(i,5)*W,hash01(i,6)*ground*.6,hash01(i,7)<.16?1.7:1,0,TAU);c.fill();}c.globalAlpha=1;
        const mx=W*.8,my=BLEED+Math.max(ground*.26,L.skyTop+46),moon=c.createRadialGradient(mx,my,6,mx,my,70);moon.addColorStop(0,'#fff6d055');moon.addColorStop(1,'#fff6d000');c.fillStyle=moon;c.fillRect(mx-70,my-70,140,140);
        crescent(c,mx,my,20,'#f8eec4');
      }
      // the lane the pet runs along, a few tufts, and a soft shade below for the meter and touch controls
      c.globalAlpha=.34;c.fillStyle=look.lane;c.fillRect(0,ground+1,W,2);c.globalAlpha=.9;c.fillStyle=look.tuft;
      for(let i=0;i<W/66+1;i++){const x=i*66+hash01(i,11)*34,up=7+hash01(i,12)*7;c.beginPath();c.moveTo(x-6,ground+3);c.lineTo(x-4,ground-up*.7);c.lineTo(x-1,ground+1);c.lineTo(x+1,ground-up);c.lineTo(x+4,ground+1);c.lineTo(x+7,ground-up*.6);c.lineTo(x+8,ground+3);c.closePath();c.fill();}
      c.globalAlpha=1;
      const shade=c.createLinearGradient(0,ground,0,H);shade.addColorStop(0,'#0e2a2c00');shade.addColorStop(.22,'#0e2a2c50');shade.addColorStop(1,'#0e2a2cb0');c.fillStyle=shade;c.fillRect(0,ground,W,H-ground);
      const lid=BLEED+Math.min(190,L.h*.36),top=c.createLinearGradient(0,0,0,lid);top.addColorStop(0,'#09272ed8');top.addColorStop(1,'#09272e00');c.fillStyle=top;c.fillRect(0,0,W,lid);
    });
    s.key=key;return this._bd=s;
  }
  _decal(sv,x,kind,life){sv.decals.push({x,kind,life});if(sv.decals.length>10)sv.decals.shift();}
  // Three text channels keep a busy stack readable: one headline, one line under it for
  // whichever layer just changed, and number popups that stay with the pet.
  _headline(sv,text,color,size=32,life=1.5,stroke='#0f3537'){
    const item={text,color,size,life,max:life,stroke};
    if(sv.banner&&sv.banner.max-sv.banner.life<.55){sv.banner.life=Math.min(sv.banner.life,.5);sv.bannerNext=item;}else{sv.banner=item;sv.bannerNext=null;}
  }
  _subhead(sv,text,color,life=1.3){sv.sub={text,color,life,max:life};}
  // A popup that never hangs off the side of the screen.
  _say(text,x,y,options){const half=text.length*(options.size||15)*.36+6;return this.juice.popup(text,clamp(x,half,this._L.w-half),y,options);}
  // Engine events for whichever catching or running view is live. Snack Storm gets
  // the shared effects layer; the legacy trail runner keeps its simple sparks.
  addEvent(event,run){
    if(run?.runMode==='snack')return this._stormEvent(event,run);
    const x=event.x??WORLD.playerX,y=event.y??55;
    if(['collect','gold','letter','jump','double-jump','power','spring','hit','near-miss','smash','shield'].includes(event.type)){
      const color=event.type==='hit'?'#ff8b75':event.type==='double-jump'?'#b7f1ef':event.type==='power'?'#ffe694':'#fff1bb';
      const count=event.type==='power'?32:event.type==='hit'?17:event.type==='collect'?5:12;
      if(!this.reducedMotion)for(let i=0;i<count;i++){const a=(i/count)*TAU,v=40+Math.random()*120;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v+50,life:.4+Math.random()*.3,max:.7,r:2+Math.random()*4,color});}
    }
    if(event.type==='near-miss')this.labels.push({x,y:110,text:'SO CLOSE! +35',color:'#fff3a5',life:1.1});
    if(event.type==='collect'&&event.kind==='gold')this.labels.push({x,y:y+45,text:'GOLDEN!',color:'#ffe489',life:.9});
    if(event.type==='hit'&&!this.reducedMotion)this.shake=.22;
    if(this.particles.length>160)this.particles.splice(0,this.particles.length-160);
  }
  // Every Snack Storm event answers back here: popups, particles, squash, shake, and time tricks.
  // Under reduced motion only still popups and steady state changes remain.
  _stormEvent(e,run){
    const sv=this._stormState(run),L=this._L,j=this.juice,rm=this.reducedMotion;
    if(e.type==='start'||!L)return;
    const px=L.x0+clamp(run.player.x,80,1040)*L.sx,gy=L.ground,H=L.petH,head=gy-H-sv.hop,mid=gy-H*.5,size=L.size,X=x=>L.x0+(Number(x)||0)*L.sx;
    switch(e.type){
      case 'collect':{
        const x=X(e.x),y=Math.min(gy-size*.34,gy-((Number(e.y)||0)+17)*L.sy);
        if(e.kind==='bone'||e.kind==='gold'){
          const total=e.totalMultiplier||1,gold=e.kind==='gold';
          sv.pip=1;if(!rm){sv.squash=gold?.7:.82;sv.squashV=0;if(sv.hop<=0)sv.hopV=gold?340:200;}
          for(const other of j.popups)if(other.catch)other.life=Math.min(other.life,gold?.2:.3);
          const pop=this._say(`+${e.value}${total>1?`  x${fmt(total)}`:''}`,px,head-12,{color:multColor(total),stroke:multStroke(total),size:clamp(14+Math.sqrt(total)*2.4,15,27)+(gold?4:0),life:gold?1.1:.75,rise:rm?0:40});
          if(pop)pop.catch=true;
          if(e.comet)this._subhead(sv,'COMET CATCH!','#ffe58a');
          if(!rm){
            // the treat hops into the pet's mouth, however far the magnet reached for it
            const art=this._kit(size)[gold?'chicken':e.bouncy?'ball':'biscuit'],mouth=this._mouth,far=Math.hypot(x-mouth.x,y-mouth.y);
            j.fly({x,y,target:()=>mouth,life:clamp(.07+far/1500,.08,.3),arc:far>60?26:6,draw:(c,fx,fy,k)=>spin(c,art,fx,fy,1.2+k*5,1-k*.6)});
            j.burst(gold?'gold':'crumb',mouth.x,mouth.y,{count:gold?12:4});
            if(gold){j.ring(px,mid,{color:'#ffe58a',radius:H*1.05,life:.42,width:5});j.hitStop(.035);j.zoomPunch(.016);}
            if(e.comet)j.burst('star',px,mid,{count:10});
          }
        }else{
          const color={magnet:'#9ff0e4',shield:'#bfe6ff',heart:'#ffc0cb'}[e.kind]||'#fff4d7';
          this._say({magnet:'MAGNET!',shield:'SHIELD UP!',heart:e.value>=80?'FULL HEARTS  +80':'+1 HEART'}[e.kind]||`+${e.value}`,px,head-34,{color,size:17,life:1.05,rise:rm?0:30});
          if(!rm){sv.squash=.8;sv.squashV=0;if(sv.hop<=0)sv.hopV=240;j.ring(px,mid,{color,radius:H*1.2,life:.5,width:5});j.burst(e.kind==='heart'?'heart':'bubble',px,mid,{count:8});}
        }
        break;
      }
      case 'miss':{
        const x=X(e.x);this._decal(sv,x,e.kind==='gold'?'gold':e.bouncy?'ball':'crumb',1.7);
        if(!rm){j.burst('crumb',x,gy-2,{count:7,colors:e.kind==='gold'?['#ffd75e','#f2a93b','#fff0a8']:undefined});j.burst('dust',x,gy,{count:3});}
        break;
      }
      case 'chain-lost':{
        // the engine says why the chain ended; a controller's own echo of the same break carries no reason
        if(e.reason===undefined&&Math.abs(run.time-sv.lostAt)<.3)break;
        sv.lost=1;sv.lostAt=run.time;
        if(e.multiplier>1){
          this._say('CHAIN LOST',px,head-22,{color:'#ff9a8a',stroke:'#4a1620e6',size:19,life:1.15,rise:rm?0:24});
          if(!rm){j.burst('debris',px,gy+16,{count:9,colors:[multColor(e.multiplier),'#fff4d7','#ff9a8a'],speed:.8});if(e.reason!=='hit'){j.shake(.22);j.hitStop(.05);j.flash('#35101c',.2,.32);}}
        }else if(!rm&&e.combo>=2)j.burst('debris',px,gy+16,{count:3,colors:['#fff4d7'],speed:.5});
        break;
      }
      case 'hit':
        sv.recoil=1;this._say('OUCH!',px,head-44,{color:'#ff9a8a',stroke:'#4a1620e6',size:20,life:.9,rise:rm?0:30});
        if(!rm){sv.squash=.68;sv.squashV=0;j.shake(.5);j.kick(0,7);j.hitStop(.09);j.flash('#ff4d3a',.34,.3);j.burst('hit',px,mid,{count:12});j.burst('debris',px,mid,{count:8,colors:['#5d4030','#3d2a20','#805d45']});}
        break;
      case 'shield':
        this._say('BLOCKED!',px,head-14,{color:'#bfe6ff',size:18,life:.95,rise:rm?0:32});
        if(!rm){j.ring(px,mid,{color:'#bfe6ff',radius:H*1.5,from:H*.6,life:.45,width:6});j.burst('bubble',px,mid,{count:12});j.burst('spark',px,mid,{count:8,colors:['#bfe6ff','#ffffff']});j.hitStop(.05);j.shake(.12);}
        break;
      case 'smash':
        this._say(`SMASH +${e.value}`,X(e.x),gy-H-14,{color:'#ffc972',size:18,life:.9,rise:rm?0:34});
        if(!rm){j.burst('stomp',X(e.x),mid,{count:12});j.burst('debris',X(e.x),mid,{count:6,colors:['#5d4030','#3d2a20']});j.hitStop(.03);}
        break;
      case 'dodge':
        this._decal(sv,X(e.x),'mud',1.9);if(!rm)j.burst('debris',X(e.x),gy,{count:5,colors:['#5d4030','#3d2a20','#805d45'],speed:.6});
        break;
      case 'near-miss':this._say('SO CLOSE! +35',X(e.x),gy-H*.55,{color:'#fff3a5',size:15,life:1,rise:rm?0:30});break;
      case 'bounce':
        this._say('BOING!',X(e.x),gy-26,{color:'#bff3e6',size:14,life:.7,rise:rm?0:26});
        if(!rm){j.ring(X(e.x),gy,{color:'#eafff8',radius:size*1.1,life:.3,width:3});j.burst('dust',X(e.x),gy,{count:5});}
        break;
      case 'gust':
        if(!rm)sv.tumble={x:e.direction>0?-30:L.w+30,dir:e.direction};
        this._subhead(sv,e.direction>0?'WHOOSH!  \u2192':'\u2190  WHOOSH!','#fff1d0',1.2);
        break;
      case 'comet':this._subhead(sv,'GOLDEN COMET!','#ffe58a',1.2);break;
      case 'bloom':{
        const x=X(e.x);sv.bloomKick=1;this._subhead(sv,'BLUEBONNET BURST!','#c5d0ff');
        if(!rm){j.ring(x,gy,{color:'#9db0ff',radius:size*2.6,life:.5,width:5});j.burst('leaf',x,gy-6,{count:14,colors:['#5a7cf0','#3d5bd0','#dfe6ff'],speed:1.5,spread:[Math.PI*1.1,Math.PI*1.9]});}
        break;
      }
      case 'fizzle':if(!rm)j.burst('poof',X(e.x),gy-4,{count:3,scale:.6});break;
      case 'combo':
        if(e.multiplier>1&&e.combo<=24){
          sv.bump=1;this._subhead(sv,e.multiplier>=5?'CHAIN MAX  x5!':`CHAIN  x${e.multiplier}`,multColor(e.multiplier),1.1);
          if(!rm){j.ring(px,mid,{color:multColor(e.multiplier),radius:H*1.1,life:.4,width:4});j.burst('spark',px,gy+14,{count:8});}
        }
        break;
      case 'fever':
        this._subhead(sv,'FRENZY  x2!','#ffb347',1.5);
        if(!rm){j.ring(px,mid,{color:'#ffb347',radius:H*2,life:.55,width:7});j.burst('spark',px,mid,{count:18,colors:['#ffb347','#ffe066','#ff8a3d']});j.shake(.14);j.flash('#ffb347',.2,.35);sv.hopV=Math.max(sv.hopV,300);}
        break;
      case 'gold-rush':{
        const fresh=(e.duration||0)<=4.01;
        if(fresh||!sv.sub||sv.sub.life<.4)this._subhead(sv,fresh?'GOLD RUSH  x2!':'GOLD RUSH  +4s','#ffe066',fresh?1.5:.9);
        if(!rm&&fresh){j.ring(px,mid,{color:'#ffe066',radius:H*2,life:.55,width:7});j.flash('#ffe27a',.16,.3);}
        break;
      }
      case 'power':
        this._subhead(sv,e.characterId==='griffin'?'ZOOMIES  x1.5!':`${(ABILITIES[e.characterId]?.name||'Power').toUpperCase()}!`,'#fff6c8',1.5);
        if(!rm){j.ring(px,mid,{color:'#fff6c8',radius:H*2.4,life:.6,width:8});j.ring(px,mid,{color:'#b5eeef',radius:H*1.5,life:.45,width:5});j.burst('power',px,mid);j.zoomPunch(.05);j.shake(.14);j.flash('#fff6c8',.22,.3);sv.hopV=Math.max(sv.hopV,320);}
        break;
      case 'charged':if(!rm){j.ring(px,mid,{color:'#fff2ab',radius:H*.95,life:.45,width:4});j.burst('spark',px,mid,{count:6});}break;
      case 'heal':if(!rm)j.burst('heart',px,mid,{count:6});break;
      case 'stack':{
        // 10x, 20x, 30x: each rung of the stack gets a bigger party. The engine names the rung (level 10|20|30);
        // a controller that watches the live stack may announce it too, as {total} from 2x upward. Read the
        // multiplier itself, leave the small steps to the chain, gold and frenzy lines, and count a rung
        // announced twice in the same moment as one party.
        const level=Number(e.level)||Number(e.total)||Number(e.totalMultiplier)||Number(e.tier)||0,tier=level>=30?3:level>=20?2:level>=10?1:0;
        if(!tier||Math.abs(run.time-sv.stackAt[tier])<.3)break;
        const again=run.time-sv.stackAt[tier]<4;sv.stackAt[tier]=run.time;
        const text=['','10x STACK!','20x STACK!','30x MAX STACK!'][tier],color=multColor(tier*10);
        if(again)this._subhead(sv,text,color,1.1);else this._headline(sv,text,color,[0,34,40,46][tier],1.4+tier*.25,multStroke(tier*10).slice(0,7));
        if(!rm&&!again){
          for(let i=0;i<tier;i++)j.ring(px,mid,{color,radius:H*(1.4+i*.9),life:.5+i*.14,width:7-i});
          j.burst(tier>=2?'confetti':'star',px,head,{count:10+tier*9});sv.hopV=Math.max(sv.hopV,280+tier*70);sv.bump=1;
          j.zoomPunch(.02*tier);j.hitStop(.03+.02*tier);
          if(tier===3){j.burst('confetti',L.w/2,L.skyTop+L.playH*.3,{count:30});j.shake(.22);if(!sv.maxed){sv.maxed=true;j.flash('#fff3c4',.3,.4);j.slowMo(.45,.55);}}
        }
        break;
      }
      case 'section':if(SECTION_BANNER[e.section])this._headline(sv,SECTION_BANNER[e.section],'#fff6dc',32,1.5);break;
      case 'final-push':
        this._headline(sv,'FINAL 10!','#ffd96d',40,1.4);
        if(!rm){j.flash('#ff8a5c',.2,.4);j.ring(L.w/2,L.skyTop+L.playH*.46,{color:'#ffd96d',radius:Math.min(L.w,L.playH)*.6,life:.6,width:8});}
        break;
      case 'tick':
        if(e.remaining<=3)j.zoomPunch(.012);
        // the last second stretches so the golden goodbye lands in slow motion
        if(e.remaining===1)j.slowMo(.45,1.3);
        break;
      case 'finale':this._subhead(sv,'GOLDEN GOODBYE!','#ffe066',1.6);break;
      case 'countdown':if(!e.count&&!rm)j.ring(L.w/2,L.skyTop+L.playH*.5,{color:'#ffe066',radius:Math.min(L.w,L.playH)*.42,life:.5,width:6});break;
      case 'won':if(!rm){j.burst('confetti',L.w/2,L.skyTop+L.playH*.3,{count:40});j.ring(px,mid,{color:'#fff3c4',radius:H*1.8,life:.6,width:6});}break;
    }
  }
  drawStorm(run,{time=0,dt=0,reducedMotion=false,insets}={}){
    const rm=Boolean(reducedMotion),j=this.juice;this.reducedMotion=rm;j.reducedMotion=rm;
    dt=clamp(Number(dt)||0,0,.1);j.update(dt);
    const c=this.begin(),L=this._stormLayout(run,insets),sv=this._stormState(run),amb=this._ambient(),kit=this._kit(L.size);
    // The storm keeps its own clock from frame time (0 while paused), so a paused game is a still picture.
    sv.clock+=dt;const t=this.time=rm?0:sv.clock;
    const world=clamp(Math.round(Number(run.worldIndex??run.stage)||0),0,4),look=STORM_LOOK[world],total=run.totalMultiplier||1,px=L.x0+clamp(run.player.x,80,1040)*L.sx;
    L.night=Boolean(look.night);
    // moods ease in and out so a layer arriving or ending is felt, never snapped
    const toward=(value,target,rate)=>value+(target-value)*Math.min(1,dt*rate);
    sv.heat=toward(sv.heat,run.feverTime>0?1:0,5);sv.gold=toward(sv.gold,run.goldRushTime>0?1:0,5);sv.zoom=toward(sv.zoom,run.powerTime>0?1:0,8);
    sv.push=toward(sv.push,run.time>=35?1:0,1.6);sv.rays=toward(sv.rays,total>=30?1:total>=20?.72:total>=10?.45:0,4);
    sv.lost=Math.max(0,sv.lost-dt*1.1);sv.pip=Math.max(0,sv.pip-dt*5);sv.bump=Math.max(0,sv.bump-dt*3);sv.recoil=Math.max(0,sv.recoil-dt*2.6);sv.bloomKick=Math.max(0,sv.bloomKick-dt*1.6);
    sv.windX+=(run.wind||0)*dt*560;sv.ticking=dt>0;sv.storm=toward(sv.storm,run.mode==='running'?Math.min(2,Math.floor(run.time/15))/2:sv.storm,1.2);if(sv.banner&&(sv.banner.life-=dt)<=0){sv.banner=sv.bannerNext;sv.bannerNext=null;}if(sv.sub&&(sv.sub.life-=dt)<=0)sv.sub=null;
    const o=j.offset;c.save();
    if(o.x||o.y||o.rot||o.zoom!==1){c.translate(L.w/2+o.x,L.h/2+o.y);if(o.rot)c.rotate(o.rot);c.scale(o.zoom,o.zoom);c.translate(-L.w/2,-L.h/2);}
    const bg=this._stormBackdrop(L,world);c.drawImage(bg.cv,-BLEED,-BLEED,bg.w,bg.h);
    this._stormSky(c,run,L,sv,amb,world,t,dt,px,total);
    this._stormDecals(c,L,sv,dt);
    for(const e of run.entities)if(!e.taken&&!e.hit)this._stormMarker(c,e,L);
    this._stormPet(c,run,L,sv,amb,t,dt,px);
    for(const e of run.entities)if(!e.taken&&!e.hit)this._stormItem(c,e,L,kit,amb,sv,t);
    this._stormMeter(c,run,L,sv,t,px,total);
    j.draw(c);c.restore();
    this._stormOverlay(c,run,L,sv,amb,t,world);
    j.drawOverlay(c,L.w,L.h);
  }
  // Everything behind the action: storm clouds, the world's own weather, and the stack moods.
  _stormSky(c,run,L,sv,amb,world,t,dt,px,total){
    const rm=this.reducedMotion,w=L.w,night=L.night,cloud=night?amb.cloudNight:amb.cloud,cs=clamp(w/520,.75,1.05),span=w+170*cs,count=w>620?6:3;
    for(let i=0;i<count;i++){const x=((hash01(i,21)*span+t*(5+i*2.3))%span)-85*cs,y=L.skyTop+(L.short?-16:4)*cs+(i%2)*11*cs+Math.sin(t*.5+i)*2;put(c,cloud,x,y,cs*(L.short?.66:.8)*(1+hash01(i,22)*.5),night?.7:.84);}
    if(sv.storm>.05&&!rm){
      const drops=Math.round(22*sv.storm),lean=(run.wind||0)*30+5,fall=L.playH+40;
      c.strokeStyle=night?'#cfdcff':'#ffffff';c.lineWidth=1.2;c.globalAlpha=.2+sv.storm*.12;c.beginPath();
      for(let i=0;i<drops;i++){const h1=hash01(i,13),h2=hash01(i,14),y=L.skyTop+((h2*fall+t*(520+h1*240))%fall),x=h1*(w+40)-20+(y-L.skyTop)*lean/fall;c.moveTo(x,y);c.lineTo(x-lean*.12,y-13-h1*8);}
      c.stroke();c.globalAlpha=1;
    }
    if(world===0){
      // Rogue River: bright motes drift up off the water
      for(let i=0;i<6;i++){const h1=hash01(i,25),h2=hash01(i,26),rise=L.playH*.7,y=L.ground-20-((h2*rise+t*(9+h1*8))%rise);put(c,amb.glowWhite,((h1*w+Math.sin(t*.6+i)*18)%w+w)%w,y,.1+h1*.08,.7);}
    }else if(world===1){
      // Redwood Run: leaves ride the same breeze that sways the treats
      const leaves=w>620?12:8,fall=L.ground-L.skyTop;
      for(let i=0;i<leaves;i++){const h1=hash01(i,31),h2=hash01(i,32),y=L.skyTop+((h2*fall+t*(24+h1*22))%fall),x=((h1*w+Math.sin(t*.9+i*1.7)*26+t*9)%(w+40))-20;spin(c,i%3?amb.leafA:amb.leafB,x,y,t*(.8+h1)+i,1.15,Math.cos(t*1.3+i)*.5+.65,.88);}
    }else if(world===2){
      // Painted Canyon: gust lines lean with the wind, and a tumbleweed rolls through
      const wind=run.wind||0,force=Math.abs(wind);
      if(force>.04&&!rm){
        c.strokeStyle='#fff1d0';c.lineWidth=1.6;c.lineCap='round';c.globalAlpha=Math.min(.62,force*.75);c.beginPath();
        for(let i=0;i<10;i++){const h1=hash01(i,41),h2=hash01(i,42),lane=w+160,x=(((h1*w+sv.windX*(.7+h2*.8))%lane)+lane)%lane-80,y=L.skyTop+h2*L.playH*.92,len=(26+h1*44)*wind;c.moveTo(x,y);c.lineTo(x+len,y+force*8);}
        c.stroke();c.globalAlpha=1;
        if(Math.random()<dt*12)this.juice.emit({x:Math.random()*w,y:L.ground-2,vx:wind*230,vy:-18,drag:1.2,life:.55,size:4,grow:15,color:'#f3dcb5a0',shape:'puff'});
      }
      const tw=sv.tumble;
      if(tw){tw.x+=tw.dir*(70+force*300)*dt;if(tw.x<-50||tw.x>w+50)sv.tumble=null;else spin(c,amb.tumble,tw.x,L.ground-17-Math.abs(Math.sin(tw.x*.045))*12,tw.x*.06,.9,.9,.9);}
    }else if(world===3){
      // Starlight Mesa: the sky twinkles
      for(let i=0;i<10;i++){const h1=hash01(i,51),h2=hash01(i,52);put(c,amb.spark,h1*w,L.skyTop+h2*L.playH*.5,.42+h2*.4,rm?.7:.25+.75*Math.abs(Math.sin(t*(1+h1)+i*2.1)));}
    }else{
      // Boerne Hills: bluebonnets nod along the lane, and shiver when one bursts
      const flowers=Math.ceil(w/56),f=amb.flower;
      for(let i=0;i<flowers;i++){const h1=hash01(i,61),s=.72+h1*.5,sway=rm?0:Math.sin(t*1.7+i*1.3)*.09+sv.bloomKick*Math.sin(t*16+i)*.22;c.save();c.translate((i+.2+h1*.6)*w/flowers,L.ground+8+hash01(i,62)*8);c.rotate(sway);c.drawImage(f.cv,-f.w*s/2,-f.h*s,f.w*s,f.h*s);c.restore();}
    }
    // Frenzy: embers climb the edges of the field
    if(sv.heat>.5&&!rm&&Math.random()<dt*16){const edge=Math.random()<.5?Math.random()*w*.09:w-Math.random()*w*.09;this.juice.emit({x:edge,y:L.ground+8,vx:(Math.random()-.5)*24,vy:-(70+Math.random()*110),gravity:-24,drag:.5,life:.9+Math.random()*.7,size:2.4+Math.random()*2.2,color:Math.random()<.5?'#ffb347':'#ffe066',shape:'dot'});}
    // 10x and up: rays fan out behind the pet, wider and brighter with every rung
    if(sv.rays>.01){const size=Math.max(w,L.h)*1.25/256,cy=L.ground-L.petH*.5;spin(c,amb.rays,px,cy,rm?0:t*.35,size,size,sv.rays*(L.night?.4:.55));if(total>=30)spin(c,amb.raysHot,px,cy,rm?.26:-t*.5,size*.8,size*.8,sv.rays*.5);}
    // Gold Rush: golden haze up top and golden rain behind the treats
    if(sv.gold>.01){
      c.globalAlpha=sv.gold*.5;c.drawImage(amb.haze.cv,0,0,w,L.skyTop+L.playH*.45);c.globalAlpha=1;
      if(!rm){const fall=L.playH+110,streaks=w>620?18:12;for(let i=0;i<streaks;i++){const h1=hash01(i,71),h2=hash01(i,72);put(c,amb.streak,h1*w,L.skyTop-70+((h2*fall+t*(430+h1*260))%fall),1.1+h1*.7,sv.gold*(.5+h2*.42));}}
    }
    // Power: speed lines tear across the field
    if(sv.zoom>.01&&!rm){
      c.strokeStyle='#ffffff';c.lineWidth=2.6;c.lineCap='round';c.globalAlpha=sv.zoom*.6;c.beginPath();
      for(let i=0;i<12;i++){const h1=hash01(i,81),h2=hash01(i,82),x=w+60-((h1*w+t*(900+h2*900))%(w+220)),y=L.ground-8-h2*L.playH*.78;c.moveTo(x,y);c.lineTo(x+50+h1*110,y);}
      c.stroke();c.globalAlpha=1;
    }
    // Final ten seconds: a giant count behind the rain, thumping on every second
    if(run.time>=35&&run.time<45&&run.mode!=='lost'){
      const left=45-run.time,n=Math.max(1,Math.ceil(left-1e-6)),beat=left-(n-1),kick=rm?0:Math.max(0,(beat-.72)/.28),hot=n<=3;
      const size=Math.min(w*(n>=10?.5:.62),L.playH*.62)*(1+kick*.16),y=L.skyTop+L.playH*.46;
      c.save();c.font=`900 ${Math.round(size)}px Roadbook,Georgia,serif`;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      c.globalAlpha=.26+kick*.24+(hot?.1:0);c.lineWidth=Math.max(4,size*.035);c.strokeStyle='#0d2f33';c.strokeText(n,w/2,y);
      c.globalAlpha=.4+kick*.32+(hot?.12:0);c.fillStyle=hot?'#ffb39a':'#fff6dc';c.fillText(n,w/2,y);c.restore();
    }
  }
  // Where a missed treat or a dodged mud ball landed.
  _stormDecals(c,L,sv,dt){
    const list=sv.decals;if(!list.length)return;let alive=0;const s=L.size,y=L.ground+3;
    for(const d of list){
      d.life-=dt;if(d.life<=0)continue;list[alive++]=d;const fade=Math.min(1,d.life/.5),x=d.x;
      if(d.kind==='mud'){
        c.globalAlpha=fade*.78;c.fillStyle='#3d2a20';c.beginPath();c.ellipse(x,y,s*.62,s*.17,0,0,TAU);c.fill();
        c.fillStyle='#6a4a37';c.beginPath();c.ellipse(x-s*.12,y-1,s*.3,s*.07,0,0,TAU);c.fill();
      }else{
        c.globalAlpha=fade*.92;c.fillStyle=d.kind==='gold'?'#f2b33d':d.kind==='ball'?'#35c9b5':'#e9c98d';
        c.beginPath();c.ellipse(x-5,y,5,2.4,0,0,TAU);c.moveTo(x+8,y+1.5);c.ellipse(x+4,y+1.5,4,2,0,0,TAU);c.moveTo(x+4.4,y-2);c.ellipse(x+1,y-2,3.4,1.8,0,0,TAU);c.fill();
      }
    }
    list.length=alive;c.globalAlpha=1;
  }
  // A soft marker on the lane shows where each falling thing will land, growing as it nears.
  _stormMarker(c,e,L){
    let wx=e.baseX??e.x;
    if(e.g){const air=(e.vy+Math.sqrt(Math.max(0,e.vy*e.vy+2*e.g*Math.max(0,e.y))))/e.g;wx+=(e.vx||0)*air;}
    const near=clamp(1-e.y/430,0,1),x=L.x0+wx*L.sx,y=L.ground+3,rx=L.size*(.26+.36*near),type=e.type;
    if(type==='mud'){
      c.globalAlpha=.16+.42*near;c.fillStyle='#6b1d12';c.beginPath();c.ellipse(x,y,rx*1.15,rx*.32,0,0,TAU);c.fill();
      if(near>.4){c.globalAlpha=Math.min(1,(near-.4)*1.6);c.strokeStyle='#ff7a5c';c.lineWidth=2;c.beginPath();c.ellipse(x,y,rx*1.4,rx*.42,0,0,TAU);c.stroke();}
    }else{
      c.globalAlpha=type==='bone'&&!L.night?.15+.33*near:.16+.42*near;
      c.fillStyle=type==='gold'?'#ffcf3f':type==='bone'?(L.night?'#dfe8ff':'#082624'):type==='bloom'?'#6f8cff':'#7fd0ff';
      c.beginPath();c.ellipse(x,y,rx,rx*.3,0,0,TAU);c.fill();
    }
    c.globalAlpha=1;
  }
  _stormItem(c,e,L,kit,amb,sv,t){
    const rm=this.reducedMotion,size=L.size,x=L.x0+e.x*L.sx,rest=L.ground-size*.34,id=e.id||0,type=e.type;
    let y=L.ground-(e.y+e.h*.5)*L.sy,squash=1;
    // a treat settles on the grass for a beat before it counts as missed
    if(y>rest){squash=rm?1:clamp(1-(y-rest)/(size*1.6),.62,1);y=rest;}
    if(y<-size||x<-size*2||x>L.w+size*2)return;
    if(type==='bone'){
      if(sv.gold>.05&&!rm&&!e.g)put(c,amb.streak,x,y-size*1.1,1,sv.gold*.8);
      if(L.night)put(c,amb.glowWhite,x,y,size/26,.55);
      if(sv.heat>.05)put(c,amb.glowWarm,x,y,size/30,sv.heat*.5);
      if(e.bouncy)spin(c,kit.ball,x,y,rm?0:t*4+id,1/Math.sqrt(squash),squash);
      else spin(c,kit.biscuit,x,y,rm?1.25:Math.PI/2+Math.sin(t*2.3+id*1.9)*.42+(e.g?t*6:0),squash,1/Math.sqrt(squash));
    }else if(type==='gold'){
      if(e.comet){
        const vx=e.slant*e.vy*L.sx,vy=-e.vy*L.sy,tail=amb.tail;c.save();c.translate(x,y);c.rotate(Math.atan2(-vx,vy));c.drawImage(tail.cv,-tail.w/2,-tail.h,tail.w,tail.h);c.restore();
        if(!rm&&sv.ticking&&Math.random()<.3)this.juice.emit({x,y,vx:(Math.random()-.5)*40,vy:-10,gravity:70,life:.5,size:3.2,spin:6,color:'#fff0a8',shape:'star'});
      }else if(!rm)put(c,amb.streak,x,y-size*1.2,1.25,.75);
      put(c,amb.glowGold,x,y,size/19*(rm?1:1+Math.sin(t*6+id)*.1),.92);
      spin(c,kit.chicken,x,y,rm?-.5:-.5+Math.sin(t*3+id)*.3);
      if(!rm){const a=t*3+id;put(c,amb.spark,x+Math.cos(a)*size*.62,y+Math.sin(a)*size*.5,.5+.2*Math.sin(t*9+id),.95);put(c,amb.spark,x-Math.cos(a*1.3)*size*.55,y-Math.sin(a*1.3)*size*.6,.36,.8);}
    }else if(type==='mud'){
      const wobble=rm?0:Math.sin(t*7+id)*.07;spin(c,kit.mud,x,y,rm?0:Math.sin(t*2+id)*.08,(1+wobble)/Math.sqrt(squash),(1-wobble)*squash);
    }else if(type==='bloom'){
      put(c,amb.glowBlue,x,y,size/20,.85);spin(c,kit.bloom,x,y,rm?0:Math.sin(t*2.2+id)*.3);
    }else{
      const bob=rm?0:Math.sin(t*4+id)*2;put(c,type==='heart'?amb.glowWhite:amb.glowCool,x,y+bob,size/17*(rm?1:1+Math.sin(t*5+id)*.12),.8);put(c,kit[type]||kit.shield,x,y+bob);
    }
  }
  _petSprite(c,id,pose,x,y,width,sit,face,stretch,squash,lean,alpha){
    c.save();c.translate(x,y);if(lean)c.rotate(lean);c.scale((sit?1:face)*stretch,1);this.character(c,id,pose,0,0,width,{portrait:sit,alpha,squash});c.restore();
  }
  _stormPet(c,run,L,sv,amb,t,dt,px){
    const rm=this.reducedMotion,p=run.player,id=run.characterId,art=this.sprites[id],gy=L.ground,H=L.petH,live=run.mode==='running';
    // Frame-to-frame motion picks the pose and the lean (the engine's own vx is per substep and too jumpy under a finger).
    if(dt>0){const v=(p.x-sv.lastX)*L.sx/dt;sv.vx+=(v-sv.vx)*Math.min(1,dt*18);}
    sv.lastX=p.x;if(!live)sv.vx=0;
    sv.moving=Math.abs(sv.vx)>(sv.moving?40:105);if(sv.vx>26)sv.face=1;else if(sv.vx<-26)sv.face=-1;
    if(rm){sv.squash=1;sv.squashV=0;sv.hop=0;sv.hopV=0;}
    else if(dt>0){
      sv.squashV+=(-380*(sv.squash-1)-13*sv.squashV)*dt;sv.squash=clamp(sv.squash+sv.squashV*dt,.55,1.5);
      if(sv.hop>0||sv.hopV>0){
        sv.hopV-=1900*dt;sv.hop+=sv.hopV*dt;
        if(sv.hop<=0){sv.hop=0;if(sv.hopV<-250){sv.squash=.84;sv.squashV=0;if(sv.hopV<-400)this.juice.burst('land',px,gy,{count:5});}sv.hopV=0;}
      }
    }
    // a quick dash kicks up dust at the pet's heels
    if(!rm&&live&&dt>0&&sv.hop<=0&&Math.abs(sv.vx)>250&&(sv.dust-=dt)<=0){sv.dust=.08;this.juice.burst('dust',px-sv.face*L.petW*.3,gy+1,{count:2,scale:.7});}
    const hop=sv.hop,power=run.powerTime>0,cy=gy-hop-H*.5,shadow=amb.shadow,sw=L.petW*(.72-Math.min(.3,hop/260));
    c.drawImage(shadow.cv,px-sw,gy-7,sw*2,16);
    if(sv.heat>.02)put(c,amb.glowWarm,px,cy,H/28*(rm?1:1+Math.sin(t*9)*.06),sv.heat*.78);
    if(sv.zoom>.02){
      put(c,amb.glowGold,px,cy,H/19,sv.zoom*.6);put(c,amb.glowWhite,px,cy,H/27,sv.zoom*.95);
      const pulse=rm?0:Math.sin(t*12)*.04;c.globalAlpha=sv.zoom*.8;c.strokeStyle='#fff6c8';c.lineWidth=3;c.beginPath();c.ellipse(px,cy,H*(.74+pulse),H*(.7-pulse),0,0,TAU);c.stroke();c.globalAlpha=1;
    }
    if(run.magnetTime>0){c.strokeStyle='#9fe6de';c.lineWidth=2.5;c.setLineDash([8,9]);c.lineDashOffset=rm?0:-t*40;c.globalAlpha=.8*Math.min(1,run.magnetTime);c.beginPath();c.ellipse(px,cy,H*.9,H*.76,0,0,TAU);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
    if(!art)return;
    const moving=sv.moving&&live,pose=moving?(hop>H*.16?2:Math.floor(t*(CHARACTER_ART[id]?.cadence||10))%2):3,sit=pose===3;
    const width=sit?L.petW:Math.min(H*.74*art.runWidth/Math.max(1,art.frames[0].h),L.runW);
    const alpha=run.invincible>0&&!power?(rm?.7:Math.floor(t*10)%2?.45:1):1;
    const lean=rm?0:clamp(sv.vx/900,-1,1)*.2+(sv.recoil>0?Math.sin(sv.recoil*22)*.16*sv.recoil:0);
    const squash=sv.squash*(rm||!sit?1:1+Math.sin(t*3.2)*.014),stretch=1/Math.sqrt(squash);
    if(power&&moving&&!rm)for(let k=2;k>0;k--)this._petSprite(c,id,pose,px-sv.face*k*H*.24,gy-hop,width,sit,sv.face,stretch,squash,lean,.2/k);
    this._petSprite(c,id,pose,px,gy-hop,width,sit,sv.face,stretch,squash,lean,alpha);
    if(run.shieldCharges>0){
      c.beginPath();c.ellipse(px,cy,H*.62,H*.68,0,0,TAU);c.globalAlpha=.16;c.fillStyle='#8fd4ff';c.fill();c.globalAlpha=.9;c.strokeStyle='#bfeaff';c.lineWidth=run.shieldCharges>1?5:3;c.stroke();
      c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.ellipse(px,cy,H*.5,H*.56,0,Math.PI*1.15,Math.PI*1.45);c.stroke();c.globalAlpha=1;
    }
    const mouth=this._mouth;mouth.x=px+(sit?0:sv.face*H*.36);mouth.y=gy-hop-H*(sit?.6:.46);
  }
  // The chain meter lives at the pet's feet: six pips to the next chain step, the
  // whole stack as one number, and a little icon for each timed layer in play.
  _stormMeter(c,run,L,sv,t,px,total){
    const rm=this.reducedMotion,gap=L.short?11:12.5,r=gap*.36,row=gap*5,y=L.ground+(L.short?13:18),lost=sv.lost,bump=rm?0:sv.bump;
    const cx=clamp(px,row/2+62,L.w-row/2-50)+(!rm&&lost>.45?Math.sin(t*70)*5*(lost-.45):0),left=cx-row/2;
    const full=run.multiplier>=5,filled=full?6:run.combo%6,broken=lost>0&&run.combo===0;
    c.globalAlpha=.8;c.fillStyle=broken?'#3a1520':'#0b2a2c';c.beginPath();c.roundRect(left-r-5,y-r-4,row+2*r+10,2*r+8,r+4);c.fill();c.globalAlpha=1;
    if(filled<6){c.fillStyle=broken?'#ff9a8a66':'#ffffff3d';c.beginPath();for(let i=filled;i<6;i++){const x=left+i*gap;c.moveTo(x+r,y);c.arc(x,y,r,0,TAU);}c.fill();}
    if(filled){
      c.fillStyle=multColor(run.multiplier);c.beginPath();
      for(let i=0;i<filled;i++){const x=left+i*gap,k=1+bump*.45+(rm?0:i===filled-1&&!full?sv.pip*.7:full?Math.sin(t*6+i)*.12:0);c.moveTo(x+r*k,y);c.arc(x,y,r*k,0,TAU);}
      c.fill();
    }
    // nothing caught for a while: a short fuse shows the chain is about to slip away
    if(run.combo>0&&run.comboTime<3.2){c.fillStyle=run.comboTime<1.4?'#ff9a8a':'#fff4d7';c.fillRect(left-r,y+r+5,(row+2*r)*clamp(run.comboTime/3.2,0,1),2.5);}
    if(total>1||broken){
      const size=(L.short?15:17)*(1+bump*.35),tx=left+row+r+9;
      c.font=`900 ${Math.round(size)}px system-ui,-apple-system,sans-serif`;c.textAlign='left';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=4;
      c.strokeStyle=broken?'#4a1620':multStroke(total);c.fillStyle=broken?'#ff9a8a':multColor(total);const text=`x${fmt(total)}`;c.strokeText(text,tx,y+.5);c.fillText(text,tx,y+.5);
    }
    let lx=left-r-15;
    if(run.feverTime>0){this._layerIcon(c,lx,y,'flame',run.feverTime,t);lx-=17;}
    if(run.goldRushTime>0){this._layerIcon(c,lx,y,'gold',run.goldRushTime,t);lx-=17;}
    if(run.powerTime>0&&run.characterId==='griffin')this._layerIcon(c,lx,y,'bolt',run.powerTime,t);
  }
  _layerIcon(c,x,y,kind,left,t){
    // a layer about to run out blinks, so the stack never drops without warning
    if(left<1.6&&!this.reducedMotion&&Math.floor(t*8)%2)c.globalAlpha=.45;
    c.fillStyle='#0b2a2cd0';c.beginPath();c.arc(x,y,8,0,TAU);c.fill();
    if(kind==='flame'){c.fillStyle='#ff8a3d';c.beginPath();c.moveTo(x,y-6.5);c.bezierCurveTo(x+6,y-1,x+5,y+5.5,x,y+5.5);c.bezierCurveTo(x-5,y+5.5,x-6,y-1,x,y-6.5);c.fill();c.fillStyle='#ffe066';c.beginPath();c.arc(x,y+2.2,2.3,0,TAU);c.fill();}
    else if(kind==='gold')star(c,x,y+.3,6.2,'#ffd24a');
    else{c.fillStyle='#fff6c8';c.beginPath();c.moveTo(x+1.5,y-6);c.lineTo(x-4,y+.8);c.lineTo(x-.6,y+.8);c.lineTo(x-1.8,y+6);c.lineTo(x+4,y-1.2);c.lineTo(x+.6,y-1.2);c.closePath();c.fill();}
    c.globalAlpha=1;
  }
  // Screen-space layers that stay put when the field shakes: mood edges, the count-in, and banners.
  _stormOverlay(c,run,L,sv,amb,t,world){
    const rm=this.reducedMotion,w=L.w,h=L.h,time=run.time;
    if(sv.heat>.01){
      // Frenzy: a warm glow breathes around the whole field
      const glow=sv.heat*(rm?.62:.66+Math.sin(t*5)*.16),side=clamp(w*.17,46,120);
      c.globalAlpha=glow;c.drawImage(amb.heatLeft.cv,0,0,side,h);c.drawImage(amb.heatRight.cv,w-side,0,side,h);
      c.globalAlpha=glow*.7;c.drawImage(amb.heatTop.cv,0,0,w,side*.9);c.drawImage(amb.heatBottom.cv,0,h-side*.9,w,side*.9);c.globalAlpha=1;
    }
    if(sv.push>.01){c.globalAlpha=sv.push*.42;c.drawImage(amb.dusk.cv,0,0,w,L.skyTop+L.playH*.75);c.globalAlpha=1;}
    if(time<3&&(run.mode==='running'||run.mode==='paused')){
      // 3, 2, 1, GO! on simulation time, while the first treats are already falling
      const go=time>=2.25,beat=go?(time-2.25)/.75:(time%.75)/.75,base=Math.min(w*.3,L.playH*(L.short?.3:.36)),y=L.skyTop+L.playH*(L.short?.33:.44);
      const pop=rm?1:beat<.22?.55+ease.outBack(beat/.22)*.45:1,text=go?'GO!':String(3-Math.floor(time/.75));
      c.save();c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      c.globalAlpha=beat>.72?1-(beat-.72)/.28:1;c.font=`900 ${Math.round(base*(go?.74:1)*pop)}px Roadbook,Georgia,serif`;
      c.lineWidth=Math.max(5,base*.09);c.strokeStyle='#0f3537';c.strokeText(text,w/2,y);c.fillStyle=go?'#ffe066':'#fff6dc';c.fillText(text,w/2,y);
      if(!go){
        c.globalAlpha=1;c.lineWidth=4;c.strokeStyle='#0f3537e6';let y2=y+base*.6+(L.short?4:10);const touch=this.touchFirst;
        // On a touch screen the controller's own coach mark teaches the drag, so the canvas only names this world's twist.
        if(!touch){c.font='800 16px system-ui,-apple-system,sans-serif';const how='Arrow keys or drag to catch';c.strokeText(how,w/2,y2);c.fillStyle='#fff6dc';c.fillText(how,w/2,y2);y2+=22;}
        c.font=`800 ${touch?16:14}px system-ui,-apple-system,sans-serif`;c.strokeText(TWIST_TIP[world],w/2,y2);c.fillStyle='#ffe9a8';c.fillText(TWIST_TIP[world],w/2,y2);
      }
      c.restore();
    }
    const b=sv.banner,sub=sv.sub,lineY=L.skyTop+Math.max(L.playH*.2,L.short?64:44); // on a short screen this clears a one-line callout under the HUD
    if(b||sub){
      c.save();c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      if(b){
        const age=b.max-b.life,pop=rm?1:age<.2?.6+ease.outBack(age/.2)*.4:1,size=Math.min(b.size,(w-28)/(b.text.length*.66))*pop;
        c.globalAlpha=Math.min(1,b.life/.3);c.font=`900 ${Math.round(size)}px Roadbook,Georgia,serif`;
        c.lineWidth=Math.max(4,size*.16);c.strokeStyle=b.stroke;c.strokeText(b.text,w/2,lineY);c.fillStyle=b.color;c.fillText(b.text,w/2,lineY);
      }
      if(sub){
        const age=sub.max-sub.life,pop=rm?1:age<.16?.7+ease.outBack(age/.16)*.3:1,size=Math.min(L.short?18:20,(w-28)/(sub.text.length*.6))*pop;
        c.globalAlpha=Math.min(1,sub.life/.3);c.font=`900 ${Math.round(size)}px system-ui,-apple-system,sans-serif`;
        const drop=b?Math.max(30,b.size*.5+17):L.short?24:30;c.lineWidth=4.5;c.strokeStyle='#0f3537e6';c.strokeText(sub.text,w/2,lineY+drop);c.fillStyle=sub.color;c.fillText(sub.text,w/2,lineY+drop);
      }
      c.restore();
    }
  }
  entity(c,e,time,palette,run){
    const x=e.x-e.w/2,y=-e.y,w=e.w,h=e.h;
    if(e.type==='gap'){
      c.fillStyle='#386c73';rounded(c,x,-2,w,64,5,'#386c73');c.fillStyle='#5cb8bb';c.fillRect(x+3,7,w-6,8);c.strokeStyle='#c5eae1';c.lineWidth=3;for(let i=0;i<3;i++){const xx=x+8+((time*30+i*40)%(Math.max(30,w-35)));c.beginPath();c.moveTo(xx,23+i%2*13);c.lineTo(Math.min(x+w-5,xx+19),23+i%2*13);c.stroke();}c.fillStyle='#e5c59c';rounded(c,x-7,-5,13,24,4,'#e5c59c');rounded(c,x+w-6,-5,13,24,4,'#e5c59c');
    }else if(e.type==='log'){
      c.save();c.globalAlpha=e.hit?.3:1;rounded(c,x,y-h,w,h,13,'#735039','#4b3629');rounded(c,x+3,y-h+5,w-7,6,3,'#ae8058');c.strokeStyle='#4d3628';c.lineWidth=3;for(let i=0;i<3;i++){c.beginPath();c.moveTo(x+10,y-h+18+i*10);c.lineTo(x+w-12,y-h+15+i*10);c.stroke();}c.fillStyle='#d7af75';c.beginPath();c.ellipse(x+w-5,y-h/2,12,h*.43,0,0,TAU);c.fill();c.strokeStyle='#9e714c';c.lineWidth=2;c.beginPath();c.ellipse(x+w-4,y-h/2,7,h*.28,0,0,TAU);c.stroke();c.restore();
    }else if(e.type==='branch'){
      c.save();c.globalAlpha=e.hit?.3:1;c.lineWidth=10;c.strokeStyle='#5c4937';c.beginPath();c.moveTo(x-13,y-h-40);c.lineTo(x+14,y-h+12);c.lineTo(x+w+12,y-h+9);c.stroke();rounded(c,x,y-h,w,h,12,'#755942','#473e2c');rounded(c,x+4,y-h+5,w-7,6,3,'#ae8860');for(let i=0;i<4;i++){c.fillStyle=i%2?'#71954c':'#90ac58';c.beginPath();c.ellipse(x+8+i*26,y-h-4,27,13,-.2,0,TAU);c.fill();}c.restore();
    }else if(e.type==='spring'){
      c.strokeStyle='#faf0c1';c.lineWidth=4;c.beginPath();c.moveTo(x+18,-3);for(let i=0;i<5;i++)c.lineTo(x+(i%2?18:38),-4-i*4);c.stroke();rounded(c,x,-22,w,11,6,'#e65f4d','#953e36');c.fillStyle='#ffdfab';c.beginPath();c.arc(x+20,-19,4,0,TAU);c.fill();rounded(c,x+4,-3,w-8,6,3,'#7c6151');
    }else{
      const cy=y-h/2+(this.reducedMotion?0:Math.sin(time*3+e.id)*2),cx=x+w/2;
      c.save();
      if(e.type==='bone'){bone(c,cx,cy,34);}
      else if(e.type==='gold'){c.shadowColor='#ffdb6e';c.shadowBlur=15;star(c,cx,cy,21,'#ffcc4d',time*.25);star(c,cx,cy,12,'#fff2b7',time*.25);}
      else if(e.type==='letter'){rounded(c,x,cy-21,40,42,10,'#ffdb77','#9f7036');c.fillStyle='#28483e';c.font='900 28px system-ui';c.textAlign='center';c.fillText(e.letter||'G',cx+2,cy+10);}
      else {const color={magnet:'#9be0de',shield:'#b0daff',heart:'#ffb4a3'}[e.type]||'#ffdb82';c.fillStyle=color;c.strokeStyle='#fff3d4';c.lineWidth=3;c.beginPath();c.arc(cx,cy,23,0,TAU);c.fill();c.stroke();c.fillStyle='#21464d';c.font='bold 24px system-ui';c.textAlign='center';c.fillText({magnet:'U',shield:'◆',heart:'♥'}[e.type]||'★',cx,cy+8);}
      c.restore();
    }
    if(e.hint&&!e.hit&&e.x>WORLD.playerX+55&&e.x<850){
      let text=e.hint||'JUMP';
      const yy=e.type==='branch'?y-h-47:e.type==='spring'?-55:Math.min(-90,y-h-23);
      c.save();c.font='800 12px system-ui';c.textAlign='center';const ww=c.measureText(text).width+19;rounded(c,x+w/2-ww/2,yy-15,ww,23,8,'#143c3be8');c.fillStyle='#fff2c8';c.fillText(text,x+w/2,yy+1);c.restore();
    }
  }
}
