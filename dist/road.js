export class RoadGame {
  constructor({random=Math.random,onEvent=()=>{}}={}){this.random=random;this.onEvent=onEvent;this.mode='ready';}
  reset({leg=1,pace='steady',captain='griffin',upgrades={}}={}){
    this.leg=leg;this.pace=pace;this.captain=captain;this.upgrades=upgrades;
    this.mode='running';this.time=0;this.distance=0;this.goal=26+leg*2;
    this.lane=0;this.position=0;this.entities=[];this.nextRow=2.5;this.rows=0;
    this.integrity=5+(captain==='spike'?1:0);this.maxIntegrity=this.integrity;
    this.hits=0;this.fuel=0;this.souvenirs=0;this.score=0;this.nearMisses=0;
    this.charge=35+(upgrades.battery||0)*15;this.boostTime=0;this.invincible=0;this.braking=false;
  }
  event(type,data={}){this.onEvent({type,...data});}
  steer(direction){if(this.mode!=='running')return;this.lane=Math.max(-1,Math.min(1,this.lane+Math.sign(direction)));}
  brake(value){this.braking=Boolean(value)&&this.mode==='running';}
  boost(){if(this.mode!=='running'||this.charge<100||this.boostTime>0)return false;this.charge=0;this.boostTime=3;this.event('zoom');return true;}
  pause(){if(this.mode!=='running')return;this.mode='paused';this.braking=false;this.event('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.event('resume');}
  end(){if(this.mode!=='running')return;this.mode='won';this.braking=false;this.score+=this.integrity*80;this.event('won');}
  spawnRow(){
    const blocked=Math.floor(this.random()*3)-1;
    const safe=[-1,0,1].filter(lane=>lane!==blocked);
    this.entities.push({type:'cone',lane:blocked,z:0,checked:false});
    // Never block all lanes; every row has a clearly reachable gap.
    if(this.leg>3&&this.rows%3===2)this.entities.push({type:'cone',lane:safe[0],z:0,checked:false});
    const pickupLane=safe[this.leg>3&&this.rows%3===2?1:Math.floor(this.random()*2)];
    this.entities.push({type:this.rows%4===3?'postcard':'fuel',lane:pickupLane,z:0,checked:false});
    this.rows++;
    if(this.captain==='kevin')this.event('guide',{lane:pickupLane});
  }
  update(dt){
    if(this.mode!=='running')return;
    dt=Math.max(0,Math.min(.05,dt));this.time+=dt;
    this.boostTime=Math.max(0,this.boostTime-dt);this.invincible=Math.max(0,this.invincible-dt);
    this.charge=Math.min(100,this.charge+dt*(5+(this.upgrades.battery||0)*1.5));
    const pace=this.pace==='scenic'?.88:this.pace==='hustle'?1.16:1;
    const speed=pace*(this.braking?.54:this.boostTime>0?1.55:1);
    this.speed=speed;this.distance=Math.min(this.goal,this.distance+dt*speed);
    this.position+=(this.lane-this.position)*Math.min(1,dt*13);
    this.nextRow-=dt*speed;
    if(this.nextRow<=0&&this.distance<this.goal-4){this.spawnRow();this.nextRow=1.8+this.random()*.55;}
    for(const item of this.entities){
      item.z+=dt*speed*.24;
      if(!item.checked&&item.z>=.88){
        item.checked=true;const gap=Math.abs(item.lane-this.position);
        if(item.type==='cone'){
          if(gap<.42&&this.invincible<=0){
            this.hits++;this.integrity=Math.max(1,this.integrity-1);this.invincible=1;
            this.boostTime=0;this.charge=Math.max(0,this.charge-18);this.event('hit');
          }else if(gap>=.42&&gap<1.35){this.nearMisses++;this.score+=30;this.event('clean');}
        }else if(gap<(this.captain==='mittens'?.7:.48)){
          item.taken=true;this.score+=item.type==='postcard'?150:40;
          if(item.type==='postcard')this.souvenirs++;else this.fuel++;
          this.charge=Math.min(100,this.charge+12);this.event('collect',{kind:item.type});
        }
      }
    }
    this.entities=this.entities.filter(item=>item.z<1.2&&!item.taken);
    if(this.distance>=this.goal)this.end();
  }
  result(){return {hits:this.hits,fuel:this.fuel,souvenirs:this.souvenirs,score:this.score,nearMisses:this.nearMisses};}
}
