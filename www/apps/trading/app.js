'use strict';
/* ================= utilities ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const sum=a=>a.reduce((x,y)=>x+y,0);
const mean=a=>a.length?sum(a)/a.length:0;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const uid=()=>Math.random().toString(36).slice(2,9);
const hash=s=>[...String(s)].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))|0,7);
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d)};
const TODAY=()=>ymd(new Date());
const weekStart=s=>{const d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONF=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOWF=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fmtD=s=>{const d=parse(s);return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const addMonths=(mk,n)=>{const [y,m]=mk.split('-').map(Number);const d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
const monthLabel=mk=>{const [y,m]=mk.split('-').map(Number);return `${MONF[m-1]} ${y}`};
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const fmtMin=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
const SG='−';
const fmtR=(n,d=1)=>{if(n==null||isNaN(n))return '—';const a=Math.abs(n);return (a<0.05?'':n>0?'+':SG)+a.toFixed(d)+'R'};
const fmtM=(n,sign)=>{if(n==null||isNaN(n))return '—';const a=Math.abs(Math.round(n));return (n<0&&a>0?SG:sign&&n>0?'+':'')+'$'+a.toLocaleString('en-US')};
const fmtP=(n,d=0)=>n==null||isNaN(n)?'—':n.toFixed(d)+'%';
const fmtPF=n=>n==null?'—':!isFinite(n)?'∞':n.toFixed(2);
const sgn=n=>n>0.0001?'pos':n<-0.0001?'neg':'';

/* ================= domain constants ================= */
const SETUPS=[{id:'sweep',name:'Liquidity sweep'},{id:'htf',name:'HTF mitigation'},{id:'orb',name:'Opening range breakout'},{id:'pullback',name:'Trend pullback'},{id:'newsfade',name:'News fade'}];
const MISTAKES=[{id:'early_exit',name:'Early exit'},{id:'moved_sl',name:'Moved SL'},{id:'oversized',name:'Oversized'},{id:'chased',name:'Chased entry'},{id:'revenge',name:'Revenge trade'},{id:'ignored',name:'Ignored plan'},{id:'overtraded',name:'Overtraded'}];
const EMOS=[{id:'calm',name:'Calm'},{id:'focus',name:'Focused'},{id:'neutral',name:'Neutral'},{id:'anxious',name:'Anxious'},{id:'fomo',name:'FOMO'},{id:'frustrated',name:'Frustrated'}];
const SESSIONS=['Asia','London','New York'];
const LEVELS=['Previous day high','Previous day low','Weekly open','HTF supply','HTF demand','Liquidity pool','Round number'];
const REACT=[{id:'held',name:'Held'},{id:'swept',name:'Swept and reversed'},{id:'broke',name:'Broke and retested'},{id:'ignored',name:'Ignored'}];
const GRADES=['A','B','C','D','F'];
const GSCORE={A:100,B:80,C:60,D:40,F:0};
const INST={EURUSD:{pip:.0001,pv:10,dp:5},GBPUSD:{pip:.0001,pv:10,dp:5},USDJPY:{pip:.01,pv:6.7,dp:3},XAUUSD:{pip:.1,pv:10,dp:2}};
const ITEMS=[
 {id:'htf',label:'HTF bias aligned',group:'setup',gate:true},
 {id:'level',label:'Price is at a mapped level',group:'setup',gate:true},
 {id:'liq',label:'Liquidity has been taken',group:'setup',gate:false},
 {id:'conf',label:'Confirmation candle closed',group:'setup',gate:true},
 {id:'sess',label:'Inside my session window',group:'setup',gate:false},
 {id:'news',label:'No news inside the window',group:'setup',gate:false,auto:true},
 {id:'aplus',label:'A+ setup only',group:'rule',gate:true},
 {id:'revenge',label:'Not a revenge trade',group:'rule',gate:true},
 {id:'limit',label:'Within today’s trade limit',group:'rule',gate:true,auto:true},
 {id:'slset',label:'Stop loss set before entry',group:'rule',gate:true},
 {id:'risk',label:'Risk within my limit',group:'rule',gate:true,auto:true}];
const nameOf=(list,id)=>(list.find(x=>x.id===id)||{}).name||'';
const itemLabel=id=>(ITEMS.find(x=>x.id===id)||{}).label||id;
const guessSession=()=>{const h=new Date().getUTCHours();return h<7?'Asia':h<12?'London':h<21?'New York':'Asia'};
const defaults=()=>({startBal:10000,riskPct:1,dailyCap:2,maxTrades:3,cooldown:30,minSample:10,nowin:15,
  instruments:JSON.parse(JSON.stringify(INST)),items:ITEMS.map(x=>({...x}))});

/* ================= state ================= */
const KEY='trading-routine-tracker.v1';
let S=null;
try{S=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){S=null}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
let installEv=null;
const ui={tab:'today',step:'plan',wk:null,mo:null,wstep:1,sheet:null,form:{},seg:'setup',jf:{o:'all',s:'all',q:''},jlimit:25,confirm:''};
const blankDay=()=>({levels:[],scen:[],events:[],star:{},check:{},planEdits:0,planReady:false,closed:false,emoStart:'',emoEnd:'',adherence:0,reflection:''});
const day=d=>S.days[d]||(S.days[d]=blankDay());
const byDate=d=>S.trades.filter(t=>t.date===d&&t.status!=='cancelled');
const inRange=(t,a,b)=>t.date>=a&&t.date<=b;
const wkTrades=ws=>S.trades.filter(t=>t.status!=='cancelled'&&inRange(t,ws,addDays(ws,6)));
const moTrades=mk=>S.trades.filter(t=>t.status!=='cancelled'&&t.date.startsWith(mk));
const wkData=ws=>S.weeks[ws]||(S.weeks[ws]={closed:false,lesson:'',focus:'',levelStudies:[],tests:[],gradeFinal:'',gradeReason:''});
const moData=mk=>S.months[mk]||(S.months[mk]={closed:false,goals:[],dismissed:[],keep:'',cut:'',change:'',psych:''});
const closedT=trs=>trs.filter(t=>t.status==='closed');

