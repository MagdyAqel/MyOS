// Original, deterministic RTS simulation; coordinates are independent of canvas size.
export const WIDTH = 1000, HEIGHT = 620;
export const TYPES = {
  hq: { name: 'مركز القيادة', hp: 1800, radius: 38 },
  power: { name: 'محطة طاقة', cost: 300, hp: 450, radius: 26 },
  supply: { name: 'مركز إمداد', cost: 400, hp: 550, radius: 28 },
  barracks: { name: 'ثكنة', cost: 400, hp: 600, radius: 28, needs: 'power' },
  factory: { name: 'مصنع مدرعات', cost: 650, hp: 800, radius: 32, needs: 'power' },
  turret: { name: 'برج دفاع', cost: 450, hp: 550, radius: 20, damage: 24, range: 165, cooldown: .9, needs: 'power' },
  soldier: { name: 'جندي', cost: 150, hp: 110, radius: 7, speed: 55, damage: 12, range: 105, cooldown: .8, needs: 'barracks' },
  tank: { name: 'دبابة', cost: 500, hp: 430, radius: 14, speed: 38, damage: 40, range: 145, cooldown: 1.2, needs: 'factory' },
};
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export class Battle {
  constructor() {
    this.nextId=1; this.cash=2400; this.time=0; this.wave=0; this.nextWave=40;
    this.income=0; this.status='playing'; this.paused=false; this.selected=new Set(); this.effects=[];
    this.message='ابنِ مركز إمداد وطاقة وثكنة. دمّر مركز قيادة العدو للفوز.';
    this.entities=[];
    this.add('hq','blue',130,320); this.add('hq','red',880,300);
    this.add('turret','red',780,240); this.add('turret','red',800,380);
    this.add('soldier','blue',205,285);this.add('soldier','blue',205,350);
    this.add('tank','blue',210,320);
  }
  add(type, team, x, y) {
    const e={...TYPES[type],id:this.nextId++,type,team,x,y,maxHp:TYPES[type].hp,cd:0,order:null};
    this.entities.push(e); return e;
  }
  has(type) { return this.entities.some(e=>e.team==='blue' && e.type===type && e.hp>0); }
  purchase(type,x,y) {
    if(this.status!=='playing'||this.paused)return false;
    const spec=TYPES[type]; if(!spec?.cost)return false;
    if(spec.needs&&!this.has(spec.needs)){this.message=`يتطلب ${TYPES[spec.needs].name} أولًا`;return false;}
    if(spec.speed&&!this.has('power')){this.message='تحتاج إلى محطة طاقة';return false;}
    if(this.cash<spec.cost){this.message='الموارد غير كافية';return false;}
    if(spec.speed){
      if(this.entities.filter(e=>e.team==='blue'&&e.speed).length>=40){this.message='الحد الأقصى ٤٠ وحدة';return false;}
      const producer=this.entities.find(e=>e.team==='blue'&&e.type===spec.needs);
      const n=this.entities.filter(e=>e.speed&&e.team==='blue').length;
      x=Math.min(560,producer.x+55+(n%3)*15);y=Math.max(25,Math.min(590,producer.y+((n%5)-2)*18));
    }else{
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<spec.radius+10||x>550||y<spec.radius+10||y>HEIGHT-spec.radius-10){this.message='اختر مساحة داخل النصف الأيسر من الخريطة';return false;}
      if(this.entities.some(e=>!e.speed&&distance(e,{x,y})<e.radius+spec.radius+12)){this.message='المكان قريب جدًا من مبنى آخر';return false;}
    }
    this.cash-=spec.cost;this.add(type,'blue',x,y);this.message=`تم تجهيز ${spec.name}`;return true;
  }
  selectAll() { this.selected=new Set(this.entities.filter(e=>e.team==='blue'&&e.speed).map(e=>e.id)); }
  selectAt(x,y,additive=false) {
    const entity=this.entities.find(e=>e.team==='blue'&&e.speed&&distance(e,{x,y})<e.radius+12);
    if(!additive)this.selected.clear();
    if(entity)this.selected.add(entity.id);
  }
  command(x,y) {
    if(this.paused||this.status!=='playing')return;
    const enemy=this.entities.find(e=>e.team==='red'&&distance(e,{x,y})<e.radius+16);
    let i=0;
    for(const unit of this.entities.filter(e=>this.selected.has(e.id))){
      unit.order=enemy?{target:enemy.id}:{x:Math.max(15,Math.min(985,x+(i%3)*20)),y:Math.max(15,Math.min(605,y+Math.floor(i/3)*20))}; i++;
    }
    this.message=i?(enemy?'أمر هجوم على الهدف':'تم إرسال أمر التحرك'):'اختر وحدة أو اضغط تحديد الجيش أولًا';
  }
  update(dt) {
    if(this.paused||this.status!=='playing')return;
    this.time+=dt;this.income+=dt;
    while(this.income>=5){this.income-=5;this.cash+=this.entities.filter(e=>e.type==='supply'&&e.team==='blue').length*180;}
    if(this.time>=this.nextWave&&this.wave<5){
      this.wave++;this.nextWave+=40;
      for(let i=0;i<this.wave+2;i++)this.add(this.wave>=3&&i%3===0?'tank':'soldier','red',940,110+i*42);
      this.message=`الموجة ${this.wave} تقترب! احمِ مركز القيادة.`;
    }
    for(const unit of this.entities){
      if(unit.hp<=0||!unit.damage)continue;
      if(unit.team==='blue'&&unit.type==='turret'&&!this.has('power'))continue;
      unit.cd=Math.max(0,unit.cd-dt);
      const opponents=this.entities.filter(e=>e.team!==unit.team&&e.hp>0);
      let ordered=unit.order?.target?opponents.find(e=>e.id===unit.order.target):null;
      if(unit.order?.target&&!ordered)unit.order=null;
      const nearby=opponents.filter(e=>distance(unit,e)<=unit.range+e.radius).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
      const target=ordered&&distance(unit,ordered)<=unit.range+ordered.radius?ordered:nearby;
      if(target){
        if(unit.cd<=0){target.hp-=unit.damage;unit.cd=unit.cooldown;this.effects.push({x:unit.x,y:unit.y,tx:target.x,ty:target.y,team:unit.team,life:.16});}
      }else if(unit.speed){
        const destination=ordered || (unit.order?.x!==undefined?unit.order:null) || (unit.team==='red'?opponents.find(e=>e.type==='hq'):null);
        if(destination){const d=distance(unit,destination);if(d>5){const step=Math.min(unit.speed*dt,d);unit.x+=(destination.x-unit.x)/d*step;unit.y+=(destination.y-unit.y)/d*step;}else if(!ordered)unit.order=null;}
      }
    }
    this.entities=this.entities.filter(e=>e.hp>0);
    this.selected=new Set([...this.selected].filter(id=>this.entities.some(e=>e.id===id)));
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
    if(!this.has('hq')){this.status='lost';this.message='سقط مركز القيادة. أعد المحاولة بخطة دفاع أقوى.';}
    else if(!this.entities.some(e=>e.team==='red'&&e.type==='hq')){this.status='won';this.message='انتصار! تم تدمير مركز قيادة العدو.';}
  }
}
