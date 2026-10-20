import {setupGlobalSearch} from "./global-search.js";
import {setupAppearance,setupDesktopExtras} from "./desktop-extras.js";
import "./productivity.css";
import './style.css';
import { setupBrowser } from './browser.js';
import { setupNotes } from './notes.js';
import {setupFiles} from './files.js';
import { bootDesktop, DEVELOPER } from './boot.js';
import { createWallpaperManager, setupPersonalization } from './wallpapers.js';
import { setupMobileViewport } from './mobile.js';
import {setupPWA,setupInstall} from './pwa.js';

const apps = [
  {id:'files', name:'مستكشف الملفات', icon:'📁', color:'#ffcb55'},
  {id:'notes', name:'المفكرة', icon:'📝', color:'#92cfff'},
  {id:'calculator', name:'الحاسبة', icon:'▦', color:'#b9c8de'},
  {id:'browser', name:'المتصفح', icon:'🌐', color:'#68c9f3'},
  {id:'strategy', name:'قيادة الأفق 3D', icon:'🎖', color:'#f5cc83'},
  {id:'arena',name:'اللعب عبر الويب',icon:'⚔',color:'#efcf93'},
  {id:'writer',name:'محرر المستندات',icon:'✒',color:'#d5c4ff'},
  {id:'media',name:'الصور والوسائط',icon:'▧',color:'#ffca9f'},
  {id:'backup',name:'النسخ الاحتياطي',icon:'▣',color:'#92dfc5'},
  {id:'install',name:'تثبيت MyOS',icon:'⇩',color:'#8cd5bd'},
  {id:'cloud', name:'المزامنة السحابية', icon:'☁', color:'#9be0ff'},
  {id:'settings', name:'الإعدادات', icon:'⚙', color:'#adc7df'},
  {id:'about', name:'حول MyOS', icon:'◈', color:'#80cfff'},
];
const read = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { toast('تعذّر الحفظ في هذا المتصفح'); } };
let z = 10;
const windows = new Map();
window.addEventListener('myos:before-data-restore',()=>{for(const [id,w] of [...windows])if(!['cloud','backup'].includes(id))w.querySelector('[data-action=close]').click();});
const root = document.querySelector('#app');
root.innerHTML = `
<main id="desktop" aria-label="سطح المكتب">
  <div class="bloom" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <header class="desktop-heading"><span class="eyebrow">YOUR SPACE, REIMAGINED</span><h1>مساحة لكل أفكارك.</h1><p>أهلًا بك في MyOS</p></header>
  <nav class="desktop-icons" aria-label="تطبيقات سطح المكتب">${apps.map(a=>`<button data-open="${a.id}" aria-label="${a.name}"><span class="app-icon" style="--icon:${a.color}">${a.icon}</span><span>${a.name}</span></button>`).join('')}</nav>
  <div class="developer-credit" dir="ltr">${DEVELOPER}</div>
  <div id="windows"></div>
  <section id="start" class="glass hidden" aria-label="قائمة ابدأ"><input id="search" placeholder="ابحث عن تطبيقاتك" aria-label="البحث عن تطبيق"><div class="section-label"><strong>التطبيقات المثبتة</strong><span>كل ما تحتاجه</span></div><div id="app-grid"></div><div class="recommend"><strong>ابدأ شيئًا رائعًا</strong><p>دوّن فكرة، رتّب ملفاتك، أو اجعل هذه المساحة لك.</p><button data-open="notes">افتح المفكرة ←</button></div><footer><span>● &nbsp; المستخدم المحلي</span><button id="lock" title="قفل سطح المكتب" aria-label="قفل سطح المكتب">⏻</button></footer></section>
  <section id="quick" class="glass hidden" aria-label="الإعدادات السريعة"><h3>الإعدادات السريعة</h3><div class="quick-grid"><button id="wifi" aria-pressed="true">◉<br>Wi-Fi</button><button id="quiet" aria-pressed="false">☾<br>عدم الإزعاج</button><button id="theme-quick">◐<br>المظهر</button></div><label>سطوع سطح المكتب<input id="brightness" aria-label="السطوع" type="range" min="45" max="100" value="100"></label><p class="muted">عناصر تجريبية داخل المحاكاة</p></section>
  <div id="toast" role="status" class="hidden"></div>
</main>
<footer id="taskbar" class="glass"><div class="weather"><span>☀</span><div>٢٤°<small>يوم جميل</small></div></div><nav class="task-apps" aria-label="شريط المهام"><button id="start-button" aria-label="ابدأ" aria-expanded="false"><span class="windows-logo"><i></i><i></i><i></i><i></i></span></button><button id="search-button" aria-label="بحث">⌕</button>${apps.filter(a=>a.id!=='about').map(a=>`<button data-open="${a.id}" data-task="${a.id}" aria-label="${a.name}">${a.icon}</button>`).join('')}</nav><button id="tray" aria-label="فتح الإعدادات السريعة"><span>⌁ &nbsp; ◖ &nbsp; ▰</span><span id="clock"></span></button></footer>
<div id="lock-screen" class="hidden"><div><span class="eyebrow">MYOS</span><h2 id="lock-clock"></h2><p>مساحتك بانتظارك</p><button id="unlock">الدخول إلى سطح المكتب ←</button></div></div>`;

