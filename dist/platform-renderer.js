import { Renderer } from './renderer.js?v=20';
import { CHARACTER_ART } from './characters.js?v=20';

const TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const palettes=[
 {sky:'#b8e5df',light:'#f5e9bb',soil:'#bc9061',edge:'#85b964',dark:'#365c46',water:'#55b7c2',hill:'#6ca999'},
 {sky:'#b6d1ad',light:'#f3e0ae',soil:'#8e674e',edge:'#7c9c55',dark:'#304e3d',water:'#81b9af',hill:'#4e806b'},
 {sky:'#9fdce2',light:'#ffe3b1',soil:'#c47950',edge:'#e4b076',dark:'#864e3a',water:'#79b3bd',hill:'#dc9467'},
 {sky:'#203a55',light:'#69758c',soil:'#806379',edge:'#b997b1',dark:'#3a405a',water:'#627eb5',hill:'#5a6683'},
 {sky:'#b8e0e3',light:'#fff0c1',soil:'#b68b61',edge:'#a7b96c',dark:'#597251',water:'#80c9cc',hill:'#a5ba88'}
];
function rect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function star(c,x,y,r,fill,t=0){c.beginPath();for(let i=0;i<10;i++){let a=i*Math.PI/5-Math.PI/2+t,k=i%2?.46:1;c.lineTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k);}c.closePath();c.fillStyle=fill;c.fill();}
function bone(c,x,y,w=25,fill='#fff0ba') {c.save();c.translate(x,y);c.rotate(-.5);c.fillStyle=fill;c.strokeStyle='#a67f48';c.lineWidth=1.5;rect(c,-w*.38,-w*.12,w*.76,w*.24,4,fill);for(const xx of [-1,1])for(const yy of [-1,1]){c.beginPath();c.arc(xx*w*.36,yy*w*.12,w*.14,0,TAU);c.fill();}c.restore();}
function label(c,text,x,y,size=13,color='#fff4d7'){c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillStyle=color;c.strokeStyle='#133b3dcc';c.lineWidth=4;c.strokeText(text,x,y);c.fillText(text,x,y);}

