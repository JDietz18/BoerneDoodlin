// Bubble Pop presentation. `view` is the shared AdventureRenderer: it supplies begin(), juice, sprites,
// the cached world backdrop, the cached treat art (_kit) and the chain meter at the buddy's feet, so the
// mini game looks like Snack Storm's cousin. Nothing here changes the run: it reads engine state and events.
//
// What the controller can rely on after every frame:
//   view.bubbleLayout = {left, top, w, h, ground, insetL, insetR}   the play field in canvas CSS px, and the side safe areas
//   view.bubblePoint(x, y) -> {x, y, w, h}          canvas px -> field units 0..1 (and the field size in px)
// The field runs from just under the HUD band (view.insets.top) to the grass line the buddy stands on.
//
// Every bubble, glow and treat is a pre-rendered sprite blitted with drawImage: no gradients, shadows or
// allocations per bubble per frame. Reduced motion keeps the bubbles rising (that is the game) and stops
// wobble, sparkle, bursts, rings, flashes, shake and flying pieces.
import {hash01,ease} from './fx.js?v=27';
import {BUBBLE_HIT,BUBBLE_COLUMNS} from './bubble-engine.js?v=27';

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt=n=>String(Number((Number(n)||0).toFixed(1)));
const WORLD_LOOK=[
  {image:0,focus:.1,stand:.72,sky:['#7cc7e6','#f5e7be'],tuft:'#5f9146',lane:'#fff2b9'},
  {image:0,focus:.6,stand:.7,sky:['#8fbfa5','#e9e2b5'],tuft:'#3f7044',lane:'#f1e6b0'},
  {image:2,focus:.08,stand:.76,sky:['#8fd6e4','#ffe0b0'],tuft:'#c58a4c',lane:'#ffe6b8'},
  {image:1,focus:.02,stand:.74,sky:['#0c1b3c','#3b3a6b'],tuft:'#55628a',lane:'#c6d6ff',night:true},
  {image:3,focus:.12,stand:.8,sky:['#86cdea','#f8ecc4'],tuft:'#6f9a45',lane:'#fff2b9'}
];
const SECTION_BANNER=['','BUBBLE BREEZE!','BUBBLE STORM!'];
const POWER_LINE={griffin:'ZOOMIES!  BIG BARK  x1.5',kevin:'ROYAL SUMMONS!',mittens:'PANTHER POUNCE!',spike:'SHELL ROLL!  BURRS ARE SAFE'};
const multColor=total=>total>=30?'#fffbe0':total>=20?'#ff9fc4':total>=10?'#ffb347':total>=5?'#ffe066':total>=4?'#cdbcff':total>=3?'#9be8f4':total>=2?'#bff3c6':'#fff4d7';
const multStroke=total=>total>=30?'#b02a78f0':total>=20?'#6b1f47e6':total>=10?'#6b3a10e6':'#133b3dd9';
const SIDE=128;

