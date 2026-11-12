import { Renderer } from './renderer.js?v=23';
import { CHARACTER_ART } from './characters.js?v=23';
import { drawScout, scoutEvent } from './scout-view.js?v=23';
import { hash01, ease } from './fx.js?v=23';

const TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), lerp=(a,b,t)=>a+(b-a)*t;
const palettes=[
 {sky:'#b8e5df',light:'#f5e9bb',soil:'#bc9061',edge:'#85b964',dark:'#365c46',water:'#55b7c2',hill:'#6ca999'},
 {sky:'#b6d1ad',light:'#f3e0ae',soil:'#8e674e',edge:'#7c9c55',dark:'#304e3d',water:'#81b9af',hill:'#4e806b'},
 {sky:'#9fdce2',light:'#ffe3b1',soil:'#c47950',edge:'#e4b076',dark:'#864e3a',water:'#79b3bd',hill:'#dc9467'},
 {sky:'#203a55',light:'#69758c',soil:'#806379',edge:'#b997b1',dark:'#3a405a',water:'#627eb5',hill:'#5a6683'},
 {sky:'#b8e0e3',light:'#fff0c1',soil:'#b68b61',edge:'#a7b96c',dark:'#597251',water:'#80c9cc',hill:'#a5ba88'}
];
// Each world's look for the platform adventure. `image` picks a quarter of the
// painted biome sheet; everything else is drawn so it can move.
const THEMES=[
 {name:'river',image:0,sky:['#7cc7e6','#d8f1e2'],sun:'#fff6c9',tint:null,haze:'#d8f1e255',soil:'#a9825a',soilDark:'#7d5f43',turf:'#6fb24e',turfLight:'#a6d970',ledge:'#9a7550',ledgeTop:'#7cba55',water:['#3fa9b8','#1f6f86'],foam:'#e4fbf5',mid:'#2f6b52',midAlpha:.4,flower:'#ffe27a',ambient:'mist',balloon:['#bfeef0','#8fd6dc'],vent:'#dff8f6'},
 {name:'redwood',image:0,sky:['#8fbf9a','#dcebc4'],sun:'#fff2b8',tint:'#1f3d2a59',haze:'#cfe3b84d',soil:'#8a6247',soilDark:'#5f4332',turf:'#5c8f47',turfLight:'#8dbb5e',ledge:'#7a4f38',ledgeTop:'#6f9b4d',water:['#4c9c8f','#22594f'],foam:'#dff5e6',mid:'#1d2f23',midAlpha:.5,flower:'#ff8f6b',ambient:'leaf',balloon:['#ffb866','#e88a3a'],vent:'#cfe8a2'},
 {name:'canyon',image:2,sky:['#62bfe0','#ffe6bd'],sun:'#fff3c2',tint:null,haze:'#ffe6bd47',soil:'#c06f48',soilDark:'#8c4a33',turf:'#e2a868',turfLight:'#f6cf8f',ledge:'#b5613f',ledgeTop:'#f0bd7e',water:['#6b3b2c','#3c1f1a'],foam:'#f2c59b',mid:'#7a3f2c',midAlpha:.6,flower:'#ffd35e',ambient:'dust',balloon:['#ff7a66','#ffd35e'],vent:'#fff3dc'},
 {name:'mesa',image:2,sky:['#0f1f3d','#3a3f73'],sun:'#f6ecc4',tint:'#0d1c3aa8',haze:'#3a3f7340',soil:'#5d4a6b',soilDark:'#3b2f4a',turf:'#8b79a8',turfLight:'#c0b0dc',ledge:'#6a5a82',ledgeTop:'#b9a8dd',water:['#27386e','#141c3d'],foam:'#c9d4ff',mid:'#1c2444',midAlpha:.66,flower:'#9fe8ff',ambient:'firefly',balloon:['#ffcf7a','#ff9a4d'],vent:'#cfd4ff'},
 {name:'boerne',image:3,sky:['#6fc3ea','#e8f6d9'],sun:'#fff5c4',tint:null,haze:'#e8f6d94a',soil:'#c9a678',soilDark:'#9a7a55',turf:'#86b84f',turfLight:'#b8dd6e',ledge:'#d9c9a3',ledgeTop:'#9cc75a',water:['#58c3c9','#2c8c99'],foam:'#effffa',mid:'#3f6a30',midAlpha:.4,flower:'#5a78e6',ambient:'petal',balloon:['#ff6b6b','#6f8ff0'],vent:'#e2fbf6'}
];
const TIER_COLORS=[[20,'#ff9ecb'],[10,'#ffb057'],[5,'#ffd75e'],[2,'#fff0a8'],[0,'#fff4d7']];
const tierColor=m=>TIER_COLORS.find(([min])=>m>=min)[1];
function rect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function star(c,x,y,r,fill,t=0){c.beginPath();for(let i=0;i<10;i++){let a=i*Math.PI/5-Math.PI/2+t,k=i%2?.46:1;c.lineTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k);}c.closePath();c.fillStyle=fill;c.fill();}
function bone(c,x,y,w=25,fill='#fff0ba') {c.save();c.translate(x,y);c.rotate(-.5);c.fillStyle=fill;c.strokeStyle='#a67f48';c.lineWidth=1.5;rect(c,-w*.38,-w*.12,w*.76,w*.24,4,fill);for(const xx of SIDES)for(const yy of SIDES){c.beginPath();c.arc(xx*w*.36,yy*w*.12,w*.14,0,TAU);c.fill();}c.restore();}
function label(c,text,x,y,size=13,color='#fff4d7'){c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillStyle=color;c.strokeStyle='#133b3dcc';c.lineWidth=Math.max(3,size*.3);c.lineJoin='round';c.strokeText(text,x,y);c.fillText(text,x,y);}
const idPhase=id=>hash01(Number(String(id).replace(/\D/g,''))||0,7)*TAU;
const SIDES=[-1,1],VENT_STONES=[-1,-.35,.35,1],ROLL_LINES=[-.5,0,.5],LANTERN_RIBS=[-9,0,9];
// Things that sit still rather than bob.
const PLANTED=new Set(['enemy','block','goal','checkpoint','spring','chest','sign']);
const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;