// Shares the approved character atlas loader and Snack Storm renderer.
export class AdventureRenderer extends Renderer {
 constructor(canvas){super(canvas);this.camera=0;this.fx=[];this.popups=[];this.lastRunId='';}
 resetCamera(){this.camera=0;this.fx=[];this.popups=[];this.lastRunId='';}
 addAdventureEvent(e){
  if(!Number.isFinite(e.x))return;
  const color=e.type==='hit'?'#ff947c':e.type==='power'?'#b5eeef':e.type==='stomp'?'#ffc972':'#fff0b7';
  if(['collect','jump','double-jump','power','spring','stomp','block','smash','hit','checkpoint','secret'].includes(e.type)){
   if(!this.reducedMotion)for(let i=0;i<(e.type==='power'?24:9);i++){const a=i*2.4;this.fx.push({x:e.x,y:e.y??420,vx:Math.cos(a)*(45+Math.random()*100),vy:-70+Math.sin(a)*90,life:.7,color,r:2+Math.random()*3});}
  }
  const text=e.type==='stomp'?`BOUNCE!${e.points?' +'+e.points:''}`:e.type==='checkpoint'?'CHECKPOINT':e.type==='secret'?'SECRET FOUND!':e.type==='collect'&&e.kind==='gold'?'GOLD RUSH!':e.type==='collect'&&e.kind==='key'?'KEY FOUND!':'';
  if(text)this.popups.push({x:e.x,y:(e.y??400)-40,life:1.25,text,color});
  if(this.fx.length>120)this.fx.splice(0,this.fx.length-120);
 }
 background(c,theme,camera,time,w,h){
  const p=palettes[theme]||palettes[0],g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,p.sky);g.addColorStop(1,p.light);c.fillStyle=g;c.fillRect(0,0,w,h);
  c.fillStyle=theme===3?'#ffefbd':'#fff2bf';c.beginPath();c.arc(w*.79,h*.2,theme===3?26:38,0,TAU);c.fill();
  if(theme===3){c.fillStyle=p.sky;c.beginPath();c.arc(w*.79+10,h*.2-6,25,0,TAU);c.fill();for(let i=0;i<46;i++){c.fillStyle='#fff4d8';c.globalAlpha=.4+(i%4)*.15;c.beginPath();c.arc((i*177.7+19)%w,(i*67.2+24)%(h*.6),i%5?1:2,0,TAU);c.fill();}c.globalAlpha=1;}
  else for(let i=0;i<6;i++){const x=((i*263-camera*.13)%(w+300)+w+300)%(w+300)-150,y=42+(i%3)*48;c.fillStyle='#fffcdf99';for(let k=0;k<3;k++){c.beginPath();c.ellipse(x+k*28,y-(k===1?10:0),37,16+k%2*5,0,0,TAU);c.fill();}}
  for(let layer=0;layer<3;layer++){c.fillStyle=p.hill;c.globalAlpha=.22+layer*.15;const shift=camera*(.08+layer*.07),step=theme===2?300:390,base=h*(.58+layer*.08);c.beginPath();c.moveTo(-100,h);for(let i=-1;i<w/step+3;i++){const x=i*step-shift%step;if(theme===2){c.lineTo(x,base);c.lineTo(x+step*.2,base-100-layer*25);c.lineTo(x+step*.55,base-100-layer*25);c.lineTo(x+step*.75,base);}else{c.quadraticCurveTo(x+step*.5,base-130-layer*22,x+step,base);}}c.lineTo(w+100,h);c.fill();}c.globalAlpha=1;
  if(theme===1)for(let i=0;i<10;i++){const x=((i*191-camera*.28)%(w+250)+w+250)%(w+250)-125;c.fillStyle='#344e3935';rect(c,x,h*.2,20,h*.8,9,c.fillStyle);for(let k=0;k<4;k++){c.beginPath();c.ellipse(x+10,h*.25+k*48,80-k*8,39,0,0,TAU);c.fill();}}
  return p;
 }
 drawPlatform(run,{time=0,dt=0,reducedMotion=false}={}){
  this.reducedMotion=reducedMotion;this.time=reducedMotion?0:time;const c=this.begin(),w=this.width,h=this.height;
  const s=Math.min(h/560,w/(w<600?450:620)),viewW=w/s,offY=(h-560*s)*.6;
  const target=clamp(run.player.x-viewW*.38,0,Math.max(0,run.width-viewW));
  if(this.lastRunId!==run.runId){this.camera=target;this.lastRunId=run.runId;}else this.camera+= (target-this.camera)*Math.min(1,dt*8);
  this.viewScale=s;this.viewOffsetY=offY;
  const p=this.background(c,run.worldIndex||0,this.camera*s,this.time,w,h);
  c.save();c.translate(-this.camera*s,offY);c.scale(s,s);
  // Gaps expose animated water beneath the route.
  c.fillStyle=p.water;c.fillRect(this.camera,500,viewW,500);
  c.strokeStyle='#d6f0d46b';c.lineWidth=2;for(let i=0;i<viewW/70+2;i++){let x=this.camera+i*70-((this.time*17)%70);c.beginPath();c.moveTo(x,520+i%2*14);c.lineTo(x+27,520+i%2*14);c.stroke();}
  for(const platform of run.platforms||[]){
   if(platform.active===false||platform.gone||platform.collapsed||platform.x+platform.w<this.camera-100||platform.x>this.camera+viewW+100)continue;
   const {x,y,w:pw}=platform,type=platform.type,ph=type==='ground'?Math.max(platform.h,(h-offY)/s-y+20):platform.h;
   if(type==='block')continue;
   const moving=type==='moving',crumble=type==='crumble';
   c.save();if(crumble&&platform.crumbleTimer>0&&!reducedMotion)c.translate(Math.sin(time*80)*2,0);
   if(moving){rect(c,x,y,pw,ph,7,'#528d91','#2b5c60');rect(c,x+4,y,pw-8,6,3,'#b5e6da');c.fillStyle='#d4f4d9';for(let xx=x+16;xx<x+pw;xx+=26){c.beginPath();c.arc(xx,y+ph*.6,3,0,TAU);c.fill();}}
   else {rect(c,x,y,pw,ph,4,crumble?'#c8b29b':p.soil);rect(c,x-1,y-2,pw+2,11,5,crumble?'#ddc9a7':p.edge);c.fillStyle='#ffffff22';c.fillRect(x+3,y+13,pw-6,4);c.strokeStyle='#6b472c30';c.lineWidth=2;for(let xx=x+25;xx<x+pw;xx+=57){c.beginPath();c.moveTo(xx,y+32);c.lineTo(xx+12,y+37);c.stroke();}if(crumble){c.strokeStyle='#846c59';c.beginPath();c.moveTo(x+pw*.4,y+4);c.lineTo(x+pw*.54,y+ph*.5);c.lineTo(x+pw*.43,y+ph);c.stroke();}}
   c.restore();
  }
  for(const e of run.entities||[]){if(e.taken||e.dead||e.hit||e.hidden||(e.secret&&!e.revealed)||e.x<this.camera-100||e.x>this.camera+viewW+160)continue;this.platformEntity(c,e,p,run);}
  const player=run.player,art=CHARACTER_ART[run.characterId],moving=Math.abs(player.vx)>5,pose=player.grounded?(moving?Math.floor(time*art.cadence)%2:0):2;
  c.fillStyle='#183b362b';c.beginPath();c.ellipse(player.x,player.y+3,34,6,0,0,TAU);c.fill();
  c.save();c.translate(player.x,player.y);if(player.facing<0)c.scale(-1,1);
  if(run.powerTime>0){c.fillStyle='#fff2ab40';c.shadowColor='#ffe69b';c.shadowBlur=20;c.beginPath();c.ellipse(0,-35,59,47,0,0,TAU);c.fill();c.shadowBlur=0;}
  this.character(c,run.characterId,pose,0,1,run.characterId==='spike'?91:100,{alpha:run.invincible>0&&Math.floor(time*9)%2?.55:1});
  if(run.shieldCharges>0){c.strokeStyle='#b7edffbb';c.lineWidth=3;c.beginPath();c.ellipse(0,-34,54,45,0,0,TAU);c.stroke();}c.restore();
  for(const f of this.fx){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=230*dt;f.life-=dt;c.globalAlpha=clamp(f.life*3,0,1);c.fillStyle=f.color;c.beginPath();c.arc(f.x,f.y,f.r,0,TAU);c.fill();}c.globalAlpha=1;this.fx=this.fx.filter(f=>f.life>0);
  for(const f of this.popups){f.y-=25*dt;f.life-=dt;c.globalAlpha=clamp(f.life*2,0,1);label(c,f.text,f.x,f.y,14,f.color);}c.globalAlpha=1;this.popups=this.popups.filter(f=>f.life>0);
  c.restore();
  // The opening sign stays attached to the route, out of the way of the HUD.
  if(player.x<280&&run.time<18){c.save();const tx=(145-this.camera)*s,ty=offY+370*s;c.fillStyle='#234a4599';rect(c,tx-65*s,ty-40*s,130*s,47*s,8,'#234a45cf');label(c,'MOVE • JUMP • EXPLORE',tx,ty-16*s,10*s);label(c,'Follow the snacks →',tx,ty+1*s,11*s);c.restore();}
 }
 platformEntity(c,e,p,run){
  const x=e.x,y=e.y+(this.reducedMotion||['enemy','block','goal','checkpoint','spring'].includes(e.type)?0:Math.sin(this.time*3+(Number(e.id)||0))*3),w=e.w||32,h=e.h||32;
  c.save();
  if(e.type==='bone')bone(c,x,y,25);
  else if(e.type==='gold'){c.shadowColor='#ffd96d';c.shadowBlur=18;star(c,x,y,24,'#e7ac35',this.time*.3);star(c,x,y,16,'#ffe68c',this.time*.3);bone(c,x,y,21,'#fff5c0');}
  else if(e.type==='key'){c.strokeStyle='#8c6232';c.lineWidth=3;c.fillStyle='#ffdc75';c.beginPath();c.arc(x-7,y-6,8,0,TAU);c.fill();c.stroke();rect(c,x-1,y-4,18,6,2,'#ffdc75','#8c6232');rect(c,x+10,y+1,5,7,1,'#ffdc75');}
  else if(e.type==='block'){const used=e.used||e.empty;rect(c,x-w/2,y-h/2,w,h,6,used?'#9b876e':'#efbd55',used?'#695f50':'#b37a31');rect(c,x-w/2+5,y-h/2+5,w-10,h-10,3,null,used?'#bba68b':'#ffe8a2');if(!used){c.fillStyle='#fff6ce';c.font='900 28px system-ui';c.textAlign='center';c.fillText('?',x,y+10);}for(const k of [-1,1]){c.fillStyle='#88643f';c.beginPath();c.arc(x+k*(w/2-6),y+h/2-6,2,0,TAU);c.fill();}}
  else if(e.type==='spring'){rect(c,x-24,y-7,48,12,6,'#eb7a66','#925249');c.strokeStyle='#f5e9b5';c.lineWidth=4;c.beginPath();for(let i=0;i<5;i++)c.lineTo(x+(i%2?12:-12),y+1+i*4);c.stroke();rect(c,x-20,y+17,40,5,2,'#526d5d');}
  else if(e.type==='enemy'){
   const boss=e.subtype==='boss',r=boss?38:22;c.fillStyle='#203b313b';c.beginPath();c.ellipse(x,y+h/2,r+5,6,0,0,TAU);c.fill();
   const wobble=this.reducedMotion?0:Math.sin(this.time*9)*2;rect(c,x-r,y-r+wobble,r*2,r*1.65,12,boss?'#9d658a':'#c17356','#684844');
   for(const side of [-1,1]){rect(c,x+side*r*.65-7,y+r*.45,14,10,4,'#5d4c40');c.fillStyle='#fff0d2';c.beginPath();c.ellipse(x+side*r*.38,y-r*.3,6,8,0,0,TAU);c.fill();c.fillStyle='#29433f';c.beginPath();c.arc(x+side*r*.38+(e.vx<0?-1:1),y-r*.3+1,2.5,0,TAU);c.fill();}
   c.strokeStyle='#70443c';c.lineWidth=2;c.beginPath();c.arc(x,y+r*.1,5,0,Math.PI);c.stroke();
   if(boss){for(let i=0;i<(e.hp||0);i++)star(c,x+(i-1)*19,y-r-15,7,'#ffd76b');label(c,'BOUNCE BOSS',x,y-r-35,11);}
  }
  else if(e.type==='checkpoint'){c.strokeStyle='#6d694f';c.lineWidth=5;c.beginPath();c.moveTo(x,y+h/2);c.lineTo(x,y-h/2);c.stroke();c.fillStyle=e.active||e.activated?'#b8e994':'#f9dd8b';c.beginPath();c.moveTo(x,y-h/2);c.lineTo(x+37,y-h/2+12);c.lineTo(x,y-h/2+24);c.fill();label(c,e.active||e.activated?'SAVED':'CHECKPOINT',x,y-h/2-12,9);}
  else if(e.type==='chest'){rect(c,x-25,y-18,50,36,5,'#a27047','#5e4937');rect(c,x-26,y-20,52,14,5,'#d4a863','#5e4937');rect(c,x-4,y-8,8,12,2,'#ffe392');label(c,'E · OPEN',x,y-32,10);}
  else if(e.type==='sign'){rect(c,x-3,y+9,6,36,2,'#87694c');rect(c,x-22,y-16,44,29,5,'#f0d69d','#93724c');c.fillStyle='#45624c';c.font='900 20px system-ui';c.textAlign='center';c.fillText('→',x,y+5);}
  else if(e.type==='goal'){
   c.strokeStyle='#f8eac6';c.lineWidth=6;c.beginPath();c.moveTo(x,y+h/2);c.lineTo(x,y-h/2);c.stroke();for(let i=0;i<4;i++)for(let j=0;j<3;j++){c.fillStyle=(i+j)%2?'#fff4d7':'#325e53';c.fillRect(x+i*13,y-h/2+j*13,13,13);}label(c,'SNACK STOP',x+23,y-h/2-13,12);
   if(this.rv){const f=this.rvFrame,rw=135,rh=f.h/f.w*rw;c.drawImage(this.rv,f.x,f.y,f.w,f.h,x+57,y+h/2-rh,rw,rh);}
   if((run.keys||0)<(run.requiredKeys||2))label(c,`${run.keys||0}/${run.requiredKeys||2} KEYS`,x+26,y+h/2+24,12,'#fff2bb');
  }
  else {const colors={heart:'#ffbda9',shield:'#b1dfff',magnet:'#a0e5d6'};c.fillStyle=colors[e.type]||'#f4d487';c.strokeStyle='#fff3c8';c.lineWidth=2;c.beginPath();c.arc(x,y,19,0,TAU);c.fill();c.stroke();c.fillStyle='#315957';c.font='900 20px system-ui';c.textAlign='center';c.fillText({heart:'♥',shield:'◆',magnet:'U'}[e.type]||'★',x,y+7);}
  c.restore();
 }
 drawScout(run,{time=0,dt=0,reducedMotion=false}={}){
  this.reducedMotion=reducedMotion;this.time=reducedMotion?0:time;const c=this.begin(),w=this.width,h=this.height,p=palettes[run.worldIndex||0];
  this.background(c,run.worldIndex||0,0,time,w,h);const rows=run.grid.length,cols=run.grid[0].length,padTop=w<600?116:(h<450?91:108),padBottom=h<450&&w>600?113:65,cell=Math.min((w-30)/cols,(h-padTop-padBottom)/rows),left=(w-cols*cell)/2,top=padTop+(h-padTop-padBottom-rows*cell)/2;
  this.scoutLayout={left,top,cell};c.save();c.translate(left,top);
  rect(c,-7,-7,cols*cell+14,rows*cell+14,16,'#1c4b45','#e8ecc1');
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const xx=x*cell,yy=y*cell;
   if(run.grid[y][x]===1){rect(c,xx+1,yy+1,cell-2,cell-2,5,p.dark);rect(c,xx+3,yy+1,cell-6,cell*.7,5,p.edge);c.fillStyle='#e3edb638';c.beginPath();c.ellipse(xx+cell*.36,yy+cell*.25,cell*.19,cell*.1,-.4,0,TAU);c.fill();}
   else{rect(c,xx+.6,yy+.6,cell-1.2,cell-1.2,3,(x+y)%2?'#ddc29a':'#e5cba2');if((x*7+y*11)%8===0){c.fillStyle='#b5946844';c.beginPath();c.arc(xx+cell*.3,yy+cell*.7,2,0,TAU);c.fill();}}
  }
  if(run.hintPath)for(const point of run.hintPath.slice(0,12)){c.fillStyle='#fff09cab';c.beginPath();c.arc((point.x+.5)*cell,(point.y+.5)*cell,3,0,TAU);c.fill();}
  for(const e of run.entities||[]){if(e.taken)continue;const x=(e.x+.5)*cell,y=(e.y+.5)*cell,r=cell*.3;
   if(e.type==='treasure'){star(c,x,y,r,'#b57a37');star(c,x,y,r*.78,'#ffe38c');}
   else if(e.type==='key'){c.save();c.translate(x,y);c.rotate(-.5);c.strokeStyle='#825f31';c.fillStyle='#ffe494';c.lineWidth=2;c.beginPath();c.arc(-r*.35,-r*.1,r*.43,0,TAU);c.fill();c.stroke();rect(c,-r*.05,-r*.25,r*1.05,r*.3,2,'#ffe494','#825f31');rect(c,r*.65,0,r*.25,r*.4,1,'#ffe494');c.restore();}
   else if(e.type==='npc'){c.fillStyle=e.delivered?'#b4df9d':'#f3e3c0';c.beginPath();c.arc(x,y-r*.2,r,0,TAU);c.fill();c.fillStyle='#366758';c.beginPath();c.arc(x-4,y-3,2,0,TAU);c.arc(x+4,y-3,2,0,TAU);c.fill();label(c,e.delivered?'✓':'!',x,y-r-4,11);}
   else if(e.type==='chest'){rect(c,x-r,y-r*.65,r*2,r*1.4,4,'#aa7546','#624d38');rect(c,x-2,y-3,4,8,1,'#ffdf89');}
   else if(e.type==='hazard'){c.fillStyle=e.active?'#9e6653':'#b69a72';c.beginPath();c.ellipse(x,y,r,r*.7,0,0,TAU);c.fill();if(e.active){c.fillStyle='#d5b58a';c.beginPath();c.arc(x-3,y-3,r*.2,0,TAU);c.arc(x+4,y+2,r*.15,0,TAU);c.fill();}}
   else if(e.type==='exit'){rect(c,x-r,y-r,r*2,r*2,4,'#2c786d');label(c,'↗',x,y+r*.55,r*1.5);}
   else if(e.type==='bone')bone(c,x,y,r*1.7);
  }
  if(run.exit){const x=(run.exit.x+.5)*cell,y=(run.exit.y+.5)*cell;rect(c,x-cell*.4,y-cell*.4,cell*.8,cell*.8,5,'#2c786d','#b5dfb4');label(c,'RV',x,y+cell*.12,cell*.29);}
  const pl=run.player,px=((pl.renderX??pl.x)+.5)*cell,py=((pl.renderY??pl.y)+1)*cell;const art=this.sprites[run.characterId],f=art?.frames[3];if(f)this.character(c,run.characterId,3,px,py-1,cell*.98*f.w/f.h,{portrait:true});
  c.restore();
 }
}
