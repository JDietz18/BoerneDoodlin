export const GOAL = 900;
export const ZONES = ['GRANTS PASS', 'DESERT RUN', 'HILL COUNTRY'];
export class SnackGame {
  constructor({random=Math.random,onEvent=()=>{}}={}) {
    this.random=random; this.onEvent=onEvent; this.width=1280; this.scale=1; this.ground=565; this.mode='ready'; this.character={speed:1,jump:1,charge:1,score:1,zoom:1,magnet:0,hitbox:1,hearts:3}; this.reset(); this.mode='ready';
  }
  setCharacter(config={}) {
    this.character={speed:1,jump:1,charge:1,score:1,zoom:1,magnet:0,hitbox:1,hearts:3,...config};
  }
  reset({goal=GOAL,difficulty=1}={}) {
    this.goal=Math.max(180,Number(goal)||GOAL);this.difficulty=Math.max(.75,Math.min(1.55,Number(difficulty)||1));
    this.mode='running'; this.time=0; this.distance=0; this.score=0; this.treats=0; this.hearts=this.character.hearts||3; this.charge=0; this.zoomTime=0;
    this.invincible=0; this.zone=0; this.entities=[]; this.particles=[]; this.spawnIn=2.2; this.pattern=0; this.worldOffset=0;
    this.combo=0;this.bestCombo=0;this.comboTime=0;this.multiplier=1;this.dodged=0;
    this.player={x:this.width*.18,y:0,vy:0,jumps:0}; this.jumpBuffer=0; this.event('start');
  }
  event(type,data={}) {this.onEvent({type,...data});}
  resize(width) {
    const oldWidth=this.width,oldScale=this.scale;this.width=width;this.scale=Math.min(1,width/820);this.player.x=width*.18;
    for(const e of this.entities){e.x*=width/oldWidth;e.w*=this.scale/oldScale;e.h*=this.scale/oldScale;e.y=this.ground-(this.ground-e.y)*this.scale/oldScale;}
  }
  jump() {
    if(this.mode!=='running') return false;
    if(this.player.jumps>=2) {this.jumpBuffer=.1;return false;}
    this.player.vy=(this.player.jumps===0?-740:-670)*(this.character.jump||1);this.player.jumps++;this.jumpBuffer=0;
    this.event('jump',{double:this.player.jumps===2});return true;
  }
  zoom() {
    if(this.mode!=='running'||this.charge<100||this.zoomTime>0) return false;
    this.charge=0;this.zoomTime=4.8*(this.character.zoom||1);
    if(this.character.ability==='cat'&&this.hearts<this.character.hearts){this.hearts++;this.event('heal');}
    this.event('zoom');return true;
  }
  pause() {if(this.mode==='running'){this.mode='paused';this.event('pause');}}
  resume() {if(this.mode==='paused'){this.mode='running';this.event('resume');}}
  end(won) {if(this.mode!=='running')return;this.mode=won?'won':'lost';this.event(this.mode);}
  spawn() {
    const r=this.random(), x=this.width+150, type=r<.72?'log':'can',s=this.scale;
    const obstacle={type,x,y:this.ground,w:(type==='log'?118:94)*s,h:90*s,hit:false};
    this.entities.push(obstacle);
    const layout=this.pattern++%4;
    for(let i=0;i<4;i++) {
      const offset=(i-1.5)*70*s;
      const y=this.ground-((layout===2?220:132)+Math.sin(i/3*Math.PI)*45)*s;
      this.entities.push({type:'bone',x:x+offset,y,w:54*s,h:54*s,taken:false});
    }
    if(layout===1) this.entities.push({type:'chicken',x:x+245*s,y:this.ground-125*s,w:65*s,h:65*s,taken:false});
    if(layout===3) this.entities.push({type:'ball',x:x+200*s,y:this.ground-205*s,w:62*s,h:62*s,taken:false});
    this.spawnIn=(1.8-this.zone*.13)/Math.sqrt(this.difficulty)+this.random()*.5;
  }
  burst(x,y,color,count=10) {
    for(let i=0;i<count;i++) {const a=this.random()*Math.PI*2,v=50+this.random()*170;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-70,life:.5+this.random()*.3,max:.8,color,size:3+this.random()*5});}
  }
  update(dt) {
    if(this.mode!=='running') return;
    dt=Math.min(.0334,Math.max(0,dt));this.time+=dt;this.invincible=Math.max(0,this.invincible-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    this.comboTime=Math.max(0,this.comboTime-dt);
    if(this.comboTime===0){this.combo=0;this.multiplier=1;}
    this.zoomTime=Math.max(0,this.zoomTime-dt);
    const nominal=(405+this.zone*37)*this.difficulty, viewScale=Math.min(1,this.width/1080), speed=nominal*viewScale*(this.zoomTime>0?1.5:1)*(this.character.speed||1);
    this.worldOffset+=speed*dt;this.distance=Math.min(this.goal,this.distance+nominal*dt*.028*(this.zoomTime>0?1.5:1)*(this.character.speed||1));
    const zone=Math.min(2,Math.floor(this.distance/(this.goal/3)));if(zone!==this.zone){this.zone=zone;this.event('zone',{zone});if(this.mode!=='running')return;}
    const p=this.player;p.vy+=2150*dt;p.y+=p.vy*dt;
    if(p.y>=0) {p.y=0;p.vy=0;p.jumps=0;if(this.jumpBuffer>0)this.jump();}
    this.spawnIn-=dt;if(this.spawnIn<=0)this.spawn();
    const px=p.x, s=this.scale, feet=this.ground+p.y-9*s, hitbox=this.character.hitbox||1;
    for(const e of this.entities) {
      e.x-=speed*dt;
      if(e.type==='log'||e.type==='can') {
        if(!e.hit&&Math.abs(e.x-px)<(e.w*.32+38*s)*hitbox&&feet>e.y-e.h*.73&&feet-79*s*hitbox<e.y-8*s) {
          e.hit=true;
          if(this.zoomTime>0){this.score+=Math.round((this.character.ability==='shell'?75:25)*(this.character.score||1));this.burst(e.x,e.y-40,'#ffe583',18);this.event('smash');}
          else if(this.invincible<=0){this.hearts--;this.combo=0;this.multiplier=1;this.comboTime=0;this.invincible=1.8;this.burst(px,feet-50,'#ff8161',12);this.event('hit');if(this.hearts<=0){this.end(false);return;}}
        }
        if(!e.hit&&!e.passed&&e.x<px-e.w*.5-38*s){e.passed=true;this.dodged++;this.score+=15;this.charge=Math.min(100,this.charge+5);this.event('dodge');}
      } else if(!e.taken) {
        const magnet=(this.zoomTime>0?(this.character.ability==='radar'?230:130)*s:0)+(this.character.magnet||0)*s;
        if(Math.abs(e.x-px)<54*s+magnet&&Math.abs(e.y-(feet-51*s))<65*s+magnet) {
          e.taken=true;
          if(e.type==='ball'){this.charge=100;this.event('charged');this.burst(e.x,e.y,'#9ffff0');}
          else {
            this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=3.4;this.multiplier=Math.min(4,1+Math.floor(this.combo/5));
            const baseValue=e.type==='chicken'?50:10,value=Math.round(baseValue*(this.character.score||1)*this.multiplier*(this.zoomTime>0&&this.character.ability==='joy'?1.5:1));
            this.score+=value;this.treats++;const was=this.charge;this.charge=Math.min(100,this.charge+(e.type==='chicken'?25:12.5)*(this.character.charge||1));
            this.event('collect',{value,chicken:e.type==='chicken',x:e.x,y:e.y,combo:this.combo,multiplier:this.multiplier});
            if(this.combo%5===0)this.event('combo',{combo:this.combo,multiplier:this.multiplier});
            this.burst(e.x,e.y,'#ffd675');if(was<100&&this.charge===100)this.event('charged');
          }
        }
      }
    }
    this.entities=this.entities.filter(e=>e.x>-150&&!e.taken&&!(e.hit&&this.zoomTime>0));
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;}
    this.particles=this.particles.filter(p=>p.life>0);
    if(this.distance>=this.goal){this.score+=this.hearts*100;this.end(true);}
  }
}
