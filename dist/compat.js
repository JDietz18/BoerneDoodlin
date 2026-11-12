// Small fill-ins so older iPhones and iPads (iOS 15) can run the game.
// Loaded first by game.js, before any module that relies on these.
const proto=globalThis.CanvasRenderingContext2D?.prototype;
if(proto&&!proto.roundRect){
  proto.roundRect=function(x,y,w,h,radii=0){
    let r=Array.isArray(radii)?radii[0]:radii;r=Math.max(0,Math.min(Number(r)||0,Math.abs(w)/2,Math.abs(h)/2));
    this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.arcTo(x+w,y,x+w,y+r,r);this.lineTo(x+w,y+h-r);this.arcTo(x+w,y+h,x+w-r,y+h,r);
    this.lineTo(x+r,y+h);this.arcTo(x,y+h,x,y+h-r,r);this.lineTo(x,y+r);this.arcTo(x,y,x+r,y,r);this.closePath();
  };
}
if(!Object.hasOwn)Object.defineProperty(Object,'hasOwn',{value:(object,key)=>Object.prototype.hasOwnProperty.call(object,key),configurable:true,writable:true});
for(const type of [Array,String]){
  if(!type.prototype.at)Object.defineProperty(type.prototype,'at',{value(index){const n=Math.trunc(index)||0,i=n<0?this.length+n:n;return i<0||i>=this.length?undefined:this[i];},configurable:true,writable:true});
}
