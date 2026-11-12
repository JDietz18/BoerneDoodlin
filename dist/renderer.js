import {CHARACTER_ART} from './characters.js?v=20';
import {WORLD} from './adventure-engine.js?v=20';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;
const COLORS=[
  {sky:'#a9ded8',soil:'#c7a777',edge:'#77a251',dark:'#315d3a',glow:'#ffdc78',image:0},
  {sky:'#abc9ab',soil:'#a98462',edge:'#698844',dark:'#2b4c36',glow:'#ffdf8f',image:0},
  {sky:'#9ddbdc',soil:'#d59869',edge:'#d5ae6e',dark:'#a4573e',glow:'#ffd476',image:2},
  {sky:'#1c344a',soil:'#796675',edge:'#9c8490',dark:'#3c4358',glow:'#c6deff',image:2},
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

export class Renderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.sprites={};this.particles=[];this.labels=[];this.shake=0;this.time=0;this.assetsReady=false;this.reducedMotion=false;
    this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.dpr=dpr;}
  async load(){
    await Promise.all(Object.entries(CHARACTER_ART).map(async([id,art])=>{const im=cleanImage(await imageLoad(art.src+'?v=20'));const regions=art.regions||(id==='mittens'?[[0,0,.53,.445],[.53,0,1,.445],[0,.445,.52,1],[.52,.445,1,1]]:undefined);const f=frames(im,2,2,regions);this.sprites[id]={image:im,frames:f,runWidth:Math.max(...f.slice(0,3).map(a=>a.w))};}));
    const decorative=await Promise.allSettled([imageLoad('/assets/route-biomes.jpg'),imageLoad('/assets/family-rv.png')]);
    if(decorative[0].status==='fulfilled')this.biomes=decorative[0].value;
    if(decorative[1].status==='fulfilled'){this.rv=cleanImage(decorative[1].value);this.rvFrame=frames(this.rv,1,1)[0];}
    this.assetsReady=true;
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
    if(theme===3){c.fillStyle='#13254488';c.fillRect(0,0,w,h);for(let i=0;i<50;i++){const x=(i*173.51+41)%w,y=(i*47.71+17)%(Math.max(50,ground*.54));c.globalAlpha=.35+(Math.sin(this.time*.6+i)*.25+.25);c.fillStyle='#fff4ca';c.beginPath();c.arc(x,y,i%6?1:1.8,0,TAU);c.fill();}c.globalAlpha=1;c.fillStyle='#f8e9b8';c.beginPath();c.arc(w*.83,ground*.19,24,0,TAU);c.fill();c.fillStyle='#24374c';c.beginPath();c.arc(w*.83+9,ground*.19-5,23,0,TAU);c.fill();}
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
  drawHome({characterId='griffin',time=0,theme=0,reducedMotion=false}={}){
    time=reducedMotion?0:time;this.time=time;this.reducedMotion=reducedMotion;const c=this.begin(),w=this.width,h=this.height,mobile=w<=736,compact=h<430&&!mobile;
    this.scene(c,theme,0,true);
    if(mobile){const shade=c.createLinearGradient(0,165,0,Math.min(h,450));shade.addColorStop(0,'#123c3500');shade.addColorStop(.6,'#123c35ed');shade.addColorStop(1,'#123c35');c.fillStyle=shade;c.fillRect(0,165,w,h-165);}
    const x=mobile?w*.54:w*.735,y=mobile?255:compact?h*.78:h*.78;
    if(this.rv){const rw=mobile?137:compact?170:250;const f=this.rvFrame,s=rw/f.w;c.globalAlpha=.88;c.drawImage(this.rv,f.x,f.y,f.w,f.h,mobile?w*.03:w*.48,(mobile?188:y-92)-f.h*s,rw,f.h*s);c.globalAlpha=1;}
    c.fillStyle='#122a2555';c.beginPath();c.ellipse(x,y+1,mobile?80:130,15,0,0,TAU);c.fill();
    const heroWidth=mobile?151:compact?180:Math.min(285,w*.27),a=this.sprites[characterId],f=a?.frames[3];
    const maxHeight=mobile?220:compact?245:h*.66;const width=f?Math.min(heroWidth,maxHeight*f.w/f.h):heroWidth;
    this.character(c,characterId,3,x,y+(reducedMotion?0:Math.sin(time*1.2)*2),width,{portrait:true});
    if(!mobile){const bx=x+width*.58,by=y-width*.75;for(let i=0;i<3;i++){const yy=by-i*67+Math.sin(time*1.6+i)*7;c.save();c.shadowColor='#ffe29e';c.shadowBlur=20;bone(c,bx+(i===1?36:0),yy,31,'#ffdc80');c.restore();}}
    if(mobile){c.fillStyle='#fff0b5';for(let i=0;i<3;i++)star(c,w*.83+(i%2)*22,60+i*45,5,'#ffde85',time*.1);}
  }
  worldPosition(x,y){return {x:x*this.scale,y:this.ground-y*this.scale};}
  addEvent(event){
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
  drawStorm(run,{time=0,dt=0,reducedMotion=false}={}){
    this.time=reducedMotion?0:time;this.reducedMotion=reducedMotion;this.updateEffects(dt);
    const c=this.begin(),w=this.width,h=this.height;this.ground=h-clamp(h*.15,65,110);this.scale=w/1120;
    const sy=Math.max(.22,(this.ground-145)/480),sx=this.scale;this.scene(c,0,0);
    // A broad catching lane makes moving the pet legible on both portrait and landscape screens.
    const px=run.player.x*sx,petWidth=clamp(w*.13,58,142),py=this.ground;
    c.save();c.strokeStyle='#ffedac69';c.lineWidth=2;c.setLineDash([6,7]);c.beginPath();c.moveTo(30,py-2);c.lineTo(w-30,py-2);c.stroke();c.setLineDash([]);
    for(const e of run.entities){
      if(e.taken||e.hit)continue;const x=e.x*sx,y=py-(e.y+e.h*.5)*sy,size=w<700?25:34;
      if(y<110||y>py+35)continue;
      c.save();c.translate(x,y);c.rotate(reducedMotion?0:Math.sin(time*1.5+e.id)*.13);
      if(e.type==='bone'){bone(c,0,0,size,'#fff2c4');}
      else if(e.type==='gold'){c.shadowColor='#ffda5e';c.shadowBlur=18;star(c,0,0,size*.67,'#ffcd55',this.time*.4);star(c,0,0,size*.37,'#fff0ab',this.time*.4);}
      else if(e.type==='mud'){c.fillStyle='#705040';c.strokeStyle='#3e302b';c.lineWidth=2;c.beginPath();for(let n=0;n<12;n++){const a=n*TAU/12,r=size*.52*(n%2?.85:1);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();c.fillStyle='#a1815e';c.beginPath();c.ellipse(-3,-5,6,3,-.4,0,TAU);c.fill();}
      else{const colors={shield:'#b0dfff',magnet:'#9fe6de',heart:'#ffb9a9'};c.fillStyle=colors[e.type]||'#ffda75';c.strokeStyle='#fff4cc';c.lineWidth=2;c.beginPath();c.arc(0,0,size*.57,0,TAU);c.fill();c.stroke();c.fillStyle='#21464d';c.font=`bold ${size*.72}px system-ui`;c.textAlign='center';c.fillText({shield:'◆',magnet:'U',heart:'♥'}[e.type]||'★',0,size*.25);}
      c.restore();
    }
    c.fillStyle='#123c3855';c.beginPath();c.ellipse(px,py+2,petWidth*.54,10,0,0,TAU);c.fill();
    if(run.powerTime>0||run.magnetTime>0){c.strokeStyle=run.powerTime>0?'#ffe68c99':'#b5eeeb88';c.lineWidth=3;c.beginPath();c.ellipse(px,py-petWidth*.4,petWidth*.9,petWidth*.65,0,0,TAU);c.stroke();}
    c.save();c.translate(px,0);const moving=Math.abs(run.player.moving)>0,pose=moving?Math.floor(time*9)%2:3;if(moving&&run.player.facing<0)c.scale(-1,1);
    const art=this.sprites[run.characterId],front=art.frames[3],standingWidth=petWidth*.88*front.w/front.h;
    this.character(c,run.characterId,pose,0,py,moving?petWidth:standingWidth,{portrait:!moving,alpha:run.invincible>0&&Math.floor(time*8)%2?.55:1});c.restore();
    if(run.shieldCharges>0){c.strokeStyle='#b9e9ffcc';c.lineWidth=3;c.beginPath();c.ellipse(px,py-petWidth*.55,petWidth*.65,petWidth*.75,0,0,TAU);c.stroke();}
    for(const p of this.particles){c.globalAlpha=Math.min(1,p.life/.25);c.fillStyle=p.color;c.beginPath();c.arc(p.x*sx,py-p.y*sy,p.r*.8,0,TAU);c.fill();}c.globalAlpha=1;
    c.textAlign='center';c.font='900 16px system-ui';for(const l of this.labels){c.globalAlpha=Math.min(1,l.life*2);c.strokeStyle='#204038';c.lineWidth=4;c.strokeText(l.text,l.x*sx,py-l.y*sy);c.fillStyle=l.color;c.fillText(l.text,l.x*sx,py-l.y*sy);}c.restore();
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
