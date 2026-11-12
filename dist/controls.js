// Gesture controls. There are no on-screen buttons: the whole play field is
// the controller. Each finger is tracked on its own, so one thumb can steer
// while the other taps. This module only reports intent through `on`, and
// draws a faint echo under each touch so the screen answers the hand.
//
//   Platform  left half: slide to run, flick up for power, pull down to drop
//             right half: tap to jump (hold for height, tap again in the air)
//   Scout     swipe or drag to walk, tap a tile, hold for a hint, two fingers for power
//   Rally     drag to steer (`drag.dx` is the finger's travel in px, `steering`
//             the same as -1..1), pull back or a second finger to brake, flick up to boost
//   Snack     drag to catch, flick up for power

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const DEAD=10,TRAIL=22,STEP=26,FLICK=48,PULL=46,HOLD=.55;

export class Controls {
  constructor({canvas,rallyCanvas,on,now=()=>globalThis.performance?.now?.()??Date.now()}){
    this.on=on;this.canvas=canvas;this.rallyCanvas=rallyCanvas;this._now=now;this.mode='';this.active=false;this.touch=false;
    this.dir={x:0,y:0};this.pointers=new Map();this.ripples=[];this.braking=false;this._steer=null;this.drag=null;this.tilt=null;this.used={move:false,action:false,power:false};
    this._bindField(canvas);this._bindField(rallyCanvas);
  }
  configure(mode){this.mode=mode;this.clear();this.used={move:false,action:false,power:false};}
  set touchMode(value){this.touch=Boolean(value);}

  // Releases everything. Called on pause, blur, and screen changes.
  clear(){
    this.pointers.clear();this.dir.x=0;this.dir.y=0;this._steer=null;this.drag=null;this.braking=false;this.ripples.length=0;
    if(this.tilt)this.tilt.value=0;
  }