function toast(message) {window.dispatchEvent(new CustomEvent('myos:notice',{detail:{text:message}})); const el=document.querySelector('#toast'); el.textContent=message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleStart(force) { const el=document.querySelector('#start'); const visible=force ?? el.classList.contains('hidden'); el.classList.toggle('hidden',!visible); document.querySelector('#start-button').setAttribute('aria-expanded',String(visible)); document.querySelector('#quick').classList.add('hidden'); if(visible) document.querySelector('#search').focus(); }
function renderApps(query='') { document.querySelector('#app-grid').innerHTML=apps.filter(a=>a.name.includes(query)||a.id.includes(query.toLowerCase())).map(a=>`<button data-open="${a.id}" aria-label="${a.name}"><span class="app-icon" style="--icon:${a.color}">${a.icon}</span>${a.name}</button>`).join('') || '<p class="muted">لا توجد نتائج</p>'; }
renderApps();
document.querySelector('#search').addEventListener('input',e=>renderApps(e.target.value));
document.querySelector('#start-button').onclick=()=>toggleStart();
document.querySelector('#search-button').onclick=()=>toggleStart(true);
document.querySelector('#tray').onclick=()=>{ toggleStart(false); document.querySelector('#quick').classList.toggle('hidden'); };
document.querySelector('#desktop').addEventListener('pointerdown',e=>{ if(e.target.closest('#start, #quick, [data-open], .window')) return; toggleStart(false); document.querySelector('#quick').classList.add('hidden'); });
document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggleStart(false);document.querySelector('#quick').classList.add('hidden');}});
document.addEventListener('click',e=>{const button=e.target.closest('[data-open]'); if(button) openApp(button.dataset.open);});
function updateClock(){const now=new Date();const time=now.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'});document.querySelector('#clock').innerHTML=`${time}<small>${now.toLocaleDateString('ar',{day:'numeric',month:'short'})}</small>`;document.querySelector('#lock-clock').textContent=time;}
updateClock();setInterval(updateClock,1000);
document.querySelector('#lock').onclick=()=>{toggleStart(false);document.querySelector('#lock-screen').classList.remove('hidden');};
document.querySelector('#unlock').onclick=()=>document.querySelector('#lock-screen').classList.add('hidden');
for(const id of ['wifi','quiet']) document.querySelector('#'+id).onclick=e=>{const b=e.currentTarget;b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));toast('تم تغيير الخيار داخل المحاكاة');};
document.querySelector('#brightness').oninput=e=>document.querySelector('#desktop').style.filter=`brightness(${e.target.value}%)`;
function setTheme(theme){document.documentElement.dataset.theme=theme;save('myos-theme',theme);}
setTheme(read('myos-theme','dark'));
document.querySelector('#theme-quick').onclick=()=>setTheme(document.documentElement.dataset.theme==='light'?'dark':'light');

