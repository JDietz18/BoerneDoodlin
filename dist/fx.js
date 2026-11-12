// Shared game-feel toolkit: particles, popups, rings, screen shake, hit-stop,
// slow motion, and flashes. Pure logic plus Canvas 2D drawing; no DOM access,
// so it runs in tests. Coordinates are y-down in whatever space the caller
// has already set on the context. Everything is bounded and expires.

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;

// kind -> how a burst behaves. Counts are upper bounds before reduced motion.
const KINDS={
  dust:{count:7,shape:'puff',speed:[20,85],spread:[Math.PI*1.05,Math.PI*1.95],gravity:-30,drag:2.6,life:[.32,.6],size:[5,11],grow:16,colors:['#fff4d6cc','#e9dcc0aa']},
  land:{count:10,shape:'puff',speed:[50,150],spread:[Math.PI*.98,Math.PI*2.02],gravity:-20,drag:3.4,life:[.28,.5],size:[4,9],grow:18,flat:.32,colors:['#fff4d6cc','#eadfc4aa']},
  spark:{count:10,shape:'spark',speed:[90,260],gravity:260,drag:1.2,life:[.25,.55],size:[2,4],colors:['#fff3b8','#ffd96d','#ffffff']},
  star:{count:8,shape:'star',speed:[80,230],gravity:340,drag:.8,life:[.45,.85],size:[4,8],spin:8,colors:['#ffe38c','#ffc94f','#fff6d0']},
  gold:{count:14,shape:'star',speed:[110,300],gravity:300,drag:.9,life:[.55,1],size:[4,9],spin:9,colors:['#ffd75e','#fff0a8','#f2a93b']},
  crumb:{count:6,shape:'dot',speed:[60,170],gravity:620,drag:.4,life:[.35,.6],size:[2,3.5],colors:['#f3d9a0','#d9b877','#fff2c9']},
  stomp:{count:12,shape:'star',speed:[130,300],gravity:420,drag:1,life:[.35,.7],size:[4,8],spin:10,colors:['#ffc972','#fff0b7','#ff9f6b']},
  hit:{count:14,shape:'spark',speed:[120,320],gravity:200,drag:1.4,life:[.3,.6],size:[2.5,5],colors:['#ff947c','#ffd0c2','#ff6b57']},
  splash:{count:14,shape:'drop',speed:[130,380],spread:[Math.PI*1.2,Math.PI*1.8],gravity:900,drag:.3,life:[.45,.8],size:[2.5,5],colors:['#d9f6f4','#9fdde0','#ffffff']},
  debris:{count:9,shape:'rect',speed:[40,170],spread:[Math.PI*.1,Math.PI*.9],gravity:880,drag:.2,life:[.5,.9],size:[4,8],spin:7,colors:['#c8b29b','#a58e76','#ddc9a7']},
  leaf:{count:6,shape:'leaf',speed:[30,110],gravity:70,drag:1.1,life:[.9,1.6],size:[5,8],spin:4,sway:26,colors:['#8fb866','#c9d77a','#e2a857']},
  confetti:{count:26,shape:'rect',speed:[160,420],spread:[Math.PI*1.1,Math.PI*1.9],gravity:520,drag:1.1,life:[.9,1.7],size:[5,9],spin:12,sway:18,colors:['#ffd96d','#ff9f7c','#9fe3d4','#fff4d7','#b9a3f0','#8fd07f']},
  heart:{count:5,shape:'heart',speed:[40,110],spread:[Math.PI*1.2,Math.PI*1.8],gravity:-60,drag:1.4,life:[.6,1],size:[6,9],colors:['#ffb4a3','#ff8f8f']},
  poof:{count:9,shape:'puff',speed:[40,130],gravity:-40,drag:3,life:[.3,.55],size:[7,13],grow:22,colors:['#fff6e2cc','#f1e4c8aa']},
  power:{count:22,shape:'spark',speed:[160,420],gravity:0,drag:2.2,life:[.35,.7],size:[3,5],colors:['#fff2ab','#b5eeef','#ffffff']},
  bubble:{count:8,shape:'ring',speed:[30,110],gravity:-120,drag:1.2,life:[.4,.8],size:[3,7],colors:['#d9f6f4','#ffffff']}
};