/* ================= metrics ================= */
function stats(trs){
  const c=closedT(trs),n=c.length;
  const wins=c.filter(t=>t.outcome==='win'),loss=c.filter(t=>t.outcome==='loss');
  const gp=sum(c.filter(t=>t.pnl>0).map(t=>t.pnl)),gl=Math.abs(sum(c.filter(t=>t.pnl<0).map(t=>t.pnl)));
  const netR=sum(c.map(t=>t.r)),netPnl=sum(c.map(t=>t.pnl));
  return{n,wins:wins.length,losses:loss.length,be:n-wins.length-loss.length,
    winRate:n?wins.length/n*100:null,netR,netPnl,avgR:n?netR/n:null,gp,gl,
    pf:n?(gl>0?gp/gl:gp>0?Infinity:null):null,
    avgWin:wins.length?mean(wins.map(t=>t.pnl)):null,avgLoss:loss.length?mean(loss.map(t=>t.pnl)):null,
    avgWinR:wins.length?mean(wins.map(t=>t.r)):null,avgLossR:loss.length?mean(loss.map(t=>t.r)):null,
    rules:n?mean(c.map(t=>t.rules??1))*100:null};
}
function groupBy(trs,fn){
  const m=new Map();
  closedT(trs).forEach(t=>{const k=fn(t);if(!m.has(k))m.set(k,[]);m.get(k).push(t)});
  return [...m].map(([k,v])=>({k,...stats(v)}));
}
function equity(trs,start){
  const c=closedT(trs).slice().sort((a,b)=>a.ts-b.ts);
  let eq=start,peak=start,dd=0;const pts=[{eq:start,t:null}];
  c.forEach(t=>{eq+=t.pnl;peak=Math.max(peak,eq);dd=Math.max(dd,(peak-eq)/peak*100);pts.push({eq,t})});
  return{pts,dd,end:eq};
}
function autoGrade(trs){
  const c=closedT(trs);if(!c.length)return null;
  const rule=mean(c.map(t=>(t.rules??1)*100));
  const g=c.filter(t=>t.grade);
  const score=g.length?0.6*rule+0.4*mean(g.map(t=>GSCORE[t.grade])):rule;
  return{score,letter:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F'};
}
const balanceBefore=d=>S.settings.startBal+sum(S.trades.filter(t=>t.status==='closed'&&t.date<d).map(t=>t.pnl));
const currentBalance=()=>S.settings.startBal+sum(S.trades.filter(t=>t.status==='closed').map(t=>t.pnl));
function streak(){
  const dates=[...new Set(S.trades.filter(t=>t.status==='closed').map(t=>t.date))].sort().reverse();
  let n=0;
  for(const d of dates){const ts=S.trades.filter(t=>t.date===d&&t.status==='closed');if(ts.every(t=>!t.ruleBreaks.length))n++;else break}
  return n;
}
function mistakeAgg(trs){
  return MISTAKES.map(m=>{const ts=closedT(trs).filter(t=>t.mistakes.includes(m.id));return{id:m.id,name:m.name,n:ts.length,r:sum(ts.map(t=>t.r))}}).filter(x=>x.n);
}

/* ================= risk calculator and checklist ================= */
function calcOut(){
  const c=S.calc,I=S.settings.instruments[c.inst]||INST.EURUSD;
  const bal=+c.bal>0?+c.bal:currentBalance();
  const riskPct=+c.risk>0?+c.risk:S.settings.riskPct;
  const riskAmt=bal*riskPct/100,sl=+c.sl>0?+c.sl:0;
  let lots=0,actual=0;
  if(sl>0){lots=Math.round(Math.floor(riskAmt/(sl*I.pv)/0.01+1e-9))/100;actual=lots*sl*I.pv}
  const entry=parseFloat(c.entry),rr=+c.rr||2,dirm=c.dir==='long'?1:-1;
  const slPrice=entry>0&&sl>0?entry-dirm*sl*I.pip:null,tpPrice=entry>0&&sl>0?entry+dirm*sl*I.pip*rr:null;
  const todayRisk=sum(byDate(TODAY()).map(t=>t.riskPct));
  const warn=[];
  if(sl>0&&lots<0.01)warn.push('Lot size is below the 0.01 minimum. Widen risk % or tighten the stop.');
  if(riskPct>S.settings.riskPct+1e-9)warn.push(`Risk ${riskPct}% is above your ${S.settings.riskPct}% per-trade limit.`);
  if(todayRisk+(bal?actual/bal*100:0)>S.settings.dailyCap+1e-9)warn.push(`This trade would take today’s risk to ${(todayRisk+actual/bal*100).toFixed(2)}%, above the ${S.settings.dailyCap}% cap.`);
  if(sl>0&&sl<5)warn.push('Stop is under 5 pips. Check the spread.');
  return{I,bal,riskPct,riskAmt,sl,lots,actual,actualPct:bal?actual/bal*100:0,slPrice,tpPrice,rr,warn,todayRisk};
}
function inWindow(){
  const d=day(TODAY()),nm=nowMin();
  return d.events.find(e=>d.star[e.id]&&Math.abs(e.min-nm)<=S.settings.nowin)||null;
}
function autoVals(){
  const trs=byDate(TODAY()),c=calcOut();
  return{news:!inWindow(),limit:trs.length<S.settings.maxTrades,
    risk:c.lots>0&&c.riskPct<=S.settings.riskPct+1e-9&&c.todayRisk+c.actualPct<=S.settings.dailyCap+1e-9};
}
const checkMap=()=>({...day(TODAY()).check,...autoVals()});
const gateMissing=()=>{const m=checkMap();return S.settings.items.filter(i=>i.gate&&!m[i.id])};
function recentLoss(){
  const cd=S.settings.cooldown*60000,now=Date.now();
  return byDate(TODAY()).find(t=>t.status==='closed'&&t.outcome==='loss'&&t.closedTs&&now-t.closedTs<cd)||null;
}

/* ================= sample data ================= */
const SEEDNUM=16;
function seed(t0=TODAY(),seedNum=SEEDNUM){
  const R=rng(seedNum);
  const rnd=(a,b)=>a+R()*(b-a);
  const choose=(items,w)=>{let x=R()*sum(w);for(let i=0;i<items.length;i++){x-=w[i];if(x<=0)return items[i]}return items[items.length-1]};
  const r1=x=>Math.round(x*10)/10;
  const st={v:1,sample:true,settings:defaults(),trades:[],days:{},weeks:{},months:{},
    calc:{inst:'EURUSD',dir:'long',sl:'12',risk:'',bal:'',entry:'',rr:2,setup:'sweep'}};
  const all=[];for(let i=90;i>=0;i--){const d=addDays(t0,-i),w=parse(d).getDay();if(w>0&&w<6)all.push(d)}
  const dates=all.slice(-47);
  /* outcomes come from shuffled decks so a sample month never swings far from its target win rate */
  const decks={};
  const draw=(setup,p)=>{
    if(!decks[setup]||!decks[setup].length){
      const size=20,w=Math.round(p*size),a=Array.from({length:size},(_,i)=>i<w);
      for(let i=size-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
      decks[setup]=a;
    }
    return decks[setup].pop();
  };
  const P={
    sweep:{p:.60,m:1.7,inst:['EURUSD','GBPUSD','XAUUSD'],ses:['London','New York'],w:.30},
    htf:{p:.55,m:2.2,inst:['EURUSD','GBPUSD','USDJPY'],ses:['London','New York'],w:.14},
    orb:{p:.45,m:1.5,inst:['GBPUSD','XAUUSD','USDJPY'],ses:['London','New York'],w:.20},
    pullback:{p:.50,m:1.5,inst:['EURUSD','USDJPY'],ses:['Asia','London'],w:.14},
    newsfade:{p:.30,m:1.3,inst:['GBPUSD','XAUUSD','EURUSD'],ses:['New York','London'],w:.22}};
  const SL={EURUSD:[8,18],GBPUSD:[10,22],USDJPY:[10,20],XAUUSD:[30,80]};
  const NOTES={sweep:['Swept the prior day low, closed back inside, entered on the retest.','Equal highs taken at the open, waited for the close back under.'],
    htf:['Tapped the 4H demand block, entered on the first M15 shift.','Mitigated the HTF supply, stop above the wick.'],
    orb:['Broke the first 30 minute range with volume, retest held.','Range was wide, entry was late.'],
    pullback:['Pulled back to the 50 EMA in a clean trend.','Trend was weak, should have skipped.'],
    newsfade:['Faded the spike after the release.','Spike kept going, no confirmation.']};
  const LESSON={moved_sl:'Moved the stop and turned a 1R loss into a bigger one. Leave it alone.',chased:'Chased the move after missing the level. Wait for price to come back.',
    ignored:'The trade was not in the plan. If it is not on the map, it is not a trade.',revenge:'Took it straight after a loss. Step away for 30 minutes.',
    oversized:'Risk was above my rule. Use the calculator every time.',overtraded:'Third trade of the day added nothing.',early_exit:'Closed early and left 1R on the table.'};
  let bal=st.settings.startBal;
  const sids=SETUPS.map(s=>s.id);
  for(const date of dates){
    const isToday=date===t0;
    const n=isToday?1:choose([0,1,2,3],[.06,.20,.38,.36]);
    let prevLoss=false;
    for(let k=0;k<n;k++){
      const setup=isToday?'sweep':choose(sids,sids.map(s=>P[s].w));
      const Q=P[setup];
      let outcome,r,mistakes=[];
      if(isToday){outcome='win';r=2.0}
      else if(R()<.06){outcome='be';r=0}
      else if(draw(setup,Q.p)){outcome='win';r=r1(Math.max(.8,Q.m*(.55+R()*.9)))}
      else{outcome='loss';r=-1}
      const ew=outcome==='win'?[.30,.30,.20,.08,.06,.06]:outcome==='loss'?[.10,.10,.18,.20,.20,.22]:[.2,.2,.3,.1,.1,.1];
      const emo=isToday?'focus':choose(EMOS.map(e=>e.id),ew);
      const neg=['anxious','fomo','frustrated'].includes(emo);
      const breaks=[];
      const pb=outcome==='loss'?(neg?.45:.10):(neg?.12:.03);
      if(!isToday&&R()<pb){
        const opts=['aplus','slset'];const w=[.5,.1];
        if(prevLoss){opts.push('revenge');w.push(.4)}
        if(k===2){opts.push('limit');w.push(.3)}
        breaks.push(choose(opts,w));
      }
      let riskPct=1;
      if(outcome==='loss'&&R()<.58){
        const mid=['moved_sl','chased','ignored','oversized','overtraded','revenge'];
        const w=[.26,.2,.2,.1,.08,(emo==='frustrated'||breaks.includes('revenge'))?.5:.05];
        const m=choose(mid,w);mistakes.push(m);
        if(m==='moved_sl')r=-1.6;
        if(m==='oversized'){riskPct=1.5;if(!breaks.includes('risk'))breaks.push('risk')}
        if(m==='revenge'&&!breaks.includes('revenge'))breaks.push('revenge');
      }
      if(outcome==='win'&&!isToday&&R()<.2){mistakes.push('early_exit');r=r1(Math.max(.5,r*.6))}
      const inst=isToday?'EURUSD':choose(Q.inst,Q.inst.map(()=>1));
      const dir=R()<.5?'long':'short';
      const [a,b]=SL[inst];const sl=Math.round(rnd(a,b));
      const I=st.settings.instruments[inst];
      const riskAmt=bal*riskPct/100;
      const lots=Math.round(Math.floor(riskAmt/(sl*I.pv)/0.01+1e-9))/100;
      const fees=Math.round(lots*6);
      const pnl=Math.round(r*riskAmt-fees);
      const session=isToday?'London':choose(Q.ses,Q.ses.map(()=>1));
      const grade=isToday?'A':(breaks.length===0&&!mistakes.length)?choose(['A','A','B'],[1,1,1]):breaks.length===0?choose(['B','C'],[1,1]):choose(['C','D','F'],[.35,.5,.15]);
      const emoAfter=outcome==='win'?choose(['calm','focus'],[1,1]):outcome==='loss'?choose(['frustrated','anxious','neutral'],[.4,.3,.3]):'neutral';
      const base=parse(date).getTime()+({Asia:9,London:15,'New York':20}[session]*3600000)+Math.round(R()*90)*60000+k*1200000;
      const ts=isToday?Math.max(parse(date).getTime()+60000,Date.now()-2*3600000):base;
      const id='s'+hash(date+k+setup).toString(36).replace('-','');
      const shots=[{id:'d'+id+'a',demo:true,kind:'entry',cap:'Entry'}];
      if(R()<.55)shots.push({id:'d'+id+'b',demo:true,kind:'after',cap:'Result'});
      const note=R()<.75?choose(NOTES[setup],[1,1]):'';
      st.trades.push({id,date,ts,closedTs:ts+Math.round(rnd(30,170))*60000,instrument:inst,dir,setup,session,status:'closed',
        slPips:sl,lots,riskPct,riskAmt:Math.round(riskAmt),balance:Math.round(bal),fees,r,pnl,outcome,grade,
        emoBefore:emo,emoDuring:neg?choose(['anxious','frustrated','neutral'],[1,1,1]):choose(['calm','focus'],[1,1]),emoAfter,
        mistakes,ruleBreaks:breaks,overrideReason:breaks.length?'Took it anyway.':'',rules:1-breaks.length/5,
        checks:{},shots,notes:note,lesson:mistakes.length?(LESSON[mistakes[0]]||''):''});
      bal+=pnl;prevLoss=outcome==='loss';
    }
    const dd=blankDay();
    dd.planReady=true;dd.closed=!isToday;
    const dts=st.trades.filter(t=>t.date===date);
    dd.adherence=dts.some(t=>t.ruleBreaks.length)?3:5;
    dd.emoStart=dts[0]?.emoBefore||'';dd.emoEnd=dts.at(-1)?.emoAfter||'';
    st.days[date]=dd;
  }
  st.trades.sort((a,b)=>a.ts-b.ts);
  /* today: a locked plan, a half-ticked checklist and a calendar */
  const td=blankDay();
  td.planReady=true;td.planTs=Date.now()-3*3600000;
  td.levels=[{id:'l1',inst:'EURUSD',price:'1.08650',type:'Previous day high',note:'Sweep target if London pushes up'},
    {id:'l2',inst:'EURUSD',price:'1.08120',type:'HTF demand',note:'4H block, watch for a reaction'},
    {id:'l3',inst:'EURUSD',price:'1.07900',type:'Weekly open',note:''},
    {id:'l4',inst:'XAUUSD',price:'2650.00',type:'Round number',note:'Likely liquidity above'}];
  td.scen=[{id:'c1',inst:'EURUSD',bias:'Bullish',if_:'price sweeps 1.0812 and closes back above',then_:'buy the retest, target 1.0865',inv:'a close below 1.0795',result:'played'},
    {id:'c2',inst:'EURUSD',bias:'Range',if_:'price stalls under 1.0865 before the data',then_:'stand aside until after the release',inv:'a clean break and retest above 1.0870',result:''}];
  const nm=nowMin();const snap=m=>clamp(Math.round(m/5)*5,0,1435);
  td.events=[{id:'e1',min:snap(nm-170),cur:'GBP',title:'UK Claimant Count',impact:'m',fc:'12.0K',prev:'18.1K'},
    {id:'e2',min:snap(nm+85),cur:'USD',title:'US CPI y/y',impact:'h',fc:'3.1%',prev:'3.2%'},
    {id:'e3',min:snap(nm+200),cur:'USD',title:'Fed Chair speaks',impact:'h',fc:'',prev:''},
    {id:'e4',min:snap(nm+310),cur:'EUR',title:'ECB Economic Bulletin',impact:'l',fc:'',prev:''}];
  td.star={e2:true};td.check={htf:true,level:true};
  const first=st.days[t0];td.emoStart=first?.emoStart||'';
  st.days[t0]=td;
  const ws=weekStart(t0),lw=addDays(ws,-7);
  st.weeks[lw]={closed:true,closedAt:Date.now()-4*86400000,lesson:'Most losses came after I moved the stop. The plan was fine; I changed it mid-trade.',
    focus:'Wait for the sweep candle to close back inside the range before entering.',
    levelStudies:[{id:'a1',inst:'EURUSD',type:'Previous day low',reaction:'swept',note:'Swept by 4 pips, reversed within the hour.'},
      {id:'a2',inst:'GBPUSD',type:'Weekly open',reaction:'held',note:'Three touches, held each time.'},
      {id:'a3',inst:'XAUUSD',type:'Round number',reaction:'broke',note:'Broke, retested, then ran.'}],
    tests:[],gradeFinal:'',gradeReason:''};
  st.weeks[ws]={closed:false,lesson:'',focus:'',
    levelStudies:[{id:'b1',inst:'EURUSD',type:'Previous day high',reaction:'swept',note:'Took the highs at the London open.'},
      {id:'b2',inst:'GBPUSD',type:'HTF demand',reaction:'held',note:''}],
    tests:[{id:'t1',setup:'htf',inst:'EURUSD',tf:'M15',period:'Jan to Jun 2026',n:64,wr:56,avgR:.72,dd:4.1,verdict:'promote',note:'Best at the London open. Skip Fridays.'},
      {id:'t2',setup:'orb',inst:'GBPUSD',tf:'M5',period:'Jan to Jun 2026',n:88,wr:44,avgR:.14,dd:7.8,verdict:'refine',note:'Edge only when the opening range is under 20 pips.'}],
    gradeFinal:'',gradeReason:''};
  return st;
}
if(!S||S.v!==1)S=seed();
ui.wk=weekStart(TODAY());ui.mo=TODAY().slice(0,7);
try{ui.tab=localStorage.getItem(KEY+'.tab')||'today'}catch(e){}
if(!['today','plan','journal','week','month'].includes(ui.tab))ui.tab='today';

/* ================= screenshot storage ================= */
const MEMSHOTS=new Map();
const IDB=(()=>{
  let p=null;
  const open=()=>p||(p=new Promise((res,rej)=>{try{const q=indexedDB.open('trc-shots',1);q.onupgradeneeded=()=>q.result.createObjectStore('s');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}}));
  const tx=(m,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction('s',m);const r=fn(t.objectStore('s'));t.oncomplete=()=>res(r.result);t.onerror=()=>rej(t.error)}));
  return{put:(k,v)=>tx('readwrite',s=>s.put(v,k)).catch(()=>MEMSHOTS.set(k,v)),get:k=>tx('readonly',s=>s.get(k)).then(v=>v||MEMSHOTS.get(k)).catch(()=>MEMSHOTS.get(k)),del:k=>tx('readwrite',s=>s.delete(k)).catch(()=>MEMSHOTS.delete(k))};
})();
const URLS=new Map();
async function shotURL(id){
  if(URLS.has(id))return URLS.get(id);
  const b=await IDB.get(id);if(!b)return '';
  const u=URL.createObjectURL(b);URLS.set(id,u);return u;
}
async function fileToBlob(file){
  let bmp;
  try{bmp=await createImageBitmap(file)}catch(e){
    bmp=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});
  }
  const w0=bmp.width||bmp.naturalWidth,h0=bmp.height||bmp.naturalHeight,k=Math.min(1,1000/Math.max(w0,h0));
  const cv=document.createElement('canvas');cv.width=Math.round(w0*k);cv.height=Math.round(h0*k);
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  return new Promise(res=>cv.toBlob(b=>res(b),'image/jpeg',.72));
}
/* a small deterministic candle sketch used for sample screenshots */
function chartSVG(t,kind){
  const r=rng(hash(t.id+(kind||'')));const N=26,E=13;
  const up=(t.dir==='long')===(t.outcome!=='loss');
  const drift=t.outcome==='be'?0:(up?1:-1)*(t.outcome==='win'?.55:.5);
  let p=0;const cs=[];
  for(let i=0;i<N;i++){
    const d=i<E?(r()-.5)*1.4:(r()-.5)*1.2+drift;
    const o=p;p=o+d;cs.push({o,c:p,h:Math.max(o,p)+r()*.5,l:Math.min(o,p)-r()*.5});
  }
  const entry=cs[E-1].c,dirm=t.dir==='long'?1:-1,sl=entry-dirm*4,tp=entry+dirm*8;
  const all=[...cs.flatMap(c=>[c.h,c.l]),sl,tp];
  const lo=Math.min(...all),hi=Math.max(...all);
  const Y=v=>74-(v-lo)/(hi-lo)*68,W=120/N;
  const body=cs.map((c,i)=>{const x=i*W+W/2,up=c.c>=c.o;return `<line x1="${x}" x2="${x}" y1="${Y(c.h)}" y2="${Y(c.l)}" class="${up?'candle-up':'candle-dn'}" stroke-width="1" vector-effect="non-scaling-stroke"/><rect x="${x-W*.3}" y="${Y(Math.max(c.o,c.c))}" width="${W*.6}" height="${Math.max(.8,Math.abs(Y(c.o)-Y(c.c)))}" class="${up?'candle-up':'candle-dn'}" stroke-width="1" vector-effect="non-scaling-stroke"/>`}).join('');
  const ln=(v,col,dash,w)=>`<line x1="${E*W}" x2="120" y1="${Y(v)}" y2="${Y(v)}" style="stroke:${col}" stroke-width="${w}" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/>`;
  return `<svg viewBox="0 0 120 80" preserveAspectRatio="none" role="img" aria-label="Sample chart">${body}${ln(entry,'var(--ink3)','none',.7)}${ln(sl,'var(--ink)','.8 1.6',1.1)}${ln(tp,'var(--ink)','3 2',.9)}</svg>`;
}
/* ================= view helpers ================= */
const IC={
  today:'<circle cx="12" cy="12" r="8.5"/><path d="M12 12l3.6-3.6M12 5.6v1.2M5.6 12h1.2M18.4 12h-1.2"/>',
  plan:'<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5h6v3H9zM8.6 13.2l2.2 2.2 4.6-4.8"/>',
  journal:'<path d="M6 4h10.5A1.5 1.5 0 0 1 18 5.5V20H7.5A1.5 1.5 0 0 1 6 18.5z"/><path d="M9 8.5h6M9 12h6"/>',
  week:'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  month:'<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevL:'<path d="M14.5 6l-6 6 6 6"/>',chevR:'<path d="M9.5 6l6 6-6 6"/>',
  star:'<path d="M12 4l2.4 5 5.5.7-4 3.8 1 5.5L12 16.4 7.1 19l1-5.5-4-3.8 5.5-.7z"/>',
  image:'<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l5-4 3 2.5 3-3 3 3.5"/>'
};
const ico=(n,c='')=>`<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const TABS=[['today','Today'],['plan','Plan'],['journal','Journal'],['week','Week'],['month','Month']];
const hdr=(title,sub,right='')=>`<header class="hd"><div><h1>${title}</h1>${sub?`<small>${sub}</small>`:''}</div>${right}</header>`;
const chip=(label,on,a,v,extra='',cls='')=>`<button class="chip ${cls} ${on?'on':''}" data-a="${a}" data-v="${esc(v)}" ${extra} aria-pressed="${!!on}">${label}</button>`;
const seg=(opts,cur,a,extra='')=>`<div class="seg" role="tablist">${opts.map(([v,l,b])=>`<button class="${cur===v?'on':''}" data-a="${a}" data-v="${v}" role="tab" aria-selected="${cur===v}">${l}${b||''}</button>`).join('')}</div>`;
const sel=(k,opts,cur,id)=>`<select class="in" id="${id||k.replace(/\W/g,'_')}" data-k="${k}">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(cur)===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select>`;
const inp=(k,val,attrs='')=>`<input class="in" id="${k.replace(/\W/g,'_')}" data-k="${k}" value="${esc(val)}" ${attrs}>`;
const num=(k,val,attrs='')=>inp(k,val,`type="text" inputmode="decimal" data-t="n" autocomplete="off" ${attrs}`);
const fld=(label,html)=>`<div class="fld"><label>${label}</label>${html}</div>`;
const area=(k,val,ph='')=>`<textarea class="in" id="${k.replace(/\W/g,'_')}" data-k="${k}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;
const sw=(on,a,id,auto)=>`<button class="sw ${auto?'auto':''}" role="switch" aria-checked="${!!on}" ${auto?'tabindex="-1" aria-disabled="true"':`data-a="${a}" data-v="${id}"`}></button>`;
const pill=(t,c='')=>`<span class="pill ${c}">${t}</span>`;
const empty=t=>`<div class="emp">${t}</div>`;
const setupName=id=>nameOf(SETUPS,id)||'No setup';
const instOpts=()=>Object.keys(S.settings.instruments);
const dpFor=inst=>(S.settings.instruments[inst]||INST.EURUSD).dp;
const tabbar=()=>`<nav class="tabs" aria-label="Sections">${TABS.map(([k,l])=>`<button data-a="tab" data-v="${k}" class="${ui.tab===k?'on':''}" ${ui.tab===k?'aria-current="page"':''}>${ico(k)}<span>${l}</span></button>`).join('')}</nav>`;
function thumbHTML(t){
  const s=t.shots&&t.shots[0];
  if(!s)return `<div class="thumb" style="display:grid;place-items:center;color:var(--ink3)">${ico('image')}</div>`;
  return `<div class="thumb">${s.demo?chartSVG(t,s.kind):`<img alt="Screenshot" data-shot="${s.id}">`}</div>`;
}
function tradeCard(t){
  const open=t.status==='open',res=open?'Open':fmtR(t.r);
  return `<button class="tcard" data-a="trade" data-id="${t.id}">
    ${thumbHTML(t)}
    <div class="mid">
      <div class="t1">${esc(t.instrument)} <span class="faint">${t.dir==='long'?'▲ Long':'▼ Short'}</span></div>
      <div class="t2">${esc(setupName(t.setup))} · ${esc(t.session)}</div>
      <div class="t3">${t.grade?pill('Grade '+t.grade):''}${t.emoBefore?pill(esc(nameOf(EMOS,t.emoBefore))):''}${t.mistakes.length?pill('⚑ '+esc(nameOf(MISTAKES,t.mistakes[0]))+(t.mistakes.length>1?' +'+(t.mistakes.length-1):''),'warn'):''}${t.ruleBreaks.length?pill('Rule break','bad'):''}</div>
    </div>
    <div class="rt"><b class="rtag ${open?'':sgn(t.r)}">${res}</b><span>${open?t.lots.toFixed(2)+' lots':fmtM(t.pnl,true)}</span></div>
  </button>`;
}

