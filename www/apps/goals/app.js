/* Future Goals — web port of the Expo/React Native app (Stage 1: Home, Planner, Timer).
   Storage: localStorage (replaces SQLite). Notifications: Capacitor LocalNotifications via the parent shell. */
'use strict';
// ---------- data ----------
const CATEGORIES=['English','IELTS','GMAT/GRE','Mathematics','Business Analytics','Finance & Accounting','Business Strategy','Leadership & Management','MBA & Scholarship Research','Professional Portfolio','Entrepreneurship & Income','Other'];
const GROUP_OF={'English':'English & IELTS','IELTS':'English & IELTS','GMAT/GRE':'GMAT & Maths','Mathematics':'GMAT & Maths','Business Analytics':'Business & Portfolio','Finance & Accounting':'Business & Portfolio','Business Strategy':'Business & Portfolio','Leadership & Management':'Business & Portfolio','Professional Portfolio':'Business & Portfolio','Entrepreneurship & Income':'Business & Portfolio','MBA & Scholarship Research':'MBA & Research','Other':'Other'};
const WEEKLY_TARGET_MIN={'English & IELTS':360,'GMAT & Maths':240,'Business & Portfolio':180,'MBA & Research':120};
const GROUP_DEFAULT_CATEGORY={'English & IELTS':'English','GMAT & Maths':'GMAT/GRE','Business & Portfolio':'Business Analytics','MBA & Research':'MBA & Scholarship Research'};
const PHASES=[{name:'1 Foundation',start:'2026-11-01',end:'2027-01-31'},{name:'2 Skill Development',start:'2027-02-01',end:'2027-04-30'},{name:'3 Professional Development',start:'2027-05-01',end:'2027-07-31'},{name:'4 Application Preparation',start:'2027-08-01',end:'2027-10-31'},{name:'5 Application Period',start:'2027-11-01',end:'2028-01-31'},{name:'6 Interview & Selection',start:'2028-02-01',end:'2028-04-30'},{name:'7 Final Preparation',start:'2028-05-01',end:'2028-07-31'},{name:'8 MBA Commencement',start:'2028-08-01',end:'2028-08-31'}];
const UNDERSTANDING=['Completely confused','Slightly understand','Understand the basics','Understand well','Can explain & apply independently'];
// ---------- time ----------
const p2=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const toMin=h=>{const [a,b]=String(h).split(':').map(Number);return (a||0)*60+(b||0)};
const fmtMin=m=>`${p2(Math.floor(m/60))}:${p2(m%60)}`;
const fmtDur=m=>`${Math.floor(m/60)}h ${m%60}m`;
const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const startOfWeek=d=>{const s=startOfDay(d);s.setDate(s.getDate()-((s.getDay()+6)%7));return s};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmtClock=ms=>{const s=Math.floor(ms/1000);return `${p2(Math.floor(s/3600))}:${p2(Math.floor(s%3600/60))}:${p2(s%60)}`};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ---------- store ----------
const KEY='futuregoals.v1';
let DB={settings:{},shifts:{},sessions:[],timer:null,lessons:{}};
try{const r=localStorage.getItem(KEY);if(r)DB=Object.assign(DB,JSON.parse(r))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){}};
const getSetting=(k,f)=>k in DB.settings?DB.settings[k]:f;
const setSetting=(k,v)=>{DB.settings[k]=v;save()};
const getShift=d=>DB.shifts[d]||'unset';
const setShift=(d,t)=>{DB.shifts[d]=t;save()};
function sumMinutes(from,to,byCat){
  const rows=DB.sessions.filter(s=>s.started_at>=from&&s.started_at<to);
  if(!byCat)return Math.round(rows.reduce((a,s)=>a+s.duration_ms,0)/60000);
  const m={};rows.forEach(s=>m[s.category]=(m[s.category]||0)+s.duration_ms/60000);
  return Object.keys(m).map(c=>({category:c,m:Math.floor(m[c])}));
}
const sessionDays=()=>new Set(DB.sessions.map(s=>dateKey(new Date(s.started_at))));
// ---------- scheduler ----------
const DEFAULT_CONFIG={morning:['08:50','16:30'],afternoon:['14:20','22:00'],wake:'06:00',sleep:'22:30',bufferMin:60,pref:{morning:'both',afternoon:'early'}};
const loadConfig=()=>{const c=getSetting('config',{});return Object.assign({},DEFAULT_CONFIG,c,{pref:Object.assign({},DEFAULT_CONFIG.pref,c.pref||{})})};
function freeWindows(type,c){
  const wake=toMin(c.wake),sleep=toMin(c.sleep);let wins;
  if(type==='morning'||type==='afternoon'){
    const s=toMin(c[type][0])-c.bufferMin,e=toMin(c[type][1])+c.bufferMin;
    wins=[[wake,Math.min(s,sleep)],[Math.max(e,wake),sleep]];
    const pf=(c.pref&&c.pref[type])||'both';
    if(pf==='early')wins=[[wake,Math.min(s,sleep,720)],[Math.max(e,wake),sleep]];
    const keep=pf==='before'||pf==='early'?[wins[0]]:pf==='after'?[wins[1]]:wins;
    const f=keep.filter(([a,b])=>b-a>=45);
    if(f.length)return f;
  }else wins=[[wake+60,sleep-30]];
  return wins.filter(([a,b])=>b-a>=45);
}
const totalFree=w=>w.reduce((s,[a,b])=>s+(b-a),0);
function dailyTarget(rem,daysLeft,type){const cap=type==='off'||type==='unset'?270:150;return Math.max(0,Math.min(cap,Math.ceil(rem/Math.max(1,daysLeft)/15)*15))}
function suggestBlocks(wins,target,deficits,nowMin=0){
  const out=[];let left=target;const d=Object.assign({},deficits);
  for(const [a0,b] of wins){
    let a=Math.max(a0,Math.ceil(nowMin/15)*15);
    while(left>=30&&b-a>=45){
      const len=Math.min(90,left,b-a);
      const g=Object.keys(d).sort((x,y)=>d[y]-d[x])[0];
      out.push({start:a,end:a+len,category:GROUP_DEFAULT_CATEGORY[g]||'Other',group:g});
      d[g]=(d[g]||0)-len;left-=len;a+=len+15;
    }
  }
  return out;
}
function planForDate(date,type){
  const cfg=loadConfig();const t=type||getShift(dateKey(date));
  const wins=freeWindows(t,cfg);const ws=startOfWeek(date),we=addDays(ws,7);
  const rows=sumMinutes(ws.getTime(),we.getTime(),true);const done={};
  rows.forEach(r=>{const g=GROUP_OF[r.category];done[g]=(done[g]||0)+r.m});
  const deficits={};Object.keys(WEEKLY_TARGET_MIN).forEach(g=>deficits[g]=Math.max(0,WEEKLY_TARGET_MIN[g]-(done[g]||0)));
  const remaining=Object.values(deficits).reduce((s,x)=>s+x,0);
  const daysLeft=7-((date.getDay()+6)%7);
  const target=Math.min(dailyTarget(remaining,daysLeft,t),totalFree(wins));
  return {type:t,cfg,wins,target,blocks:suggestBlocks(wins,target,deficits)};
}
// ---------- notifications (Capacitor LocalNotifications through the parent shell) ----------
const LN=(()=>{try{const c=(window.parent&&window.parent.Capacitor)||window.Capacitor;return c&&c.Plugins&&c.Plugins.LocalNotifications||null}catch(e){return null}})();
const TIMER_NOTIF_ID=900001;
async function initNotifications(){
  if(!LN)return;
  try{
    const p=await LN.checkPermissions();if(p.display!=='granted')await LN.requestPermissions();
    await LN.createChannel({id:'study',name:'Study reminders',importance:3});
    await LN.createChannel({id:'challenge',name:'Challenge complete',importance:4});
  }catch(e){}
}
// ---------- Curriculum engine ----------
const phaseIdx=d=>{const k=dateKey(d),i=PHASES.findIndex(p=>k>=p.start&&k<=p.end);return i>=0?i+1:(k<PHASES[0].start?1:8)};
const lessonsOf=sub=>(CURR[sub]||[]).map((L,i)=>Object.assign({id:sub+'#'+i,i,sub,n:(CURR[sub]||[]).length},L));
const lstate=id=>DB.lessons[id]||{min:0,done:false};
const lessonDone=L=>{const s=lstate(L.id);return !!s.done||s.min>=L.m};
const lessonOpen=(L,ph,used)=>L.p<=ph&&!lessonDone(L)&&(used[L.id]||0)+lstate(L.id).min<L.m;
const reviewFor=sub=>Object.assign({sub,i:0,n:0},reviewLesson(sub));
// Gives every study block a subject and a concrete lesson. A lesson with little time left shares its block with the next one.
function buildSchedule(from,days){
  const used={},out={};
  for(let i=0;i<days;i++){
    const d=addDays(startOfDay(from),i),plan=planForDate(d),ph=phaseIdx(d),ord=Math.floor(d.getTime()/864e5);
    const blocks=plan.blocks.map((b,bi)=>{
      const list=rotationFor(b.group,ph)||[b.category],work=list.filter(s=>lessonsOf(s).some(L=>lessonOpen(L,ph,used))),pool=work.length?work:list;
      const sub=pool[(ord+bi)%pool.length],len=b.end-b.start,open=()=>lessonsOf(sub).find(x=>lessonOpen(x,ph,used));
      let L=open();
      if(!L)return Object.assign({},b,{category:sub,lesson:reviewFor(sub),before:0,len,mainMin:len,then:null,left:null});
      let before=used[L.id]||0,rem=L.m-lstate(L.id).min-before,then=null,mainMin=len;
      if(rem<15){used[L.id]=L.m-lstate(L.id).min;L=open()||reviewFor(sub);before=used[L.id]||0;rem=L.review?1e9:L.m-lstate(L.id).min-before}
      if(rem<len-14){
        mainMin=rem;used[L.id]=before+rem;
        const L2=open()||reviewFor(sub);then={lesson:L2,min:len-rem};if(!L2.review)used[L2.id]=(used[L2.id]||0)+then.min;
      }else if(!L.review)used[L.id]=before+len;
      return Object.assign({},b,{category:sub,lesson:L,before,len,mainMin,then,left:then||L.review?null:Math.max(0,L.m-lstate(L.id).min-before-len)});
    });
    out[dateKey(d)]=Object.assign({},plan,{blocks});
  }
  return out;
}
function markDone(id,flag){const s=DB.lessons[id]||(DB.lessons[id]={min:0,done:false});s.done=flag;save();render();rescheduleReminders()}
async function rescheduleReminders(){
  if(!LN)return;
  try{
    const pend=await LN.getPending();
    const ids=(pend.notifications||[]).filter(n=>n.id!==TIMER_NOTIF_ID).map(n=>({id:n.id}));
    if(ids.length)await LN.cancel({notifications:ids});
    const list=[];let id=1000;
    const add=(date,title,body)=>{if(date.getTime()>Date.now()+5000)list.push({id:id++,title,body,schedule:{at:date,allowWhileIdle:true},channelId:'study'})};
    const sched=buildSchedule(new Date(),7);
    for(let i=0;i<7;i++){
      const day=addDays(startOfDay(new Date()),i),plan=sched[dateKey(day)];
      if(!plan.blocks.length)continue;
      const mk=m=>new Date(day.getTime()+m*60000),first=plan.blocks[0];
      add(mk(first.start-45),'Plan your day',`${plan.blocks.length} study block(s) today. First: ${first.lesson.t} at ${fmtMin(first.start)}.`);
      plan.blocks.slice(0,3).forEach(b=>add(mk(b.start-10),'Study session soon',`${b.category}: ${b.lesson.t} at ${fmtMin(b.start)} (${b.len} min).`));
      add(mk(toMin(plan.cfg.sleep)-60),'Evening reflection','What did you actually understand today? Log it in 2 minutes.');
    }
    if(list.length)await LN.schedule({notifications:list});
  }catch(e){}
}
async function notifyTimerDone(seconds){
  if(!LN)return;
  try{await LN.schedule({notifications:[{id:TIMER_NOTIF_ID,title:'The challenge is complete',body:'Your study block is done. Log what you learned.',schedule:{at:new Date(Date.now()+seconds*1000),allowWhileIdle:true},channelId:'challenge'}]})}catch(e){}
}
async function cancelTimerNotif(){if(!LN)return;try{await LN.cancel({notifications:[{id:TIMER_NOTIF_ID}]})}catch(e){}}
// ---------- sounds ----------
const startA=new Audio('sounds/challenge_start.wav'),doneA=new Audio('sounds/challenge_complete.wav');
function cue(a,phrase,delay){
  if(!getSetting('soundOn',true))return;
  try{a.currentTime=0;a.play().catch(()=>{})}catch(e){}
  setTimeout(()=>{try{const u=new SpeechSynthesisUtterance(phrase);u.lang='en-US';u.rate=.95;u.pitch=.9;speechSynthesis.speak(u)}catch(e){}},delay);
}
const playStart=()=>cue(startA,'Challenge start',900),playComplete=()=>cue(doneA,'The challenge is complete',1500);
// ---------- UI helpers ----------
const $v=document.getElementById('view');let view='home';
let acts={},ak=0;
const reg=fn=>{const k='a'+(ak++);acts[k]=fn;return k};
const resetActs=()=>{acts={};ak=0};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&acts[b.dataset.act])acts[b.dataset.act]()});
const IC={clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',chart:'<path d="M5 20v-7M12 20V5M19 20v-10"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',sliders:'<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',check:'<path d="M5 12l4 4 10-10"/>'};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24">${IC[n]}</svg>`;
const card=(title,icon,body,right,cls)=>`<section class="card ${cls||''}"><div class="ch"><h2>${icon?ic(icon):''}${esc(title)}</h2>${right||''}</div>${body}</section>`;
const pill=(l,on,fn)=>`<button class="pill${on?' on':''}" data-act="${reg(fn)}">${esc(l)}</button>`;
const btn=(l,fn,kind='')=>`<button class="btn ${kind}" data-act="${reg(fn)}">${esc(l)}</button>`;
const seg=(opts,cur,fn)=>`<div class="seg">${opts.map(o=>`<button class="${o[0]===cur?'on':''}" data-act="${reg(()=>fn(o[0]))}">${esc(o[1])}</button>`).join('')}</div>`;
const bigDur=m=>`${Math.floor(m/60)}<small>h</small> ${p2(m%60)}<small>m</small>`;
const bar=pc=>`<div class="bar"><b style="width:${Math.max(0,Math.min(100,pc))}%"></b></div>`;
const dots=n=>`<span class="dots">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'f':''}"></i>`).join('')}</span>`;
function mini(pc){const r=26,c=2*Math.PI*r;return `<svg class="mini" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="rt"/><circle cx="32" cy="32" r="${r}" class="rp" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-Math.min(1,pc/100))}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${Math.round(pc)}%</text></svg>`}
document.querySelectorAll('#top button').forEach(b=>b.onclick=()=>go(b.dataset.v));
function go(v){view=v;document.querySelectorAll('#top button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$v.scrollTop=0;render()}
function render(){({home:renderHome,planner:renderPlanner,timer:renderTimer,stats:renderStats})[view]()}
function dayStrip(plan,showNow){
  const w=toMin(plan.cfg.wake),s=toMin(plan.cfg.sleep),span=Math.max(1,s-w);
  const pc=m=>Math.max(0,Math.min(100,(m-w)/span*100));
  const part=(a,b,c)=>`<i class="${c}" style="left:${pc(a)}%;width:${Math.max(.8,pc(b)-pc(a))}%"></i>`;
  const n=new Date(),nm=n.getHours()*60+n.getMinutes();
  return `<div class="strip">${plan.wins.map(([a,b])=>part(a,b,'free')).join('')}${plan.blocks.map(b=>part(b.start,b.end,'blk')).join('')}${showNow&&nm>=w&&nm<=s?`<u style="left:${pc(nm)}%"></u>`:''}</div><div class="ticks"><span>${fmtMin(w)}</span><span>Free time</span><span>${fmtMin(s)}</span></div>`;
}
const blockRows=(blocks,nm)=>blocks.length?`<div class="rows">${blocks.map(b=>`<div class="row${nm!=null&&b.end<=nm?' past':''}"><span>${esc(b.category)}<span class="dim sm ls">${esc(b.lesson.t)}${b.then?', then '+esc(b.then.lesson.t):''}</span></span><span class="tn dim">${fmtMin(b.start)} to ${fmtMin(b.end)}</span></div>`).join('')}</div>`:'';
function lessonBody(L,len){
  const ul=a=>`<ul class="bl">${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  let h=`<div class="lb"><div class="lh">What to learn</div>${ul(L.learn)}<div class="lh">Do this</div><p>${esc(L.d)}</p><div class="lh">You are done when</div><p>${esc(L.done)}</p>${L.res?`<div class="lh">Resources</div><p class="dim">${esc(L.res)}</p>`:''}`;
  if(len){const r=m=>Math.max(5,Math.round(m/5)*5),a=r(len*.1),c=r(len*.35),w=r(len*.1),l=Math.max(5,len-a-c-w);
    h+=`<div class="lh">How to spend ${len} minutes</div><ol class="bl st"><li><b>${a} min recall.</b> Without notes, write 3 things you remember from your last session on this subject.</li><li><b>${l} min learn.</b> ${esc(L.learn.slice(0,2).join('. Then '))}.</li><li><b>${c} min practise.</b> ${esc(L.d)}</li><li><b>${w} min wrap-up.</b> Write a 3-line summary and your biggest doubt, then rate your understanding in the timer.</li></ol>`}
  return h+'</div>';
}
function startLesson(b){
  if(T.status!=='idle'){if(confirm('A session is already in progress. Open the timer?'))go('timer');return}
  T=Object.assign({},IDLE,{category:b.category,topic:b.lesson.t,lessonId:b.lesson.id,mode:'custom',targetMin:b.len});DB.timer=T;save();go('timer');
}
const blockCard=b=>`<details class="blk"><summary><div class="bs"><div class="b1"><span class="tn">${fmtMin(b.start)} to ${fmtMin(b.end)}</span><span class="dim sm">${b.len} min</span></div><b>${esc(b.lesson.t)}</b><div class="dim sm">${esc(b.category)}${b.lesson.review?', review':`, lesson ${b.lesson.i+1} of ${b.lesson.n}`}${b.left>0?`, about ${fmtDur(b.left)} left after this`:''}</div>${b.then?`<div class="dim sm">Then ${b.then.min} min: ${esc(b.then.lesson.t)}</div>`:''}</div></summary>${b.then?`<div class="lb"><div class="lh sp">First ${b.mainMin} min: finish this lesson</div></div>`:''}${lessonBody(b.lesson,b.mainMin)}${b.then?`<div class="lb"><div class="lh sp">Then ${b.then.min} min: ${esc(b.then.lesson.t)}</div></div>${lessonBody(b.then.lesson,b.then.min)}`:''}<div class="actions">${btn('Start this session',()=>startLesson(b))}${b.lesson.review?'':btn('Mark lesson done',()=>markDone(b.lesson.id,true),'ghost')}</div></details>`;
const SHIFT_LABEL={morning:'Morning shift',afternoon:'Afternoon shift',off:'Day off'};
// ---------- Road: one dot per roadmap week, one row per phase ----------
function roadCard(now){
  const nowWs=startOfWeek(now).getTime();let total=0,elapsedW=0;
  const rows=PHASES.map((p,pi)=>{
    const st=new Date(p.start+'T00:00:00'),en=new Date(p.end+'T23:59:59');
    let w=startOfWeek(st);if(w<st)w=addDays(w,7);const cells=[];
    while(w<=en){const t=w.getTime();total++;
      if(t>nowWs)cells.push('<i class="w f"></i>');
      else{elapsedW++;const m=sumMinutes(t,addDays(w,7).getTime());cells.push(`<i class="w${t===nowWs?' cur':''}" style="opacity:${(.14+.86*Math.min(1,m/900)).toFixed(2)}"></i>`)}
      w=addDays(w,7)}
    return `<div class="wr"><em>${pi+1}</em>${cells.join('')}</div>`}).join('');
  const left=total-elapsedW;
  return card('Road to August 2028','map',
   `<div class="kv"><b>${left}</b><span>weeks left</span></div><div class="weeks" role="img" aria-label="${elapsedW} of ${total} weeks elapsed">${rows}</div>
    <div class="legend"><span>Less</span><i class="w" style="opacity:.14"></i><i class="w" style="opacity:.45"></i><i class="w" style="opacity:.75"></i><i class="w"></i><span>15h goal met</span></div>
    <p class="note">Each dot is a week and each row is a phase. A brighter dot means more hours studied.</p>`,`<span class="tag">Week ${Math.max(1,elapsedW)} of ${total}</span>`);
}
// ---------- Home ----------
function renderHome(){
  resetActs();
  const now=new Date(),sod=startOfDay(now),ws=startOfWeek(now),plan=planForDate(now);
  const day=d=>sumMinutes(d.getTime(),addDays(d,1).getTime());
  const today=day(sod),week=sumMinutes(ws.getTime(),addDays(ws,7).getTime());
  const month=sumMinutes(new Date(now.getFullYear(),now.getMonth(),1).getTime(),new Date(now.getFullYear(),now.getMonth()+1,1).getTime());
  const days=sessionDays();let streak=0,c=days.has(dateKey(now))?now:addDays(now,-1);
  while(days.has(dateKey(c))){streak++;c=addDays(c,-1)}
  const nm=now.getHours()*60+now.getMinutes(),nb=plan.blocks.find(b=>b.end>nm);
  const done={};sumMinutes(ws.getTime(),addDays(ws,7).getTime(),true).forEach(r=>{const g=GROUP_OF[r.category];done[g]=(done[g]||0)+r.m});
  const todayPct=plan.target>0?today/plan.target*100:0,hr=now.getHours();
  const last7=[];for(let i=6;i>=0;i--){const d=addDays(sod,-i);last7.push({d,m:day(d)})}
  const mx=Math.max(60,...last7.map(x=>x.m)),tot7=last7.reduce((a,x)=>a+x.m,0);
  const chip=plan.type==='unset'?`<button class="chip" data-act="${reg(()=>go('planner'))}">Set shift</button>`:`<span class="chip solid">${SHIFT_LABEL[plan.type]}</span>`;
  const tb=buildSchedule(now,1)[dateKey(now)].blocks,nx=tb.find(x=>x.end>nm);
  const planBody=(nx?`<div class="next"><div><div class="eyebrow">Up next, ${fmtMin(nx.start)} to ${fmtMin(nx.end)}</div><b>${esc(nx.lesson.t)}</b><div class="dim sm" style="margin-top:2px">${esc(nx.category)}${nx.lesson.review?'':`, lesson ${nx.lesson.i+1} of ${nx.lesson.n}`}${nx.then?`, then ${esc(nx.then.lesson.t)}`:''}</div></div></div><div class="actions" style="margin-top:12px">${btn('Start this session',()=>startLesson(nx))}${btn('See the details',()=>{plView='schedule';go('planner')},'ghost')}</div>`:`<p class="note">${tb.length?'All suggested blocks for today are done.':plan.type==='unset'?'Choose a shift to get accurate suggestions.':'No study block fits today\'s free time.'}</p>`)+dayStrip(plan,true)+blockRows(tb,nm);
  const groups=Object.keys(WEEKLY_TARGET_MIN).map(g=>`<div class="grp"><div class="gl"><span>${esc(g)}</span><span class="dim tn">${fmtDur(done[g]||0)} / ${fmtDur(WEEKLY_TARGET_MIN[g])}</span></div>${bar((done[g]||0)/WEEKLY_TARGET_MIN[g]*100)}</div>`).join('');
  $v.innerHTML=
   `<div class="greet"><h1>${hr<12?'Good morning':hr<18?'Good afternoon':'Good evening'}</h1><p>${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p></div>`+
   `<section class="card hero"><div><div class="eyebrow">Studied today</div><div class="num">${bigDur(today)}</div><div class="cap">Target ${fmtDur(plan.target)}</div></div>${mini(todayPct)}</section>`+
   card('Today\'s plan','clock',planBody,chip)+
   card('Last 7 days','chart',`<div class="chart">${last7.map((x,i)=>`<div class="bc"><div class="bt"><i class="${i===6?'today':''}" style="height:${Math.max(4,x.m/mx*100)}%"></i></div><span class="${i===6?'fg':''}">${x.d.toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>`,`<span class="tag">${fmtDur(tot7)}</span>`)+
   card('This week','target',`${bar(week/9)}<div class="grps">${groups}</div>`,`<span class="tag">${fmtDur(week)} / 15h</span>`)+
   `<div class="kpis"><section class="card kpi">${ic('cal')}<div class="kv"><b>${fmtDur(month)}</b><span>this month</span></div></section><section class="card kpi">${ic('flame')}<div class="kv"><b>${streak} day${streak===1?'':'s'}</b><span>current streak</span></div></section></div>`+
   roadCard(now);
}
// ---------- Planner ----------
let cfgDraft=null,cfgOpen=false,plView='schedule';
function syllabusHtml(){
  const ph=phaseIdx(new Date());
  return Object.keys(CURR).map(sub=>{
    const ls=lessonsOf(sub),dn=ls.filter(lessonDone).length,cur=ls.find(x=>!lessonDone(x)&&x.p<=ph);
    return `<details class="card syl"><summary><div class="sy1"><b>${esc(sub)}</b><span class="dim sm">${dn} of ${ls.length} lessons done, ${fmtDur(ls.reduce((a,x)=>a+x.m,0))} in total</span>${bar(dn/ls.length*100)}</div></summary>`+
      ls.map(L=>{const st=lstate(L.id),done=lessonDone(L),tag=done?'Done':cur&&cur.id===L.id?'Now':L.p>ph?'Phase '+L.p:'Next';
        return `<details class="ln"><summary><span class="chip${done?' solid':''}">${tag}</span><span class="lt">${esc(L.t)}</span><span class="dim sm tn">${fmtDur(L.m)}</span></summary>${lessonBody(L)}<p class="dim sm" style="margin:10px 0 0">Studied ${fmtDur(Math.round(st.min))} of ${fmtDur(L.m)}</p><div class="actions">${done&&st.done?btn('Reopen',()=>markDone(L.id,false),'ghost'):done?'':btn('Mark done',()=>markDone(L.id,true))}</div></details>`}).join('')+`</details>`;
  }).join('');
}
function renderPlanner(){
  resetActs();if(!cfgDraft)cfgDraft=JSON.parse(JSON.stringify(loadConfig()));const cfg=cfgDraft;
  const tabs=`<div style="margin:0 0 14px">${seg([['schedule','Schedule'],['syllabus','Syllabus']],plView,v=>{plView=v;renderPlanner()})}</div>`;
  if(plView==='syllabus'){const sy=$v.scrollTop;$v.innerHTML=`<div class="greet"><h1>Syllabus</h1><p>Every lesson, in order. Lessons unlock by roadmap phase and the Schedule serves them one block at a time.</p></div>${tabs}${syllabusHtml()}`;$v.scrollTop=sy;return}
  const fld=(l,v,on)=>`<label class="tf"><span>${l}</span><input class="in" inputmode="numeric" value="${esc(v)}" placeholder="HH:MM" data-in="${reg(on)}"></label>`;
  const prefRow=(k,label,opts)=>`<div class="prow"><span>${label}</span>${seg(opts,cfg.pref[k],v=>{cfg.pref[k]=v;renderPlanner()})}</div>`;
  let h=`<div class="greet"><h1>Planner</h1><p>Next 14 days. Tap a block to see exactly what to study.</p></div>${tabs}`+
   `<details class="card cfg" ${cfgOpen?'open':''}><summary>${ic('sliders')}<span>Shift hours and preferences</span></summary>
    <div class="tfs">${fld('Morning in',cfg.morning[0],x=>cfg.morning[0]=x)}${fld('Morning out',cfg.morning[1],x=>cfg.morning[1]=x)}${fld('Afternoon in',cfg.afternoon[0],x=>cfg.afternoon[0]=x)}${fld('Afternoon out',cfg.afternoon[1],x=>cfg.afternoon[1]=x)}${fld('Wake',cfg.wake,x=>cfg.wake=x)}${fld('Sleep',cfg.sleep,x=>cfg.sleep=x)}${fld('Buffer (min)',String(cfg.bufferMin),x=>cfg.bufferMin=Number(x)||0)}</div>
    ${prefRow('morning','Morning shift: study',[['before','Before'],['after','After'],['both','Both']])}
    ${prefRow('afternoon','Afternoon shift: study',[['before','Before'],['both','Both'],['early','Until 12:00']])}
    <div class="actions">${btn('Save hours',()=>{setSetting('config',cfg);cfgDraft=null;renderPlanner();rescheduleReminders()})}</div></details>`;
  const sched=buildSchedule(new Date(),14);
  for(let i=0;i<14;i++){
    const d=addDays(startOfDay(new Date()),i),plan=sched[dateKey(d)],ph=phaseIdx(d);
    h+=`<section class="card"><div class="dh"><div class="dn"><b>${d.toLocaleDateString('en-GB',{weekday:'short'})}</b><span>${d.getDate()} ${d.toLocaleDateString('en-GB',{month:'short'})}</span>${i===0?'<em class="tag">Today</em>':''}</div>${seg([['morning','Morning'],['afternoon','Afternoon'],['off','Off']],plan.type,v=>{setShift(dateKey(d),v);renderPlanner();rescheduleReminders()})}</div>
      ${dayStrip(plan,i===0)}
      <p class="note">${plan.type==='unset'?'Choose a shift for accurate suggestions.':'Target '+fmtDur(plan.target)+', roadmap phase '+ph+' ('+esc(PHASES[ph-1].name.replace(/^\d\s/,''))+')'}</p>${plan.blocks.map(blockCard).join('')}</section>`;
  }
  const sy=$v.scrollTop;$v.innerHTML=h;$v.scrollTop=sy;
  $v.querySelectorAll('[data-in]').forEach(i=>i.oninput=()=>acts[i.dataset.in](i.value));
  const dt=$v.querySelector('details.cfg');if(dt)dt.ontoggle=()=>{cfgOpen=dt.open};
}
// ---------- Stats ----------
function renderStats(){
  resetActs();const S=DB.sessions,now=new Date();
  const totalMin=Math.round(S.reduce((a,x)=>a+x.duration_ms,0)/60000);
  const avgLen=S.length?Math.round(totalMin/S.length):0;
  const avgU=S.length?S.reduce((a,x)=>a+(x.understanding||0),0)/S.length:0;
  // last 8 weeks, hours per week vs the 15h goal
  const ws0=startOfWeek(now),wk=[];
  for(let i=7;i>=0;i--){const a=addDays(ws0,-7*i);wk.push({a,m:sumMinutes(a.getTime(),addDays(a,7).getTime())})}
  const mx=Math.max(900,...wk.map(x=>x.m));
  // by subject, last 30 days
  const from=addDays(startOfDay(now),-29).getTime(),by={};
  S.filter(x=>x.started_at>=from).forEach(x=>{const b=by[x.category]||(by[x.category]={m:0,u:0,n:0});b.m+=x.duration_ms/60000;b.u+=(x.understanding||0);b.n++});
  const subs=Object.keys(by).map(c=>({c,m:Math.round(by[c].m),u:by[c].u/by[c].n,n:by[c].n})).sort((a,b)=>b.m-a.m);
  const top=subs.length?subs[0].m:1;
  const weak=subs.filter(x=>x.n>=2&&x.u<=2.5).map(x=>x.c);
  let h=`<div class="greet"><h1>Stats</h1><p>${S.length?'Everything you have logged so far.':'Log a session and your stats will appear here.'}</p></div>`;
  h+=`<div class="kpis"><section class="card kpi">${ic('clock')}<div class="kv"><b>${fmtDur(totalMin)}</b><span>total studied</span></div></section><section class="card kpi">${ic('list')}<div class="kv"><b>${S.length}</b><span>sessions, avg ${avgLen} min</span></div></section></div>`;
  h+=card('Last 8 weeks','chart',`<div class="chart wk">${wk.map((x,i)=>`<div class="bc"><div class="bt"><i class="${i===7?'today':''}" style="height:${Math.max(4,x.m/mx*100)}%"></i><u style="bottom:${900/mx*100}%"></u></div><span class="${i===7?'fg':''}">${x.a.getDate()}/${x.a.getMonth()+1}</span></div>`).join('')}</div><p class="note">Line marks the 15h weekly goal. Bars are hours studied that week.</p>`,`<span class="tag">${S.length?'avg understanding '+avgU.toFixed(1)+'/5':''}</span>`);
  h+=card('By subject, last 30 days','target',subs.length?subs.map(x=>`<div class="grp"><div class="gl"><span>${esc(x.c)}</span><span class="dim tn">${fmtDur(x.m)}</span></div>${bar(x.m/top*100)}<div class="sub">${dots(Math.round(x.u))}<span class="dim sm">understanding ${x.u.toFixed(1)}/5, ${x.n} session${x.n>1?'s':''}</span></div></div>`).join(''):'<p class="note">No sessions in the last 30 days.</p>',null);
  if(weak.length)h+=card('Worth revisiting','flame',`<p>${weak.map(esc).join(', ')} ${weak.length>1?'are':'is'} averaging low understanding. Schedule a recap before adding new material.</p>`);
  const log=S.slice().sort((a,b)=>b.started_at-a.started_at).slice(0,50);
  h+=card('Session log','list',log.length?`<div class="rows">${log.map(x=>`<div class="row hist"><div><div>${esc(x.category)}${x.topic?`<span class="dim">, ${esc(x.topic)}</span>`:''}</div><div class="dim sm">${new Date(x.started_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}, ${fmtDur(Math.round(x.duration_ms/60000))}</div>${x.notes?`<div class="dim sm nt">${esc(x.notes)}</div>`:''}</div><div class="right">${dots(x.understanding)}<div><button class="chip" data-act="${reg(()=>{if(confirm('Delete this session?')){DB.sessions=DB.sessions.filter(y=>y.id!==x.id);save();renderStats()}})}">Delete</button></div></div></div>`).join('')}</div>`:'<p class="note">Nothing logged yet.</p>');
  h+=card('Preferences','sliders',`<div class="prow"><span>Sound and voice cues</span>${seg([['on','On'],['off','Off']],getSetting('soundOn',true)?'on':'off',v=>{setSetting('soundOn',v==='on');renderStats()})}</div>`);
  const sy=$v.scrollTop;$v.innerHTML=h;$v.scrollTop=sy;
}
// ---------- Timer ----------
const IDLE={status:'idle',startedAt:0,segStart:null,accMs:0,category:'English',topic:'',lessonId:'',mode:'stopwatch',targetMin:0};
let T=Object.assign({},IDLE,DB.timer||{});let und=3,notes='';
const elapsed=s=>s.accMs+(s.status==='running'&&s.segStart?Date.now()-s.segStart:0);
const RR=112,RC=2*Math.PI*RR;
function frac(s){const e=elapsed(s);if(s.status==='idle')return 0;return s.targetMin>0?Math.min(1,e/(s.targetMin*60000)):(e%3600000)/3600000}
function persist(n){T=n;DB.timer=n;save();renderTimer()}
function readout(s){const act=s.status==='running'||s.status==='paused',left=s.targetMin>0?Math.max(0,s.targetMin*60000-elapsed(s)):null;
  return {clk:fmtClock(left!==null&&act?left:elapsed(s)),lbl:s.status==='review'?'Finished':s.status==='idle'?'Ready':(left!==null&&act?'Remaining':'Elapsed')+(s.status==='paused'?', paused':'')}}
function renderTimer(){
  const ae=document.activeElement,typing=ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')&&$v.contains(ae);
  if(typing){updateClock();return}
  resetActs();const s=T,active=s.status==='running'||s.status==='paused',r=readout(s);
  let h=`<div class="greet"><h1>Focus timer</h1><p>${active||s.status==='review'?esc(s.category)+(s.topic?', '+esc(s.topic):''):'Track a study session.'}</p></div>`;
  h+=`<section class="card dialcard"><div class="dial"><svg viewBox="0 0 260 260" class="ring"><circle cx="130" cy="130" r="${RR}" class="rt"/><circle id="rp" cx="130" cy="130" r="${RR}" class="rp" stroke-dasharray="${RC}" stroke-dashoffset="${RC*(1-frac(s))}" transform="rotate(-90 130 130)"/></svg>
    <div class="dc"><div id="clk">${r.clk}</div><div id="clkl">${r.lbl}</div></div></div>
    <div class="actions">`+
    (s.status==='idle'?btn('Start session',start):'')+
    (s.status==='running'?btn('Pause',()=>persist(Object.assign({},T,{status:'paused',accMs:elapsed(T),segStart:null})))+btn('Finish',stop,'ghost'):'')+
    (s.status==='paused'?btn('Resume',()=>persist(Object.assign({},T,{status:'running',segStart:Date.now()})))+btn('Finish',stop,'ghost'):'')+`</div>`+
    (active?`<div class="center">${btn('Discard session',reset,'text')}</div>`:'')+`</section>`;
  if(s.status==='idle'){
    h+=card('Session','book',`<div class="lbl">Subject</div><div class="pills">${CATEGORIES.map(c=>pill(c,s.category===c,()=>{T.category=c;T.lessonId='';renderTimer()})).join('')}</div>
      <div class="lbl">Topic</div><input id="topic" class="in" placeholder="Optional" value="${esc(s.topic)}">${s.lessonId?`<p class="note">Linked to a syllabus lesson. The time you log counts toward it. ${btn('Unlink',()=>{T.lessonId='';renderTimer()},'text')}</p>`:''}
      <div class="lbl mt">Mode</div>${seg([['stopwatch','Stopwatch'],['pomodoro','Pomodoro 25'],['custom','Custom']],s.mode,v=>{T.mode=v;T.targetMin=v==='stopwatch'?0:v==='pomodoro'?25:(T.targetMin||45);renderTimer()})}
      ${s.mode==='custom'?`<div class="lbl mt">Minutes</div><input id="cmin" class="in" type="number" inputmode="numeric" value="${s.targetMin}">`:''}`);
  }
  if(s.status==='review'){
    h+=card(`Review, ${fmtDur(Math.round(s.accMs/60000))} of ${s.category}`,'check',
      `<div class="lbl">How well did you understand this material?</div><div class="opts">${UNDERSTANDING.map((u,i)=>`<button class="opt${und===i+1?' on':''}" data-act="${reg(()=>{und=i+1;renderTimer()})}"><span>${i+1}</span>${esc(u)}</button>`).join('')}</div>
       <textarea id="notes" class="in" placeholder="What did you learn? What was hard? What next? Could you explain it without notes?">${esc(notes)}</textarea>
       <div class="actions">${btn('Save session',saveSession)}${btn('Discard',reset,'ghost')}</div>`);
  }
  const hist=DB.sessions.slice().sort((a,b)=>b.started_at-a.started_at).slice(0,15);
  h+=card('Recent sessions','list',hist.length?`<div class="rows">${hist.map(x=>`<div class="row hist"><div><div>${esc(x.category)}${x.topic?`<span class="dim">, ${esc(x.topic)}</span>`:''}</div><div class="dim sm">${new Date(x.started_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></div><div class="right"><div class="tn">${fmtDur(Math.round(x.duration_ms/60000))}</div>${dots(x.understanding)}</div></div>`).join('')}</div>`:'<p class="note">No sessions yet. Finish a timer to log your first one.</p>');
  const sy=$v.scrollTop;$v.innerHTML=h;$v.scrollTop=sy;
  const t=document.getElementById('topic');if(t)t.oninput=()=>{T.topic=t.value};
  const cm=document.getElementById('cmin');if(cm)cm.oninput=()=>{T.targetMin=Number(cm.value)||0};
  const nt=document.getElementById('notes');if(nt)nt.oninput=()=>{notes=nt.value};
}
function updateClock(){
  const c=document.getElementById('clk');if(!c)return;const r=readout(T);
  c.textContent=r.clk;const l=document.getElementById('clkl');if(l)l.textContent=r.lbl;
  const p=document.getElementById('rp');if(p)p.setAttribute('stroke-dashoffset',RC*(1-frac(T)));
}
async function start(){
  const target=T.mode==='pomodoro'?25:T.targetMin;
  if(target>0)notifyTimerDone(target*60);
  persist(Object.assign({},T,{status:'running',startedAt:Date.now(),segStart:Date.now(),accMs:0,targetMin:target}));playStart();
}
function stop(){playComplete();cancelTimerNotif();persist(Object.assign({},T,{status:'review',accMs:elapsed(T),segStart:null}))}
function reset(){if(confirm('Discard this session? The tracked time will be lost.')){cancelTimerNotif();notes='';persist(Object.assign({},IDLE))}}
function saveSession(){
  const id=`${T.startedAt}-${T.category}`;
  if(!DB.sessions.some(x=>x.id===id))DB.sessions.push({id,category:T.category,topic:T.topic,method:T.mode,started_at:T.startedAt,ended_at:T.startedAt+T.accMs,duration_ms:T.accMs,understanding:und,notes});
  if(T.lessonId){const ls=DB.lessons[T.lessonId]||(DB.lessons[T.lessonId]={min:0,done:false});ls.min+=Math.round(T.accMs/60000);save()}
  notes='';und=3;persist(Object.assign({},IDLE));
}
setInterval(()=>{
  if(view!=='timer')return;
  if(T.status==='running'&&T.targetMin>0&&elapsed(T)>=T.targetMin*60000){stop();return}
  updateClock();
},500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
// ---------- boot ----------
go('home');
initNotifications().then(rescheduleReminders).catch(()=>{});