export class Juice {
  constructor({maxParticles=260,maxPopups=26,maxRings=14,random=Math.random}={}){
    this.maxParticles=maxParticles;this.maxPopups=maxPopups;this.maxRings=maxRings;this._random=random;
    this.reducedMotion=false;this.clear();
  }
  clear(){
    this.particles=[];this.popups=[];this.rings=[];this.fliers=[];
    this.trauma=0;this.kickX=0;this.kickY=0;this.zoom=0;this._freeze=0;this._slow=1;this._slowTime=0;this._flash=null;this.clock=0;
  }
  rand(a=0,b=1){const r=this._random();return a+(b-a)*clamp(Number.isFinite(r)?r:.5,0,.999999);}

  // --- time -----------------------------------------------------------
  // A brief freeze sells an impact. Slow motion stretches a big moment.
  hitStop(seconds=.06){if(this.reducedMotion)return;this._freeze=Math.max(this._freeze,clamp(finite(seconds),0,.25));}
  slowMo(scale=.4,seconds=.5){if(this.reducedMotion)return;this._slow=clamp(finite(scale,1),.15,1);this._slowTime=Math.max(this._slowTime,clamp(finite(seconds),0,2));}
  // Converts a real frame delta into the delta the simulation should use.
  step(dt){
    dt=clamp(finite(dt),0,.1);
    if(this._freeze>0){const used=Math.min(dt,this._freeze);this._freeze-=used;dt-=used;if(dt<=0)return 0;}
    if(this._slowTime>0){this._slowTime=Math.max(0,this._slowTime-dt);return dt*this._slow;}
    return dt;
  }
  get frozen(){return this._freeze>0;}

  // --- camera ---------------------------------------------------------
  shake(amount=.3){if(this.reducedMotion)return;this.trauma=clamp(this.trauma+finite(amount),0,1);}
  kick(dx=0,dy=0){if(this.reducedMotion)return;this.kickX=clamp(this.kickX+finite(dx),-40,40);this.kickY=clamp(this.kickY+finite(dy),-40,40);}
  zoomPunch(amount=.04){if(this.reducedMotion)return;this.zoom=clamp(this.zoom+finite(amount),-.12,.12);}
  flash(color='#ffffff',strength=.35,life=.22){if(this.reducedMotion)return;this._flash={color,strength:clamp(finite(strength),0,.8),life:clamp(finite(life,.2),.05,1.5),max:clamp(finite(life,.2),.05,1.5)};}
  // Screen offset for this frame. Trauma is squared so small bumps stay subtle.
  get offset(){
    if(this.reducedMotion||(!this.trauma&&!this.kickX&&!this.kickY&&!this.zoom))return {x:0,y:0,rot:0,zoom:1};
    const t=this.trauma*this.trauma,c=this.clock;
    return {x:(Math.sin(c*91.7)+Math.sin(c*53.3)*.6)*t*9+this.kickX,y:(Math.cos(c*83.1)+Math.sin(c*61.9)*.6)*t*7+this.kickY,rot:Math.sin(c*71.3)*t*.012,zoom:1+this.zoom};
  }