/* ================= Today ================= */
function viewToday(){
  const t0=TODAY(),d=day(t0),trs=byDate(t0),cl=trs.filter(t=>t.status==='closed'),op=trs.filter(t=>t.status==='open');
  const used=sum(trs.map(t=>t.riskPct)),cap=S.settings.dailyCap,max=S.settings.maxTrades;
  const brk=new Set(trs.flatMap(t=>t.ruleBreaks));
  const logged=cl.filter(t=>t.grade&&t.shots.length).length;
  const steps=[
    ['plan','Plan',d.planReady?'done':(d.levels.length||d.scen.length)?'doing':'todo',d.planReady?`${d.levels.length} levels, ${d.scen.length} scenarios`:'Not locked yet'],
    ['exec','Execute',d.closed?'done':trs.length?'doing':'todo',`${trs.length} of ${max} trades`],
    ['log','Log',d.closed?'done':logged?'doing':'todo',cl.length?`${logged} of ${cl.length} logged`:'Nothing to log yet']];
  const segs=Math.max(4,Math.round(cap/0.25)),filled=Math.min(segs,Math.ceil(used/0.25-1e-9));
  const gcls=used>cap+1e-9?'x':used>=cap*.75?'w':'f';
  const nm=nowMin(),nxt=d.events.filter(e=>e.min>nm).sort((a,b)=>a.min-b.min)[0];
  const until=nxt?(()=>{const m=nxt.min-nm;return m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`})():'';
  const h=new Date().getUTCHours();
  const act={Asia:h<9,London:h>=7&&h<16,'New York':h>=12&&h<21};
  const ws=weekStart(t0),wst=stats(wkTrades(ws)),wg=autoGrade(wkTrades(ws));
  const lw=Object.keys(S.weeks).filter(k=>S.weeks[k].closed&&S.weeks[k].focus).sort().pop();
  const dow=new Date().getDay(),reviewDue=(dow===5||dow===6||dow===0)&&!wkData(ws).closed;
  const dom=+t0.slice(8),prevM=addMonths(t0.slice(0,7),-1),monthDue=dom<=3&&moTrades(prevM).length&&!moData(prevM).closed;
  const rule=(ok,l)=>`<div class="rule ${ok?'ok':'no'}"><span class="m">${ico(ok?'check':'x','sm')}</span><span>${l}</span></div>`;
  return `<div class="wrap">
    ${hdr(DOWF[new Date().getDay()],`${parse(t0).getDate()} ${MONF[parse(t0).getMonth()]} ${parse(t0).getFullYear()}`,`<button class="iconbtn" data-a="settings" aria-label="Settings">${ico('sliders')}</button>`)}
    <div class="sess" aria-label="Market sessions, UTC">${['Asia','London','New York'].map(s=>`<span class="pill ${act[s]?'good':''}"><i class="dot ${act[s]?'good':''}"></i>${s}</span>`).join('')}</div>
    ${installEv?`<div class="banner"><div><b>Install</b>Add this app to your home screen.</div><button class="btn sm pri" data-a="install">Install</button></div>`:''}
    ${S.sample?`<div class="banner warn"><div><b>Sample data</b>Trades and numbers here are examples. Erase them when you are ready to log your own.</div><button class="btn sm ${ui.confirm==='fresh'?'dng':''}" data-a="fresh">${ui.confirm==='fresh'?'Tap again':'Start fresh'}</button></div>`:''}
    ${reviewDue?`<div class="banner good"><div><b>Weekly review</b>This week is ready to review.</div><button class="btn sm pri" data-a="tab" data-v="week">Open</button></div>`:''}
    ${monthDue?`<div class="banner good"><div><b>Monthly review</b>${monthLabel(prevM)} is ready to review.</div><button class="btn sm pri" data-a="gomonth" data-v="${prevM}">Open</button></div>`:''}
    ${lw?`<div class="banner"><div><b>Focus this week</b>${esc(S.weeks[lw].focus)}</div></div>`:''}
    <section class="card"><h2>Today’s routine</h2>
      <div class="steps">${steps.map(([k,l,s,sub])=>`<button class="step ${s}" data-a="gostep" data-v="${k}"><span class="s">${s==='done'?ico('check','sm'):''}</span><b>${l}</b><span>${sub}</span></button>`).join('')}</div>
    </section>
    <section class="card"><h2>Risk used today <span class="r ${used>cap?'neg':''}">${used.toFixed(1)}% of ${cap}%</span></h2>
      <div class="gauge" role="img" aria-label="${used.toFixed(1)} percent of ${cap} percent daily risk used">${Array.from({length:segs},(_,i)=>`<i class="${i<filled?gcls:''}"></i>`).join('')}</div>
      <div class="kv" style="margin-top:10px"><span class="muted">Trades</span><span class="pips" aria-label="${trs.length} of ${max} trades">${Array.from({length:max},(_,i)=>`<i class="${i<trs.length?'f':''}"></i>`).join('')}</span></div>
      ${op.length?`<div class="kv" style="margin-top:8px"><span class="muted">Open now</span><b>${op.map(t=>esc(t.instrument)).join(', ')}</b></div>`:''}
      <hr class="hr"><div class="rules">${rule(!brk.has('aplus'),'A+ only')}${rule(!brk.has('revenge'),'No revenge')}${rule(trs.length<=max&&!brk.has('limit'),'Quantity')}</div>
    </section>
    <section class="card"><h2>Next event ${d.events.length?pill('Sample','line'):''}</h2>
      ${nxt?`<div class="ev"><span class="tm">${fmtMin(nxt.min)}</span><div class="nm"><b>${esc(nxt.title)}</b><small>${esc(nxt.cur)} · ${until}</small></div><span class="imp ${nxt.impact}" aria-label="${{h:'High',m:'Medium',l:'Low'}[nxt.impact]} impact"><i></i><i></i><i></i></span></div>`:empty(d.events.length?'No more events today.':'No events added. Add them in Plan.')}
    </section>
    <section class="card"><h2>This week <span class="r muted">${fmtD(ws)} to ${fmtD(addDays(ws,4))}</span></h2>
      <div class="tiles t3">
        <div class="tile"><b>${fmtP(wst.winRate)}</b><span>Win rate</span></div>
        <div class="tile"><b class="${sgn(wst.netR)}">${wst.n?fmtR(wst.netR):'—'}</b><span>Net R</span></div>
        <div class="tile"><b>${wg?wg.letter:'—'}</b><span>Execution</span></div>
      </div>
      <div class="kv" style="margin-top:12px"><span class="muted">Clean days in a row</span><b>${streak()}</b></div>
    </section>
  </div>`;
}

/* ================= Plan ================= */
function viewPlan(){
  const t0=TODAY(),d=day(t0);
  const logN=byDate(t0).filter(t=>t.status==='closed'&&!(t.grade&&t.shots.length)).length;
  const tabs=[['plan','Plan',d.planReady?` <i class="dot good"></i>`:''],['exec','Execute',byDate(t0).length?` <i class="dot acc"></i>`:''],['log','Log',d.closed?` <i class="dot good"></i>`:logN?` <i class="dot warn"></i>`:'']];
  return `<div class="wrap">${hdr('Plan',fmtD(t0))}${seg(tabs,ui.step,'step')}${ui.step==='plan'?planStep(d):ui.step==='exec'?execStep(d):logStep(d)}</div>`;
}
const touchPlan=d=>{if(d.planReady)d.planEdits++};
function planStep(d){
  const evs=d.events.slice().sort((a,b)=>a.min-b.min);
  const lv=d.levels.slice().sort((a,b)=>a.inst.localeCompare(b.inst)||parseFloat(b.price)-parseFloat(a.price));
  const F=ui.form;
  const evForm=F.ev?`<div class="form"><div class="g2">${fld('Time',inp('form.evtime',F.evtime||'09:00','type="time"'))}${fld('Currency',sel('form.evcur',['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD'],F.evcur||'USD'))}</div><div class="sp"></div>${fld('Event',inp('form.evtitle',F.evtitle||'','placeholder="US CPI y/y" autocomplete="off"'))}<div class="sp"></div><div class="lab">Impact</div><div class="chips" style="margin-top:6px">${[['h','High'],['m','Medium'],['l','Low']].map(([v,l])=>chip(l,(F.evimp||'m')===v,'evimp',v)).join('')}</div><button class="btn pri blk" data-a="addEv">Add event</button></div>`:'';
  const lvForm=F.lv?`<div class="form"><div class="g2">${fld('Instrument',sel('form.lvinst',instOpts(),F.lvinst||S.calc.inst))}${fld('Price',inp('form.lvprice',F.lvprice||'','type="text" inputmode="decimal" placeholder="1.08650" autocomplete="off"'))}</div><div class="sp"></div>${fld('Type',sel('form.lvtype',LEVELS,F.lvtype||LEVELS[0]))}<div class="sp"></div>${fld('Note',inp('form.lvnote',F.lvnote||'','placeholder="What you expect here" autocomplete="off"'))}<button class="btn pri blk" data-a="addLevel">Add level</button></div>`:'';
  const scForm=F.sc?`<div class="form"><div class="g2">${fld('Instrument',sel('form.scinst',instOpts(),F.scinst||S.calc.inst))}${fld('Bias',sel('form.scbias',['Bullish','Bearish','Range'],F.scbias||'Bullish'))}</div><div class="sp"></div>${fld('If',inp('form.scif',F.scif||'','placeholder="price sweeps the low and closes back above" autocomplete="off"'))}<div class="sp"></div>${fld('Then I',inp('form.scthen',F.scthen||'','placeholder="buy the retest, target the high" autocomplete="off"'))}<div class="sp"></div>${fld('Invalid if',inp('form.scinv',F.scinv||'','placeholder="a close below the low" autocomplete="off"'))}<button class="btn pri blk" data-a="addScen">Add scenario</button></div>`:'';
  return `
  <section class="card"><h2><span>Calendar ${d.events.length&&S.sample?pill('Sample','line'):''}</span><button class="btn sm" data-a="frm" data-v="ev">${F.ev?'Close':'Add'}</button></h2>
    ${evs.length?evs.map(e=>`<div class="ev"><span class="tm">${fmtMin(e.min)}</span><div class="nm"><b>${esc(e.title)}</b><small>${esc(e.cur)}${e.fc||e.prev?` · forecast ${esc(e.fc||'—')}, previous ${esc(e.prev||'—')}`:''}${d.star[e.id]?` · no-trade ±${S.settings.nowin} min`:''}</small></div><span class="imp ${e.impact}" aria-label="${{h:'High',m:'Medium',l:'Low'}[e.impact]} impact"><i></i><i></i><i></i></span><button class="star ${d.star[e.id]?'on':''}" data-a="star" data-v="${e.id}" aria-label="Avoid trading around this event" aria-pressed="${!!d.star[e.id]}">${ico('star')}</button></div>`).join(''):empty('No events yet. Add the releases you want to avoid.')}
    ${evForm}
  </section>
  <section class="card"><h2>Key levels<button class="btn sm" data-a="frm" data-v="lv">${F.lv?'Close':'Add'}</button></h2>
    ${lv.length?lv.map(l=>`<div class="lvl"><span class="px">${esc(l.price)}</span><div class="nm"><b>${esc(l.inst)}</b> ${pill(esc(l.type))}${l.note?`<small>${esc(l.note)}</small>`:''}</div><button class="xbtn" data-a="rmLevel" data-v="${l.id}" aria-label="Remove level">${ico('x','sm')}</button></div>`).join(''):empty('Map the levels you will act on before the session opens.')}
    ${lvForm}
  </section>
  <section class="card"><h2>Scenarios<button class="btn sm" data-a="frm" data-v="sc">${F.sc?'Close':'Add'}</button></h2>
    ${d.scen.length?d.scen.map(s=>`<div class="scn"><div style="display:flex;gap:6px;align-items:center;justify-content:space-between"><div style="display:flex;gap:6px;align-items:center"><b>${esc(s.inst)}</b>${pill(esc(s.bias),s.bias==='Bullish'?'good':s.bias==='Bearish'?'bad':'')}</div><button class="xbtn" data-a="rmScen" data-v="${s.id}" aria-label="Remove scenario">${ico('x','sm')}</button></div><p><b>If</b> ${esc(s.if_)}</p><p><b>Then</b> ${esc(s.then_)}</p><p><b>Invalid if</b> ${esc(s.inv)}</p></div>`).join(''):empty('Write what you will do if price does X at level Y.')}
    ${scForm}
  </section>
  ${d.planReady
    ?`<div class="banner good"><div><b>Plan locked</b>${d.planTs?'at '+fmtMin(new Date(d.planTs).getHours()*60+new Date(d.planTs).getMinutes()):''}${d.planEdits?` · ${d.planEdits} edit${d.planEdits>1?'s':''} after lock`:' · no edits since'}</div></div><button class="btn blk" data-a="unlockPlan">Unlock plan</button>`
    :`<button class="btn pri blk" data-a="planReady">Mark plan ready</button><p class="hint">Locking time-stamps the plan. Later changes are counted as edits after lock.</p>`}`;
}

function execStep(d){
  const win=inWindow(),rl=recentLoss(),trs=byDate(TODAY()),max=S.settings.maxTrades;
  return `
  ${win?`<div class="banner warn"><div><b>No-trade window</b>${esc(win.title)} at ${fmtMin(win.min)}. Wait until it passes.</div></div>`:''}
  ${trs.length>=max?`<div class="banner bad"><div><b>Trade limit reached</b>You have taken ${trs.length} of ${max} trades today. Quality over quantity.</div></div>`:''}
  ${rl?`<div class="banner warn"><div><b>Cooling off</b>${esc(rl.instrument)} closed as a loss less than ${S.settings.cooldown} minutes ago. Confirm this is not a revenge trade.</div></div>`:''}
  <section class="card"><h2>This trade</h2>
    <div class="lab" style="margin-bottom:6px">Setup</div>
    <div class="chips">${SETUPS.map(s=>chip(s.name,S.calc.setup===s.id,'cs',s.id,'','sm')).join('')}</div>
  </section>
  <div id="liveDisc">${discCard()}</div>
  <section class="card"><h2>Risk calculator</h2>
    <div class="g2">${fld('Balance ($)',num('calc.bal',S.calc.bal,`placeholder="${Math.round(currentBalance())}" data-live="calc"`))}${fld('Risk (%)',num('calc.risk',S.calc.risk,`placeholder="${S.settings.riskPct}" data-live="calc"`))}</div>
    <div class="sp"></div>
    <div class="g2">${fld('Instrument',sel('calc.inst',instOpts(),S.calc.inst).replace('<select','<select data-r="1"'))}<div class="fld"><label>Direction</label><div class="seg in">${[['long','Long'],['short','Short']].map(([v,l])=>`<button class="${S.calc.dir===v?'on':''}" data-a="cd" data-v="${v}">${l}</button>`).join('')}</div></div></div>
    <div class="sp"></div>
    <div class="g2">${fld('Stop loss (pips)',num('calc.sl',S.calc.sl,'data-live="calc" placeholder="12"'))}${fld('Entry price (optional)',num('calc.entry',S.calc.entry,'data-live="calc" placeholder="1.08400"'))}</div>
    <div class="sp"></div>
    <div class="lab" style="margin-bottom:6px">Target</div>
    <div class="chips">${[1.5,2,3].map(v=>chip(v+'R',+S.calc.rr===v,'rr',v,'','sm')).join('')}</div>
    <div id="liveOut">${calcOutHTML()}</div>
  </section>
  <div id="liveOpen">${openBox()}</div>`;
}
function discCard(){
  const m=checkMap(),items=S.settings.items,sup=items.filter(i=>i.group==='setup'),rul=items.filter(i=>i.group==='rule');
  const row=i=>`<div class="row"><div class="grow">${esc(i.label)}${i.gate?'<span class="gate">GATE</span>':''}${i.auto?'<span class="auto-tag">auto</span>':''}</div>${sw(m[i.id],'chk',i.id,i.auto)}</div>`;
  const on=sup.filter(i=>m[i.id]).length;
  return `<section class="card"><h2>Setup confirmation <span class="r ${on===sup.length?'pos':'muted'}">${on} of ${sup.length}</span></h2>${sup.map(row).join('')}</section>
  <section class="card"><h2>Discipline <span class="r ${rul.every(i=>m[i.id])?'pos':'muted'}">${rul.filter(i=>m[i.id]).length} of ${rul.length}</span></h2>${rul.map(row).join('')}</section>`;
}
function calcOutHTML(){
  const c=calcOut(),dp=c.I.dp;
  return `<div class="out">
    <div class="lots">${c.sl>0?c.lots.toFixed(2):'—'}<small>lots</small></div>
    <div class="kv"><span class="muted">Risk</span><b>${c.sl>0?fmtM(c.actual)+' · '+c.actualPct.toFixed(2)+'%':'—'}</b></div>
    <div class="kv"><span class="muted">Stop distance</span><b>${c.sl>0?c.sl+' pips':'—'}</b></div>
    ${c.slPrice!=null?`<div class="kv"><span class="muted">Stop price</span><b class="neg mono">${c.slPrice.toFixed(dp)}</b></div><div class="kv"><span class="muted">Target at ${c.rr}R</span><b class="pos mono">${c.tpPrice.toFixed(dp)}</b></div>`:''}
    ${c.warn.map(w=>`<p class="hint warn">${esc(w)}</p>`).join('')}
  </div>`;
}
function openBox(){
  const miss=gateMissing(),c=calcOut(),bad=!(c.lots>0);
  if(!miss.length)return `<button class="btn pri blk" data-a="openTrade" ${bad?'disabled':''}>Open trade${c.lots>0?' · '+c.lots.toFixed(2)+' lots':''}</button>`;
  return `<button class="btn pri blk" disabled>Open trade</button><p class="hint bad">${miss.length} gate${miss.length>1?'s are':' is'} off: ${miss.map(i=>esc(i.label)).join(', ')}.</p><button class="btn blk" data-a="override" ${bad?'disabled':''}>Override and open with a reason</button>`;
}

function logStep(d){
  const trs=byDate(TODAY()),cl=trs.filter(t=>t.status==='closed'),op=trs.filter(t=>t.status==='open');
  const problems=[];
  if(op.length)problems.push(`${op.length} trade${op.length>1?'s are':' is'} still open. Close or cancel it.`);
  cl.filter(t=>!t.shots.length).forEach(t=>problems.push(`${t.instrument} needs a screenshot.`));
  const emoRow=(k,v)=>`<div class="chips">${EMOS.map(e=>chip(e.name,v===e.id,'emo',k+':'+e.id,'','sm')).join('')}</div>`;
  const sc=ui.form;
  return `
  <section class="card"><h2>Today’s trades <span class="r muted">${trs.length}</span></h2>
    ${trs.length?trs.map(tradeCard).join(''):empty('No trades yet today. Plan, then execute.')}
    ${op.length?'<p class="hint">Tap an open trade to enter the result.</p>':''}
  </section>
  ${d.scen.length?`<section class="card"><h2>Scenario results</h2>${d.scen.map(s=>`<div class="scn"><b>${esc(s.inst)}</b> <span class="muted">${esc(s.bias)}</span><p>${esc(s.if_)}</p><div class="chips" style="margin-top:8px">${[['played','Played'],['not','Not played'],['invalid','Invalidated']].map(([v,l])=>chip(l,s.result===v,'scres',s.id+':'+v,'','sm')).join('')}</div></div>`).join('')}</section>`:''}
  <section class="card"><h2>Emotional state</h2>
    <div class="lab" style="margin-bottom:6px">At the start</div>${emoRow('start',d.emoStart)}
    <div class="sp"></div><div class="lab" style="margin-bottom:6px">At the end</div>${emoRow('end',d.emoEnd)}
  </section>
  <section class="card"><h2>Plan adherence <span class="r muted">Rule score ${cl.length?Math.round(mean(cl.map(t=>t.rules??1))*100)+'%':'—'}</span></h2>
    <div class="chips">${[1,2,3,4,5].map(n=>chip(n,d.adherence===n,'adh',n)).join('')}</div>
    <div class="sp"></div>${area('day.reflection',d.reflection,'One thing I did well, one thing to fix')}
  </section>
  ${d.closed?`<div class="banner good"><div><b>Day closed</b>Notes can still be edited.</div></div><button class="btn blk" data-a="reopenDay">Reopen day</button>`
   :`${problems.length?`<div class="banner warn"><div><b>Before you close the day</b>${problems.map(esc).join('<br>')}</div></div>`:''}<button class="btn pri blk" data-a="closeDay" ${problems.length?'disabled':''}>Close day</button>`}`;
}
/* ================= Journal ================= */
function filteredTrades(){
  const f=ui.jf,q=f.q.trim().toLowerCase();
  return S.trades.filter(t=>t.status!=='cancelled').filter(t=>f.o==='all'||t.outcome===f.o).filter(t=>f.s==='all'||t.setup===f.s)
    .filter(t=>!q||[t.notes,t.lesson,t.instrument,setupName(t.setup),t.mistakes.map(m=>nameOf(MISTAKES,m)).join(' ')].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>b.ts-a.ts);
}
function journalList(){
  const all=filteredTrades(),list=all.slice(0,ui.jlimit);
  if(!all.length)return empty(S.trades.length?'No trades match these filters.':'No trades yet. Tap + Trade to log your first one.');
  const groups=[];list.forEach(t=>{const g=groups.at(-1);if(g&&g.d===t.date)g.t.push(t);else groups.push({d:t.date,t:[t]})});
  return groups.map(g=>{const cr=g.t.filter(t=>t.status==='closed').reduce((a,t)=>a+t.r,0);
    return `<div class="dayhd"><b>${fmtD(g.d)}</b><span>${g.t.length} trade${g.t.length>1?'s':''} · <span class="${sgn(cr)}">${fmtR(cr)}</span></span></div>${g.t.map(tradeCard).join('')}`}).join('')
    +(all.length>list.length?`<button class="btn blk" data-a="jmore">Show older trades</button>`:'');
}
function viewJournal(){
  const f=ui.jf;
  return `<div class="wrap">${hdr('Journal',`${closedT(S.trades).length} closed trades`)}
    <div class="seg">${[['all','All'],['win','Wins'],['loss','Losses'],['be','Break-even']].map(([v,l])=>`<button class="${f.o===v?'on':''}" data-a="jo" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="g2" style="margin-bottom:4px">${sel('jf.s',[['all','All setups'],...SETUPS.map(s=>[s.id,s.name])],f.s).replace('<select','<select data-r="1"')}${inp('jf.q',f.q,'type="search" placeholder="Search notes" autocomplete="off" data-live="jq"')}</div>
    <div id="jlist">${journalList()}</div></div>`;
}

/* ================= Week ================= */
const rangeLbl=(a,b)=>{const x=parse(a),y=parse(b);return `${x.getDate()} ${MON[x.getMonth()]} to ${y.getDate()} ${MON[y.getMonth()]}`};
function dlt(cur,prev,f,unit,goodUp=true){
  if(cur==null||prev==null)return '<span class="dlt faint">No data last week</span>';
  const d=cur-prev;if(Math.abs(d)<0.05)return '<span class="dlt faint">Same as last week</span>';
  const good=(d>0)===goodUp;return `<span class="dlt ${goodUp===null?'faint':good?'pos':'neg'}">${d>0?'▲':'▼'} ${f(Math.abs(d))}${unit} vs last week</span>`;
}
function dayBars(ws){
  const trs=closedT(wkTrades(ws)),vals=Array.from({length:7},(_,i)=>{const d=addDays(ws,i),ts=trs.filter(t=>t.date===d);return{d,n:ts.length,r:sum(ts.map(t=>t.r))}});
  const mx=Math.max(1,...vals.map(v=>Math.abs(v.r))),base=58,sc=40/mx;
  const bars=vals.map((v,i)=>{const x=14+i*44,h=Math.abs(v.r)*sc,y=v.r>=0?base-h:base;
    return `<g>${v.n?`<rect x="${x}" y="${y}" width="28" height="${Math.max(2,h)}" rx="3" style="${v.r>=0?'fill:var(--ink)':'fill:url(#hl);stroke:var(--ink);stroke-width:1'}"/><text x="${x+14}" y="${v.r>=0?y-4:y+h+11}" text-anchor="middle" style="fill:var(--ink2);font-size:10px;font-weight:600">${fmtR(v.r)}</text>`:`<rect x="${x+11}" y="${base-1}" width="6" height="2" rx="1" style="fill:var(--ink3)"/>`}<text x="${x+14}" y="112" text-anchor="middle">${DOW[parse(v.d).getDay()][0]}${parse(v.d).getDate()}</text></g>`}).join('');
  return `<svg class="chart" viewBox="0 0 322 120" role="img" aria-label="Net R per day this week"><defs><pattern id="hl" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:var(--surface)"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:var(--ink)" stroke-width="2"/></pattern></defs><line x1="8" x2="314" y1="${base}" y2="${base}" style="stroke:var(--line)"/>${bars}</svg>`;
}
function viewWeek(){
  const ws=ui.wk,we=addDays(ws,6),W=wkData(ws),isCur=ws===weekStart(TODAY()),trs=wkTrades(ws);
  const prog=[['Stats',st=>trs.length>0],['Patterns',()=>W.levelStudies.length>0||mistakeAgg(trs).length>0],['Tests',()=>W.tests.length>0],['Reflect',()=>!!(W.lesson&&W.focus)],['Close',()=>W.closed]];
  return `<div class="wrap">${hdr('Week',null)}
    <div class="nav"><button class="iconbtn" data-a="wkn" data-v="-1" aria-label="Previous week">${ico('chevL')}</button><div class="lbl">${rangeLbl(ws,we)}${isCur?'<br><span class="xs muted">This week</span>':''}${W.closed?' '+pill('Closed','good'):''}</div><button class="iconbtn" data-a="wkn" data-v="1" ${isCur?'disabled':''} aria-label="Next week">${ico('chevR')}</button></div>
    <div class="prog" role="tablist">${prog.map(([l,f],i)=>`<button class="${ui.wstep===i+1?'on':''} ${f()?'done':''}" data-a="wstep" data-v="${i+1}" role="tab" aria-selected="${ui.wstep===i+1}">${f()&&ui.wstep!==i+1?ico('check','sm'):i+1} ${l}</button>`).join('')}</div>
    ${[null,weekStats,weekPatterns,weekTests,weekReflect,weekClose][ui.wstep](ws,W,trs)}
    <div style="display:flex;gap:8px;margin-top:4px">${ui.wstep>1?`<button class="btn" style="flex:1" data-a="wstep" data-v="${ui.wstep-1}">Back</button>`:''}${ui.wstep<5?`<button class="btn pri" style="flex:1" data-a="wstep" data-v="${ui.wstep+1}">Next: ${['','','Patterns','Tests','Reflect','Close'][ui.wstep+1]}</button>`:''}</div>
  </div>`;
}
function weekStats(ws,W,trs){
  const st=stats(trs),pv=stats(wkTrades(addDays(ws,-7))),ag=autoGrade(trs),fin=W.gradeFinal||(ag?ag.letter:'');
  const tiles=[
    ['Win rate',fmtP(st.winRate),'',dlt(st.winRate,pv.winRate,v=>v.toFixed(0),' pts')],
    ['Trades',st.n,'',dlt(st.n,pv.n?pv.n:null,v=>v.toFixed(0),'',null)],
    ['Net R',st.n?fmtR(st.netR):'—',sgn(st.netR),dlt(st.n?st.netR:null,pv.n?pv.netR:null,v=>v.toFixed(1),'R')],
    ['Average R',st.n?fmtR(st.avgR,2):'—',sgn(st.avgR),dlt(st.avgR,pv.avgR,v=>v.toFixed(2),'R')],
    ['Rules followed',fmtP(st.rules),'',dlt(st.rules,pv.rules,v=>v.toFixed(0),' pts')],
    ['Net P&L',st.n?fmtM(st.netPnl,true):'—',sgn(st.netPnl),dlt(st.n?st.netPnl:null,pv.n?pv.netPnl:null,v=>'$'+Math.round(v).toLocaleString('en-US'),'')]];
  return `<section class="card"><h2>Performance</h2>
    ${st.n?`<div class="tiles">${tiles.map(([l,v,c,d])=>`<div class="tile"><b class="${c}">${v}</b><span>${l}</span>${d}</div>`).join('')}</div><div class="sp"></div>${dayBars(ws)}`:empty('No closed trades this week.')}
  </section>
  <section class="card"><h2>Execution grade</h2>
    ${ag?`<div style="display:flex;gap:14px;align-items:center"><div class="grade" aria-label="Grade ${fin}">${fin}</div><div><b>${ag.score.toFixed(0)} out of 100</b><div class="sm muted">60% rules followed, 40% your own trade grades. The formula gives ${ag.letter}.</div></div></div>
    <div class="sp"></div><div class="lab" style="margin-bottom:6px">Your grade</div><div class="chips">${GRADES.map(g=>chip(g,fin===g,'wgrade',g)).join('')}</div>
    ${fin!==ag.letter?`<div class="sp"></div>${fld('Why does it differ from the formula?',inp('wk.gradeReason',W.gradeReason,'placeholder="Required when you change the grade" autocomplete="off"'))}`:''}`:empty('Grade appears after your first closed trade.')}
  </section>`;
}
function weekPatterns(ws,W,trs){
  const ma=mistakeAgg(trs).sort((a,b)=>a.r-b.r),mx=Math.max(1,...ma.map(x=>Math.abs(x.r))),worst=ma[0]&&ma[0].r<0?ma[0].id:'';
  const closed=closedT(trs).slice().sort((a,b)=>b.ts-a.ts);
  const F=ui.form;
  const ls=W.levelStudies;
  const byType={};ls.forEach(l=>{(byType[l.type]??={held:0,swept:0,broke:0,ignored:0,n:0})[l.reaction]++;byType[l.type].n++});
  const lsForm=F.ls?`<div class="form"><div class="g2">${fld('Instrument',sel('form.lsinst',instOpts(),F.lsinst||S.calc.inst))}${fld('Level type',sel('form.lstype',LEVELS,F.lstype||LEVELS[0]))}</div><div class="sp"></div><div class="lab" style="margin-bottom:6px">Reaction</div><div class="chips">${REACT.map(r=>chip(r.name,(F.lsre||'held')===r.id,'lsre',r.id,'','sm')).join('')}</div><div class="sp"></div>${fld('Note',inp('form.lsnote',F.lsnote||'','placeholder="What price did" autocomplete="off"'))}<button class="btn pri blk" data-a="addLs">Add study</button></div>`:'';
  return `<section class="card"><h2>Mistake logger <span class="r muted">${ma.reduce((a,x)=>a+x.n,0)} tagged</span></h2>
    ${ma.length?`<div class="bars">${ma.map(x=>{const w=Math.abs(x.r)/mx*50;return `<div class="b"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)} <span class="faint">×${x.n}</span></span><div class="track"><i class="zero"></i><div class="fill ${x.r<0?'n':'p'}" style="${x.r<0?`right:50%;width:${w}%`:`left:50%;width:${w}%`}"></div></div><span class="v ${sgn(x.r)}">${fmtR(x.r)}</span></div>`}).join('')}</div>
    ${worst?`<p class="hint">Costliest this week: <b>${esc(nameOf(MISTAKES,worst))}</b>.</p>`:''}`:empty('Nothing tagged yet. Tag the trades below.')}
    ${closed.length?`<button class="btn blk" style="margin-top:10px" data-a="frm" data-v="tagging">${F.tagging?'Done tagging':'Tag this week’s trades'}</button>`:''}
    ${F.tagging?closed.map(t=>`<div style="margin-top:12px"><div class="sm"><b>${esc(t.instrument)}</b> ${t.dir==='long'?'▲':'▼'} <span class="muted">${fmtD(t.date)}</span> <span class="${sgn(t.r)}"><b>${fmtR(t.r)}</b></span></div><div class="chips scroll" style="margin-top:6px">${MISTAKES.map(m=>chip(m.name,t.mistakes.includes(m.id),'tagm',t.id+':'+m.id,'','sm')).join('')}</div></div>`).join(''):''}
  </section>
  <section class="card"><h2>Levels and liquidity<button class="btn sm" data-a="frm" data-v="ls">${F.ls?'Close':'Add study'}</button></h2>
    ${ls.length?`${Object.entries(byType).map(([t,o])=>`<div style="margin-bottom:10px"><div class="kv"><span>${esc(t)}</span><span class="muted">${o.n} ${o.n>1?'studies':'study'}</span></div><div class="stk">${REACT.filter(r=>o[r.id]).map(r=>`<i class="r-${r.id}" style="width:${o[r.id]/o.n*100}%"></i>`).join('')}</div></div>`).join('')}
      <div class="legend">${REACT.map(r=>`<span><i class="r-${r.id}"></i>${r.name}</span>`).join('')}</div><hr class="hr">
      ${ls.map(l=>`<div class="lvl"><div class="nm"><b>${esc(l.inst)}</b> ${pill(esc(l.type))} ${pill(esc(nameOf(REACT,l.reaction)),l.reaction==='held'?'good':l.reaction==='swept'?'warn':l.reaction==='broke'?'bad':'')}${l.note?`<small>${esc(l.note)}</small>`:''}</div><button class="xbtn" data-a="rmLs" data-v="${l.id}" aria-label="Remove study">${ico('x','sm')}</button></div>`).join('')}`:empty('Log how price reacted at your levels this week.')}
    ${lsForm}
  </section>`;
}
function weekTests(ws,W){
  const F=ui.form;
  const form=F.bt?`<div class="form"><div class="g2">${fld('Setup',sel('form.btsetup',SETUPS.map(s=>[s.id,s.name]),F.btsetup||'sweep'))}${fld('Instrument',sel('form.btinst',instOpts(),F.btinst||S.calc.inst))}</div><div class="sp"></div>
    <div class="g2">${fld('Timeframe',sel('form.bttf',['M1','M5','M15','H1','H4','D1'],F.bttf||'M15'))}${fld('Test period',inp('form.btper',F.btper||'','placeholder="Jan to Jun 2026" autocomplete="off"'))}</div><div class="sp"></div>
    <div class="g2">${fld('Sample size',num('form.btn',F.btn||''))}${fld('Win rate (%)',num('form.btwr',F.btwr||''))}</div><div class="sp"></div>
    <div class="g2">${fld('Average R',num('form.btavg',F.btavg||''))}${fld('Max drawdown (R)',num('form.btdd',F.btdd||''))}</div><div class="sp"></div>
    <div class="lab" style="margin-bottom:6px">Verdict</div><div class="chips">${[['promote','Promote'],['refine','Refine'],['discard','Discard']].map(([v,l])=>chip(l,(F.btv||'refine')===v,'btv',v,'','sm')).join('')}</div><div class="sp"></div>
    ${fld('Notes',inp('form.btnote',F.btnote||'','placeholder="What worked, what did not" autocomplete="off"'))}<button class="btn pri blk" data-a="addBt">Save test</button></div>`:'';
  return `<section class="card"><h2>Backtest log<button class="btn sm" data-a="frm" data-v="bt">${F.bt?'Close':'Add test'}</button></h2>
    ${W.tests.length?W.tests.map(t=>{
      const live=stats(S.trades.filter(x=>x.setup===t.setup)),gap=live.n>=5&&t.wr?live.winRate-t.wr:null;
      return `<div class="scn"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(setupName(t.setup))}</b><span class="pill verdict-${t.verdict}">${esc({promote:'Promote',refine:'Refine',discard:'Discard'}[t.verdict])}</span></div>
      <div class="sm muted">${esc(t.inst)} · ${esc(t.tf)} · ${esc(t.period)}</div>
      <div class="tiles t3" style="margin-top:8px"><div class="tile"><b style="font-size:18px">${t.wr}%</b><span>Win rate</span></div><div class="tile"><b style="font-size:18px">${fmtR(+t.avgR,2)}</b><span>Avg R</span></div><div class="tile"><b style="font-size:18px">${t.dd}R</b><span>Max DD</span></div></div>
      <div class="kv sm" style="margin-top:8px"><span class="muted">Sample</span><span>${t.n} trades</span></div>
      ${live.n?`<div class="kv sm" style="margin-top:4px"><span class="muted">Live</span><span>${fmtP(live.winRate)} win · ${fmtR(live.avgR,2)} · ${live.n} trades ${gap!=null?`<span class="${gap>=0?'pos':'neg'}">(${gap>=0?'+':SG}${Math.abs(gap).toFixed(0)} pts)</span>`:''}</span></div>`:''}
      ${t.note?`<p class="hint">${esc(t.note)}</p>`:''}
      <button class="btn sm ghost" style="margin-top:6px" data-a="rmBt" data-v="${t.id}">Remove</button></div>`}).join(''):empty('Log a test before you trade a new setup live.')}
    ${form}
  </section>`;
}
function weekReflect(ws,W){
  const goals=moData(ws.slice(0,7)).goals.filter(g=>g.status==='open');
  return `<section class="card"><h2>Reflect</h2>
    ${fld('Main lesson this week',area('wk.lesson',W.lesson,'What did the data tell you?'))}
    <div class="sp"></div>${fld('One focus rule for next week',inp('wk.focus',W.focus,'placeholder="Shown on Today until the next review" autocomplete="off"'))}
  </section>
  ${goals.length?`<section class="card"><h2>${MONF[+ws.slice(5,7)-1]} goals</h2>${goals.map(g=>`<div class="row"><div class="grow sm">${esc(g.text)}</div></div>`).join('')}</section>`:''}`;
}
function weekClose(ws,W,trs){
  const ag=autoGrade(trs),checks=[['Stats reviewed',trs.length>0],['Mistakes tagged',mistakeAgg(trs).length>0],['Level study added',W.levelStudies.length>0],['Backtest logged',W.tests.length>0],['Lesson and focus rule written',!!(W.lesson&&W.focus)]];
  return `<section class="card"><h2>Close the week</h2>
    ${checks.map(([l,ok])=>`<div class="row"><div class="grow">${l}</div>${ok?pill('Done','good'):pill('Open')}</div>`).join('')}
    <div class="sp"></div>
    ${W.closed?`<div class="banner good"><div><b>Week closed</b>Snapshot saved ${W.closedAt?new Date(W.closedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}. Numbers in this review no longer move when old trades are edited.</div></div><button class="btn blk" data-a="reopenWeek">Reopen week</button>`
    :`<button class="btn pri blk" data-a="closeWeek">Close week</button><p class="hint">Saves a snapshot of this week${ag?` (grade ${W.gradeFinal||ag.letter})`:''}. Your focus rule appears on Today.</p>`}
  </section>`;
}

/* ================= Month ================= */
function equityChart(eq,b0){
  const pts=eq.pts;if(pts.length<2)return empty('Close a trade to start the equity curve.');
  const W=340,H=150,L=54,Rr=12,T=10,B=24,vals=pts.map(p=>p.eq),lo=Math.min(...vals,b0),hi=Math.max(...vals,b0),pd=(hi-lo)*.12||50,y0=lo-pd,y1=hi+pd;
  const X=i=>L+i/(pts.length-1)*(W-L-Rr),Y=v=>T+(1-(v-y0)/(y1-y0))*(H-T-B);
  const line=pts.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(p.eq).toFixed(1)}`).join('');
  const ticks=[y0+pd,(lo+hi)/2,hi-0].map(v=>Math.round(v/100)*100);
  const first=pts[1].t.date,last=pts.at(-1).t.date,up=eq.end>=b0;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity curve from ${fmtM(b0)} to ${fmtM(eq.end)}">
    ${ticks.map(v=>`<line x1="${L}" x2="${W-Rr}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${L-6}" y="${Y(v)+3}" text-anchor="end">${fmtM(v)}</text>`).join('')}
    <line x1="${L}" x2="${W-Rr}" y1="${Y(b0)}" y2="${Y(b0)}" style="stroke:var(--ink3)" stroke-dasharray="3 3"/>
    <path d="${line}L${X(pts.length-1)} ${H-B}L${X(0)} ${H-B}Z" style="fill:var(--ink);opacity:.12"/>
    <path d="${line}" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${X(pts.length-1)}" cy="${Y(eq.end)}" r="3.5" style="fill:var(--ink)"/>
    <text x="${L}" y="${H-6}">${fmtD(first)}</text><text x="${W-Rr}" y="${H-6}" text-anchor="end">${fmtD(last)}</text></svg>`;
}
function heatmap(mk){
  const [y,m]=mk.split('-').map(Number),startDow=(new Date(y,m-1,1).getDay()+6)%7,dim=new Date(y,m,0).getDate(),by={};
  closedT(moTrades(mk)).forEach(t=>{(by[t.date]??=[]).push(t)});
  const t0=TODAY();let cells='';
  for(let i=0;i<startDow;i++)cells+='<div class="c e"></div>';
  for(let d=1;d<=dim;d++){
    const ds=`${mk}-${pad(d)}`,ts=by[ds];
    if(ts){const r=sum(ts.map(t=>t.r)),mag=clamp(Math.abs(r)/3,.15,1),txt=`<span>${d}</span><b>${r>0.05?'+':r<-0.05?SG:''}${Math.abs(r).toFixed(1)}</b>`,lab=`aria-label="${fmtD(ds)} ${fmtR(r)}"`;
      if(r>0.05){const pc=Math.round(14+mag*76);cells+=`<div class="c ${ds===t0?'td':''}" style="background:color-mix(in srgb,var(--ink) ${pc}%,var(--surface2));color:${pc>46?'var(--surface)':'var(--ink)'}" ${lab}>${txt}</div>`}
      else if(r<-0.05){const gap=Math.round(11-mag*7);cells+=`<div class="c l ${ds===t0?'td':''}" style="background:repeating-linear-gradient(135deg,var(--ink) 0 1.4px,var(--surface) 1.4px ${gap}px)" ${lab}>${txt}</div>`}
      else cells+=`<div class="c ${ds===t0?'td':''}" style="color:var(--ink)" ${lab}>${txt}</div>`}
    else cells+=`<div class="c ${ds===t0?'td':''}" style="opacity:${[0,6].includes(new Date(y,m-1,d).getDay())?.4:1}"><span>${d}</span></div>`;
  }
  return `<div class="cal">${['M','T','W','T','F','S','S'].map(x=>`<div class="h">${x}</div>`).join('')}${cells}</div><div class="legend"><span><i class="solid-p"></i>Profit day, darker is larger</span><span><i class="hatch-l"></i>Loss day, denser is larger</span></div>`;
}
function suggestions(mk){
  const mt=moTrades(mk),M=moData(mk),min=S.settings.minSample,out=[];
  const ma=mistakeAgg(mt).filter(x=>x.n>=2).sort((a,b)=>a.r-b.r)[0];
  if(ma&&ma.r<0)out.push({id:'m-'+ma.id,text:`Limit “${ma.name}” to ${Math.ceil(ma.n/2)} or fewer next month`,why:`${ma.n} times this month, ${fmtR(ma.r)} in total.`});
  const g=groupBy(mt,t=>t.setup).filter(x=>x.n>=min);
  const weak=g.filter(x=>x.avgR<0).sort((a,b)=>a.netR-b.netR)[0];
  if(weak)out.push({id:'w-'+weak.k,text:`Pause or retest ${setupName(weak.k)} before trading it again`,why:`${weak.n} trades, ${fmtR(weak.avgR,2)} average, ${fmtP(weak.winRate)} win rate.`});
  const top=g.filter(x=>x.avgR>0).sort((a,b)=>b.netR-a.netR)[0];
  if(top)out.push({id:'t-'+top.k,text:`Take more ${setupName(top.k)} setups`,why:`${top.n} trades, ${fmtR(top.netR)} in total at ${fmtP(top.winRate)} win rate.`});
  return out.filter(s=>!M.dismissed.includes(s.id)&&!M.goals.some(x=>x.sid===s.id));
}
function viewMonth(){
  const mk=ui.mo,mt=moTrades(mk),st=stats(mt),M=moData(mk),b0=balanceBefore(mk+'-01'),eq=equity(mt,b0),ret=st.n?st.netPnl/b0*100:null;
  const isCur=mk===TODAY().slice(0,7),min=S.settings.minSample;
  const keyFn={setup:t=>t.setup,session:t=>t.session,pair:t=>t.instrument,weekday:t=>DOWF[parse(t.date).getDay()]}[ui.seg];
  const lab=k=>ui.seg==='setup'?setupName(k):k;
  const rows=groupBy(mt,keyFn).sort((a,b)=>((b.n>=min)-(a.n>=min))||(b.netR-a.netR));
  const topK=rows.filter(x=>x.n>=min&&x.netR>0)[0]?.k;
  const emo=groupBy(mt,t=>t.emoBefore||'none').filter(x=>x.k!=='none'&&x.n>=2).sort((a,b)=>b.avgR-a.avgR);
  const emx=Math.max(.5,...emo.map(x=>Math.abs(x.avgR)));
  const brk=stats(mt.filter(t=>t.ruleBreaks.length)),ok=stats(mt.filter(t=>!t.ruleBreaks.length));
  const sug=suggestions(mk);
  return `<div class="wrap">${hdr('Month',null)}
    <div class="nav"><button class="iconbtn" data-a="mon" data-v="-1" aria-label="Previous month">${ico('chevL')}</button><div class="lbl">${monthLabel(mk)}${isCur?'<br><span class="xs muted">Month to date</span>':''}${M.closed?' '+pill('Closed','good'):''}</div><button class="iconbtn" data-a="mon" data-v="1" ${isCur?'disabled':''} aria-label="Next month">${ico('chevR')}</button></div>
    <section class="card"><h2>Performance</h2>
      ${st.n?`<div class="tile hero"><span>Net P&L</span><b class="${sgn(st.netPnl)}">${fmtM(st.netPnl,true)}</b><span class="${sgn(ret)}" style="font-size:14px;font-weight:600">${ret>0?'+':ret<0?SG:''}${Math.abs(ret).toFixed(1)}% on ${fmtM(b0)}</span></div><div class="sp" style="height:8px"></div>
      <div class="tiles t3"><div class="tile"><b>${fmtPF(st.pf)}</b><span>Profit factor</span></div><div class="tile"><b>${fmtP(st.winRate)}</b><span>Win rate</span></div><div class="tile"><b>${st.n}</b><span>Trades</span></div>
        <div class="tile"><b class="${sgn(st.avgR)}">${fmtR(st.avgR,2)}</b><span>Expectancy</span></div><div class="tile"><b>${eq.dd.toFixed(1)}%</b><span>Max drawdown</span></div><div class="tile"><b>${S.settings.items.length?fmtP(st.rules):''}</b><span>Rules followed</span></div></div>
      <div class="tiles" style="margin-top:8px"><div class="tile"><span>Average win</span><b class="pos" style="font-size:18px">${fmtM(st.avgWin,true)}</b><span>${fmtR(st.avgWinR)}</span></div><div class="tile"><span>Average loss</span><b class="neg" style="font-size:18px">${fmtM(st.avgLoss)}</b><span>${fmtR(st.avgLossR)}</span></div></div>
      <div class="sp"></div><div class="lab" style="margin-bottom:6px">Equity</div>${equityChart(eq,b0)}<div class="sp"></div><div class="lab" style="margin-bottom:8px">Daily result in R</div>${heatmap(mk)}`:empty('No closed trades this month.')}
    </section>
    <section class="card"><h2>Edge refinement</h2>
      <div class="chips scroll">${[['setup','Setup'],['session','Session'],['pair','Pair'],['weekday','Weekday']].map(([v,l])=>chip(l,ui.seg===v,'seg',v)).join('')}</div>
      ${rows.length?rows.map(x=>{const q=x.n>=min;return `<div class="lb ${q?'':'dim'}"><div class="top"><b>${esc(lab(x.k))}</b><span class="tr ${q?sgn(x.netR):''}">${fmtR(x.netR)}</span></div><div class="sub">${x.n} trade${x.n>1?'s':''} · ${fmtP(x.winRate)} win · avg ${fmtR(x.avgR,2)} · PF ${fmtPF(x.pf)}</div><div class="fl">${q&&x.k===topK?pill('Top edge','good'):''}${q&&x.avgR<0?pill('Review or drop','bad'):''}${!q?pill('Under '+min+' trades','line'):''}</div></div>`}).join('')+`<p class="hint">Rows under ${min} trades are too few to judge. Change this in Settings.</p>`:empty('No closed trades this month.')}
    </section>
    <section class="card"><h2>Psychology</h2>
      ${emo.length?`<div class="lab" style="margin-bottom:6px">Average R by feeling before the trade</div><div class="bars">${emo.map(x=>{const w=Math.abs(x.avgR)/emx*50;return `<div class="b"><span>${esc(nameOf(EMOS,x.k))} <span class="faint">×${x.n}</span></span><div class="track"><i class="zero"></i><div class="fill ${x.avgR<0?'n':'p'}" style="${x.avgR<0?`right:50%;width:${w}%`:`left:50%;width:${w}%`}"></div></div><span class="v ${sgn(x.avgR)}">${fmtR(x.avgR,2)}</span></div>`}).join('')}</div><hr class="hr">`:''}
      ${st.n?`<div class="lab" style="margin-bottom:6px">Following rules vs breaking them</div>
      <div class="kv"><span>Followed all rules (${ok.n})</span><b class="${sgn(ok.netR)}">${fmtR(ok.netR)} · avg ${fmtR(ok.avgR,2)}</b></div>
      <div class="kv" style="margin-top:6px"><span>Broke a rule (${brk.n})</span><b class="${sgn(brk.netR)}">${brk.n?fmtR(brk.netR)+' · avg '+fmtR(brk.avgR,2):'—'}</b></div>`:empty('Psychology insights appear once trades are logged.')}
      <div class="sp"></div>${fld('Notes on my psychology this month',area('mo.psych',M.psych,'Patterns in how I felt and acted'))}
    </section>
    <section class="card"><h2>Action plan</h2>
      ${M.goals.length?`<div class="lab" style="margin-bottom:6px">Goals</div>${M.goals.map(g=>`<div class="scn"><div style="display:flex;gap:8px;justify-content:space-between"><span>${esc(g.text)}</span><button class="xbtn" data-a="rmGoal" data-v="${g.id}" aria-label="Remove goal">${ico('x','sm')}</button></div><div class="chips" style="margin-top:8px">${[['open','Open'],['met','Met'],['missed','Missed']].map(([v,l])=>chip(l,g.status===v,'goalst',g.id+':'+v,'','sm')).join('')}</div></div>`).join('')}`:''}
      ${sug.length?`<div class="lab" style="margin:${M.goals.length?'12px':'0'} 0 6px">Suggested from your data</div>${sug.map(s=>`<div class="scn"><b>${esc(s.text)}</b><p class="muted">${esc(s.why)}</p><div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm pri" data-a="goalAdd" data-v="${esc(s.id)}">Accept</button><button class="btn sm" data-a="goalNo" data-v="${esc(s.id)}">Dismiss</button></div></div>`).join('')}`:(M.goals.length?'':empty('Goals are suggested once the month has enough trades.'))}
      <hr class="hr">
      ${fld('Keep',area('mo.keep',M.keep,'What is working'))}<div class="sp"></div>${fld('Cut',area('mo.cut',M.cut,'What to stop doing'))}<div class="sp"></div>${fld('Change',area('mo.change',M.change,'What to try differently'))}
    </section>
    ${M.closed?`<div class="banner good"><div><b>Month closed</b>Snapshot saved.</div></div><button class="btn blk" data-a="reopenMonth">Reopen month</button>`:`<button class="btn pri blk" data-a="closeMonth" ${st.n?'':'disabled'}>Close month</button><p class="hint">Saves a snapshot of ${monthLabel(mk)} and carries your keep, cut and change lists forward.</p>`}
  </div>`;
}
/* ================= trade sheet ================= */
const outcomeOf=r=>r>0.05?'win':r<-0.05?'loss':'be';
function sheetCalc(d){
  const I=S.settings.instruments[d.instrument]||INST.EURUSD,bal=currentBalance(),rp=+d.riskPct>0?+d.riskPct:S.settings.riskPct,ra=bal*rp/100,sl=+d.slPips>0?+d.slPips:0;
  const lots=sl?Math.round(Math.floor(ra/(sl*I.pv)/0.01+1e-9))/100:0,actual=lots*sl*I.pv;
  return{bal,rp,ra,sl,lots,actual,actualPct:bal?actual/bal*100:0};
}
function sheetPrevHTML(){
  const s=ui.sheet,d=s.d;let lots,risk,rp,fees,ra;
  if(s.isNew){const c=sheetCalc(d);lots=c.lots;risk=c.actual;rp=c.actualPct;ra=Math.round(c.actual);fees=Math.round(lots*6)}
  else{lots=d.lots;risk=d.riskAmt;rp=d.riskPct;ra=d.riskAmt;fees=d.fees!=null?d.fees:Math.round(lots*6)}
  const r=parseFloat(d.r),has=!isNaN(r),pnl=has?Math.round(r*ra-fees):null;
  const oc=d.outcome||(has?outcomeOf(r):'');
  return `<div class="lab" style="margin:12px 0 6px">Tag</div><div class="chips">${[['win','Win'],['loss','Loss'],['be','Break-even']].map(([v,l])=>chip(l,oc===v,'so',v,'','sm')).join('')}</div>
    <div class="out"><div class="kv"><span class="muted">Size</span><b>${lots.toFixed(2)} lots · ${fmtM(risk)} (${rp.toFixed(2)}%)</b></div>
    <div class="kv"><span class="muted">P&L after ${fmtM(fees)} fees</span><b class="${sgn(pnl)}">${pnl==null?'—':fmtM(pnl,true)}</b></div></div>`;
}
function tradeSheet(s){
  const d=s.d,isNew=s.isNew,open=d.status==='open';
  const top=isNew?`<section class="card"><h2>Trade</h2>
      <div class="g2">${fld('Instrument',sel('sheet.d.instrument',instOpts(),d.instrument).replace('<select','<select data-r="1"'))}<div class="fld"><label>Direction</label><div class="seg in">${[['long','Long'],['short','Short']].map(([v,l])=>`<button class="${d.dir===v?'on':''}" data-a="sdir" data-v="${v}">${l}</button>`).join('')}</div></div></div>
      <div class="sp"></div><div class="g2">${fld('Stop loss (pips)',num('sheet.d.slPips',d.slPips,'data-live="sheetp"'))}${fld('Risk (%)',num('sheet.d.riskPct',d.riskPct,'data-live="sheetp"'))}</div></section>`
    :`<section class="card"><h2>Trade <span class="r muted">${fmtD(d.date)}</span></h2>
      <div class="kv"><span class="muted">Size</span><b>${d.lots.toFixed(2)} lots</b></div><div class="kv" style="margin-top:6px"><span class="muted">Stop</span><b>${d.slPips} pips</b></div>
      <div class="kv" style="margin-top:6px"><span class="muted">Risk</span><b>${fmtM(d.riskAmt)} · ${d.riskPct}%</b></div>
      ${d.slPrice?`<div class="kv" style="margin-top:6px"><span class="muted">Stop and target</span><b class="mono">${d.slPrice.toFixed(dpFor(d.instrument))} / ${d.tpPrice.toFixed(dpFor(d.instrument))}</b></div>`:''}</section>`;
  const emoRow=(k,l,v)=>`<div class="lab" style="margin:10px 0 6px">${l}</div><div class="chips">${EMOS.map(e=>chip(e.name,v===e.id,'semo',k+':'+e.id,'','sm')).join('')}</div>`;
  const brk=d.ruleBreaks.length?`<section class="card"><h2>Rule breaks</h2><div class="chips">${d.ruleBreaks.map(b=>pill(esc(itemLabel(b)),'bad')).join('')}</div>${d.overrideReason?`<p class="hint">Reason given: ${esc(d.overrideReason)}</p>`:''}</section>`:'';
  const ck=d.checks&&Object.keys(d.checks).length?`<section class="card"><h2>Checklist at entry</h2><div class="chips">${S.settings.items.map(i=>`<span class="pill ${d.checks[i.id]?'good':'line'}">${d.checks[i.id]?'✓ ':''}${esc(i.label)}</span>`).join('')}</div></section>`:'';
  return `<div class="grab"></div>
  <div class="sh"><h2>${isNew?'New trade':open?'Close trade':esc(d.instrument)+' '+(d.dir==='long'?'▲ Long':'▼ Short')}</h2><button class="iconbtn" data-a="sclose" aria-label="Close">${ico('x')}</button></div>
  <div class="stack">
    ${top}
    <section class="card"><h2>Result</h2>
      <div class="chips">${[[-1,SG+'1R'],[0,'BE'],[1,'+1R'],[2,'+2R'],[3,'+3R']].map(([v,l])=>chip(l,d.r!==null&&d.r!==''&&parseFloat(d.r)===v,'sr',v)).join('')}</div>
      <div class="sp"></div>${fld('Result in R',num('sheet.d.r',d.r===null?'':d.r,'data-live="sheetp" placeholder="1.5"'))}
      <div id="sheetPrev">${sheetPrevHTML()}</div>
    </section>
    <section class="card"><h2>Setup and grade</h2>
      <div class="lab" style="margin-bottom:6px">Setup</div><div class="chips">${SETUPS.map(x=>chip(x.name,d.setup===x.id,'ssetup',x.id,'','sm')).join('')}</div>
      <div class="lab" style="margin:10px 0 6px">Session</div><div class="chips">${SESSIONS.map(x=>chip(x,d.session===x,'ssess',x,'','sm')).join('')}</div>
      <div class="lab" style="margin:10px 0 6px">Execution grade</div><div class="chips">${GRADES.map(g=>chip(g,d.grade===g,'sg',g,'','sm')).join('')}</div>
    </section>
    <section class="card"><h2>How I felt</h2>${emoRow('b','Before',d.emoBefore)}${emoRow('d','During',d.emoDuring)}${emoRow('a','After',d.emoAfter)}</section>
    <section class="card"><h2>Mistakes</h2><div class="chips">${MISTAKES.map(m=>chip(m.name,d.mistakes.includes(m.id),'smk',m.id,'','sm')).join('')}</div></section>
    ${brk}${ck}
    <section class="card"><h2>Screenshots <span class="r muted">${d.shots.length} of 6</span></h2>
      <div class="shots">${d.shots.map(x=>`<div class="thumb">${x.demo?chartSVG(d,x.kind):`<img data-shot="${x.id}" alt="Trade screenshot">`}<button class="x" data-a="shotdel" data-v="${x.id}" aria-label="Remove screenshot">${ico('x','sm')}</button></div>`).join('')}
      ${d.shots.length<6?`<label class="addshot">${ico('image')}<span>Add screenshot</span><input type="file" accept="image/*" hidden data-file="shot"></label>`:''}</div>
    </section>
    <section class="card"><h2>Notes</h2>${fld('What happened',area('sheet.d.notes',d.notes,'Entry reason, management, result'))}<div class="sp"></div>${fld('What I would do differently',area('sheet.d.lesson',d.lesson,'One thing'))}</section>
  </div>
  <div class="ft">${isNew?'':`<button class="btn ${ui.confirm==='del'?'dng':''}" data-a="sdel" style="flex:0 0 auto">${ui.confirm==='del'?'Tap again to delete':'Delete'}</button>`}<button class="btn pri" data-a="ssave">${isNew?'Add trade':open&&d.r!==null&&d.r!==''?'Close trade':'Save'}</button></div>`;
}
function overrideSheet(){
  return `<div class="grab"></div><div class="sh"><h2>Override the gates</h2><button class="iconbtn" data-a="sclose" aria-label="Close">${ico('x')}</button></div>
  <div class="banner warn"><div><b>Gates off</b>${gateMissing().map(i=>esc(i.label)).join(', ')||'None'}</div></div>
  ${fld('Why are you taking it anyway?',area('form.ovr',ui.form.ovr||'','Be specific. This is saved on the trade and counts as a rule break.'))}
  <div class="ft"><button class="btn" data-a="sclose">Cancel</button><button class="btn pri" data-a="ovrOk">Open trade</button></div>`;
}
function settingsSheet(){
  const s=S.settings,c=ui.confirm;
  const two=(k,label,cls='')=>`<button class="btn blk ${c===k?'dng':''} ${cls}" data-a="${k}">${c===k?'Tap again to confirm':label}</button>`;
  return `<div class="grab"></div><div class="sh"><h2>Settings</h2><button class="iconbtn" data-a="sclose" aria-label="Close">${ico('x')}</button></div>
  <div class="stack">
    <section class="card"><h2>Risk rules</h2>
      <div class="g2">${fld('Risk per trade (%)',num('settings.riskPct',s.riskPct))}${fld('Daily risk cap (%)',num('settings.dailyCap',s.dailyCap))}</div><div class="sp"></div>
      <div class="g2">${fld('Max trades per day',num('settings.maxTrades',s.maxTrades))}${fld('Cool-down after a loss (min)',num('settings.cooldown',s.cooldown))}</div><div class="sp"></div>
      <div class="g2">${fld('Starting balance ($)',num('settings.startBal',s.startBal))}${fld('Trades to judge a setup',num('settings.minSample',s.minSample))}</div>
    </section>
    <section class="card"><h2>Checklist gates</h2><p class="sm muted">A gate must be on before Open trade is enabled.</p>
      ${s.items.map(i=>`<div class="row"><div class="grow">${esc(i.label)}<span class="auto-tag">${i.group==='setup'?'Setup':'Rule'}</span></div>${sw(i.gate,'gate',i.id)}</div>`).join('')}
    </section>
    <section class="card"><h2>Pip value per lot ($)</h2><div class="g2">${Object.keys(s.instruments).map(k=>fld(k,num('settings.instruments.'+k+'.pv',s.instruments[k].pv))).join('')}</div></section>
    <section class="card"><h2>Your data</h2>
      <p class="sm muted" style="margin-bottom:10px">${S.sample?'You are looking at sample data. Start fresh to begin with an empty journal.':'Everything is stored on this device. Nothing is uploaded.'}</p>
      ${installEv?'<button class="btn pri blk" data-a="install" style="margin-bottom:8px">Install app on this device</button>':''}
      <button class="btn blk" data-a="copyCsv">Copy trades as CSV</button>
      ${two('fresh','Start fresh and erase everything')}
      ${two('loadSample','Load sample data')}
    </section>
  </div>
  <div class="ft"><button class="btn pri" data-a="sclose">Done</button></div>`;
}
const sheetHTML=()=>`<div class="ov"><div class="sheet" role="dialog" aria-modal="true">${ui.sheet.type==='trade'?tradeSheet(ui.sheet):ui.sheet.type==='settings'?settingsSheet():overrideSheet()}</div></div>`;

/* ================= render and events ================= */
const VIEWS={today:viewToday,plan:viewPlan,journal:viewJournal,week:viewWeek,month:viewMonth};
function hydrate(){$$('img[data-shot]').forEach(async im=>{if(im.getAttribute('src'))return;const u=await shotURL(im.dataset.shot);if(u)im.src=u})}
function render(){
  const y=window.scrollY,sh=$('.sheet'),sy=sh?sh.scrollTop:0;
  $('#app').innerHTML=VIEWS[ui.tab]()+tabbar()+(['today','plan','journal'].includes(ui.tab)&&!ui.sheet?`<button class="fab" data-a="newTrade">${ico('plus')} Trade</button>`:'')+(ui.sheet?sheetHTML():'');
  document.body.classList.toggle('lock',!!ui.sheet);
  window.scrollTo(0,y);const s2=$('.sheet');if(s2)s2.scrollTop=sy;
  hydrate();
}
function toast(m){
  $$('.toast').forEach(x=>x.remove());
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2400);
}
let saveT=0;const saveSoon=()=>{clearTimeout(saveT);saveT=setTimeout(save,250)};
const ROOTS={calc:()=>S.calc,settings:()=>S.settings,sheet:()=>ui.sheet,day:()=>day(TODAY()),wk:()=>wkData(ui.wk),mo:()=>moData(ui.mo),form:()=>ui.form,jf:()=>ui.jf};
function assign(el){
  const path=el.dataset.k.split('.');let o=ROOTS[path[0]]();
  for(let i=1;i<path.length-1;i++)o=o[path[i]];
  const key=path.at(-1);let v=el.value;
  if(path[0]==='settings'){const n=parseFloat(String(v).replace(',','.'));if(!isNaN(n)&&n>=0)o[key]=n;else return}
  else o[key]=v;
  if(path[0]==='sheet'&&key==='r'){const r=parseFloat(v);if(!ui.sheet.d.outcomeManual&&!isNaN(r))ui.sheet.d.outcome=outcomeOf(r)}
  if(path[0]==='jf'){ui.jlimit=25}
  saveSoon();
}
const LIVE={
  calc(){const a=$('#liveDisc'),b=$('#liveOut'),c=$('#liveOpen');if(a)a.innerHTML=discCard();if(b)b.innerHTML=calcOutHTML();if(c)c.innerHTML=openBox()},
  sheetp(){const p=$('#sheetPrev');if(p)p.innerHTML=sheetPrevHTML();
    const rc=$$('.sheet .chips .chip[data-a="sr"]');const r=parseFloat(ui.sheet.d.r);rc.forEach(c=>{const on=!isNaN(r)&&parseFloat(c.dataset.v)===r;c.classList.toggle('on',on);c.setAttribute('aria-pressed',on)})},
  jq(){const l=$('#jlist');if(l){l.innerHTML=journalList();hydrate()}}
};
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.k)return;assign(el);if(el.dataset.live&&LIVE[el.dataset.live])LIVE[el.dataset.live]()});
document.addEventListener('change',e=>{
  const el=e.target;if(!el.dataset)return;
  if(el.dataset.k){assign(el);save();if(el.dataset.r)render()}
  else if(el.dataset.file==='shot')addShot(el);
});
document.addEventListener('click',e=>{
  if(e.target.classList&&e.target.classList.contains('ov')){closeSheet();return}
  const el=e.target.closest('[data-a]');if(!el)return;
  const fn=A[el.dataset.a];if(fn){const keep=el.dataset.a==='sdel'||el.dataset.a==='fresh'||el.dataset.a==='loadSample';if(!keep)ui.confirm='';fn(el.dataset,el)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.sheet)closeSheet()});
