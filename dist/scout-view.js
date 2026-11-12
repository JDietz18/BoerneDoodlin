// Trail Scout presentation. Kept separate from the platform renderer so the
// top-down view can grow on its own. `view` is the shared AdventureRenderer:
// it supplies begin(), background(), character(), sprites, juice, and insets.
const TAU=Math.PI*2;
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

// Called by the controller for every Trail Scout engine event.
export function scoutEvent(view,e,run){}

// Draws one frame. Sets view.scoutLayout={left,top,cell} (CSS px), which the
// controller uses to map canvas taps to grid cells.
export function drawScout(view,run,{time=0,dt=0,reducedMotion=false}={}){
  view.reducedMotion=reducedMotion;view.time=reducedMotion?0:time;const c=view.begin(),w=view.width,h=view.height,p=palettes[run.worldIndex||0];
  view.background(c,run.worldIndex||0,0,time,w,h);const rows=run.grid.length,cols=run.grid[0].length,padTop=w<600?116:(h<450?91:108),padBottom=h<450&&w>600?113:65,cell=Math.min((w-30)/cols,(h-padTop-padBottom)/rows),left=(w-cols*cell)/2,top=padTop+(h-padTop-padBottom-rows*cell)/2;
  view.scoutLayout={left,top,cell};c.save();c.translate(left,top);
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
  const pl=run.player,px=((pl.renderX??pl.x)+.5)*cell,py=((pl.renderY??pl.y)+1)*cell;const art=view.sprites[run.characterId],f=art?.frames[3];if(f)view.character(c,run.characterId,3,px,py-1,cell*.98*f.w/f.h,{portrait:true});
  c.restore();
}
