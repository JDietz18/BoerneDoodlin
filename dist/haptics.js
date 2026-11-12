// Small touch feedback. Android and most desktop browsers expose
// navigator.vibrate. iPhone Safari does not, but toggling a native switch
// control produces the system tick on recent iOS, so a hidden switch is used
// there. Every path is optional: unsupported devices simply stay still.

const PATTERNS={
  tap:[8],light:[10],medium:[18],heavy:[32],
  collect:[6],gold:[12,40,12],stomp:[22],hit:[40,50,30],
  power:[14,30,14,30,24],success:[14,60,14,60,30],max:[20,40,20,40,20,40,40]
};

export class Haptics {
  constructor({enabled=true,navigatorRef=globalThis.navigator,documentRef=globalThis.document,now=()=>globalThis.performance?.now?.()??Date.now()}={}){
    this.enabled=Boolean(enabled);this._navigator=navigatorRef;this._document=documentRef;this._now=now;this._last=-1e9;this._label=null;this._timers=new Set();
    this.canVibrate=typeof navigatorRef?.vibrate==='function';
  }
  setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.cancel();}
  get supported(){return this.canVibrate||this._switchSupported();}
  _switchSupported(){
    const doc=this._document;if(!doc?.createElement)return false;
    if(this._switchOk!==undefined)return this._switchOk;
    try{const probe=doc.createElement('input');probe.type='checkbox';this._switchOk='switch' in probe;}catch{this._switchOk=false;}
    return this._switchOk;
  }
  _ensureSwitch(){
    if(this._label||!this._switchSupported())return this._label;
    const doc=this._document;
    try{
      const label=doc.createElement('label'),input=doc.createElement('input');
      input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1;
      label.setAttribute('aria-hidden','true');label.className='haptic-switch';
      label.style.cssText='position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      label.appendChild(input);(doc.body||doc.documentElement).appendChild(label);this._label=label;
    }catch{this._label=null;this._switchOk=false;}
    return this._label;
  }
  _tick(){try{this._ensureSwitch()?.click();}catch{/* optional */}}
  // Fires one named pattern. Rapid repeats are dropped so a treat streak
  // feels like a purr, not a buzz.
  pulse(kind='tap'){
    if(!this.enabled)return false;
    const pattern=PATTERNS[kind]||PATTERNS.tap,now=this._now(),gap=kind==='collect'?70:45;
    if(now-this._last<gap)return false;this._last=now;
    if(this.canVibrate){try{return this._navigator.vibrate(pattern)!==false;}catch{return false;}}
    if(!this._switchSupported())return false;
    // The switch gives single ticks; replay the pattern's "on" beats.
    let at=0;
    for(let i=0;i<pattern.length;i+=2){
      if(at===0)this._tick();
      else{const timer=setTimeout(()=>{this._timers.delete(timer);if(this.enabled)this._tick();},at);this._timers.add(timer);}
      at+=pattern[i]+(pattern[i+1]||0);
    }
    return true;
  }
  cancel(){for(const timer of this._timers)clearTimeout(timer);this._timers.clear();if(this.canVibrate){try{this._navigator.vibrate(0);}catch{/* optional */}}}
}