const closeSheet=()=>{ui.sheet=null;ui.confirm='';save();render()};
const go=(tab)=>{ui.tab=tab;ui.form={};try{localStorage.setItem(KEY+'.tab',tab)}catch(e){}render();window.scrollTo(0,0)};

/* ================= domain actions ================= */
function openTradeNow(reason){
  const c=calcOut(),cm=checkMap(),failed=S.settings.items.filter(i=>!cm[i.id]),t0=TODAY(),dp=c.I.dp;
  const breaks=failed.filter(i=>i.group==='rule').map(i=>i.id);
  S.trades.push({id:uid(),date:t0,ts:Date.now(),instrument:S.calc.inst,dir:S.calc.dir,setup:S.calc.setup,session:guessSession(),status:'open',
    slPips:c.sl,lots:c.lots,riskPct:+c.actualPct.toFixed(2),riskAmt:Math.round(c.actual),balance:Math.round(c.bal),
    entry:parseFloat(S.calc.entry)||null,slPrice:c.slPrice,tpPrice:c.tpPrice,rr:c.rr,
    r:null,pnl:null,outcome:null,fees:null,grade:'',emoBefore:day(t0).emoStart||'',emoDuring:'',emoAfter:'',mistakes:[],
    ruleBreaks:breaks,overrideReason:reason||'',checks:cm,rules:1-breaks.length/5,shots:[],notes:'',lesson:''});
  S.trades.sort((a,b)=>a.ts-b.ts);day(t0).check={};save();
}
function saveTrade(){
  const s=ui.sheet,d=s.d,hasR=d.r!==null&&d.r!==''&&!isNaN(parseFloat(d.r));
  if(s.isNew&&!hasR){toast('Enter the result in R first.');return}
  if(s.isNew){const c=sheetCalc(d);if(!(c.lots>0)){toast('Enter a stop loss so the lot size can be worked out.');return}
    Object.assign(d,{slPips:c.sl,lots:c.lots,riskAmt:Math.round(c.actual),balance:Math.round(c.bal),riskPct:+c.actualPct.toFixed(2),status:'closed',closedTs:Date.now(),fees:Math.round(c.lots*6)})}
  if(hasR){
    d.r=parseFloat(d.r);if(d.fees==null)d.fees=Math.round(d.lots*6);
    d.pnl=Math.round(d.r*d.riskAmt-d.fees);if(!d.outcome)d.outcome=outcomeOf(d.r);
    if(d.status==='open'){d.status='closed';d.closedTs=Date.now()}
  }else d.r=null;
  if(d.rules==null)d.rules=1-d.ruleBreaks.length/5;
  delete d.outcomeManual;
  const i=S.trades.findIndex(x=>x.id===d.id);
  if(i>=0)S.trades[i]=d;else S.trades.push(d);
  S.trades.sort((a,b)=>a.ts-b.ts);
  const msg=s.isNew?'Trade added':hasR&&d.status==='closed'?'Trade saved':'Saved';
  ui.sheet=null;save();render();toast(msg);
}
async function addShot(el){
  const f=el.files&&el.files[0];if(!f||!ui.sheet)return;
  try{const b=await fileToBlob(f),id='u'+uid();await IDB.put(id,b);ui.sheet.d.shots.push({id,kind:'entry',cap:''});render()}
  catch(e){toast('That image could not be read.')}
}
function csv(){
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const head=['date','instrument','direction','setup','session','status','lots','risk_pct','r','pnl','outcome','grade','mistakes','rule_breaks','notes'];
  return [head.join(','),...S.trades.map(t=>[t.date,t.instrument,t.dir,setupName(t.setup),t.session,t.status,t.lots,t.riskPct,t.r,t.pnl,t.outcome,t.grade,t.mistakes.map(m=>nameOf(MISTAKES,m)).join('; '),t.ruleBreaks.map(itemLabel).join('; '),t.notes].map(q).join(','))].join('\n');
}
function bootDefaults(){
  const t0=TODAY(),dom=+t0.slice(8),pm=addMonths(t0.slice(0,7),-1);
  ui.wk=weekStart(t0);ui.mo=dom<=14&&closedT(moTrades(pm)).length>=10?pm:t0.slice(0,7);
}
const freshState=()=>({v:1,sample:false,settings:S.settings,trades:[],days:{},weeks:{},months:{},calc:{inst:'EURUSD',dir:'long',sl:'',risk:'',bal:'',entry:'',rr:2,setup:'sweep'}});
const toggleIn=(arr,v)=>{const i=arr.indexOf(v);i>=0?arr.splice(i,1):arr.push(v)};