function openApp(id,matchConnection=null,openTarget=null){
  toggleStart(false);document.querySelector('#quick').classList.add('hidden');
  if(windows.has(id)){const w=windows.get(id);w.classList.remove('hidden');w.style.zIndex=++z;if(openTarget){const content=w.querySelector('.window-content');if(content.dataset.appReady==='true')content.dispatchEvent(new CustomEvent('myos:open-item',{detail:openTarget}));else content.pendingTarget=openTarget;}return;}
  const app=apps.find(a=>a.id===id);if(!app)return;
  const w=document.createElement('section');w.className='window glass';w.setAttribute('aria-label',app.name);w.style.zIndex=++z;
  if(id==='strategy')w.classList.add('game-window','maximized');
  if(id==='browser')w.classList.add('browser-window');
  w.style.left=`${Math.max(8,(innerWidth-Math.min(760,innerWidth-24))/2+windows.size*18)}px`;w.style.top=`${Math.min(70+windows.size*24,Math.max(0,innerHeight-550))}px`;
  w.innerHTML=`<header class="titlebar"><span>${app.icon} &nbsp; ${app.name}</span><div class="window-controls"><button data-action="minimize" aria-label="تصغير">─</button><button data-action="maximize" aria-label="تكبير">□</button><button data-action="close" aria-label="إغلاق">×</button></div></header><div class="window-content"></div>`;
  document.querySelector('#windows').append(w);windows.set(id,w);document.querySelector(`[data-task="${id}"]`)?.classList.add('running');
  w.onpointerdown=()=>w.style.zIndex=++z;
  w.querySelector('[data-action="close"]').onclick=()=>{w.cleanup?.();w.remove();windows.delete(id);document.querySelector(`[data-task="${id}"]`)?.classList.remove('running');};
  w.querySelector('[data-action="minimize"]').onclick=()=>w.classList.add('hidden');
  const maximize=()=>w.classList.toggle('maximized');w.querySelector('[data-action="maximize"]').onclick=maximize;
  const bar=w.querySelector('.titlebar');bar.ondblclick=e=>{if(!e.target.closest('button'))maximize();};
  bar.onpointerdown=e=>{if(e.target.closest('button')||w.classList.contains('maximized'))return;const rect=w.getBoundingClientRect();const dx=e.clientX-rect.left,dy=e.clientY-rect.top;bar.setPointerCapture(e.pointerId);bar.onpointermove=m=>{w.style.left=`${Math.max(0,Math.min(innerWidth-100,m.clientX-dx))}px`;w.style.top=`${Math.max(0,Math.min(innerHeight-100,m.clientY-dy))}px`;};bar.onpointerup=()=>bar.onpointermove=null;bar.onpointercancel=()=>bar.onpointermove=null;};
  const content=w.querySelector('.window-content');
  if(id==='notes') w.cleanup=setupNotes(content,{target:openTarget});
  if(id==='browser') w.cleanup=setupBrowser(content);
  if(id==='strategy'){
    content.textContent='جارٍ تحميل العالم ثلاثي الأبعاد…';
    import('./game.js').then(({setupGame})=>{if(w.isConnected)w.cleanup=setupGame(content,{network:matchConnection});}).catch(()=>{if(w.isConnected)content.textContent='تعذّر تحميل اللعبة. أعد تحميل الصفحة وحاول مجددًا.';});
  }
  if(id==='cloud'){content.textContent='جارٍ فتح المزامنة…';import('./cloud.js').then(({setupCloud})=>{if(w.isConnected)w.cleanup=setupCloud(content);}).catch(()=>{if(w.isConnected)content.textContent='تعذّر فتح المزامنة. أعد المحاولة.';});}
  if(id==='arena'){content.textContent='جارٍ فتح المواجهة…';import('./arena.js').then(({setupArena})=>{if(w.isConnected)w.cleanup=setupArena(content,{openGame:connection=>{windows.get('strategy')?.querySelector('[data-action=close]').click();openApp('strategy',connection);}});}).catch(()=>{if(w.isConnected)content.textContent='تعذّر فتح اللعب عبر الويب';});}
  if(['writer','media','backup'].includes(id)){content.textContent='جارٍ فتح التطبيق…';const loaders={writer:()=>import('./documents.js').then(m=>m.setupWriter),media:()=>import('./media.js').then(m=>m.setupMedia),backup:()=>import('./backup.js').then(m=>m.setupBackup)};loaders[id]().then(setup=>{if(w.isConnected){w.cleanup=setup(content,{target:content.pendingTarget||openTarget});content.dataset.appReady='true';}}).catch(()=>{if(w.isConnected)content.textContent='تعذّر فتح التطبيق. أعد المحاولة.';});}
  if(id==='install')w.cleanup=setupInstall(content);
  if(id==='calculator') setupCalculator(content);
  if(id==='files') w.cleanup=setupFiles(content,{target:openTarget,openMedia:item=>openApp('media',null,item)});
  if(id==='settings'){w.cleanup=setupPersonalization(content,wallpaperManager,setTheme);setupAppearance(content);}
  if(['files','notes'].includes(id))content.dataset.appReady='true';
  if(id==='about')content.innerHTML='<div class="about-page"><span class="about-mark">◈</span><h2>MyOS</h2><p>سطح مكتب صغير. احتمالات كبيرة.</p><p class="muted">محاكاة تفاعلية مستوحاة من ويندوز 11 تعمل داخل المتصفح.<br>ليست نظام تشغيل حقيقيًا، ولا تشغّل برامج Windows.</p><span class="version">الإصدار 4.3.0 · Develped by:Pro. Magdy S. Aqel</span></div>';
}
setupGlobalSearch(item=>openApp(item.app,null,item));
const wallpaperManager=createWallpaperManager();
function setupCalculator(content){
  content.innerHTML='<div class="calculator"><span class="muted">قياسية</span><output aria-label="نتيجة الحاسبة">0</output><div class="calc-keys"></div></div>';
  let display='0',stored=null,operator=null,fresh=true;
  const output=content.querySelector('output');
  const calculate=()=>{if(stored===null||!operator)return;const value=Number(display);const result=operator==='+'?stored+value:operator==='−'?stored-value:operator==='×'?stored*value:value===0?NaN:stored/value;display=Number.isFinite(result)?String(Number(result.toPrecision(12))):'خطأ';stored=null;operator=null;};
  for(const key of ['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','⌫','0','.','=']){const b=document.createElement('button');b.textContent=key;if(key==='=')b.className='equals';b.onclick=()=>{if(/^[0-9.]$/.test(key)){if(fresh||display==='خطأ'){display=key==='.'?'0.':key;fresh=false;}else if(key!=='.'||!display.includes('.'))display=display==='0'&&key!=='.'?key:display+key;}else if(key==='C'){display='0';stored=null;operator=null;fresh=true;}else if(key==='⌫'){display=display.slice(0,-1)||'0';}else if(key==='±'){display=String(-Number(display));}else if(key==='%'){display=String(Number(display)/100);}else if(key==='='){calculate();fresh=true;}else{if(!fresh)calculate();stored=Number(display);operator=key;fresh=true;}output.textContent=display;};content.querySelector('.calc-keys').append(b);}
}

setupMobileViewport();
setupDesktopExtras({openApp,windows,raise:w=>w.style.zIndex=++z,lock:()=>document.querySelector('#lock-screen').classList.remove('hidden')});
setupPWA();
bootDesktop();
if(new URLSearchParams(location.hash.slice(1)).has("myos-room"))openApp("arena");