// Shares the approved character atlas loader and Snack Storm renderer.
export class AdventureRenderer extends Renderer {
 constructor(canvas){super(canvas);this._stamps=new Map();this._glows=new Map();this.resetCamera();}
 resetCamera(){
  this.camera=0;this.cameraY=0;this.fx=[];this.popups=[];this.lastRunId='';this._snap=true;
  this.anim={sx:1,sy:1,spin:0,idle:0,stepTime:0,lead:0,trail:[],trailTime:0,keys:[],lastFacing:1};
  this.ghosts=[];this.bumps=new Map();this.raised=new Map();this._merge=null;this._compass=0;this._ventSpray=0;this._chainShown=1;
 }
 // Small pre-rendered sprites avoid per-frame shadows and gradients.
 stamp(key,w,h,draw){
  let s=this._stamps.get(key);if(s)return s;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*2);canvas.height=Math.ceil(h*2);const x=canvas.getContext('2d');x.scale(2,2);x.translate(w/2,h/2);draw(x);
  s={canvas,w,h};this._stamps.set(key,s);return s;
 }
 blit(c,s,x,y,scale=1,alpha=1){if(alpha<=0)return;const a=c.globalAlpha;c.globalAlpha=a*alpha;c.drawImage(s.canvas,x-s.w*scale/2,y-s.h*scale/2,s.w*scale,s.h*scale);c.globalAlpha=a;}
 // Looked up many times a frame, so a hit builds neither a key nor a closure.
 glow(color,r=40){
  let sizes=this._glows.get(color);if(!sizes)this._glows.set(color,sizes=new Map());
  let made=sizes.get(r);if(!made)sizes.set(r,made=this._glow(color,r));return made;
 }
 _glow(color,r){return this.stamp(`glow:${color}:${r}`,r*2,r*2,x=>{const g=x.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,color);g.addColorStop(1,color.slice(0,7)+'00');x.fillStyle=g;x.fillRect(-r,-r,r*2,r*2);});}

 // Engine events become motion, impact, and readable numbers.
 addAdventureEvent(e,run){
  const j=this.juice,p=run?.player,px=p?.x??e.x,py=p?(p.y-32):e.y,x=Number.isFinite(e.x)?e.x:px,y=Number.isFinite(e.y)?e.y:py,a=this.anim;
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  const big=size=>size/(this.viewScale||1);
  // Text anchored to the buddy stays inside the visible trail.
  const follow=p?()=>{const v=this._view;return {x:v?clamp(p.x,v.left+96/v.s,v.right-96/v.s):p.x,y:v?Math.max(p.y-32,v.top+((this.insets.top||0)+150)/v.s):p.y-32};}:null;
  const say=(text,dy,opts)=>follow?j.popup(text,0,dy,{...opts,follow}):j.popup(text,px,py+dy,opts);
  switch(e.type){
   case 'jump':j.burst('dust',x,y,{count:5});a.sx=.84;a.sy=1.2;break;
   case 'double-jump':j.ring(x,y-10,{color:'#dff7f4',radius:44,life:.32,width:3});j.burst('spark',x,y-6,{count:7,colors:['#dff7f4','#ffffff']});a.sx=.86;a.sy=1.18;a.spin=1;break;
   case 'land':{const hard=clamp(((e.speed||300)-250)/650,0,1);j.burst('land',x,y,{count:Math.round(4+hard*9),speed:.7+hard*.7});a.sx=1+.1+hard*.2;a.sy=1-.1-hard*.2;if(e.drop){j.shake(.22);j.kick(0,5);j.ring(x,y,{color:'#fff4d6',radius:70,life:.28,width:3});}else if(hard>.7)j.kick(0,3);break;}
   case 'collect':this._collectFx(e,x,y,big);break;
   case 'key':j.ring(x,y,{color:'#ffdc75',radius:64,life:.5,width:4});j.burst('gold',x,y,{count:10});j.popup(`KEY ${e.keys}/${e.requiredKeys}`,x,y-34,{color:'#ffe38c',size:big(17),life:1.4});break;
   case 'pickup':j.ring(x,y,{color:e.kind==='magnet'?'#a0e5d6':'#b1dfff',radius:58,life:.45,width:4});say(e.kind==='magnet'?'SNACK MAGNET':'SHIELD UP',-58,{color:'#dff7f4',size:big(14),life:1.2});break;
   case 'heal':j.burst('heart',px,py,{count:6});if(e.healed)say('+1 HEART',-58,{color:'#ffb4a3',size:big(14)});break;
   case 'stomp':case 'smash':{
    const chain=e.chain||1;j.burst('stomp',x,y,{count:chain>1?16:12});j.ring(x,y,{color:'#ffc972',radius:50+chain*6,life:.3,width:4});j.hitStop(e.kind==='boss'?.1:.065);j.shake(e.kind==='boss'?.4:.22);j.kick(0,4);
    j.popup(chain>1?`BOUNCE ×${chain}  +${e.value}`:`BOUNCE! +${e.value}`,x,y-40,{color:chain>1?tierColor(chain*3):'#ffc972',size:big(chain>1?19:16),life:1.1});
    if(e.hp<=0)this.ghosts.push({x,y,boss:e.kind==='boss',t:0});else j.flash('#ffffff',.18,.12);a.sx=.88;a.sy=1.14;break;}
   case 'pop':{const t=THEMES[e.skin||0].balloon,chain=e.chain||1;j.burst('confetti',x,y,{count:12,colors:[t[0],t[1],'#fff4d7']});j.ring(x,y,{color:t[0],radius:46,life:.28,width:3});j.hitStop(.035);a.sx=.88;a.sy=1.16;
    j.popup(chain>1?`POP ×${chain}`:'POP!',x,y-36,{color:chain>1?tierColor(chain*3):'#fff4d7',size:big(chain>1?19:15),life:.9});break;}
   case 'vent':j.burst(e.skin===2||e.skin===1?'poof':'splash',x,y,{count:16,speed:1.2});j.ring(x,y,{color:THEMES[e.skin||0].vent,radius:80,life:.4,width:4});j.kick(0,-6);j.popup('WHOOSH!',x,y-70,{color:'#e9fbff',size:big(18),life:.9});a.sx=.82;a.sy=1.24;break;
   case 'splash':j.burst(e.kind==='ravine'?'poof':'splash',x,y,{count:14});j.ring(x,y,{color:'#e4fbf5',radius:56,life:.35,width:3});break;
   case 'spring':this.bumps.set(`s${Math.round(x)}`,.3);j.ring(x,y,{color:'#ffd0c2',radius:52,life:.3,width:4});j.burst('spark',x,y,{count:8,spread:[Math.PI*1.2,Math.PI*1.8]});a.sx=.8;a.sy=1.28;break;
   case 'block':this.bumps.set(`b${Math.round(x)}`,.2);j.burst('crumb',x,y,{count:8});j.kick(0,-2);break;
   case 'crumble':j.burst('debris',x,y+8,{count:11});break;
   case 'marker':j.ring(x,y-10,{color:'#b8e994',radius:34,life:.4,width:3});j.burst('spark',x,y-14,{count:5,colors:['#b8e994','#fff4d7']});break;
   case 'chain-lost':if(e.combo>=12)say('CHAIN LOST',-66,{color:'#ffb4a3',size:big(13),life:.9});break;
   case 'hit':j.burst('hit',x,y,{count:16});j.shake(.6);j.hitStop(.09);j.flash('#ff6b57',.3,.3);a.sx=1.18;a.sy=.84;break;
   case 'shield':j.ring(x,y,{color:'#b7edff',radius:80,life:.45,width:5});j.burst('spark',x,y,{count:12,colors:['#b7edff','#ffffff']});j.popup('SHIELD SAVED YOU',x,y-52,{color:'#dff3ff',size:big(14),life:1.2});j.hitStop(.05);break;
   case 'respawn':j.burst('poof',x,y-30,{count:12});j.ring(x,y-30,{color:'#fff4d7',radius:60,life:.4,width:3});this._snap=true;break;
   case 'checkpoint':this.raised.set(Math.round(x),.6);j.burst('confetti',x,y-30,{count:14});j.ring(x,y,{color:'#b8e994',radius:70,life:.5,width:4});j.popup('CHECKPOINT',x,y-64,{color:'#d6f5b0',size:big(15),life:1.4});break;
   case 'secret-found':j.burst('gold',x,y,{count:12});j.ring(x,y,{color:'#ffe38c',radius:90,life:.6,width:3});j.popup('A SECRET!',x,y-44,{color:'#ffe38c',size:big(16),life:1.5});break;
   case 'secret':j.burst('gold',x,y,{count:18});break;
   case 'chest':j.burst('poof',x,y,{count:8});j.burst('star',x,y-10,{count:10});j.kick(0,-3);break;
   case 'power':j.ring(px,py,{color:'#fff2ab',radius:150,life:.5,width:6});j.burst('power',px,py,{count:24});j.flash('#fff2ab',.22,.28);j.zoomPunch(.05);a.sx=1.2;a.sy=1.2;break;
   case 'charged':j.ring(px,py,{color:'#fff2ab',radius:56,life:.5,width:3});break;
   case 'fever':j.flash('#ffb057',.2,.4);say('SNACK FRENZY ×2',-70,{color:'#ffb057',size:big(20),life:1.6});j.burst('star',px,py,{count:12});break;
   case 'gold-rush':say('GOLD RUSH ×2',-92,{color:'#ffd75e',size:big(19),life:1.4});break;
   case 'combo':if(e.multiplier<=(this._chainShown||1))break;this._chainShown=e.multiplier;say(`CHAIN ×${e.multiplier}`,-66,{color:tierColor(e.multiplier),size:big(17),life:1.1});j.ring(px,py,{color:tierColor(e.multiplier),radius:60,life:.35,width:3});break;
   case 'stack':say(e.total>=30?'MAX STACK 30×!':`${e.total}× STACK`,-112,{color:tierColor(e.total),size:big(e.total>=30?26:21),life:1.6});j.burst(e.total>=10?'gold':'star',px,py-20,{count:e.total>=30?40:16});if(e.total>=10)j.zoomPunch(.04);if(e.total>=30){j.flash('#ffd75e',.3,.5);j.slowMo(.45,.5);}break;
   case 'boss-defeated':j.slowMo(.3,.9);j.shake(.7);j.burst('confetti',x,y,{count:40});j.burst('gold',x,y,{count:24});j.flash('#ffffff',.35,.4);break;
   case 'locked':this._compass=6;j.popup(e.keys<e.requiredKeys?`${e.requiredKeys-e.keys} KEY${e.requiredKeys-e.keys===1?'':'S'} TO GO`:'BOUNCE THE BOSS FIRST',x,y-140,{color:'#ffe38c',size:big(16),life:1.8});break;
   case 'won':j.slowMo(.35,.8);j.burst('confetti',px,py-30,{count:44});j.burst('gold',px,py,{count:20});j.flash('#fff4d7',.25,.5);break;
   case 'lost':j.shake(.5);break;
   case 'restore':case 'start':this._snap=true;break;
  }
 }
 // Many treats can arrive in one frame (a chest pays twelve). Merge their
 // numbers into one readable popup at that spot.
 _collectFx(e,x,y,big){
  const j=this.juice,total=e.totalMultiplier||1;
  if(e.kind==='gold'){j.burst('gold',x,y,{count:14});j.ring(x,y,{color:'#ffd75e',radius:70,life:.45,width:4});j.hitStop(.04);}
  else if(e.kind==='bone')j.burst('crumb',x,y,{count:total>=5?5:3,colors:total>=5?['#ffd75e','#fff0a8']:undefined});
  else if(e.kind==='heart')j.burst('heart',x,y,{count:5});
  if((e.multiplier||1)<(this._chainShown||1))this._chainShown=e.multiplier||1;
  if(!e.value)return;
  const m=this._merge,now=j.clock;
  if(m&&m.popup.life>0&&now-m.at<.12&&Math.abs(m.x-x)<2&&Math.abs(m.y-y)<2){m.value+=e.value;m.popup.text=`+${m.value}`;m.popup.size=big(Math.min(24,13+Math.log10(m.value)*3));return;}
  const popup=j.popup(`+${e.value}`,x,y-22,{color:e.kind==='gold'?'#ffd75e':tierColor(total),size:big(e.kind==='gold'?19:total>=5?15:12),life:e.kind==='gold'?1.1:.7,rise:54});
  if(popup)this._merge={x,y,at:now,value:e.value,popup};
 }

 // Legacy palette backdrop. Trail Scout still calls this.
 background(c,theme,camera,time,w,h){
  const p=palettes[theme]||palettes[0],g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,p.sky);g.addColorStop(1,p.light);c.fillStyle=g;c.fillRect(0,0,w,h);
  c.fillStyle=theme===3?'#ffefbd':'#fff2bf';c.beginPath();c.arc(w*.79,h*.2,theme===3?26:38,0,TAU);c.fill();
  if(theme===3){c.fillStyle=p.sky;c.beginPath();c.arc(w*.79+10,h*.2-6,25,0,TAU);c.fill();for(let i=0;i<46;i++){c.fillStyle='#fff4d8';c.globalAlpha=.4+(i%4)*.15;c.beginPath();c.arc((i*177.7+19)%w,(i*67.2+24)%(h*.6),i%5?1:2,0,TAU);c.fill();}c.globalAlpha=1;}
  else for(let i=0;i<6;i++){const x=((i*263-camera*.13)%(w+300)+w+300)%(w+300)-150,y=42+(i%3)*48;c.fillStyle='#fffcdf99';for(let k=0;k<3;k++){c.beginPath();c.ellipse(x+k*28,y-(k===1?10:0),37,16+k%2*5,0,0,TAU);c.fill();}}
  for(let layer=0;layer<3;layer++){c.fillStyle=p.hill;c.globalAlpha=.22+layer*.15;const shift=camera*(.08+layer*.07),step=theme===2?300:390,base=h*(.58+layer*.08);c.beginPath();c.moveTo(-100,h);for(let i=-1;i<w/step+3;i++){const x=i*step-shift%step;if(theme===2){c.lineTo(x,base);c.lineTo(x+step*.2,base-100-layer*25);c.lineTo(x+step*.55,base-100-layer*25);c.lineTo(x+step*.75,base);}else{c.quadraticCurveTo(x+step*.5,base-130-layer*22,x+step,base);}}c.lineTo(w+100,h);c.fill();}c.globalAlpha=1;
  if(theme===1)for(let i=0;i<10;i++){const x=((i*191-camera*.28)%(w+250)+w+250)%(w+250)-125;c.fillStyle='#344e3935';rect(c,x,h*.2,20,h*.8,9,c.fillStyle);for(let k=0;k<4;k++){c.beginPath();c.ellipse(x+10,h*.25+k*48,80-k*8,39,0,0,TAU);c.fill();}}
  return p;
 }

 // Painted, layered backdrop in screen space. `ground` is the screen y of the trail.
 backdrop(c,index,T,camX,camY,ground,w,h){
  const t=this.time,key=`${index}:${Math.round(h)}`;
  if(this._skyKey!==key){const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,T.sky[0]);g.addColorStop(.75,T.sky[1]);g.addColorStop(1,T.sky[1]);this._sky=g;this._skyKey=key;}
  c.fillStyle=this._sky;c.fillRect(0,0,w,h);
  const night=index===3,sx=w*(night?.24:.78)-camX*.012,sy=Math.max(54,ground*.2)-camY*.02;
  if(night||!this.biomes){this.blit(c,this.glow(night?'#c9d4ff':'#fff6c9',90),sx,sy,1.5,night?.5:.85);c.fillStyle=T.sun;c.beginPath();c.arc(sx,sy,night?22:30,0,TAU);c.fill();}
  if(night){
   c.fillStyle=T.sky[0];c.beginPath();c.arc(sx+9,sy-6,21,0,TAU);c.fill();
   c.fillStyle='#fff4d8';for(let i=0;i<64;i++){const span=w+80,x=((hash01(i,1)*span-camX*.02)%span+span)%span-40,y=hash01(i,2)*ground*.82,tw=.35+.65*Math.abs(Math.sin(t*(.6+hash01(i,3))+i));c.globalAlpha=tw*(i%7?.7:1);const r=i%9?1.3:2.2;c.fillRect(x,y,r,r);}
   c.globalAlpha=1;
   // A shooting star crosses every few seconds.
   const cycle=(t*.21)%1,which=Math.floor(t*.21);if(cycle<.16&&!this.reducedMotion){const u=cycle/.16,x0=hash01(which,5)*w*.8+w*.1,y0=hash01(which,6)*ground*.35+20;c.strokeStyle='#fff4d8';c.globalAlpha=1-u;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(x0+u*150,y0+u*60);c.lineTo(x0+u*150-46,y0+u*60-18);c.stroke();c.globalAlpha=1;}
  }
  if(this.biomes){
   const im=this.biomes,sw=im.width/2,sh=im.height/2,tileH=Math.max(h,(ground+40)/.7),tileW=tileH*1.02,top=Math.min(0,ground-tileH*.7-camY*.06),shift=((camX*.1)%(tileW*2)+tileW*2)%(tileW*2);
   // Tiles overlap by a pixel, so they are drawn solid; night dims them once afterwards.
   c.save();
   for(let n=-1;n<Math.ceil(w/tileW)+2;n++){const x=n*tileW-shift;c.save();c.translate(x,top);if(n%2!==0){c.translate(tileW,0);c.scale(-1,1);}c.drawImage(im,(T.image%2)*sw+1,Math.floor(T.image/2)*sh+1,sw-2,sh-2,0,0,tileW+1,tileH);c.restore();}
   c.restore();
   if(night){c.globalAlpha=.5;c.fillStyle=this._sky;c.fillRect(0,0,w,h);c.globalAlpha=1;}
   if(T.tint){c.fillStyle=T.tint;c.fillRect(0,0,w,h);}
  }else this.background(c,index,camX,t,w,h);
  if(!night&&!this.reducedMotion)for(let i=0;i<4;i++){const span=w+360,x=((hash01(i,9)*span-camX*.05-t*(6+i*3))%span+span)%span-180,y=30+hash01(i,10)*ground*.3,sc=.7+hash01(i,11)*.7;c.fillStyle=index===1?'#f4f6dc59':'#ffffff73';for(let k=0;k<3;k++){c.beginPath();c.ellipse(x+k*30*sc,y-(k===1?11*sc:0),40*sc,17*sc+(k%2)*5,0,0,TAU);c.fill();}}
  // Built once per world in its own space, then slid to wherever the ground is.
  if(this._hazeKey!==index){const g=c.createLinearGradient(0,0,0,280);g.addColorStop(0,T.haze.slice(0,7)+'00');g.addColorStop(1,T.haze.slice(0,7)+'8c');this._haze=g;this._hazeKey=index;}
  c.save();c.translate(0,ground-260);c.fillStyle=this._haze;c.fillRect(0,0,w,h+260);c.restore();
  // A closer silhouette layer gives the eye something that moves faster.
  c.fillStyle=T.mid;const step=index===1?210:index===2?340:260,off=camX*.34;
  for(let i=Math.floor(off/step)-1;i<(off+w)/step+1;i++){
   const x=i*step-off+hash01(i,20)*step*.5,r=hash01(i,21),base=ground+8;c.globalAlpha=T.midAlpha;
   if(index===1){const tw=30+r*26;c.fillRect(x,-10,tw,base+10);c.fillRect(x-7,base-14,tw+14,22);c.globalAlpha=T.midAlpha*.45;c.fillRect(x+tw*.62,-10,tw*.16,base);c.globalAlpha=T.midAlpha;for(let k=0;k<3;k++){const by=base*(.18+k*.24)+r*30,dir=(i+k)%2?1:-1;c.beginPath();c.moveTo(x+tw/2,by);c.lineTo(x+tw/2+dir*(70+r*40),by-18);c.lineTo(x+tw/2+dir*(60+r*30),by+4);c.fill();}}
   else if(index===2||index===3){const mw=120+r*150,mh=90+r*150;c.beginPath();c.moveTo(x,base);c.lineTo(x+mw*.1,base-mh);c.lineTo(x+mw*.42,base-mh-10);c.lineTo(x+mw*.5,base-mh*.72);c.lineTo(x+mw*.82,base-mh*.7);c.lineTo(x+mw,base);c.fill();if(index===3&&r>.45){const cx=x+mw+50,ch=70+r*50;c.fillRect(cx,base-ch,12,ch);c.fillRect(cx-16,base-ch*.62,16,9);c.fillRect(cx-16,base-ch*.8,9,ch*.2);c.fillRect(cx+12,base-ch*.5,15,9);c.fillRect(cx+19,base-ch*.72,9,ch*.24);}}
   else{const th=110+r*120,tw=index===4?130+r*60:70+r*30;if(index===4){c.fillRect(x+tw/2-9,base-th*.55,18,th*.55);c.beginPath();c.ellipse(x+tw/2,base-th*.66,tw*.62,th*.32,0,0,TAU);c.ellipse(x+tw*.2,base-th*.52,tw*.36,th*.2,0,0,TAU);c.ellipse(x+tw*.82,base-th*.54,tw*.34,th*.2,0,0,TAU);c.fill();}else{c.fillRect(x+tw/2-5,base-th*.3,10,th*.3);for(let k=0;k<4;k++){c.beginPath();c.moveTo(x+tw/2,base-th+k*th*.17);c.lineTo(x+tw/2+tw*(.22+k*.1),base-th*.72+k*th*.19);c.lineTo(x+tw/2-tw*(.22+k*.1),base-th*.72+k*th*.19);c.fill();}}}
  }
  c.globalAlpha=1;
 }

 drawPlatform(run,{time=0,dt=0,reducedMotion=false,insets}={}){
  this.reducedMotion=reducedMotion;this.time=reducedMotion?0:time;const j=this.juice;j.reducedMotion=reducedMotion;j.update(dt);
  const c=this.begin(),w=this.width,h=this.height,ins=insets||this.insets,index=run.worldIndex||0,T=THEMES[index]||THEMES[0],t=this.time,player=run.player,a=this.anim;
  // --- camera -------------------------------------------------------
  const portrait=h>w*1.05,s=portrait?clamp(w/470,.66,1.2):h/(h<470?500:560),viewW=w/s,viewH=h/s;
  const groundScreen=h-Math.max((ins.bottom||0)+26,h*.12),restTop=480-groundScreen/s;
  if(player.facing!==a.lastFacing||Math.abs(player.vx)>40)a.lead+=((player.facing||1)-a.lead)*(1-Math.exp(-dt*2.4));a.lastFacing=player.facing;
  const lead=reducedMotion?0:a.lead*(portrait?.15:.12),targetX=clamp(player.x-viewW*(.5-lead),0,Math.max(0,run.width-viewW));
  const headRoom=((ins.top||0)+48)/s,targetY=clamp(Math.min(restTop,player.y-64-headRoom),-320,restTop);
  if(this.lastRunId!==run.runId||this._snap){this.camera=targetX;this.cameraY=targetY;this.lastRunId=run.runId;this._snap=false;a.trail.length=0;a.keys.length=0;}
  else{this.camera+=(targetX-this.camera)*(1-Math.exp(-dt*7));this.cameraY+=(targetY-this.cameraY)*(1-Math.exp(-dt*(targetY<this.cameraY?6:3)));}
  const camX=this.camera,camY=this.cameraY,o=j.offset;this.viewScale=s;this.viewOffsetY=-camY*s;
  const sx=x=>(x-camX)*s,sy=y=>(y-camY)*s;this._view={left:camX,right:camX+viewW,top:camY,s};
  // Labels never hide beneath the HUD band.
  j.ceiling=camY+((ins.top||0)+4)/s;
  // --- backdrop -----------------------------------------------------
  c.save();c.translate(w/2,h/2);c.rotate(o.rot);c.scale(o.zoom,o.zoom);c.translate(-w/2+o.x,-h/2+o.y);
  this.backdrop(c,index,T,camX*s,camY*s,sy(480),w,h);
  c.save();c.translate(-camX*s,-camY*s);c.scale(s,s);
  const left=camX-120,right=camX+viewW+160,bottom=camY+viewH+40;
  // Water, or a shadowed ravine, fills every gap.
  this.water(c,index,T,camX,viewW,bottom,t);
  for(const e of run.entities||[])if(e.type==='vent'&&e.x>left&&e.x<right)this.vent(c,e,T,t,dt);
  // --- platforms ----------------------------------------------------
  for(const platform of run.platforms||[]){
   if(platform.active===false||platform.x+platform.w<left||platform.x>right||platform.type==='block')continue;
   this.platform(c,platform,index,T,t,bottom,run);
  }
  // --- entities -----------------------------------------------------
  for(const e of run.entities||[]){if(e.taken||e.dead||e.type==='vent'||(e.secret&&!e.revealed)||e.x<left||e.x>right)continue;this.platformEntity(c,e,T,run);}
  for(const g of this.ghosts){g.t+=dt;const u=clamp(g.t/.34,0,1),r=g.boss?38:22;c.save();c.translate(g.x,g.y+r*.8);c.scale(1+u*.5,Math.max(.12,1-u*1.6));c.globalAlpha=1-u;rect(c,-r,-r*1.65,r*2,r*1.65,12,g.boss?'#9d658a':'#c17356');c.restore();}
  this.ghosts=this.ghosts.filter(g=>g.t<.34);
  for(const [key,value] of this.bumps){const rest=value-dt;if(rest<=0)this.bumps.delete(key);else this.bumps.set(key,rest);}
  for(const [key,value] of this.raised){const rest=value-dt;if(rest<=0)this.raised.delete(key);else this.raised.set(key,rest);}
  // --- player -------------------------------------------------------
  this.hero(c,run,dt,T);
  j.draw(c);
  c.restore();
  // --- foreground and overlays (screen space) -------------------------
  this.ambient(c,T,camX*s,w,h,t,sy(480));
  if(index===3)this.blit(c,this.glow('#ffe9b0',120),sx(player.x),sy(player.y-34),1.6*s,.2);
  this.overlays(c,run,dt,w,h,t,sx,sy);
  c.restore();
  j.drawOverlay(c,w,h);
 }

 water(c,index,T,camX,viewW,bottom,t){
  const x0=camX-40,width=viewW+80,top=506;
  if(index===2){c.fillStyle=T.water[1];c.fillRect(x0,top-22,width,bottom-top+22);c.fillStyle=T.water[0];c.fillRect(x0,top-22,width,60);c.strokeStyle='#a5633f66';c.lineWidth=3;for(let k=0;k<3;k++){c.beginPath();c.moveTo(x0,top+10+k*26);c.lineTo(x0+width,top+16+k*26);c.stroke();}return;}
  c.fillStyle=T.water[1];c.fillRect(x0,top,width,bottom-top);
  c.fillStyle=T.water[0];c.beginPath();c.moveTo(x0,bottom);const start=Math.floor(x0/28)*28;
  for(let x=start;x<=x0+width+28;x+=28)c.lineTo(x,top+Math.sin(x*.045+t*2.2)*4+Math.sin(x*.021-t*1.3)*3);
  c.lineTo(x0+width+28,top+46);c.lineTo(x0,top+46);c.closePath();c.fill();
  c.strokeStyle=T.foam;c.lineWidth=2.5;c.globalAlpha=.75;c.beginPath();
  for(let x=start;x<=x0+width+28;x+=28){const y=top+Math.sin(x*.045+t*2.2)*4+Math.sin(x*.021-t*1.3)*3;if(x===start)c.moveTo(x,y);else c.lineTo(x,y);}
  c.stroke();c.globalAlpha=.5;c.lineWidth=2;
  for(let i=Math.floor(x0/90);i<(x0+width)/90;i++){const x=i*90+((t*22+hash01(i,30)*90)%90),y=top+18+hash01(i,31)*34;c.beginPath();c.moveTo(x,y);c.lineTo(x+16+hash01(i,32)*14,y);c.stroke();}
  c.globalAlpha=1;
  if(index===3){c.fillStyle='#fff4d8';for(let i=Math.floor(x0/70);i<(x0+width)/70;i++){c.globalAlpha=.25+.5*Math.abs(Math.sin(t*1.4+i*1.7));c.fillRect(i*70+hash01(i,33)*60,top+12+hash01(i,34)*50,2,2);}c.globalAlpha=1;}
 }

 // Vents rest as a ring of stones, bubble before they blow, then stand tall.
 vent(c,e,T,t,dt){
  const period=e.period||4,cycle=e.cycle??0,active=cycle<e.duty,u=active?cycle/e.duty:0,strength=active?Math.min(1,u/.14,(1-u)/.2):0,warn=!active&&(1-cycle)*period<.7,color=T.vent,half=e.w*.32;
  c.fillStyle='#00000026';c.beginPath();c.ellipse(e.x,512,e.w*.5,7,0,0,TAU);c.fill();
  c.fillStyle=T.soilDark;for(const k of VENT_STONES){c.beginPath();c.ellipse(e.x+k*e.w*.42,514,11,7,0,0,TAU);c.fill();}
  if(warn&&!this.reducedMotion){c.fillStyle=color;for(let i=0;i<5;i++){const ph=(t*2.2+i*.37)%1;c.globalAlpha=1-ph;c.beginPath();c.arc(e.x+(hash01(i,40)-.5)*e.w*.6,512-ph*26,2+hash01(i,41)*3,0,TAU);c.fill();}c.globalAlpha=1;}
  if(strength>0){
   const height=190*strength,top=506-height,wob=this.reducedMotion?0:Math.sin(t*26)*3;
   if(e.skin===1||e.skin===2||e.skin===3){
    // A spinning column of leaves, dust, or starlight.
    c.strokeStyle=color;c.lineCap='round';
    for(let i=0;i<9;i++){const u=i/8,y=506-height*u,rx=half*(.45+u*.9),sway=this.reducedMotion?0:Math.sin(t*9+i*1.1)*rx*.35;c.globalAlpha=.8-u*.3;c.lineWidth=5-u*2;c.beginPath();c.ellipse(e.x+sway,y,rx,5+u*4,0,0,TAU);c.stroke();}
    c.globalAlpha=.24;rect(c,e.x-half*.8,top,half*1.6,height+30,half*.8,color);c.globalAlpha=1;
   }else{
    c.globalAlpha=.34;rect(c,e.x-half-8+wob,top+10,half*2+16,height+40,half,color);
    c.globalAlpha=.72;rect(c,e.x-half*.62-wob,top,half*1.24,height+40,half*.6,color);
    c.globalAlpha=.9;rect(c,e.x-half*.2,top+12,half*.4,height,half*.2,'#ffffff');c.globalAlpha=1;
   }
   this._ventSpray-=dt;if(this._ventSpray<=0&&dt>0&&!this.reducedMotion){this._ventSpray=.05;this.juice.emit({x:e.x+(Math.random()-.5)*half*2,y:top+6,vx:(Math.random()-.5)*150,vy:-90-Math.random()*150,gravity:520,life:.55,size:2.5+Math.random()*2.5,color,shape:'dot'});}
  }
 }

 platform(c,p,index,T,t,bottom,run){
  const {x,y,w:pw,type}=p,ground=type==='ground',ph=ground?Math.max(p.h,bottom-y):p.h;
  c.save();
  if(type==='crumble'&&p.crumbleTimer>0&&!this.reducedMotion)c.translate(Math.sin(this.time*80)*2.2,Math.cos(this.time*67)*1.2);
  if(ground){
   rect(c,x,y,pw,ph,6,T.soil);c.fillStyle=T.soilDark;c.fillRect(x,y+34,pw,ph-34);
   for(let i=Math.floor(x/64);i*64<x+pw;i++){const px=i*64+hash01(i,50)*40;if(px>x+6&&px<x+pw-34)rect(c,px,y+46+hash01(i,51)*40,14+hash01(i,52)*16,5,2,'#00000018');}
   rect(c,x-2,y-3,pw+4,15,7,T.turf);c.fillStyle=T.turfLight;c.fillRect(x+3,y-1,pw-6,3);
   this.tufts(c,x,y,pw,index,T,t);
  }else if(type==='moving'){
   if(!this.reducedMotion){c.strokeStyle='#ffffff40';c.lineWidth=2;c.setLineDash([4,7]);c.beginPath();if(p.axis==='y'){c.moveTo(p.originX+pw/2,p.originY-p.range+12);c.lineTo(p.originX+pw/2,p.originY+p.range+12);}else{c.moveTo(p.originX-p.range+pw/2,p.originY+12);c.lineTo(p.originX+p.range+pw/2,p.originY+12);}c.stroke();c.setLineDash([]);}
   this.blit(c,this.glow('#b5f0e6',40),x+pw/2,y+16,2.2,.3+.12*Math.sin(t*4));
   rect(c,x,y,pw,ph,9,'#3f8f95','#245a5f');rect(c,x+4,y+1,pw-8,6,3,'#bdeee2');c.fillStyle='#e2fbf0';for(let xx=x+16;xx<x+pw-8;xx+=26){c.beginPath();c.arc(xx,y+ph*.62,3,0,TAU);c.fill();}
  }else if(type==='crumble'){
   rect(c,x,y,pw,ph,5,'#c8b29b');rect(c,x-1,y-2,pw+2,10,5,'#e2d0ae');c.strokeStyle='#846c59';c.lineWidth=2;c.beginPath();c.moveTo(x+pw*.3,y+3);c.lineTo(x+pw*.38,y+ph*.55);c.lineTo(x+pw*.3,y+ph);c.moveTo(x+pw*.66,y+3);c.lineTo(x+pw*.6,y+ph*.6);c.lineTo(x+pw*.7,y+ph);c.stroke();
  }else if(type==='bridge'){
   c.strokeStyle='#6b4a32';c.lineWidth=3;c.beginPath();c.moveTo(x,y+6);c.quadraticCurveTo(x+pw/2,y+16,x+pw,y+6);c.stroke();for(let xx=x+4;xx<x+pw-10;xx+=22)rect(c,xx,y,18,ph-6,3,'#b98a5b','#7d5a3c');
  }else{
   const secret=type==='secret';
   rect(c,x,y+4,pw,ph-4,7,secret?'#b98f3e':T.ledge);c.fillStyle='#00000022';c.fillRect(x+4,y+ph-7,pw-8,5);
   rect(c,x-2,y-2,pw+4,11,6,secret?'#ffe38c':T.ledgeTop);c.fillStyle='#ffffff40';c.fillRect(x+4,y,pw-8,2.5);
   if(secret&&!this.reducedMotion){for(let i=0;i<4;i++){const ph2=(t*.9+i*.25)%1;c.globalAlpha=Math.sin(ph2*Math.PI);star(c,x+12+hash01(i,60)*(pw-24),y-6-ph2*18,4,'#fff6c9',t);}c.globalAlpha=1;}
   else if(index!==2)for(let i=0;i<3;i++){const hx=x+10+hash01(Math.round(x)+i,61)*(pw-20);c.fillStyle=T.ledgeTop;c.fillRect(hx,y+8,3,5+hash01(Math.round(x)+i,62)*9);}
  }
  c.restore();
 }
 // Grass, flowers, and world details along the top of the trail.
 tufts(c,x,y,pw,index,T,t){
  const sway=this.reducedMotion?0:1;
  for(let i=Math.ceil((x+8)/30);i*30<x+pw-8;i++){
   const gx=i*30+hash01(i,70)*14,r=hash01(i,71),bend=sway*Math.sin(t*1.8+i*.9)*2.2;
   if(r<.5){c.strokeStyle=r<.25?T.turf:T.turfLight;c.lineWidth=2;c.lineCap='round';const hgt=6+r*16;c.beginPath();c.moveTo(gx-3,y);c.lineTo(gx-4+bend,y-hgt*.8);c.moveTo(gx,y);c.lineTo(gx+bend,y-hgt);c.moveTo(gx+3,y);c.lineTo(gx+5+bend,y-hgt*.7);c.stroke();}
   else if(r<.62){
    if(index===2){rect(c,gx-3,y-16,6,16,3,'#5f8f55');rect(c,gx-9,y-11,5,4,2,'#5f8f55');rect(c,gx+4,y-13,5,4,2,'#5f8f55');}
    else if(index===4){c.fillStyle='#4f8a3c';c.fillRect(gx-1,y-12,2,12);c.fillStyle=T.flower;for(let k=0;k<4;k++){c.beginPath();c.arc(gx+bend*.6+(k%2?2:-2),y-12-k*3.4,2.6-k*.3,0,TAU);c.fill();}c.fillStyle='#ffffff';c.beginPath();c.arc(gx+bend*.6,y-24,1.4,0,TAU);c.fill();}
    else if(index===1){c.fillStyle='#f3ead2';c.fillRect(gx-1.5,y-7,3,7);c.fillStyle=T.flower;c.beginPath();c.ellipse(gx,y-8,7,4.5,0,Math.PI,TAU);c.fill();}
    else if(index===3){this.blit(c,this.glow(T.flower,14),gx,y-8,1,.5+.4*Math.sin(t*2+i));c.fillStyle=T.flower;c.beginPath();c.arc(gx,y-8,2.4,0,TAU);c.fill();}
    else{c.fillStyle='#4f8a3c';c.fillRect(gx-1,y-10,2,10);c.fillStyle=T.flower;c.beginPath();c.arc(gx+bend*.5,y-11,3.4,0,TAU);c.fill();c.fillStyle='#fff8e0';c.beginPath();c.arc(gx+bend*.5,y-11,1.3,0,TAU);c.fill();}
   }else if(r>.9){c.fillStyle='#00000022';c.beginPath();c.ellipse(gx,y-1,8,4,0,0,TAU);c.fill();c.fillStyle=index===3?'#8f86a8':'#c9c2b1';c.beginPath();c.ellipse(gx,y-3,7,5,0,0,TAU);c.fill();}
  }
 }

 treat(c,x,y,width,rot=0){if(!this.prop(c,'biscuit',x,y,width,{rotate:rot-.45}))bone(c,x,y,width*.8);}
 platformEntity(c,e,T,run){
  const t=this.time,still=this.reducedMotion,phase=e._phase??=idPhase(e.id),bob=still||PLANTED.has(e.type)?0:Math.sin(t*3+phase)*3;
  const x=e.x,y=e.y+bob,w=e.w||32,h=e.h||32,s=this.viewScale||1;
  c.save();
  if(e.type==='bone'){if(e.rain){
    // Shower treats fade in, streak while they fall, and settle once they land.
    const fade=clamp((e.age??1)/.3,0,1),falling=e.floor===undefined||e.y<e.floor;
    if(falling){c.globalAlpha=.5*fade;c.strokeStyle='#fff4d7';c.lineWidth=2;c.beginPath();c.moveTo(x,y-10);c.lineTo(x,y-34);c.stroke();}
    c.globalAlpha=fade;this.treat(c,x,falling?y:e.y,30,still||!falling?0:t*5+phase);c.globalAlpha=1;}else this.treat(c,x,y,30,still?0:Math.sin(t*2+phase)*.18);}
  else if(e.type==='gold'){this.blit(c,this.glow('#ffd75e',44),x,y,1+.12*Math.sin(t*4),.85);star(c,x,y,25,'#e7ac35',t*.5);star(c,x,y,17,'#ffe68c',t*.5);if(!this.prop(c,'chicken',x,y,30,{rotate:-.3}))bone(c,x,y,21,'#fff5c0');}
  else if(e.type==='key'){this.blit(c,this.glow('#ffdc75',34),x,y,1,.7+.2*Math.sin(t*5));c.translate(x,y);c.rotate(still?0:Math.sin(t*2+phase)*.2);c.strokeStyle='#8c6232';c.lineWidth=3;c.fillStyle='#ffdc75';c.beginPath();c.arc(-8,-5,9,0,TAU);c.fill();c.stroke();c.fillStyle='#fff6c9';c.beginPath();c.arc(-8,-5,3.4,0,TAU);c.fill();rect(c,0,-8,20,6,2,'#ffdc75','#8c6232');rect(c,12,-2,5,8,1,'#ffdc75','#8c6232');}
  else if(e.type==='block'){
   const used=e.used||e.empty,bump=this.bumps.get(`b${Math.round(x)}`),lift=bump?-Math.sin((1-bump/.2)*Math.PI)*10:0,by=y+lift;
   if(!used)this.blit(c,this.glow('#ffe38c',40),x,by,1.1,.35+.15*Math.sin(t*3+phase));
   rect(c,x-w/2,by-h/2,w,h,7,used?'#9b876e':'#efbd55',used?'#695f50':'#b37a31');rect(c,x-w/2+5,by-h/2+5,w-10,h-10,4,null,used?'#bba68b':'#ffe8a2');
   if(!used){c.fillStyle='#fff6ce';c.font='900 28px system-ui';c.textAlign='center';const wob=still?0:Math.sin(t*3+phase)*2;c.fillText('?',x,by+10+wob);}
   for(const k of SIDES){c.fillStyle='#88643f';c.beginPath();c.arc(x+k*(w/2-6),by+h/2-6,2,0,TAU);c.fill();}
  }
  else if(e.type==='spring'){
   const bump=this.bumps.get(`s${Math.round(x)}`),press=bump?Math.sin((1-bump/.3)*Math.PI):0,top=y-7-press*12;
   c.strokeStyle='#f5e9b5';c.lineWidth=4;c.beginPath();for(let i=0;i<5;i++)c.lineTo(x+(i%2?12:-12),lerp(top+9,y+16,i/4));c.stroke();
   rect(c,x-24,top,48,12,6,'#eb7a66','#925249');rect(c,x-20,y+17,40,5,2,'#526d5d');
  }
  else if(e.type==='enemy')this.bandit(c,e,x,y,h,t);
  else if(e.type==='checkpoint'){
   const on=e.active||e.activated,raise=this.raised.get(Math.round(x)),up=on?1-(raise?raise/.6:0):0,flagY=lerp(y+h/2-30,y-h/2,ease.outBack(clamp(up,0,1))),wave=still?0:Math.sin(t*6)*3;
   c.strokeStyle='#6d694f';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(x,y+h/2);c.lineTo(x,y-h/2);c.stroke();
   if(on)this.blit(c,this.glow('#b8e994',40),x+16,flagY+12,1,.4);
   c.fillStyle=on?'#8fd96a':'#f9dd8b';c.beginPath();c.moveTo(x,flagY);c.quadraticCurveTo(x+20,flagY+2+wave,x+38,flagY+12);c.quadraticCurveTo(x+20,flagY+16-wave,x,flagY+24);c.fill();
   c.fillStyle='#fff6c9';c.beginPath();c.arc(x,y-h/2-3,5,0,TAU);c.fill();
  }
  else if(e.type==='chest'){
   const near=run.interaction?.id===e.id,hop=near&&!still?Math.abs(Math.sin(t*6))*4:0;
   if(e.secret||near)this.blit(c,this.glow('#ffe38c',52),x,y,1.1,.5+.2*Math.sin(t*4));
   rect(c,x-25,y-18-hop,50,36,5,'#a27047','#5e4937');rect(c,x-26,y-20-hop,52,14,5,'#d4a863','#5e4937');rect(c,x-4,y-8-hop,8,12,2,'#ffe392');
   if(near&&!coarse())label(c,'E · OPEN',x,y-34-hop,12/s);
  }
  else if(e.type==='sign'){rect(c,x-3,y+9,6,36,2,'#87694c');c.translate(x,y);c.rotate(run.interaction?.id===e.id&&!still?Math.sin(t*5)*.05:0);rect(c,-24,-18,48,32,6,'#f0d69d','#93724c');c.fillStyle='#45624c';c.font='900 22px system-ui';c.textAlign='center';c.fillText('→',0,7);}
  else if(e.type==='goal')this.goal(c,e,x,y,h,run,t);
  else if(e.type==='balloon')this.balloon(c,e,x,y,T,t,phase);
  else if(e.type==='marker'){rect(c,x-3,y-6,6,24,2,'#87694c');if(e.active)this.blit(c,this.glow('#b8e994',22),x,y-12,1,.7);rect(c,x-11,y-22,22,18,5,e.active?'#b8e994':'#f0d69d','#93724c');c.fillStyle='#45624c';for(const [px,py,r] of [[0,-10,3.4],[-5,-15,1.7],[0,-17,1.7],[5,-15,1.7]]){c.beginPath();c.arc(x+px,y+py,r,0,TAU);c.fill();}}
  else {
   const colors={heart:'#ffbda9',shield:'#b1dfff',magnet:'#a0e5d6'},color=colors[e.type]||'#f4d487',pulse=still?1:1+Math.sin(t*4+phase)*.06;
   this.blit(c,this.glow(color,36),x,y,1.1,.7);c.fillStyle=color;c.strokeStyle='#fff3c8';c.lineWidth=2.5;c.beginPath();c.arc(x,y,19*pulse,0,TAU);c.fill();c.stroke();c.fillStyle='#315957';c.font='900 20px system-ui';c.textAlign='center';c.fillText({heart:'♥',shield:'◆',magnet:'U'}[e.type]||'★',x,y+7);
  }
  c.restore();
 }
 bandit(c,e,x,y,h,t){
  const boss=e.subtype==='boss',kind=e.subtype,r=boss?38:22,still=this.reducedMotion,step=still?0:Math.sin(t*10+x*.02),hurt=e.hurtTime>0,dir=e.vx<0?-1:1,air=e.airborne||kind==='floater';
  const floorY=(e.baseY??e.y)+h/2,lift=clamp((floorY-(y+h/2))/160,0,1),squash=air?1.08:1+step*.05;
  c.fillStyle='#203b31';c.globalAlpha=.23*(1-lift*.6);c.beginPath();c.ellipse(x,floorY,(r+5)*(1-lift*.4),6,0,0,TAU);c.fill();c.globalAlpha=1;
  c.translate(x,y+h/2);
  if(kind==='floater'){
   // Little wings keep this one bobbing.
   const flap=still?.3:Math.sin(t*22)*.5;c.fillStyle='#fff0d2';for(const side of SIDES){c.save();c.translate(side*r*.8,-h*.62);c.rotate(side*(-.5+flap));c.beginPath();c.ellipse(side*10,0,13,6,0,0,TAU);c.fill();c.restore();}
  }
  if(kind==='roller'&&!still){c.translate(0,-h/2);c.rotate(dir*t*7);c.translate(0,h/2);}
  c.scale(1/squash,squash);c.translate(0,-h/2);
  if(kind!=='roller')for(const side of SIDES)rect(c,side*r*.62-7,r*.5+(air?5:side*step>0?-3:0),14,air?13:10,4,'#5d4c40');
  const body=hurt&&Math.floor(t*14)%2?'#fff0d2':boss?'#9d658a':kind==='hopper'?'#c98a4e':kind==='roller'?'#a9886a':kind==='floater'?'#b77a8c':'#c17356';
  rect(c,-r,-r,r*2,kind==='roller'?r*2:r*1.65,kind==='roller'?r:13,body,'#684844');
  if(kind==='roller'){c.strokeStyle='#68484466';c.lineWidth=2;for(const k of ROLL_LINES){c.beginPath();c.moveTo(k*r*1.2,-r+3);c.quadraticCurveTo(k*r*1.7,0,k*r*1.2,r-3);c.stroke();}}
  rect(c,-r*.82,-r*.55,r*1.64,r*.5,r*.25,'#3b2c2acc');
  for(const side of SIDES){c.fillStyle='#fff0d2';c.beginPath();c.ellipse(side*r*.38,-r*.3,6,hurt?2:7.5,0,0,TAU);c.fill();if(!hurt){c.fillStyle='#29433f';c.beginPath();c.arc(side*r*.38+dir*2,-r*.3+1,2.6,0,TAU);c.fill();}}
  c.strokeStyle='#70443c';c.lineWidth=2;c.beginPath();if(hurt)c.arc(0,r*.3,5,Math.PI,TAU);else c.arc(0,r*.12,5,0,Math.PI);c.stroke();
  if(boss){for(let i=0;i<(e.maxHp||3);i++)star(c,(i-1)*19,-r-15,7,i<(e.hp||0)?'#ffd76b':'#00000033');c.scale(squash,1/squash);label(c,e.name?e.name.toUpperCase():'BOUNCE BOSS',0,-r-36,12/(this.viewScale||1));}
 }
 goal(c,e,x,y,h,run,t){
  const ready=(run.keys||0)>=(run.requiredKeys||2)&&run.bossDefeated!==false,still=this.reducedMotion,s=this.viewScale||1;
  if(ready)this.blit(c,this.glow('#fff2ab',90),x+110,y+h/2-50,1.6,.45+.15*Math.sin(t*3));
  c.strokeStyle='#f8eac6';c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(x,y+h/2);c.lineTo(x,y-h/2);c.stroke();
  for(let i=0;i<4;i++)for(let k=0;k<3;k++){c.fillStyle=(i+k)%2?'#fff4d7':'#325e53';c.fillRect(x+i*13,y-h/2+k*13+(still?0:Math.sin(t*5+i*.8)*i*.7),13,13);}
  if(this.rv){const f=this.rvFrame,rw=128,rh=f.h/f.w*rw,idle=still?0:Math.sin(t*9)*1.2;c.drawImage(this.rv,f.x,f.y,f.w,f.h,x+46,y+h/2-rh+idle,rw,rh);}
  if(ready){const hop=still?0:Math.abs(Math.sin(t*4))*8;label(c,'ONWARD!',x+26,y-h/2-18-hop,15/s,'#fff2ab');}
  else label(c,`${run.keys||0}/${run.requiredKeys||2} KEYS`,x+26,y-h/2-16,13/s,'#fff2bb');
 }
 // Floating bounce pads, dressed for each world.
 balloon(c,e,x,y,T,t,phase){
  const [a,b]=T.balloon,skin=e.skin||0,sway=this.reducedMotion?0:Math.sin(t*1.6+phase)*.07;
  c.translate(x,y);c.rotate(sway);
  if(skin===0){c.globalAlpha=.55;c.fillStyle=a;c.beginPath();c.arc(0,0,25,0,TAU);c.fill();c.globalAlpha=1;c.strokeStyle='#ffffffcc';c.lineWidth=2;c.beginPath();c.arc(0,0,25,0,TAU);c.stroke();c.strokeStyle='#ffffff';c.lineWidth=3;c.lineCap='round';c.beginPath();c.arc(0,0,18,Math.PI*1.1,Math.PI*1.45);c.stroke();this.treat(c,0,2,22);}
  else if(skin===3){this.blit(c,this.glow('#ffcf7a',60),0,0,1,.8+.15*Math.sin(t*4+phase));rect(c,-19,-22,38,44,12,a,'#b5622c');c.strokeStyle='#b5622c88';c.lineWidth=1.5;for(const k of LANTERN_RIBS){c.beginPath();c.moveTo(k,-21);c.lineTo(k,21);c.stroke();}rect(c,-9,-27,18,6,2,'#5b3a25');rect(c,-7,21,14,5,2,'#5b3a25');c.fillStyle='#fff6c9';c.beginPath();c.arc(0,0,6,0,TAU);c.fill();}
  else if(skin===2){c.fillStyle=a;c.beginPath();c.ellipse(0,-5,25,22,0,0,TAU);c.fill();c.fillStyle=b;c.beginPath();c.ellipse(0,-5,10,22,0,0,TAU);c.fill();c.strokeStyle='#7a4a35';c.lineWidth=1.5;c.beginPath();c.moveTo(-14,13);c.lineTo(-6,21);c.moveTo(14,13);c.lineTo(6,21);c.stroke();rect(c,-7,20,14,8,2,'#a8754c','#6b4a32');}
  else{c.strokeStyle='#ffffffaa';c.lineWidth=1.5;c.beginPath();c.moveTo(0,22);c.quadraticCurveTo(6,32,-2,44);c.stroke();c.fillStyle=a;c.beginPath();c.ellipse(0,-2,23,25,0,0,TAU);c.fill();c.fillStyle=b;c.beginPath();c.moveTo(-5,22);c.lineTo(5,22);c.lineTo(0,16);c.fill();c.fillStyle='#ffffff99';c.beginPath();c.ellipse(-8,-11,5,8,-.5,0,TAU);c.fill();if(skin===4)star(c,3,2,9,'#ffffff',0);}
 }

 // The buddy: shadow, speed ghosts, squash and stretch, and trailing keys.
 hero(c,run,dt,T){
  const p=run.player,a=this.anim,t=this.time,still=this.reducedMotion,art=CHARACTER_ART[run.characterId],moving=Math.abs(p.vx)>12,j=this.juice;
  a.sx+=(1-a.sx)*Math.min(1,dt*11);a.sy+=(1-a.sy)*Math.min(1,dt*11);a.spin=Math.max(0,a.spin-dt/.4);
  a.idle=p.grounded&&!moving?a.idle+dt:0;
  if(p.grounded&&Math.abs(p.vx)>150&&dt>0){a.stepTime-=dt;if(a.stepTime<=0){a.stepTime=.2;j.burst('dust',p.x-p.facing*14,p.y,{count:2,speed:.6});}}
  // Shadow on whatever is below.
  let floor=null;for(const s of run.platforms)if(s.active!==false&&p.x>s.x-6&&p.x<s.x+s.w+6&&s.y>=p.y-4&&(!floor||s.y<floor.y))floor=s;
  if(floor){const gap=clamp((floor.y-p.y)/260,0,1);c.fillStyle='#10302a';c.globalAlpha=.24*(1-gap*.75);c.beginPath();c.ellipse(p.x,floor.y+3,34*(1-gap*.5),6*(1-gap*.4),0,0,TAU);c.fill();c.globalAlpha=1;}
  const sit=a.idle>1.2&&!still,pose=p.grounded?(moving?Math.floor(t*art.cadence)%2:sit?3:0):2,width=run.characterId==='spike'?91:100;
  const sprite=this.sprites[run.characterId],f0=sprite?.frames[0],f3=sprite?.frames[3];
  const sitWidth=f0&&f3?f3.w*(f0.h*(width/sprite.runWidth)*1.2)/f3.h:width;
  if(run.powerTime>0&&dt>0&&!still){a.trailTime-=dt;if(a.trailTime<=0){a.trailTime=.045;a.trail.push({x:p.x,y:p.y,pose,facing:p.facing});if(a.trail.length>6)a.trail.shift();}}else if(run.powerTime<=0)a.trail.length=0;
  for(let i=0;i<a.trail.length;i++){const g=a.trail[i];c.save();c.translate(g.x,g.y);if(g.facing<0)c.scale(-1,1);this.character(c,run.characterId,g.pose,0,1,width,{alpha:.07+i*.045});c.restore();}
  if(run.powerTime>0)this.blit(c,this.glow('#fff2ab',70),p.x,p.y-34,1.15+(still?0:Math.sin(t*12)*.06),.7);
  if(run.magnetTime>0){c.strokeStyle='#a0e5d6';c.lineWidth=2;c.globalAlpha=.5;c.setLineDash([6,8]);c.lineDashOffset=-t*40;c.beginPath();c.arc(p.x,p.y-32,96,0,TAU);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
  const lean=still?0:p.grounded?clamp(p.vx/run.speed,-1,1)*.05:clamp(p.vy/1100,-1,1)*.16*p.facing,spin=a.spin>0&&!still?-p.facing*TAU*ease.outCubic(1-a.spin):0,bobY=p.grounded&&moving&&!still?Math.abs(Math.sin(t*art.cadence*Math.PI))*-3:0;
  c.save();c.translate(p.x,p.y-32+bobY);c.rotate(lean+spin);c.translate(0,32);if(p.facing<0)c.scale(-1,1);c.scale(still?1:a.sx,still?1:a.sy);
  this.character(c,run.characterId,pose,0,1,pose===3?sitWidth:width,{portrait:pose===3,alpha:run.invincible>0&&run.powerTime<=0&&Math.floor(t*10)%2?.5:1});
  c.restore();
  if(run.shieldCharges>0){c.strokeStyle='#b7edff';c.lineWidth=3;c.globalAlpha=.6+.25*Math.sin(t*5);c.beginPath();c.ellipse(p.x,p.y-34,54+Math.sin(t*3)*2,46,0,0,TAU);c.stroke();c.globalAlpha=1;}
  // Collected keys trail behind like little followers.
  while(a.keys.length<(run.keys||0))a.keys.push({x:p.x,y:p.y-40});a.keys.length=Math.min(a.keys.length,run.keys||0);
  for(let i=0;i<a.keys.length;i++){const k=a.keys[i],tx=p.x-p.facing*(42+i*26),ty=p.y-74-i*6+(still?0:Math.sin(t*4+i)*5),e=dt>0?1-Math.exp(-dt*(7-i*1.5)):0;k.x+=(tx-k.x)*e;k.y+=(ty-k.y)*e;c.save();c.translate(k.x,k.y);c.rotate(-.5);c.strokeStyle='#8c6232';c.lineWidth=2.5;c.fillStyle='#ffdc75';c.beginPath();c.arc(-6,0,6.5,0,TAU);c.fill();c.stroke();rect(c,0,-2.5,15,5,2,'#ffdc75','#8c6232');c.restore();}
  // A draining arc warns that the chain is about to end.
  if(run.combo>0&&run.comboTime>0&&run.comboTime<2.2){const u=run.comboTime/2.2;c.strokeStyle=u<.4&&Math.floor(t*8)%2?'#ff947c':'#fff0a8';c.lineWidth=4;c.lineCap='round';c.beginPath();c.arc(p.x,p.y-88,13,-Math.PI/2,-Math.PI/2+TAU*u);c.stroke();}
 }

 // Drifting details that pass in front of the trail.
 ambient(c,T,scroll,w,h,t,ground){
  if(this.reducedMotion)return;const kind=T.ambient,n=kind==='firefly'?16:kind==='mist'?6:14;
  for(let i=0;i<n;i++){
   const a=hash01(i,80),b=hash01(i,81),d=.6+hash01(i,82)*.8,span=w+120;
   if(kind==='mist'){const x=((a*span-scroll*.5-t*14*d)%span+span)%span-60,y=ground-30+b*50;c.globalAlpha=.16;c.fillStyle='#ffffff';c.beginPath();c.ellipse(x,y,90*d,13,0,0,TAU);c.fill();continue;}
   if(kind==='firefly'){const x=((a*span-scroll*1.15+Math.sin(t*.7+i)*30)%span+span)%span-60,y=ground-40-b*ground*.5+Math.sin(t*1.1+i*2)*18,glow=.35+.65*Math.abs(Math.sin(t*1.6+i*1.3));this.blit(c,this.glow('#f6ffb0',12),x,y,1,glow);continue;}
   const fall=kind==='dust'?18:38,x=((a*span-scroll*1.2+t*(kind==='dust'?46:-18)*d+Math.sin(t*1.4+i)*22)%span+span)%span-60,y=((b*(h+40)+t*fall*d)%(h+40))-20;
   c.globalAlpha=kind==='dust'?.35:.75;c.fillStyle=kind==='leaf'?(i%3?'#9cc76a':'#e2a857'):kind==='petal'?(i%2?'#7f9af0':'#ffffff'):'#f6dcb4';
   c.save();c.translate(x,y);c.rotate(t*(1+a*2)+i);c.beginPath();if(kind==='dust')c.arc(0,0,1.6+a*1.6,0,TAU);else c.ellipse(0,0,5+a*3,2.4,0,0,TAU);c.fill();c.restore();
  }
  c.globalAlpha=1;
 }

 // Whole-screen mood for each bonus layer, plus pointers to missed keys.
 overlays(c,run,dt,w,h,t,sx,sy){
  const still=this.reducedMotion,edge=(color,strength)=>{const key=`${color}:${Math.round(w)}x${Math.round(h)}`;if(this._edgeKey!==key){const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.42,w/2,h/2,Math.max(w,h)*.74);g.addColorStop(0,color+'00');g.addColorStop(1,color);this._edge=g;this._edgeKey=key;}c.globalAlpha=clamp(strength,0,1);c.fillStyle=this._edge;c.fillRect(0,0,w,h);c.globalAlpha=1;};
  if(run.feverTime>0)edge('#ff9a3c',.3+(still?0:.1*Math.sin(t*8)));
  else if(run.goldRushTime>0)edge('#ffd75e',.24+(still?0:.08*Math.sin(t*6)));
  else if(run.hearts===1&&run.maxHearts>1)edge('#ff5a4a',.16+(still?0:.1*Math.abs(Math.sin(t*3))));
  if(run.goldRushTime>0&&!still){for(let i=0;i<14;i++){const x=hash01(i,90)*w,ph=(t*.5+hash01(i,91))%1;c.globalAlpha=Math.sin(ph*Math.PI)*.8;star(c,x,h-ph*h,3+hash01(i,92)*3,'#fff0a8',t+i);}c.globalAlpha=1;}
  if(run.powerTime>0&&!still){c.strokeStyle='#ffffff';c.lineWidth=2;c.lineCap='round';const dir=run.player.facing||1;for(let i=0;i<10;i++){const y=hash01(i,93)*h,ph=(t*2.4+hash01(i,94))%1,x=dir>0?w-ph*(w+160):ph*(w+160)-80;c.globalAlpha=.28*Math.sin(ph*Math.PI);c.beginPath();c.moveTo(x,y);c.lineTo(x+dir*(60+hash01(i,95)*70),y);c.stroke();}c.globalAlpha=1;}
  // Point back to a key the player has run past; the goal's reminder points to both.
  this._compass=Math.max(0,this._compass-dt);
  if((run.keys||0)<(run.requiredKeys||2)){
   for(const e of run.entities){
    if(e.type!=='key'||e.taken)continue;const px=sx(e.x);if(px>=0&&px<=w)continue;
    const behind=e.x<run.player.x;if(this._compass<=0&&(!behind||run.player.x-e.x<700))continue;
    const d=behind?-1:1,x=behind?26:w-26,y=clamp(sy(e.y),90,h-(this.insets.bottom||0)-60),pulse=still?0:Math.sin(t*5)*4;
    c.save();c.translate(x+d*pulse,y);this.blit(c,this.glow('#ffdc75',30),0,0,1,.8);c.fillStyle='#ffdc75';c.strokeStyle='#5c4526';c.lineWidth=2;c.beginPath();c.moveTo(d*16,0);c.lineTo(d*2,-11);c.lineTo(d*2,11);c.closePath();c.fill();c.stroke();c.beginPath();c.arc(-d*7,0,7,0,TAU);c.fill();c.stroke();c.restore();
   }
  }
 }

 drawScout(run,opts){drawScout(this,run,opts);}
 addScoutEvent(e,run){scoutEvent(this,e,run);}
}