function makeSprite(w,h,dpr,paint){
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.ceil(w*dpr));cv.height=Math.max(1,Math.ceil(h*dpr));
  const c=cv.getContext('2d');c.scale(dpr,dpr);paint(c,w,h);return {cv,w,h};
}
// Centred blit with a uniform scale, optional rotation and alpha.
function blit(c,s,x,y,scale=1,alpha=1,rotation=0){
  if(!s||alpha<=.004)return;const w=s.w*scale,h=s.h*scale;
  if(rotation){c.save();c.translate(x,y);c.rotate(rotation);if(alpha<1)c.globalAlpha*=alpha;c.drawImage(s.cv,-w/2,-h/2,w,h);c.restore();return;}
  if(alpha<1){const before=c.globalAlpha;c.globalAlpha=before*alpha;c.drawImage(s.cv,x-w/2,y-h/2,w,h);c.globalAlpha=before;}else c.drawImage(s.cv,x-w/2,y-h/2,w,h);
}
// One soap-bubble body per tint: ink rim, tinted glass, a white rim light and two glints.
function paintBubble(c,tint){
  c.translate(SIDE/2,SIDE/2);const R=SIDE/2-5;
  const g=c.createRadialGradient(-R*.28,-R*.32,R*.08,0,0,R);g.addColorStop(0,tint+'30');g.addColorStop(.62,tint+'50');g.addColorStop(1,tint+'b8');
  c.fillStyle=g;c.beginPath();c.arc(0,0,R,0,TAU);c.fill();
  c.lineWidth=5;c.strokeStyle='#10231fd0';c.beginPath();c.arc(0,0,R,0,TAU);c.stroke();
  c.lineWidth=2.5;c.strokeStyle='#ffffffc0';c.beginPath();c.arc(0,0,R-4.5,0,TAU);c.stroke();
  c.lineCap='round';c.strokeStyle='#ffffffe6';c.lineWidth=7;c.beginPath();c.arc(0,0,R*.7,Math.PI*1.08,Math.PI*1.42);c.stroke();
  c.lineWidth=5;c.beginPath();c.arc(0,0,R*.7,Math.PI*1.5,Math.PI*1.56);c.stroke();
  c.fillStyle='#ffffff99';c.beginPath();c.ellipse(R*.34,R*.5,R*.16,R*.08,-.7,0,TAU);c.fill();
}
// A grumpy little burr: spikes, a round body, two eyes. It must read as "leave me alone" at a glance.
function paintBurr(c,s){
  c.translate(s/2,s/2);const R=s*.46;
  c.lineJoin='round';c.fillStyle='#8a5a34';c.strokeStyle='#10231f';c.lineWidth=2.2;c.beginPath();
  for(let i=0;i<28;i++){const a=i*Math.PI/14,k=i%2?.66:1.04;c.lineTo(Math.cos(a)*R*k,Math.sin(a)*R*k);}
  c.closePath();c.fill();c.stroke();
  c.fillStyle='#a8774a';c.beginPath();c.arc(-R*.12,-R*.12,R*.5,0,TAU);c.fill();
  c.fillStyle='#fff8ea';for(const x of [-1,1]){c.beginPath();c.ellipse(x*R*.28,-R*.02,R*.17,R*.2,0,0,TAU);c.fill();}
  c.fillStyle='#231512';for(const x of [-1,1]){c.beginPath();c.arc(x*R*.25,R*.03,R*.08,0,TAU);c.fill();}
  c.strokeStyle='#231512';c.lineWidth=R*.12;c.lineCap='round';c.beginPath();c.moveTo(-R*.5,-R*.34);c.lineTo(-R*.1,-R*.18);c.moveTo(R*.5,-R*.34);c.lineTo(R*.1,-R*.18);c.stroke();
  c.lineWidth=R*.1;c.beginPath();c.arc(0,R*.5,R*.18,Math.PI*1.15,Math.PI*1.85);c.stroke();
}
function kitFor(view){
  const dpr=view.dpr||1,store=view._bubbleKit;if(store?.dpr===dpr)return store;
  const kit={dpr},body=tint=>makeSprite(SIDE,SIDE,dpr,c=>paintBubble(c,tint));
  kit.treat=body('#8fe3ff');kit.gold=body('#ffd54a');kit.burr=body('#ff8a72');kit.safe=body('#9be07a');
  kit.burrArt=makeSprite(96,96,dpr,c=>paintBurr(c,96));
  return view._bubbleKit=kit;
}
// Field geometry for this frame. The buddy stands on the grass line; the sky fills the space under the HUD band.
function layoutFor(view,insets){
  const w=view.width,h=view.height,ins=insets||view.insets||{},short=h<480,L=view._bL||(view._bL={});
  let top=Math.max(0,Number(ins.top)||0),bottom=Math.max(0,Number(ins.bottom)||0);
  if(!top&&!bottom){top=short?58:92;bottom=short?84:0;}
  top=Math.min(top,h*.35);bottom=Math.min(bottom,h*.45);
  L.w=w;L.h=h;L.short=short;L.ground=Math.round(h-Math.max(bottom+(short?26:36),clamp(h*.15,65,110)));
  L.skyTop=top+(short?2:6);L.top=L.skyTop+(short?0:4);L.fh=Math.max(60,L.ground-L.top);L.playH=Math.max(60,L.ground-L.skyTop);
  return L;
}
function stateFor(view,run){
  let s=view._bv;
  if(!s||s.runId!==run.runId)s=view._bv={runId:run.runId,clock:0,lookX:null,px:null,lean:0,hop:0,hopV:0,squash:1,squashV:0,pip:0,bump:0,lost:0,heat:0,gold:0,zoom:0,push:0,rays:0,recoil:0,banner:null,sub:null,stringPop:null,pounce:null,wave:0,stackAt:[-9,-9,-9,-9],maxed:false,headFloor:0,ticking:false};
  return s;
}
// Drawn radius of a bubble, matching what the engine measures hits against.
const radiusOf=(e,L)=>Math.max((e.r||.06)*L.fh,BUBBLE_HIT.minRadius);