const A={
  tab:d=>go(d.v),
  step:d=>{ui.step=d.v;ui.form={};render()},
  gostep:d=>{ui.step=d.v;go('plan')},
  gomonth:d=>{ui.mo=d.v;go('month')},
  settings:()=>{ui.sheet={type:'settings'};render()},
  sclose:closeSheet,
  chk:d=>{const c=day(TODAY()).check;c[d.v]=!c[d.v];save();render()},
  star:d=>{const x=day(TODAY());x.star[d.v]=!x.star[d.v];save();render()},
  frm:d=>{ui.form[d.v]=!ui.form[d.v];render()},
  evimp:d=>{ui.form.evimp=d.v;render()},
  addEv:()=>{const F=ui.form,x=day(TODAY());if(!(F.evtitle||'').trim()){toast('Give the event a name.');return}
    const [h,m]=(F.evtime||'09:00').split(':').map(Number);
    x.events.push({id:uid(),min:h*60+m,cur:F.evcur||'USD',title:F.evtitle.trim(),impact:F.evimp||'m',fc:'',prev:''});
    F.evtitle='';F.ev=false;save();render()},
  addLevel:()=>{const F=ui.form,x=day(TODAY());if(!(parseFloat(F.lvprice)>0)){toast('Enter a price.');return}
    x.levels.push({id:uid(),inst:F.lvinst||S.calc.inst,price:F.lvprice.trim(),type:F.lvtype||LEVELS[0],note:(F.lvnote||'').trim()});
    touchPlan(x);F.lvprice='';F.lvnote='';F.lv=false;save();render()},
  rmLevel:d=>{const x=day(TODAY());x.levels=x.levels.filter(l=>l.id!==d.v);touchPlan(x);save();render()},
  addScen:()=>{const F=ui.form,x=day(TODAY());if(!(F.scif||'').trim()||!(F.scthen||'').trim()){toast('Fill in the if and the then.');return}
    x.scen.push({id:uid(),inst:F.scinst||S.calc.inst,bias:F.scbias||'Bullish',if_:F.scif.trim(),then_:F.scthen.trim(),inv:(F.scinv||'').trim()||'a close beyond the level',result:''});
    touchPlan(x);F.scif=F.scthen=F.scinv='';F.sc=false;save();render()},
  rmScen:d=>{const x=day(TODAY());x.scen=x.scen.filter(s=>s.id!==d.v);touchPlan(x);save();render()},
  planReady:()=>{const x=day(TODAY());x.planReady=true;x.planTs=Date.now();x.planEdits=0;save();render();toast('Plan locked')},
  unlockPlan:()=>{day(TODAY()).planReady=false;save();render()},
  cs:d=>{S.calc.setup=d.v;save();render()},
  cd:d=>{S.calc.dir=d.v;save();render()},
  rr:d=>{S.calc.rr=+d.v;save();render()},
  openTrade:()=>{openTradeNow('');ui.step='log';render();toast('Trade opened. Close it from the Log step.')},
  override:()=>{ui.form.ovr='';ui.sheet={type:'override'};render()},
  ovrOk:()=>{const r=(ui.form.ovr||'').trim();if(!r){toast('Add the reason first.');return}
    openTradeNow(r);ui.sheet=null;ui.step='log';render();toast('Trade opened with an override')},
  emo:d=>{const [k,v]=d.v.split(':'),x=day(TODAY()),f=k==='start'?'emoStart':'emoEnd';x[f]=x[f]===v?'':v;save();render()},
  adh:d=>{const x=day(TODAY());x.adherence=x.adherence===+d.v?0:+d.v;save();render()},
  scres:d=>{const [id,v]=d.v.split(':'),s=day(TODAY()).scen.find(x=>x.id===id);if(s){s.result=s.result===v?'':v;save();render()}},
  closeDay:()=>{day(TODAY()).closed=true;save();render();toast('Day closed')},
  reopenDay:()=>{day(TODAY()).closed=false;save();render()},
  jo:d=>{ui.jf.o=d.v;ui.jlimit=25;render()},
  jmore:()=>{ui.jlimit+=25;render()},
  trade:d=>{const t=S.trades.find(x=>x.id===d.id);ui.sheet={type:'trade',isNew:false,d:JSON.parse(JSON.stringify(t))};ui.confirm='';render()},
  newTrade:()=>{const c=S.calc;ui.sheet={type:'trade',isNew:true,d:{id:uid(),date:TODAY(),ts:Date.now(),instrument:c.inst,dir:c.dir,setup:c.setup||'sweep',session:guessSession(),status:'closed',
    slPips:c.sl||'',riskPct:S.settings.riskPct,r:null,outcome:'',fees:null,grade:'',emoBefore:'',emoDuring:'',emoAfter:'',mistakes:[],ruleBreaks:[],overrideReason:'',checks:{},shots:[],notes:'',lesson:'',rules:1}};render()},
  sdir:d=>{ui.sheet.d.dir=d.v;render()},
  ssetup:d=>{ui.sheet.d.setup=d.v;render()},
  ssess:d=>{ui.sheet.d.session=d.v;render()},
  sg:d=>{const x=ui.sheet.d;x.grade=x.grade===d.v?'':d.v;render()},
  semo:d=>{const [k,v]=d.v.split(':'),x=ui.sheet.d,f={b:'emoBefore',d:'emoDuring',a:'emoAfter'}[k];x[f]=x[f]===v?'':v;render()},
  smk:d=>{toggleIn(ui.sheet.d.mistakes,d.v);render()},
  sr:d=>{const x=ui.sheet.d;x.r=+d.v;if(!x.outcomeManual)x.outcome=outcomeOf(+d.v);render()},
  so:d=>{const x=ui.sheet.d;x.outcome=d.v;x.outcomeManual=true;render()},
  shotdel:d=>{const x=ui.sheet.d;x.shots=x.shots.filter(s=>s.id!==d.v);render()},
  ssave:saveTrade,
  sdel:()=>{if(ui.confirm!=='del'){ui.confirm='del';render();return}
    S.trades=S.trades.filter(t=>t.id!==ui.sheet.d.id);ui.sheet=null;ui.confirm='';save();render();toast('Trade deleted')},
  gate:d=>{const i=S.settings.items.find(x=>x.id===d.v);i.gate=!i.gate;save();render()},
  copyCsv:()=>{const txt=csv();
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('CSV copied')).catch(()=>toast('Copy was blocked on this device'))},
  fresh:()=>{if(ui.confirm!=='fresh'){ui.confirm='fresh';render();return}
    S=freshState();ui.sheet=null;ui.confirm='';bootDefaults();save();render();toast('Started fresh')},
  loadSample:()=>{if(ui.confirm!=='loadSample'){ui.confirm='loadSample';render();return}
    S=seed();ui.sheet=null;ui.confirm='';bootDefaults();save();render();toast('Sample data loaded')},
  /* weekly */
  wkn:d=>{const n=addDays(ui.wk,7*+d.v);if(n<=weekStart(TODAY())){ui.wk=n;ui.form={};render();window.scrollTo(0,0)}},
  wstep:d=>{ui.wstep=+d.v;ui.form={};render();window.scrollTo(0,0)},
  wgrade:d=>{const W=wkData(ui.wk);W.gradeFinal=d.v;save();render()},
  tagm:d=>{const [id,m]=d.v.split(':'),t=S.trades.find(x=>x.id===id);if(t){toggleIn(t.mistakes,m);save();render()}},
  lsre:d=>{ui.form.lsre=d.v;render()},
  addLs:()=>{const F=ui.form,W=wkData(ui.wk);W.levelStudies.push({id:uid(),inst:F.lsinst||S.calc.inst,type:F.lstype||LEVELS[0],reaction:F.lsre||'held',note:(F.lsnote||'').trim()});F.lsnote='';F.ls=false;save();render()},
  rmLs:d=>{const W=wkData(ui.wk);W.levelStudies=W.levelStudies.filter(x=>x.id!==d.v);save();render()},
  btv:d=>{ui.form.btv=d.v;render()},
  addBt:()=>{const F=ui.form,W=wkData(ui.wk);if(!(+F.btn>0)||!(+F.btwr>=0&&F.btwr!=='')){toast('Add the sample size and win rate.');return}
    W.tests.push({id:uid(),setup:F.btsetup||'sweep',inst:F.btinst||S.calc.inst,tf:F.bttf||'M15',period:(F.btper||'').trim()||'Not set',n:+F.btn,wr:+F.btwr,avgR:+F.btavg||0,dd:+F.btdd||0,verdict:F.btv||'refine',note:(F.btnote||'').trim()});
    F.btn=F.btwr=F.btavg=F.btdd=F.btnote=F.btper='';F.bt=false;save();render()},
  rmBt:d=>{const W=wkData(ui.wk);W.tests=W.tests.filter(x=>x.id!==d.v);save();render()},
  closeWeek:()=>{const W=wkData(ui.wk),trs=wkTrades(ui.wk),ag=autoGrade(trs);W.closed=true;W.closedAt=Date.now();W.snapshot={...stats(trs),grade:W.gradeFinal||(ag?ag.letter:'')};
    if(W.gradeFinal&&ag&&W.gradeFinal!==ag.letter&&!(W.gradeReason||'').trim()){W.closed=false;toast('Say why your grade differs from the formula.');ui.wstep=1;render();return}
    save();render();toast('Week closed')},
  reopenWeek:()=>{wkData(ui.wk).closed=false;save();render()},
  /* monthly */
  mon:d=>{const n=addMonths(ui.mo,+d.v);if(n<=TODAY().slice(0,7)){ui.mo=n;render();window.scrollTo(0,0)}},
  seg:d=>{ui.seg=d.v;render()},
  goalAdd:d=>{const M=moData(ui.mo),s=suggestions(ui.mo).find(x=>x.id===d.v);if(s){M.goals.push({id:uid(),sid:s.id,text:s.text,status:'open'});save();render()}},
  goalNo:d=>{moData(ui.mo).dismissed.push(d.v);save();render()},
  goalst:d=>{const [id,v]=d.v.split(':'),g=moData(ui.mo).goals.find(x=>x.id===id);if(g){g.status=v;save();render()}},
  rmGoal:d=>{const M=moData(ui.mo);M.goals=M.goals.filter(x=>x.id!==d.v);save();render()},
  closeMonth:()=>{const M=moData(ui.mo);M.closed=true;M.closedAt=Date.now();M.snapshot=stats(moTrades(ui.mo));save();render();toast('Month closed')},
  reopenMonth:()=>{moData(ui.mo).closed=false;save();render()}
};

/* ================= install prompt (only fires when served over https) ================= */
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;if(!ui.sheet)render()});
window.addEventListener('appinstalled',()=>{installEv=null;render();toast('App installed')});
A.install=async()=>{if(!installEv)return;installEv.prompt();try{await installEv.userChoice}catch(e){}installEv=null;render()};

/* ================= boot ================= */
bootDefaults();
let bootDay=TODAY();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&TODAY()!==bootDay){bootDay=TODAY();bootDefaults();render()}});
render();


/* ===== offline support: register the service worker (only on http/https) ===== */
if('serviceWorker' in navigator && false){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});
}