  _setDirection(x,y){if(this.dir.x===x&&this.dir.y===y)return;this.dir.x=x;this.dir.y=y;if(x||y)this.used.move=true;this.on.direction?.(x,y);}
  _power(p){if(p)p.spent=true;this.used.power=true;this.on.power?.();}
  _role(kind){for(const p of this.pointers.values())if(p.role===kind)return p;return null;}
  _local(canvas,e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,w:r.width||1,h:r.height||1};}

  _bindField(canvas){
    if(!canvas)return;
    canvas.addEventListener('pointerdown',e=>{
      if(!this.active)return;e.preventDefault();this.on.gesture?.(e);
      try{canvas.setPointerCapture(e.pointerId);}catch{/* synthetic or already released */}
      const at=this._local(canvas,e),t=this._now()/1000,p={id:e.pointerId,canvas,x0:at.x,y0:at.y,x:at.x,y:at.y,ax:at.x,ay:at.y,t0:t,refY:at.y,refX:at.x,refT:t,moved:false,spent:false,pulled:false,role:'action'};
      const others=this.pointers.size;this.pointers.set(e.pointerId,p);this.ripples.push({x:at.x,y:at.y,t:0});if(this.ripples.length>8)this.ripples.shift();
      const m=this.mode;
      if(m==='platform'){
        // The left half steers unless a thumb is already steering.
        if(at.x<at.w*.5&&!this._role('move'))p.role='move';
        else{this.used.action=true;this.on.jump?.();}
      }else if(m==='scout'){
        if(others){for(const other of this.pointers.values())other.spent=true;this._setDirection(0,0);this._power(p);}
        else p.role='move';
      }else if(m==='rally'){
        if(others){p.role='brake';this.braking=true;this.on.brake?.(true);}
        else{p.role='move';this._steer=0;this.drag={dx:0};this.on.steerStart?.();this.on.steer?.(0);}
      }else if(m==='snack'){
        if(others)this._power(p);
        else{p.role='move';this.used.move=true;this.on.fieldX?.(clamp(at.x/at.w,0,1));}
      }
    });
    canvas.addEventListener('pointermove',e=>{
      const p=this.pointers.get(e.pointerId);if(!p||!this.active)return;
      const at=this._local(canvas,e),t=this._now()/1000;p.x=at.x;p.y=at.y;
      if(Math.hypot(at.x-p.x0,at.y-p.y0)>DEAD)p.moved=true;
      // A quick upward flick, measured over the last fifth of a second.
      if(t-p.refT>.2){p.refT=t;p.refY=at.y;p.refX=at.x;}
      const rise=p.refY-at.y,flick=rise>=FLICK&&rise>Math.abs(at.x-p.refX)*1.2;
      const m=this.mode;
      if(m==='platform'){
        if(p.role==='move'){
          const dx=at.x-p.ax;if(Math.abs(dx)>DEAD)this._setDirection(Math.sign(dx),0);
          if(Math.abs(dx)>TRAIL)p.ax=at.x-Math.sign(dx)*TRAIL;
          if(flick&&!p.spent){this._power(p);p.refT=t;p.refY=at.y;}
        }
        // A quick pull down, measured the same way as the flick.
        const fall=at.y-p.refY;
        if(!p.pulled&&fall>=PULL&&fall>Math.abs(at.x-p.refX)*1.2){p.pulled=true;this.on.drop?.();p.refT=t;p.refY=at.y;}else if(p.pulled&&fall<0)p.pulled=false;
      }else if(m==='scout'&&p.role==='move'&&!p.spent){
        const dx=at.x-p.ax,dy=at.y-p.ay;
        if(Math.hypot(dx,dy)>=STEP){
          const horizontal=Math.abs(dx)>Math.abs(dy);this._setDirection(horizontal?Math.sign(dx):0,horizontal?0:Math.sign(dy));
          const d=Math.hypot(dx,dy);p.ax=at.x-dx/d*STEP;p.ay=at.y-dy/d*STEP;p.walked=true;
        }
      }else if(m==='rally'&&p.role==='move'){
        this._steer=clamp((at.x-p.x0)/Math.max(60,at.w*.2),-1,1);this.drag={dx:at.x-p.x0};this.used.move=true;this.on.steer?.(this._steer);
        const pull=at.y-p.y0>PULL;if(pull!==p.pulled){p.pulled=pull;this.braking=pull||!!this._role('brake');this.on.brake?.(this.braking);}
        if(flick&&!p.spent){this._power(p);p.refT=t;p.refY=at.y;}
      }else if(m==='snack'&&p.role==='move'){
        this.on.fieldX?.(clamp(at.x/at.w,0,1));
        if(flick&&!p.spent){this._power(p);p.refT=t;p.refY=at.y;}
      }
    });
    const release=e=>{
      const p=this.pointers.get(e.pointerId);if(!p)return;this.pointers.delete(e.pointerId);
      const m=this.mode,lifted=e.type==='pointerup';
      if(m==='platform'){
        if(p.role==='move')this._setDirection(0,0);
        else if(!this._role('action'))this.on.releaseJump?.();
      }else if(m==='scout'){
        if(p.role==='move'){this._setDirection(0,0);if(lifted&&!p.moved&&!p.spent&&!p.walked&&!p.hinted)this.on.tap?.(p.x,p.y);}
      }else if(m==='rally'){
        if(p.role==='move'){this._steer=null;this.drag=null;this.on.steer?.(null);}
        this.braking=!!this._role('brake')||[...this.pointers.values()].some(o=>o.pulled);this.on.brake?.(this.braking);
      }else if(m==='snack'&&p.role==='move')this.on.fieldX?.(null);
    };
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }

  // Per-frame upkeep: Trail Scout's press-and-hold hint, and fading ripples.
  update(dt){
    if(this.mode==='scout'&&this.active){const t=this._now()/1000;for(const p of this.pointers.values())if(p.role==='move'&&!p.moved&&!p.spent&&!p.hinted&&t-p.t0>=HOLD){p.hinted=true;this.on.hint?.();}}
    let alive=0;for(const r of this.ripples){r.t+=dt;if(r.t<.4)this.ripples[alive++]=r;}this.ripples.length=alive;
  }
  get busy(){return this.pointers.size>0||this.ripples.length>0;}

  // A faint echo under each finger. Coordinates are relative to the field.
  draw(c,{reduced=false}={}){
    if(!this.busy)return;c.save();c.lineCap='round';
    if(!reduced)for(const r of this.ripples){const u=r.t/.4;c.globalAlpha=(1-u)*.5;c.strokeStyle='#fff4db';c.lineWidth=2.5*(1-u)+.5;c.beginPath();c.arc(r.x,r.y,10+u*30,0,TAU);c.stroke();}
    for(const p of this.pointers.values()){
      if(p.role==='move'&&this.mode!=='snack'){
        const dx=p.x-p.ax,dy=this.mode==='platform'?0:p.y-p.ay,far=Math.hypot(dx,dy);
        c.globalAlpha=.28;c.fillStyle='#fff4db';c.beginPath();c.arc(p.ax,this.mode==='platform'?p.y:p.ay,6,0,TAU);c.fill();
        if(far>DEAD){c.globalAlpha=.42;c.strokeStyle='#fff4db';c.lineWidth=5;c.beginPath();c.moveTo(p.ax,this.mode==='platform'?p.y:p.ay);c.lineTo(p.x,p.y);c.stroke();}
      }
      c.globalAlpha=.26;c.strokeStyle='#fff4db';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,22,0,TAU);c.stroke();
    }
    c.restore();
  }

  // --- tilt steering (RV Rally, opt in) ----------------------------------
  // iPhone asks for motion permission; this must run from a tap.
  async enableTilt(){
    if(this.tilt)return true;const D=globalThis.DeviceOrientationEvent;if(!D)return false;
    try{if(typeof D.requestPermission==='function'&&await D.requestPermission()!=='granted')return false;}catch{return false;}
    const state={value:0,zero:null,seen:false};
    state.handler=e=>{
      if(e.gamma===null||e.beta===null)return;state.seen=true;
      const angle=(globalThis.screen?.orientation?.angle??globalThis.orientation??0)|0,raw=angle===90?e.beta:angle===-90||angle===270?-e.beta:e.gamma;
      if(state.zero===null)state.zero=raw;
      const value=clamp((raw-state.zero)/22,-1,1);state.value=Math.abs(value)<.08?0:value;
    };
    globalThis.addEventListener('deviceorientation',state.handler);this.tilt=state;return true;
  }
  disableTilt(){if(!this.tilt)return;globalThis.removeEventListener('deviceorientation',this.tilt.handler);this.tilt=null;}
  // Re-centre so "level" is however the phone is being held right now.
  calibrateTilt(){if(this.tilt)this.tilt.zero=null;}
  // Analog steering for this frame: a drag wins, then tilt, else null.
  get steering(){if(this._steer!==null&&this._steer!==undefined)return this._steer;if(this.tilt?.seen)return this.tilt.value;return null;}
}
