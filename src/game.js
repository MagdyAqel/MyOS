import { Battle, TYPES, WIDTH, HEIGHT } from './battle.js';
import './apps.css';

export function setupGame(content) {
  content.innerHTML=`<div class="rts-app">
    <header class="rts-header"><div><span class="eyebrow">DESERT COMMAND</span><strong>قيادة الصحراء</strong></div><div class="rts-stats" aria-live="off"><span data-stat="cash"></span><span data-stat="wave"></span><span data-stat="army"></span></div><button data-game="pause">إيقاف مؤقت</button><button data-game="restart">مهمة جديدة</button></header>
    <div class="rts-layout"><div class="battlefield"><canvas width="1000" height="620" tabindex="0" aria-label="ساحة المعركة: انقر لاختيار وحدة، ثم انقر موقعًا للتحرك أو عدوًا للهجوم"></canvas><div class="rts-result hidden" role="status"></div></div>
    <aside class="rts-panel"><div class="rts-mission"><span>العملية 01</span><h2>خط الدفاع الأخير</h2><p>ابنِ قاعدة، صدّ ٥ موجات، ودمّر مركز العدو الأحمر.</p></div><h3>إنشاء مبانٍ</h3><div class="build-buttons">${['supply','power','barracks','factory','turret'].map(t=>`<button data-build="${t}"><span>${({supply:'▤',power:'ϟ',barracks:'⌂',factory:'▥',turret:'⌖'})[t]} ${TYPES[t].name}</span><small>$${TYPES[t].cost}</small></button>`).join('')}</div><h3>تدريب الجيش</h3><div class="train-buttons">${['soldier','tank'].map(t=>`<button data-train="${t}">${TYPES[t].name}<small>$${TYPES[t].cost}</small></button>`).join('')}</div><button data-game="select">تحديد الجيش</button><button data-game="attack">هجوم على مقر العدو</button><p class="rts-help">البناء: اختر مبنى ثم انقر مساحة في نصفك الأيسر. الجندي يحتاج ثكنة، والدبابة مصنعًا، وكلاهما يحتاج طاقة. الإمداد يمنح $180 كل ٥ ثوانٍ.</p></aside></div>
    <footer class="rts-footer"><span class="rts-message" role="status"></span><span>أزرق: أنت · أحمر: العدو</span></footer>
    <details class="rts-instructions"><summary>طريقة اللعب</summary><p>انقر وحدة لتحديدها؛ Shift لإضافة وحدة. انقر مكانًا فارغًا للتحرك أو عدوًا للهجوم. زر الفأرة الأيمن يصدر أمرًا أيضًا. «تحديد الجيش» ثم «هجوم على مقر العدو» بديل مناسب للهاتف. يمكنك إلغاء البناء بزر Escape. تنتهي المهمة عند تدمير مركز قيادة أحد الفريقين. اللعبة أصلية ومصغرة مستوحاة من ألعاب الاستراتيجية؛ لا تستخدم ملفات Generals ولا تتطلب تثبيتها.</p></details></div>`;
  const canvas=content.querySelector('canvas'),ctx=canvas.getContext('2d');
  const message=content.querySelector('.rts-message'),result=content.querySelector('.rts-result');
  let battle=new Battle(),building=null,last=0,lastHud=0,animation,stopped=false;
  function refresh(){
    content.querySelector('[data-stat="cash"]').textContent=`$${battle.cash}`;
    content.querySelector('[data-stat="wave"]').textContent=`موجة ${battle.wave}/5 · ${battle.wave<5?Math.max(0,Math.ceil(battle.nextWave-battle.time))+'ث':'الموجة الأخيرة'}`;
    content.querySelector('[data-stat="army"]').textContent=`الجيش ${battle.entities.filter(e=>e.team==='blue'&&e.speed).length} · المحدد ${battle.selected.size}`;
    const text=building?`بناء ${TYPES[building].name}: اختر موقعًا في النصف الأيسر · Escape للإلغاء`:battle.message;
    if(message.textContent!==text)message.textContent=text;
    content.querySelector('[data-game="pause"]').textContent=battle.paused?'متابعة':'إيقاف مؤقت';
    const ended=battle.status!=='playing';result.classList.toggle('hidden',!ended&&!battle.paused);
    result.textContent=ended?(battle.status==='won'?'انتصار — سيطرت على الميدان':'انتهت المهمة — سقطت القاعدة'):'المهمة متوقفة مؤقتًا';
    for(const button of content.querySelectorAll('[data-build], [data-train]')){
      const type=button.dataset.build||button.dataset.train,spec=TYPES[type];
      button.disabled=ended||battle.paused||battle.cash<spec.cost||Boolean(spec.needs&&!battle.has(spec.needs))||Boolean(spec.speed&&!battle.has('power'));
      button.setAttribute('aria-pressed',String(building===type));
    }
  }
  content.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{building=building===b.dataset.build?null:b.dataset.build;refresh();});
  content.querySelectorAll('[data-train]').forEach(b=>b.onclick=()=>{battle.purchase(b.dataset.train);refresh();});
  content.querySelector('[data-game="pause"]').onclick=()=>{if(battle.status==='playing')battle.paused=!battle.paused;refresh();};
  content.querySelector('[data-game="restart"]').onclick=()=>{battle=new Battle();building=null;refresh();};
  content.querySelector('[data-game="select"]').onclick=()=>{building=null;battle.selectAll();refresh();};
  content.querySelector('[data-game="attack"]').onclick=()=>{building=null;battle.command(880,300);refresh();};
  function interact(event){
    event.preventDefault();if(battle.paused||battle.status!=='playing')return;
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*WIDTH,y=(event.clientY-rect.top)/rect.height*HEIGHT;
    if(building){if(battle.purchase(building,x,y))building=null;}
    else if(event.button===2)battle.command(x,y);
    else if(battle.entities.some(e=>e.team==='blue'&&e.speed&&Math.hypot(e.x-x,e.y-y)<e.radius+12))battle.selectAt(x,y,event.shiftKey);
    else if(battle.selected.size)battle.command(x,y);
    else battle.selectAt(x,y);
    refresh();
  }
  canvas.onpointerdown=interact;canvas.oncontextmenu=e=>e.preventDefault();
  content.onkeydown=e=>{if(e.key==='Escape'){building=null;refresh();}};
  function draw(){
    ctx.fillStyle='#ba9d6c';ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(let y=0;y<HEIGHT;y+=40)for(let x=0;x<WIDTH;x+=40){ctx.fillStyle=(x+y)%80===0?'#b59968':'#bea374';ctx.fillRect(x,y,40,40);}
    ctx.fillStyle='#cbb082';ctx.beginPath();ctx.moveTo(0,275);ctx.lineTo(1000,265);ctx.lineTo(1000,355);ctx.lineTo(0,365);ctx.fill();
    ctx.strokeStyle='#dfd1a655';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(560,0);ctx.lineTo(560,620);ctx.stroke();ctx.setLineDash([]);
    for(const [x,y,r] of [[430,90,34],[560,510,42],[670,70,28],[390,450,20],[55,100,23],[710,560,26]]){ctx.fillStyle='#7f755b';ctx.beginPath();ctx.ellipse(x,y,r,r*.55,.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#968a69';ctx.beginPath();ctx.ellipse(x-3,y-4,r*.8,r*.4,.3,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#635b40';ctx.font='bold 13px Tahoma';ctx.textAlign='center';ctx.fillText('منطقة البناء',270,30);ctx.fillText('قطاع العدو',835,30);
    for(const e of battle.entities){
      ctx.save();ctx.translate(e.x,e.y);const blue=e.team==='blue',color=blue?'#64cbf3':'#f37866',dark=blue?'#244962':'#713a32';
      ctx.shadowColor='#0005';ctx.shadowOffsetY=4;ctx.shadowBlur=3;
      if(battle.selected.has(e.id)){ctx.strokeStyle='#b9f5ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,4,e.radius+9,e.radius+5,0,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle=dark;ctx.strokeStyle=color;ctx.lineWidth=2;
      if(e.type==='soldier'){ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#e1c7a3';ctx.fillRect(-2,-4,4,4);}
      else if(e.type==='tank'){ctx.fillStyle='#343b36';ctx.fillRect(-18,-13,36,26);ctx.fillStyle=dark;ctx.fillRect(-15,-10,30,20);ctx.strokeRect(-15,-10,30,20);ctx.fillStyle=color;ctx.fillRect(-7,-6,14,12);ctx.fillRect(0,-3,blue?27:-27,5);}
      else{const r=e.radius;ctx.fillRect(-r,-r*.7,r*2,r*1.4);ctx.strokeRect(-r,-r*.7,r*2,r*1.4);ctx.fillStyle=blue?'#37617b':'#8e5143';ctx.fillRect(-r+5,-r*.7+5,r*2-10,9);ctx.fillStyle=color;
        if(e.type==='power'){ctx.beginPath();ctx.moveTo(-7,-10);ctx.lineTo(7,-10);ctx.lineTo(-2,1);ctx.lineTo(8,1);ctx.lineTo(-8,15);ctx.lineTo(-2,3);ctx.lineTo(-9,3);ctx.fill();}
        else if(e.type==='turret'){ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.fillRect(0,-3,blue?28:-28,6);}
        else{for(let i=-1;i<2;i++)ctx.fillRect(i*13-4,-4,8,11);}
      }
      ctx.shadowColor='transparent';const bar=e.radius*2+8;ctx.fillStyle='#1c2529';ctx.fillRect(-bar/2,-e.radius-12,bar,4);ctx.fillStyle=blue?'#79e9bc':'#ffb38d';ctx.fillRect(-bar/2,-e.radius-12,bar*Math.max(0,e.hp/e.maxHp),4);
      if(!e.speed){ctx.font='11px Tahoma';ctx.fillStyle='#1d261f';ctx.textAlign='center';ctx.fillText(e.name,0,e.radius+20);}
      ctx.restore();
    }
    for(const effect of battle.effects){ctx.strokeStyle=effect.team==='blue'?'#dcfbff':'#ffdb7c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(effect.x,effect.y);ctx.lineTo(effect.tx,effect.ty);ctx.stroke();}
    if(building){ctx.fillStyle='#003a4c33';ctx.fillRect(0,0,550,HEIGHT);}
  }
  function frame(time){
    if(stopped)return;
    const dt=last?Math.min((time-last)/1000,.08):0;last=time;
    if(!document.hidden&&!content.closest('.window').classList.contains('hidden')&&document.querySelector('#lock-screen').classList.contains('hidden'))battle.update(dt);
    draw();if(time-lastHud>100){refresh();lastHud=time;}animation=requestAnimationFrame(frame);
  }
  refresh();animation=requestAnimationFrame(frame);
  return ()=>{stopped=true;cancelAnimationFrame(animation);content.onkeydown=null;};
}