export function drawBubble(view,run,{time=0,dt=0,reducedMotion=false,insets}={}){
  const rm=Boolean(reducedMotion),j=view.juice;view.reducedMotion=rm;j.reducedMotion=rm;
  const L=layoutFor(view,insets),sv=stateFor(view,run);
  // Labels stay below the HUD band, and below the headline while one is showing.
  j.ceiling=Math.max((((insets||view.insets)?.top)||0)+4,sv.headFloor||0);
  dt=clamp(Number(dt)||0,0,.1);j.update(dt);
  const lay=view.bubbleLayout||(view.bubbleLayout={});lay.left=0;lay.top=L.top;lay.w=L.w;lay.h=L.fh;lay.ground=L.ground;const sideIns=insets||view.insets||{};lay.insetL=Math.max(0,Number(sideIns.left)||0);lay.insetR=Math.max(0,Number(sideIns.right)||0);
  if(!view.bubblePoint)view.bubblePoint=(x,y)=>{const l=view.bubbleLayout;return {x:clamp(x/l.w,-.2,1.2),y:(y-l.top)/l.h,w:l.w,h:l.h};};
  const c=view.begin(),amb=view._ambient(),kitArt=view._kit(clamp(Math.round(Math.min(L.w*.074,L.fh*.06)),26,44)),bub=kitFor(view);
  sv.clock+=dt;sv.ticking=dt>0;const t=view.time=rm?0:sv.clock;
  const world=clamp(Math.round(Number(run.worldIndex??run.stage)||0),0,4),look=WORLD_LOOK[world],total=run.totalMultiplier||1,night=Boolean(look.night);
  L.night=night;
  const toward=(value,target,rate)=>value+(target-value)*Math.min(1,dt*rate);
  sv.heat=toward(sv.heat,run.feverTime>0?1:0,5);sv.gold=toward(sv.gold,run.goldRushTime>0?1:0,5);sv.zoom=toward(sv.zoom,run.powerTime>0?1:0,8);
  sv.push=toward(sv.push,run.time>=35?1:0,1.6);sv.rays=toward(sv.rays,total>=30?1:total>=20?.72:total>=10?.45:0,4);
  sv.lost=Math.max(0,sv.lost-dt*1.1);sv.pip=Math.max(0,sv.pip-dt*5);sv.bump=Math.max(0,sv.bump-dt*3);sv.recoil=Math.max(0,sv.recoil-dt*2.6);sv.wave=Math.max(0,sv.wave-dt*1.7);
  if(sv.banner&&(sv.banner.life-=dt)<=0)sv.banner=null;if(sv.sub&&(sv.sub.life-=dt)<=0)sv.sub=null;if(sv.pounce&&(sv.pounce.life-=dt)<=0)sv.pounce=null;
  const o=j.offset;c.save();
  if(o.x||o.y||o.rot||o.zoom!==1){c.translate(L.w/2+o.x,L.h/2+o.y);if(o.rot)c.rotate(o.rot);c.scale(o.zoom,o.zoom);c.translate(-L.w/2,-L.h/2);}
  const bg=view._stormBackdrop(L,world);c.drawImage(bg.cv,-24,-24,bg.w,bg.h);
  sky(view,c,run,L,sv,amb,world,t,total);
  // the buddy stands behind the sky, so a bubble that rises past a paw is never hidden by it
  buddy(view,c,run,L,sv,amb,t,dt,rm);
  // bubbles rise out of the grass, so everything below the lane is clipped away
  c.save();c.beginPath();c.rect(0,0,L.w,L.ground+14);c.clip();
  if(world===2&&!rm){c.strokeStyle='#ffffff';c.lineWidth=2;c.globalAlpha=.16;c.setLineDash([3,12]);c.beginPath();for(const x of BUBBLE_COLUMNS){c.moveTo(x*L.w,L.top);c.lineTo(x*L.w,L.ground);}c.stroke();c.setLineDash([]);c.globalAlpha=1;}
  if(sv.pounce)pounceColumn(c,L,sv,rm);
  for(const e of run.entities)if(!e.popped&&!e.gone)bubble(c,e,L,kitArt,bub,amb,sv,run,t,rm,night);
  trails(c,run,L);
  c.restore();
  view._stormMeter(c,run,L,sv,t,sv.px??L.w/2,total);
  if(run.keyboard&&run.mode!=='won')reticle(c,run,L,t,rm);
  j.draw(c);c.restore();
  overlay(c,run,L,sv,amb,t,world,rm,view);
  j.drawOverlay(c,L.w,L.h);
}