  // --- emitters -------------------------------------------------------
  emit(p){
    if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return null;
    const life=clamp(finite(p.life,.5),.05,4);
    const particle={x:p.x,y:p.y,vx:finite(p.vx),vy:finite(p.vy),gravity:finite(p.gravity),drag:clamp(finite(p.drag),0,12),life,max:life,size:clamp(finite(p.size,4),.5,60),grow:finite(p.grow),rot:finite(p.rot),spin:finite(p.spin),sway:finite(p.sway),phase:finite(p.phase),flat:clamp(finite(p.flat,1),.1,1),color:p.color||'#fff4d7',shape:p.shape||'dot',text:p.text||''};
    this.particles.push(particle);
    if(this.particles.length>this.maxParticles)this.particles.splice(0,this.particles.length-this.maxParticles);
    return particle;
  }
  burst(kind,x,y,{count,color,colors,angle,spread,speed=1,scale=1,vx=0,vy=0}={}){
    const k=KINDS[kind]||KINDS.spark;if(!Number.isFinite(x)||!Number.isFinite(y))return 0;
    let n=Math.round(clamp(finite(count,k.count),0,80));
    if(this.reducedMotion)n=Math.min(n,kind==='confetti'?6:3);
    const palette=colors||(color?[color]:k.colors),[a0,a1]=spread||k.spread||[0,TAU];
    for(let i=0;i<n;i++){
      const a=angle!==undefined?angle+this.rand(-.5,.5)*(a1-a0):this.rand(a0,a1),v=this.rand(k.speed[0],k.speed[1])*speed*(this.reducedMotion?.25:1);
      this.emit({x:x+this.rand(-3,3),y:y+this.rand(-3,3),vx:Math.cos(a)*v+vx,vy:Math.sin(a)*v*(k.flat||1)+vy,gravity:k.gravity||0,drag:k.drag||0,life:this.rand(k.life[0],k.life[1]),size:this.rand(k.size[0],k.size[1])*scale,grow:k.grow||0,rot:this.rand(0,TAU),spin:(k.spin||0)*this.rand(-1,1),sway:k.sway||0,phase:this.rand(0,TAU),flat:1,color:palette[Math.floor(this.rand(0,palette.length))],shape:k.shape});
    }
    return n;
  }
  ring(x,y,{color='#fff4d7',radius=46,life=.38,width=4,from=6}={}){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    this.rings.push({x,y,color,radius:clamp(finite(radius,46),4,600),from:clamp(finite(from,6),0,600),life:clamp(finite(life,.38),.05,2),max:clamp(finite(life,.38),.05,2),width:clamp(finite(width,4),.5,30)});
    if(this.rings.length>this.maxRings)this.rings.splice(0,this.rings.length-this.maxRings);
  }
  // `follow` (a function returning {x,y}) pins the label to something that
  // moves, such as the player; x and y are then offsets from that point.
  popup(text,x,y,{color='#fff4d7',size=15,life=1,rise=42,weight=900,stroke='#133b3dd9',follow=null}={}){
    if(!text||!Number.isFinite(x)||!Number.isFinite(y))return null;if(typeof follow!=='function')follow=null;
    // Nudge a new label above a fresh neighbour so stacked pickups stay readable.
    for(const other of this.popups)if(!other.follow===!follow&&other.max-other.life<.35&&Math.abs(other.x-x)<70&&Math.abs(other.y-y)<size+4)y=other.y-size-5;
    const max=clamp(finite(life,1),.2,4),popup={text:String(text).slice(0,40),x,y,color,stroke,size:clamp(finite(size,15),6,90),life:max,max,rise:this.reducedMotion?0:finite(rise,42),weight,follow,lift:0};
    this.popups.push(popup);
    if(this.popups.length>this.maxPopups)this.popups.splice(0,this.popups.length-this.maxPopups);
    return popup;
  }
  // An object that travels from a point to a (possibly moving) target.
  fly({x,y,target,life=.4,draw,arc=40,onArrive}={}){
    if(!Number.isFinite(x)||!Number.isFinite(y)||typeof target!=='function'||typeof draw!=='function')return;
    if(this.reducedMotion){onArrive?.();return;}
    this.fliers.push({x0:x,y0:y,target,draw,arc:finite(arc,40),life:0,max:clamp(finite(life,.4),.08,2),onArrive});
    if(this.fliers.length>40)this.fliers.splice(0,this.fliers.length-40).forEach(f=>f.onArrive?.());
  }

  // --- frame ----------------------------------------------------------
  // dt here is real time, so effects keep moving through a hit-stop.
  update(dt){
    dt=clamp(finite(dt),0,.1);this.clock+=dt;
    this.trauma=Math.max(0,this.trauma-dt*1.9);this.kickX*=Math.exp(-dt*14);this.kickY*=Math.exp(-dt*14);this.zoom*=Math.exp(-dt*9);
    if(Math.abs(this.kickX)<.05)this.kickX=0;if(Math.abs(this.kickY)<.05)this.kickY=0;if(Math.abs(this.zoom)<.0005)this.zoom=0;
    if(this._flash){this._flash.life-=dt;if(this._flash.life<=0)this._flash=null;}
    let alive=0;
    for(const p of this.particles){
      p.life-=dt;if(p.life<=0)continue;
      const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vy=p.vy*drag+p.gravity*dt;
      p.x+=(p.vx+(p.sway?Math.sin(this.clock*3+p.phase)*p.sway:0))*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;p.size=Math.max(.2,p.size+p.grow*dt);
      this.particles[alive++]=p;
    }
    this.particles.length=alive;
    this.rings=this.rings.filter(r=>(r.life-=dt)>0);
    for(const p of this.popups){p.life-=dt;p.lift+=p.rise*dt*clamp(p.life/p.max+.25,0,1);}
    this.popups=this.popups.filter(p=>p.life>0);
    const flying=[];
    for(const f of this.fliers){f.life+=dt;if(f.life>=f.max)f.onArrive?.();else flying.push(f);}
    this.fliers=flying;
  }
  get busy(){return this.particles.length+this.popups.length+this.rings.length+this.fliers.length>0||this.trauma>0||!!this._flash;}

