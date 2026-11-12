// Touch and pointer controls for every activity. One thumb pad that can be
// slid across without lifting, big action buttons, and direct gestures on the
// play field. Each pointer is tracked on its own, so holding a direction while
// tapping jump always works. This module only reports intent through `on`.

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export class Controls {
  constructor({get,canvas,rallyCanvas,on}){
    this.on=on;this.canvas=canvas;this.rallyCanvas=rallyCanvas;this.mode='';this.dir={x:0,y:0};this.active=false;
    this.el={root:get('play-controls'),pad:get('move-pad'),jump:get('jump-button'),power:get('power-button'),interact:get('interact-button'),hint:get('hint-button'),brake:get('brake-button'),powerLabel:get('power-label'),interactLabel:get('interact-label'),hintLabel:get('hint-label')};
    this.padPointer=null;this.padStart=null;this.dropped=false;this.fieldPointers=new Map();this.tilt=null;
    this._bindPad();this._bindButtons();this._bindField(canvas);this._bindField(rallyCanvas);
  }

  // --- configuration ---------------------------------------------------
  configure(mode,{powerLabel='POWER',powerAria='Use power'}={}){
    const e=this.el,scout=mode==='scout';this.mode=mode;this.clear();
    e.root.dataset.mode=mode;e.pad.dataset.layout=scout?'cross':'row';e.pad.hidden=mode==='memory';
    e.pad.setAttribute('aria-label',scout?'Movement pad. Slide to change direction.':mode==='rally'?'Steering pad. Slide left or right.':'Movement pad. Slide left or right.');
    e.jump.hidden=mode!=='platform';e.brake.hidden=mode!=='rally';e.hint.hidden=!scout;e.power.hidden=mode==='memory';e.interact.hidden=true;
    e.powerLabel.textContent=powerLabel;e.power.setAttribute('aria-label',powerAria);
  }
  setPower(charge,ready){const p=this.el.power;const value=Math.round(clamp(charge,0,100));if(this._charge!==value){this._charge=value;p.style.setProperty('--charge',value/100);}if(this._ready!==ready){this._ready=ready;p.classList.toggle('ready',ready);}}
  // The interact button only appears when there is something to use.
  setInteract(label){const b=this.el.interact;if(this._interact===label)return;this._interact=label;b.hidden=!label;if(label)this.el.interactLabel.textContent=label;}
  setHint(count){if(this._hint===count)return;this._hint=count;this.el.hintLabel.textContent=`HINT · ${count}`;this.el.hint.classList.toggle('spent',count<=0);}
  // Space the field should keep clear above the bottom edge, in CSS px.
  insetBottom(arena){if(this.el.root.hidden||!this.touch)return 0;const a=arena.getBoundingClientRect();let top=a.bottom;for(const node of [this.el.pad,this.el.jump,this.el.power,this.el.brake,this.el.hint]){if(node.hidden)continue;const r=node.getBoundingClientRect();if(r.height)top=Math.min(top,r.top);}return Math.max(0,Math.round(a.bottom-top));}
  set touchMode(value){this.touch=Boolean(value);}

  // Releases everything. Called on pause, blur, and screen changes.
  clear(){
    this.padPointer=null;this.padStart=null;this.dropped=false;this.fieldPointers.clear();this.dir.x=0;this.dir.y=0;this._steer=null;
    for(const node of this.el.root.querySelectorAll('.pressed'))node.classList.remove('pressed');this.el.pad.dataset.dir='';
    this.tilt&&(this.tilt.value=0);
  }

  // --- thumb pad -------------------------------------------------------
  _padDirection(e){
    const r=this.el.pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy;
    if(this.mode==='scout'){
      if(Math.hypot(dx,dy)<r.width*.1)return {x:this.dir.x,y:this.dir.y};
      return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
    }
    // A little hysteresis around the centre stops jitter when a thumb rests there.
    const dead=r.width*.05;if(Math.abs(dx)<dead&&this.dir.x)return {x:this.dir.x,y:0};
    return {x:dx<0?-1:1,y:0};
  }
  _setDirection(x,y){
    if(this.dir.x===x&&this.dir.y===y)return;this.dir.x=x;this.dir.y=y;
    this.el.pad.dataset.dir=x<0?'left':x>0?'right':y<0?'up':y>0?'down':'';this.on.direction?.(x,y);
  }
  _bindPad(){
    const pad=this.el.pad;
    pad.addEventListener('pointerdown',e=>{
      if(this.padPointer!==null)return;e.preventDefault();this.on.gesture?.();this.padPointer=e.pointerId;this.padStart={x:e.clientX,y:e.clientY};this.dropped=false;
      try{pad.setPointerCapture(e.pointerId);}catch{/* synthetic or already released */}
      const d=this._padDirection(e);this._setDirection(d.x,d.y);
    });
    pad.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.padPointer)return;const d=this._padDirection(e);this._setDirection(d.x,d.y);
      // Dragging the thumb down on the pad is a fast drop in platform levels.
      if(this.mode==='platform'&&!this.dropped&&e.clientY-this.padStart.y>36){this.dropped=true;this.on.drop?.();}
      if(this.dropped&&e.clientY-this.padStart.y<16)this.dropped=false;
    });
    const release=e=>{if(e.pointerId!==this.padPointer)return;this.padPointer=null;this._setDirection(0,0);};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,release);
    // Keyboard and switch users can still nudge with the pad focused.
    pad.addEventListener('keydown',e=>{const map={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(map){this._setDirection(map[0],this.mode==='scout'?map[1]:0);}});
    pad.addEventListener('keyup',()=>this._setDirection(0,0));
  }

  // --- buttons ---------------------------------------------------------
  _button(node,down,up){
    const held=new Set();
    node.addEventListener('pointerdown',e=>{e.preventDefault();this.on.gesture?.();held.add(e.pointerId);try{node.setPointerCapture(e.pointerId);}catch{/* optional */}node.classList.add('pressed');down();});
    const release=e=>{if(!held.delete(e.pointerId))return;if(!held.size){node.classList.remove('pressed');up?.();}};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(name,release);
    // Enter, Space, and assistive activation arrive as a click with no pointer.
    node.addEventListener('click',e=>{if(e.detail===0){this.on.gesture?.();down();setTimeout(()=>up?.(),120);}});
    node.addEventListener('contextmenu',e=>e.preventDefault());
  }
  _bindButtons(){
    const e=this.el,on=this.on;
    this._button(e.jump,()=>on.jump?.(),()=>on.releaseJump?.());
    this._button(e.power,()=>on.power?.());
    this._button(e.interact,()=>on.interact?.());
    this._button(e.hint,()=>on.hint?.());
    this._button(e.brake,()=>on.brake?.(true),()=>on.brake?.(false));
    e.pad.addEventListener('contextmenu',ev=>ev.preventDefault());
  }

  // --- gestures on the play field ---------------------------------------
  _bindField(canvas){
    if(!canvas)return;
    canvas.addEventListener('pointerdown',e=>{
      if(!this.active)return;e.preventDefault();this.on.gesture?.();
      try{canvas.setPointerCapture(e.pointerId);}catch{/* optional */}
      const info={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,stepped:false,canvas};this.fieldPointers.set(e.pointerId,info);
      if(this.mode==='platform')this.on.jump?.();
      else if(this.mode==='snack')this.on.fieldX?.(this._fraction(canvas,e.clientX));
      else if(this.mode==='rally'){info.steer=true;this._steer=0;this.on.steer?.(0);}
    });
    canvas.addEventListener('pointermove',e=>{
      const info=this.fieldPointers.get(e.pointerId);if(!info||!this.active)return;
      const dx=e.clientX-info.x,dy=e.clientY-info.y;if(Math.hypot(dx,dy)>10)info.moved=true;
      if(this.mode==='snack')this.on.fieldX?.(this._fraction(canvas,e.clientX));
      else if(this.mode==='rally'&&info.steer){const width=canvas.getBoundingClientRect().width||1;this._steer=clamp(dx/Math.max(60,width*.2),-1,1);this.on.steer?.(this._steer);}
      else if(this.mode==='scout'){
        // Swipe a cell's worth to step; keep dragging to keep walking.
        const sx=e.clientX-info.lastX,sy=e.clientY-info.lastY;
        if(Math.hypot(sx,sy)>=30){const step=Math.abs(sx)>Math.abs(sy)?{x:Math.sign(sx),y:0}:{x:0,y:Math.sign(sy)};info.lastX=e.clientX;info.lastY=e.clientY;info.stepped=true;this.on.swipe?.(step.x,step.y);}
      }else if(this.mode==='platform'&&!info.dropped&&dy>44){info.dropped=true;this.on.drop?.();}
    });
    const release=e=>{
      const info=this.fieldPointers.get(e.pointerId);if(!info)return;this.fieldPointers.delete(e.pointerId);
      if(this.mode==='platform'&&![...this.fieldPointers.values()].some(p=>p.canvas===canvas))this.on.releaseJump?.();
      else if(this.mode==='rally'&&info.steer){this._steer=null;this.on.steer?.(null);}
      else if(this.mode==='scout'&&!info.moved&&!info.stepped&&e.type==='pointerup'){const r=canvas.getBoundingClientRect();this.on.tap?.(e.clientX-r.left,e.clientY-r.top);}
      else if(this.mode==='snack'&&!this.fieldPointers.size)this.on.fieldX?.(null);
    };
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }
  _fraction(canvas,clientX){const r=canvas.getBoundingClientRect();return clamp((clientX-r.left)/(r.width||1),0,1);}

  // --- tilt steering (RV Rally, opt in) ----------------------------------
  // iPhone asks for motion permission; this must run from a tap.
  async enableTilt(){
    if(this.tilt)return true;const D=globalThis.DeviceOrientationEvent;if(!D)return false;
    try{if(typeof D.requestPermission==='function'&&await D.requestPermission()!=='granted')return false;}catch{return false;}
    const state={value:0,zero:null,seen:false};
    state.handler=e=>{
      if(e.gamma===null||e.beta===null)return;state.seen=true;
      const angle=(screen.orientation?.angle??globalThis.orientation??0)|0,raw=angle===90?e.beta:angle===-90||angle===270?-e.beta:e.gamma;
      if(state.zero===null)state.zero=raw;
      const value=clamp((raw-state.zero)/22,-1,1);state.value=Math.abs(value)<.08?0:value;
    };
    globalThis.addEventListener('deviceorientation',state.handler);this.tilt=state;return true;
  }
  disableTilt(){if(!this.tilt)return;globalThis.removeEventListener('deviceorientation',this.tilt.handler);this.tilt=null;}
  // Re-centre so "level" is however the phone is being held right now.
  calibrateTilt(){if(this.tilt)this.tilt.zero=null;}
  // Analog steering for this frame: a field drag wins, then tilt, else null.
  get steering(){if(this._steer!==null&&this._steer!==undefined)return this._steer;if(this.tilt?.seen)return this.tilt.value;return null;}
}