function sky(view,c,run,L,sv,amb,world,t,total){
  const rm=view.reducedMotion,w=L.w,night=L.night,cloud=night?amb.cloudNight:amb.cloud,cs=clamp(w/520,.75,1.05),span=w+170*cs,count=w>620?6:3;
  for(let i=0;i<count;i++){const x=((hash01(i,21)*span+t*(5+i*2.3))%span)-85*cs,y=L.skyTop+(L.short?-16:4)*cs+(i%2)*11*cs+Math.sin(t*.5+i)*2;blit(c,cloud,x,y,cs*(L.short?.66:.8)*(1+hash01(i,22)*.5),night?.7:.84);}
  if(world===0){
    for(let i=0;i<6;i++){const h1=hash01(i,25),h2=hash01(i,26),rise=L.playH*.7,y=L.ground-20-((h2*rise+t*(9+h1*8))%rise);blit(c,amb.glowWhite,((h1*w+Math.sin(t*.6+i)*18)%w+w)%w,y,.1+h1*.08,.7);}
  }else if(world===1){
    const leaves=w>620?12:8,fall=L.ground-L.skyTop,wind=run.wind||0;
    for(let i=0;i<leaves;i++){const h1=hash01(i,31),h2=hash01(i,32),y=L.skyTop+((h2*fall+t*(24+h1*22))%fall),x=((h1*w+Math.sin(t*.9+i*1.7)*26+t*(9+wind*40))%(w+40)+w+40)%(w+40)-20;blit(c,i%3?amb.leafA:amb.leafB,x,y,1.15,.88,rm?0:t*(.8+h1)+i);}
    if(!rm&&Math.abs(run.wind||0)>.2){c.strokeStyle='#fff1d0';c.lineWidth=1.6;c.lineCap='round';c.globalAlpha=Math.min(.5,Math.abs(run.wind)*.5);c.beginPath();for(let i=0;i<8;i++){const h1=hash01(i,41),h2=hash01(i,42),x=((h1*w+t*60*run.wind)%(w+160)+w+160)%(w+160)-80,y=L.skyTop+h2*L.playH*.9;c.moveTo(x,y);c.lineTo(x+40*run.wind,y+3);}c.stroke();c.globalAlpha=1;}
  }else if(world===3){
    for(let i=0;i<10;i++){const h1=hash01(i,51),h2=hash01(i,52);blit(c,amb.spark,h1*w,L.skyTop+h2*L.playH*.5,.42+h2*.4,rm?.7:.25+.75*Math.abs(Math.sin(t*(1+h1)+i*2.1)));}
  }else if(world===4){
    const flowers=Math.ceil(w/56),f=amb.flower;
    for(let i=0;i<flowers;i++){const h1=hash01(i,61),s=.72+h1*.5,sway=rm?0:Math.sin(t*1.7+i*1.3)*.09;c.save();c.translate((i+.2+h1*.6)*w/flowers,L.ground+8+hash01(i,62)*8);c.rotate(sway);c.drawImage(f.cv,-f.w*s/2,-f.h*s,f.w*s,f.h*s);c.restore();}
  }
  const petH=L.petH||80,cy=L.ground-petH*.5,px=sv.px??w/2;
  if(sv.rays>.01){const size=Math.max(w,L.h)*1.25/256;blit(c,amb.rays,px,cy,size,sv.rays*(night?.4:.55),rm?0:t*.35);if(total>=30)blit(c,amb.raysHot,px,cy,size*.8,sv.rays*.5,rm?.26:-t*.5);}
  if(sv.gold>.01){
    c.globalAlpha=sv.gold*.5;c.drawImage(amb.haze.cv,0,0,w,L.skyTop+L.playH*.45);c.globalAlpha=1;
    if(!rm){const fall=L.playH+110,streaks=w>620?14:9;for(let i=0;i<streaks;i++){const h1=hash01(i,71),h2=hash01(i,72);blit(c,amb.spark,h1*w,L.skyTop+L.playH-((h2*fall+t*(80+h1*60))%fall),.5+h1*.4,sv.gold*(.4+h2*.4));}}
  }
  if(sv.zoom>.01&&!rm&&run.characterId==='griffin'){
    c.strokeStyle='#ffffff';c.lineWidth=2.4;c.lineCap='round';c.globalAlpha=sv.zoom*.45;c.beginPath();
    for(let i=0;i<10;i++){const h1=hash01(i,81),h2=hash01(i,82),x=w+60-((h1*w+t*(700+h2*700))%(w+220)),y=L.ground-8-h2*L.playH*.78;c.moveTo(x,y);c.lineTo(x+50+h1*110,y);}
    c.stroke();c.globalAlpha=1;
  }
}
function bubble(c,e,L,kit,bub,amb,sv,run,t,rm,night){
  const R=radiusOf(e,L),x=e.x*L.w,y=L.top+e.y*L.fh,kind=e.kind,id=e.id||0;
  if(y<L.top-R||y>L.ground+R+14)return;
  // fade out under the HUD band as a bubble floats away, and grow in as it leaves the grass
  const fade=clamp((e.y-.02)/.13,0,1),born=rm?1:clamp(e.age/.28,0,1),grow=rm?1:.55+ease.outBack(born)*.45;
  if(fade<=.01)return;
  const wobble=rm?0:Math.sin(t*3.2+(e.phase||id))*.035,sx=(1+wobble)*grow,sy=(1-wobble)*grow,safe=kind==='burr'&&run.powerTime>0&&run.characterId==='spike';
  const body=kind==='gold'?bub.gold:kind==='burr'?(safe?bub.safe:bub.burr):bub.treat,diameter=R*2,scale=diameter/SIDE;
  if(night)blit(c,amb.glowWhite,x,y,R*3.2/64,(rm?.6:.7+Math.sin(t*2+id)*.15)*fade);
  if(kind==='gold')blit(c,amb.glowGold,x,y,R*2.8/64,.85*fade);
  if(run.feverTime>0&&kind!=='burr')blit(c,amb.glowWarm,x,y,R*2.4/64,.4*fade*Math.min(1,run.feverTime));
  const before=c.globalAlpha;if(fade<1)c.globalAlpha=before*fade;
  c.save();c.translate(x,y);c.scale(sx,sy);
  c.drawImage(body.cv,-diameter/2,-diameter/2,diameter,diameter);
  // what is inside: a treat, a golden chicken strip, or a burr
  const spin=rm?0:Math.sin(t*1.6+id)*.25;
  if(kind==='burr'){const art=bub.burrArt,k=R*1.28/art.w;c.rotate(spin*.5);c.drawImage(art.cv,-art.w*k/2,-art.h*k/2,art.w*k,art.h*k);}
  else if(kind==='gold'){const art=kit.chicken,k=R*1.18/(kit.size*1.5);c.rotate(-.5+spin);c.drawImage(art.cv,-art.w*k/2,-art.h*k/2,art.w*k,art.h*k);}
  else if(e.variant===1){const art=kit.ball,k=R*.92/(kit.size*.88);c.rotate(spin);c.drawImage(art.cv,-art.w*k/2,-art.h*k/2,art.w*k,art.h*k);}
  else{const art=kit.biscuit,k=R*1.05/(kit.size*1.2);c.rotate(.5+spin);c.drawImage(art.cv,-art.w*k/2,-art.h*k/2,art.w*k,art.h*k);}
  c.restore();c.globalAlpha=before;
  if(kind==='gold'&&!rm){const a=t*3+id;blit(c,amb.spark,x+Math.cos(a)*R*.95,y+Math.sin(a)*R*.8,.5+.2*Math.sin(t*9+id),.9*fade);}
}
function trails(c,run,L){
  if(!run.trails?.length)return;c.lineCap='round';c.lineJoin='round';
  for(const s of run.trails){
    const pts=s.pts;if(pts.length<2)continue;const last=pts[pts.length-1],age=run.time-last.t,alive=clamp(1-(age-.12)/.3,0,1);if(alive<=0)continue;
    c.globalAlpha=.55*alive;c.strokeStyle='#fff6c8';c.lineWidth=9;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x*L.w,L.top+p.y*L.fh):c.moveTo(p.x*L.w,L.top+p.y*L.fh));c.stroke();
    c.globalAlpha=.9*alive;c.strokeStyle='#ffffff';c.lineWidth=3;c.stroke();
  }
  c.globalAlpha=1;
}
function pounceColumn(c,L,sv,rm){
  if(rm)return;const p=sv.pounce,k=clamp(p.life/p.max,0,1),w=L.w*.34;
  c.globalAlpha=.32*k;c.fillStyle='#ffc3df';c.fillRect(p.x*L.w-w/2,L.top,w,L.fh);c.globalAlpha=1;
}
// The keyboard marker: a ring that turns gold over something it would pop.
function reticle(c,run,L,t,rm){
  const x=run.reticle.x*L.w,y=L.top+run.reticle.y*L.fh;let over=false;
  for(const e of run.entities)if(!e.popped&&!e.gone&&e.kind!=='burr'&&Math.hypot(e.x*run.field.w-run.reticle.x*run.field.w,e.y*run.field.h-run.reticle.y*run.field.h)<=run.hitPx(e)){over=true;break;}
  c.save();c.lineWidth=4;c.strokeStyle='#10231f';c.beginPath();c.arc(x,y,24,0,TAU);c.stroke();
  c.lineWidth=2.5;c.strokeStyle=over?'#ffd23f':'#fff4db';c.beginPath();c.arc(x,y,24,0,TAU);c.moveTo(x-34,y);c.lineTo(x-14,y);c.moveTo(x+14,y);c.lineTo(x+34,y);c.moveTo(x,y-34);c.lineTo(x,y-14);c.moveTo(x,y+14);c.lineTo(x,y+34);c.stroke();
  c.restore();
}
function buddy(view,c,run,L,sv,amb,t,dt,rm){
  const id=run.characterId,art=view.sprites[id],gy=L.ground,front=art?.frames[3],aspect=front?front.w/front.h:.8;
  let petH=clamp(L.h*.2,70,150);if(petH*aspect>L.w*.34)petH=L.w*.34/aspect;
  L.petH=petH;L.petW=petH*aspect;
  // The buddy shifts toward the last pop and leans into it, so it always seems to be watching the play.
  const home=L.w/2,want=sv.lookX===null?home:clamp(home+(sv.lookX-home)*.3,L.petW*.6,L.w-L.petW*.6);
  if(sv.px===null||rm)sv.px=rm?home:want;else sv.px+=(want-sv.px)*Math.min(1,dt*6);
  const px=sv.px,leanWant=rm||sv.lookX===null?0:clamp((sv.lookX-px)/L.w,-.5,.5)*.5;sv.lean+=(leanWant-sv.lean)*Math.min(1,dt*10);
  if(rm){sv.squash=1;sv.squashV=0;sv.hop=0;sv.hopV=0;}
  else if(dt>0){
    sv.squashV+=(-380*(sv.squash-1)-13*sv.squashV)*dt;sv.squash=clamp(sv.squash+sv.squashV*dt,.55,1.5);
    if(sv.hop>0||sv.hopV>0){sv.hopV-=1900*dt;sv.hop+=sv.hopV*dt;if(sv.hop<=0){sv.hop=0;if(sv.hopV<-250){sv.squash=.86;sv.squashV=0;}sv.hopV=0;}}
  }
  const hop=sv.hop,cy=gy-hop-petH*.5,sw=L.petW*(.72-Math.min(.3,hop/260));
  c.drawImage(amb.shadow.cv,px-sw,gy-7,sw*2,16);
  if(sv.heat>.02)blit(c,amb.glowWarm,px,cy,petH/28*(rm?1:1+Math.sin(t*9)*.06),sv.heat*.78);
  if(sv.zoom>.02){
    blit(c,amb.glowGold,px,cy,petH/19,sv.zoom*.6);blit(c,amb.glowWhite,px,cy,petH/27,sv.zoom*.95);
    const pulse=rm?0:Math.sin(t*12)*.04;c.globalAlpha=sv.zoom*.8;c.strokeStyle='#fff6c8';c.lineWidth=3;c.beginPath();c.ellipse(px,cy,petH*(.74+pulse),petH*(.7-pulse),0,0,TAU);c.stroke();c.globalAlpha=1;
  }
  if(!art)return;
  const squash=sv.squash*(rm?1:1+Math.sin(t*3.2)*.014),stretch=1/Math.sqrt(squash),lean=sv.lean+(rm?0:sv.recoil>0?Math.sin(sv.recoil*22)*.12*sv.recoil:0);
  view._petSprite(c,id,3,px,gy-hop,L.petW,true,1,stretch,squash,lean,1);
  const mouth=view._mouth;mouth.x=px;mouth.y=gy-hop-petH*.6;
}
function overlay(c,run,L,sv,amb,t,world,rm,view){
  const w=L.w,h=L.h,time=run.time;
  if(sv.heat>.01){
    const glow=sv.heat*(rm?.62:.66+Math.sin(t*5)*.16),side=clamp(w*.17,46,120);
    c.globalAlpha=glow;c.drawImage(amb.heatLeft.cv,0,0,side,h);c.drawImage(amb.heatRight.cv,w-side,0,side,h);
    c.globalAlpha=glow*.7;c.drawImage(amb.heatTop.cv,0,0,w,side*.9);c.drawImage(amb.heatBottom.cv,0,h-side*.9,w,side*.9);c.globalAlpha=1;
  }
  if(sv.push>.01){c.globalAlpha=sv.push*.34;c.drawImage(amb.dusk.cv,0,0,w,L.skyTop+L.playH*.75);c.globalAlpha=1;}
  if(time<2.1&&(run.mode==='running'||run.mode==='paused')){
    // 3, 2, 1, GO! on simulation time, while the first bubbles are already floating up
    const go=time>=1.5,beat=go?(time-1.5)/.6:(time%.5)/.5,base=Math.min(w*.3,L.playH*(L.short?.3:.34)),y=L.skyTop+L.playH*(L.short?.52:.4);
    const pop=rm?1:beat<.22?.55+ease.outBack(beat/.22)*.45:1,text=go?'GO!':String(3-Math.floor(time/.5));
    c.save();c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
    c.globalAlpha=beat>.72?1-(beat-.72)/.28:1;c.font=`900 ${Math.round(base*(go?.74:1)*pop)}px Roadbook,Georgia,serif`;
    c.lineWidth=Math.max(5,base*.09);c.strokeStyle='#0f3537';c.strokeText(text,w/2,y);c.fillStyle=go?'#ffe066':'#fff6dc';c.fillText(text,w/2,y);
    c.restore();
  }
  const b=sv.banner,sub=sv.sub,lineY=L.skyTop+Math.max(L.playH*.2,L.short?64:44);
  sv.headFloor=b||sub?lineY+(sub?(b?Math.max(30,b.size*.5+17):L.short?24:30)+12:(b.size||30)*.55):0;
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

// ---- events ---------------------------------------------------------------------------
function say(view,L,text,x,y,options){const half=text.length*(options.size||15)*.36+6;return view.juice.popup(text,clamp(x,half,L.w-half),y,options);}
function headline(sv,text,color,size=32,life=1.5,stroke='#0f3537'){const item={text,color,size,life,max:life,stroke};if(sv.banner&&sv.banner.max-sv.banner.life<.55)sv.banner.life=Math.min(sv.banner.life,.5);sv.banner=item;}
function subhead(sv,text,color,life=1.3){sv.sub={text,color,life,max:life};}
const spinBlit=(c,s,x,y,rot,scale,alpha=1)=>blit(c,s,x,y,scale,alpha,rot);

export function bubbleEvent(view,e,run){
  const L=view._bL,sv=stateFor(view,run),j=view.juice,rm=view.reducedMotion;
  if(!L||e.type==='start')return;
  const X=v=>(Number(v)||0)*L.w,Y=v=>L.top+(Number(v)||0)*L.fh,px=sv.px??L.w/2,petH=L.petH||80,gy=L.ground,mid=gy-petH*.5,head=gy-petH-sv.hop;
  switch(e.type){
    case 'collect':{
      const x=X(e.x),y=Y(e.y),R=Math.max((e.r||.06)*L.fh,BUBBLE_HIT.minRadius),gold=e.kind==='gold',total=e.totalMultiplier||1;
      sv.lookX=x;
      if(e.mass){if(!rm)j.burst('bubble',x,y,{count:2,scale:R/26});break;}
      sv.rapid=run.time-(sv.lastCollect??-9)<.4?(sv.rapid||0)+1:1;sv.lastCollect=run.time;
      sv.pip=1;if(!rm){sv.squash=gold?.74:.86;sv.squashV=0;if(sv.hop<=0)sv.hopV=gold?320:160;}
      // Inside a long string the STRING label carries the news, so the little per-bubble numbers stop piling up.
      if(sv.rapid<4)say(view,L,`+${e.value}${total>1?`  x${fmt(total)}`:''}`,x,y-R*.5,{color:multColor(total),stroke:multStroke(total),size:clamp(13+Math.sqrt(total)*2.4,14,26)+(gold?4:0),life:gold?1.1:.6,rise:rm?0:38});
      if(!rm){
        j.ring(x,y,{color:gold?'#ffe58a':'#e9fbff',radius:R*1.4,from:R*.55,life:.26,width:3});
        j.burst('bubble',x,y,{count:gold?10:6,scale:R/24,colors:gold?['#ffe58a','#fff6d0','#ffffff']:undefined});
        if(gold){j.burst('gold',x,y,{count:9,scale:.8});j.hitStop(.03);}
        const mouth=view._mouth,kit=view._kit(clamp(Math.round(Math.min(L.w*.074,L.fh*.06)),26,44)),art=gold?kit.chicken:e.variant===1?kit.ball:kit.biscuit,far=Math.hypot(x-mouth.x,y-mouth.y);
        j.fly({x,y,target:()=>mouth,life:clamp(.1+far/1500,.12,.34),arc:far>60?26:6,draw:(cc,fx,fy,k)=>spinBlit(cc,art,fx,fy,1.2+k*5,1-k*.6)});
      }
      break;
    }
    case 'string':{
      const x=X(e.x),y=Y(e.y);if(sv.stringPop)sv.stringPop.life=Math.min(sv.stringPop.life,.1);
      sv.stringPop=say(view,L,`STRING x${e.count}  +${e.bonus}`,x,y-Math.max(26,(L.fh*.07)),{color:'#fff3a5',stroke:'#133b3dee',size:clamp(15+e.count*1.3,16,28),life:1,rise:rm?0:36});
      if(!rm){sv.hopV=Math.max(sv.hopV,230+Math.min(e.count,8)*22);sv.bump=1;if(e.count===3)j.burst('star',x,y,{count:8});}
      break;
    }
    case 'burr':{
      const x=X(e.x),y=Y(e.y);sv.recoil=1;
      say(view,L,'PRICKLY!',x,y-24,{color:'#ff9a8a',stroke:'#4a1620e6',size:19,life:.9,rise:rm?0:30});
      if(!rm){j.burst('hit',x,y,{count:10});j.burst('debris',x,y,{count:6,colors:['#8a5a34','#a8774a','#5d3b22']});j.shake(.16);}
      break;
    }
    case 'smash':if(e.value>=100)say(view,L,`SHELL ROLL +${e.value}`,X(e.x),Y(e.y),{color:'#ffc972',size:18,life:.9,rise:rm?0:34});else if(!rm)j.burst('stomp',X(e.x),Y(e.y),{count:5,scale:.7});break;
    case 'chain-lost':
      sv.lost=1;
      if(e.multiplier>1){
        say(view,L,'CHAIN LOST',px,head-22,{color:'#ff9a8a',stroke:'#4a1620e6',size:19,life:1.1,rise:rm?0:24});
        if(!rm&&e.reason!=='burr'){j.burst('debris',px,gy+16,{count:7,colors:[multColor(e.multiplier),'#fff4d7','#ff9a8a'],speed:.8});}
      }
      break;
    case 'combo':
      if(e.multiplier>1&&e.combo<=24){
        sv.bump=1;subhead(sv,e.multiplier>=5?'CHAIN MAX  x5!':`CHAIN  x${e.multiplier}`,multColor(e.multiplier),1.1);
        if(!rm){j.ring(px,mid,{color:multColor(e.multiplier),radius:petH*1.1,life:.4,width:4});j.burst('spark',px,gy+14,{count:8});}
      }
      break;
    case 'fever':
      subhead(sv,'FRENZY  x2!','#ffb347',1.5);
      if(!rm){j.ring(px,mid,{color:'#ffb347',radius:petH*2,life:.55,width:7});j.burst('spark',px,mid,{count:16,colors:['#ffb347','#ffe066','#ff8a3d']});j.flash('#ffb347',.18,.35);}
      break;
    case 'gold-rush':{
      const fresh=(e.duration||0)<=4.01;
      if(fresh||!sv.sub||sv.sub.life<.4)subhead(sv,fresh?'GOLD RUSH  x2!':'GOLD RUSH  +4s','#ffe066',fresh?1.5:.9);
      if(!rm&&fresh){j.ring(px,mid,{color:'#ffe066',radius:petH*2,life:.55,width:7});j.flash('#ffe27a',.14,.3);}
      break;
    }
    case 'power':
      subhead(sv,POWER_LINE[e.characterId]||'POWER!','#fff6c8',1.6);
      if(!rm){j.ring(px,mid,{color:'#fff6c8',radius:petH*2.4,life:.6,width:8});j.ring(px,mid,{color:'#b5eeef',radius:petH*1.5,life:.45,width:5});j.burst('power',px,mid);j.zoomPunch(.04);j.flash('#fff6c8',.2,.3);sv.hopV=Math.max(sv.hopV,320);}
      break;
    case 'bark':if(!rm){j.ring(px,mid,{color:'#ffffff',radius:Math.max(L.w,L.h)*.9,from:petH*.4,life:.55,width:12});j.ring(px,mid,{color:'#fff0a8',radius:Math.max(L.w,L.h)*.7,from:petH*.3,life:.45,width:7});j.shake(.14);}break;
    case 'summon':if(!rm){j.ring(px,mid,{color:'#ffd56d',radius:petH*1.9,life:.6,width:6});j.burst('gold',px,head,{count:12});}break;
    case 'pounce':
      sv.pounce={x:e.x,life:.35,max:.35};if(!rm){sv.hopV=Math.max(sv.hopV,380);j.burst('star',X(e.x),L.top+L.fh*.5,{count:10,colors:['#ffc3df','#fff0f6','#ffffff']});}
      break;
    case 'split':if(!rm)j.burst('bubble',X(e.x),Y(e.y),{count:6,colors:['#dfe6ff','#ffffff','#fff0a8']});subhead(sv,'SPLIT!  TWO FOR ONE','#dfe6ff',1);break;
    case 'bloom':{
      const x=X(e.x),y=Y(e.y);subhead(sv,'BLUEBONNET BURST!','#c5d0ff');
      if(!rm){j.ring(x,y,{color:'#9db0ff',radius:L.fh*.12,life:.45,width:4});j.burst('leaf',x,y,{count:12,colors:['#5a7cf0','#3d5bd0','#dfe6ff'],speed:1.3});}
      break;
    }
    case 'charged':if(!rm){j.ring(px,mid,{color:'#fff2ab',radius:petH*.95,life:.45,width:4});j.burst('spark',px,mid,{count:6});}break;
    case 'stack':{
      const level=Number(e.level)||Number(e.total)||Number(e.totalMultiplier)||Number(e.tier)||0,tier=level>=30?3:level>=20?2:level>=10?1:0;
      if(!tier||Math.abs(run.time-sv.stackAt[tier])<.3)break;
      const again=run.time-sv.stackAt[tier]<4;sv.stackAt[tier]=run.time;
      const text=['','10x STACK!','20x STACK!','30x MAX STACK!'][tier],color=multColor(tier*10);
      if(again)subhead(sv,text,color,1.1);else headline(sv,text,color,[0,34,40,46][tier],1.4+tier*.25,multStroke(tier*10).slice(0,7));
      if(!rm&&!again){
        for(let i=0;i<tier;i++)j.ring(px,mid,{color,radius:petH*(1.4+i*.9),life:.5+i*.14,width:7-i});
        j.burst(tier>=2?'confetti':'star',px,head,{count:10+tier*9});sv.hopV=Math.max(sv.hopV,280+tier*70);sv.bump=1;
        if(tier===3){j.burst('confetti',L.w/2,L.skyTop+L.playH*.3,{count:30});if(!sv.maxed){sv.maxed=true;j.flash('#fff3c4',.28,.4);}}
      }
      break;
    }
    case 'section':if(SECTION_BANNER[e.section])headline(sv,SECTION_BANNER[e.section],'#fff6dc',32,1.5);break;
    case 'final-push':
      headline(sv,'FINAL 10!','#ffd96d',40,1.4);
      if(!rm){j.flash('#ff8a5c',.18,.4);j.ring(L.w/2,L.skyTop+L.playH*.46,{color:'#ffd96d',radius:Math.min(L.w,L.playH)*.6,life:.6,width:8});}
      break;
    case 'tick':if(e.remaining<=3)j.zoomPunch(.01);break;
    case 'finale':subhead(sv,'GOLDEN GOODBYE!','#ffe066',1.6);break;
    case 'countdown':if(!e.count&&!rm)j.ring(L.w/2,L.skyTop+L.playH*.5,{color:'#ffe066',radius:Math.min(L.w,L.playH)*.42,life:.5,width:6});break;
    case 'won':if(!rm){j.burst('confetti',L.w/2,L.skyTop+L.playH*.3,{count:40});j.ring(px,mid,{color:'#fff3c4',radius:petH*1.8,life:.6,width:6});}break;
  }
}