  draw(c){
    c.save();
    for(const r of this.rings){const t=1-r.life/r.max,e=1-(1-t)*(1-t);c.globalAlpha=clamp(1-t,0,1);c.strokeStyle=r.color;c.lineWidth=r.width*(1-t*.7);c.beginPath();c.arc(r.x,r.y,r.from+(r.radius-r.from)*e,0,TAU);c.stroke();}
    for(const p of this.particles){
      const t=p.life/p.max;c.globalAlpha=clamp(t*2.2,0,1);c.fillStyle=p.color;
      if(p.shape==='puff'){c.globalAlpha=clamp(t*1.4,0,.85);c.beginPath();c.arc(p.x,p.y,p.size,0,TAU);c.fill();}
      else if(p.shape==='spark'){const speed=Math.hypot(p.vx,p.vy)||1,len=clamp(speed*.035,2,16);c.strokeStyle=p.color;c.lineWidth=p.size*.7;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx/speed*len,p.y-p.vy/speed*len);c.stroke();}
      else if(p.shape==='ring'){c.strokeStyle=p.color;c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,p.size,0,TAU);c.stroke();}
      else if(p.shape==='drop'){c.beginPath();c.ellipse(p.x,p.y,p.size*.7,p.size*1.2,Math.atan2(p.vy,p.vx)+Math.PI/2,0,TAU);c.fill();}
      else{
        c.save();c.translate(p.x,p.y);c.rotate(p.rot);
        if(p.shape==='star'){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,k=i%2?.45:1;c.lineTo(Math.cos(a)*p.size*k,Math.sin(a)*p.size*k);}c.closePath();c.fill();}
        else if(p.shape==='rect'){c.scale(1,Math.cos(p.rot*1.7)*.8+.2);c.fillRect(-p.size/2,-p.size/3,p.size,p.size*.66);}
        else if(p.shape==='leaf'){c.beginPath();c.ellipse(0,0,p.size,p.size*.42,0,0,TAU);c.fill();}
        else if(p.shape==='heart'){const s=p.size/9;c.beginPath();c.moveTo(0,7*s);c.bezierCurveTo(-11*s,-2*s,-5*s,-10*s,0,-4*s);c.bezierCurveTo(5*s,-10*s,11*s,-2*s,0,7*s);c.fill();}
        else{c.beginPath();c.arc(0,0,p.size,0,TAU);c.fill();}
        c.restore();
      }
    }
    c.globalAlpha=1;
    for(const f of this.fliers){const t=clamp(f.life/f.max,0,1),e=t*t*(3-2*t),to=f.target()||{x:f.x0,y:f.y0};const x=f.x0+(finite(to.x,f.x0)-f.x0)*e,y=f.y0+(finite(to.y,f.y0)-f.y0)*e-Math.sin(t*Math.PI)*f.arc;c.save();f.draw(c,x,y,t);c.restore();}
    c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
    for(const p of this.popups){
      const age=p.max-p.life,pop=this.reducedMotion?1:age<.14?.55+age/.14*.65:age<.24?1.2-(age-.14)/.1*.2:1;
      c.globalAlpha=clamp(p.life/Math.min(.35,p.max)*1,0,1);c.font=`${p.weight} ${Math.round(p.size*pop)}px system-ui,-apple-system,sans-serif`;
      const base=p.follow?p.follow():null,x=base?finite(base.x)+p.x:p.x,y=(base?finite(base.y)+p.y:p.y)-p.lift;
      c.lineWidth=Math.max(3,p.size*.28);c.strokeStyle=p.stroke;c.strokeText(p.text,x,y);c.fillStyle=p.color;c.fillText(p.text,x,y);
    }
    c.restore();
  }
  // Screen-space tint, drawn with the identity game transform.
  drawOverlay(c,width,height){
    if(!this._flash)return;c.save();c.globalAlpha=clamp(this._flash.strength*(this._flash.life/this._flash.max),0,.8);c.fillStyle=this._flash.color;c.fillRect(0,0,width,height);c.restore();
  }
}

// Deterministic 0..1 value from integers, for scenery that must not flicker.
export function hash01(a,b=0){let n=Math.imul((a|0)^0x9e3779b9,0x85ebca6b)^Math.imul((b|0)+0x7f4a7c15,0xc2b2ae35);n^=n>>>15;n=Math.imul(n,0x2c1b3c6d);n^=n>>>12;return (n>>>0)/4294967296;}
export const ease={out:t=>1-(1-t)*(1-t),outCubic:t=>1-Math.pow(1-t,3),inOut:t=>t*t*(3-2*t),outBack:t=>{const s=1.70158;t-=1;return t*t*((s+1)*t+s)+1;}};
