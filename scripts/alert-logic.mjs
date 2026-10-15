/* Stjerneradar V1.1 - pure alert decisions, shared with regression tests. */
import {clampLocation,findWindows,alertEligibility,canDispatchPush,localNightKey,localDate,formatClock,formatDate} from '../core.js';
import {createHash} from 'node:crypto';

const MODES=new Set(['eyes','binoculars','planets','deep']);
const LIGHTS=new Set(['unknown','urban','suburban','rural']);
const str=v=>typeof v==='string'?v.trim():'';
export function parseConfig(value){
  if(!value)throw Error('GitHub Secret STJERNERADAR_CONFIG mangler. Kopier JSON fra appens Indstillinger.');
  let x;try{x=typeof value==='string'?JSON.parse(value):value;}catch{throw Error('STJERNERADAR_CONFIG er ikke gyldig JSON.');}
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('STJERNERADAR_CONFIG skal være et JSON-objekt.');
  const loc=x.location||{};
  const {lat,lon}=clampLocation(loc.lat,loc.lon);
  const tz=str(loc.tz)||'Europe/Copenhagen';
  try{new Intl.DateTimeFormat('en-GB',{timeZone:tz});}catch{throw Error('Ugyldig tidszone i STJERNERADAR_CONFIG.');}
  const threshold=Number(x.threshold??80),minHours=Number(x.minHours??1);
  if(!Number.isInteger(threshold)||threshold<60||threshold>95)throw Error('Indeksgrænse skal være mellem 60 og 95.');
  if(!Number.isInteger(minHours)||minHours<1||minHours>3)throw Error('Mindste antal timer skal være 1, 2 eller 3.');
  return {
    location:{lat,lon,tz,name:str(loc.name).slice(0,60)||'Mit observationssted',light:LIGHTS.has(loc.light)?loc.light:'unknown'},
    alertId:/^[A-Za-z0-9_-]{8,128}$/.test(x.alertId||'')?x.alertId:'',
    mode:MODES.has(x.mode)?x.mode:'eyes',threshold,minHours,
    notify:{early:x.notify?.early!==false,late:x.notify?.late!==false,
      clearing:x.notify?.clearing!==false,events:x.notify?.events!==false}
  };
}
export function fingerprint(config){return createHash('sha256').update((config.alertId||'')+':'+JSON.stringify(config.location)).digest('hex').slice(0,16);}
export function initialState(config){return {schema:1,siteKey:fingerprint(config),sent:{},snapshots:{},lastSnapshotAt:0,tle:null};}
export function normalizeState(input,config){
  const s=input&&typeof input==='object'&&input.schema===1?input:initialState(config);
  if(s.siteKey!==fingerprint(config))return initialState(config);
  return {...initialState(config),...s,sent:s.sent&&typeof s.sent==='object'?s.sent:{},
    snapshots:s.snapshots&&typeof s.snapshots==='object'?s.snapshots:{}};
}
export function clearExpiredState(state,now){
 for(const [k,v] of Object.entries(state.sent))if(!v?.at||now-v.at>21*86400000)delete state.sent[k];
 for(const [k,v] of Object.entries(state.snapshots))if(!v?.checkedAt||now-v.checkedAt>12*3600000||Number(k)<now-3600000||Number(k)>now+48*3600000)delete state.snapshots[k];
}
export function saveSnapshots(state,hours,now){
  clearExpiredState(state,now);
  for(const h of hours.filter(x=>x.time>=now-3600000&&x.time<now+48*3600000)){
    if(Number.isFinite(h.rating?.score))state.snapshots[h.time]={score:h.rating.score,checkedAt:now};
  }
  state.lastSnapshotAt=now;
}
export function ordinaryCount(state,now,tz){const today=localDate(now,tz);
 return Object.values(state.sent).filter(e=>e.date===today&&['early','late','clearing'].includes(e.kind)).length;
}
export function specialCount(state,now,tz){const today=localDate(now,tz);
 return Object.values(state.sent).filter(e=>e.date===today&&e.kind==='event').length;
}
export function markSent(state,alert,now,tz){state.sent[alert.key]={kind:alert.kind,at:now,date:localDate(now,tz)};}
export function readyToSend(state,alert,now,tz){
 if(state.sent[alert.key]||!canDispatchPush(now,tz))return false;
 if(alert.kind==='test')return true;
 return (alert.kind==='event'?specialCount(state,now,tz)<2:ordinaryCount(state,now,tz)<2);
}
export function proposeAlerts({config,state,now,hours,meteors=[],iss=[],eclipses=[],comets=[]}){
 const tz=config.location.tz,name=config.location.name,nightTime=t=>localNightKey(t,tz);
 if(!canDispatchPush(now,tz))return [];
 const windows=findWindows(hours.filter(x=>x.time>=now-3600000&&x.time<=now+36*3600000),config.threshold,config.minHours)
   .filter(w=>w.end>now&&w.start>=now).sort((a,b)=>a.start-b.start);
 const alerts=[];
 for(const window of windows){
  const timeText=`${formatDate(window.start,tz)} kl. ${formatClock(window.start,tz)}–${formatClock(window.end,tz)}`;
  for(const kind of ['late','early']){
   if(!config.notify[kind])continue;
   const a=alertEligibility({now,scheduledFor:now,timezone:tz,kind,windowStart:window.start,
    windowEnd:window.end,windowScore:window.score,windowHours:window.lengthHours,
    minimumHours:config.minHours,threshold:config.threshold,ageMinutes:0});
   if(!a.ok)continue;
   alerts.push({kind,key:`${state.siteKey}:${nightTime(window.start)}:${kind}`,
     title:kind==='early'?'Stjerneradar · God stjernenat på vej':'Stjerneradar · Snart klart',
     body:`${name}: Stjerneindeks ${window.score}/100. Bedste vindue kl. ${timeText}. Prognosen kan ændre sig.`,tab:'today',when:window.start,priority:kind==='late'?3:1});
  }
  if(config.notify.clearing&&window.start-now<=3*3600000){
   const old=state.snapshots[String(window.start)];
   if(old&&now-old.checkedAt<12*3600000&&old.score<=config.threshold-20&&window.score>=config.threshold){
    alerts.push({kind:'clearing',key:`${state.siteKey}:${nightTime(window.start)}:clearing`,
     title:'Stjerneradar · Uventet opklaring',body:`${name}: Bedre forhold end tidligere ventet! Stjerneindeks ${window.score}/100 fra kl. ${formatClock(window.start,tz)}.`,
     tab:'today',when:window.start,priority:4});
   }
  }
 }
 if(config.notify.events){
  const eventThreshold=Math.max(60,config.threshold-10);
  for(const m of meteors){
   if(m.time-now<12*3600000||m.time-now>36*3600000)continue;
   const possible=hours.filter(h=>Math.abs(h.time-m.time)<18*3600000&&h.rating?.sunAlt<-12&&h.rating?.score>=eventThreshold);
   if(!possible.length)continue;
   alerts.push({kind:'event',key:`${state.siteKey}:meteor:${m.id}`,title:`Stjerneradar · ${m.name}`,
     body:`Meteorregn omkring ${formatDate(m.time,tz)}. ${name}: en lovende nat med stjerneindeks op til ${Math.max(...possible.map(h=>h.rating.score))}/100. Maksimumsdato er vejledende.`,
     when:m.time,tab:'events',priority:2});
  }
  for(const i of iss){
   if(i.peak-now<30*60000||i.peak-now>120*60000)continue;
   const nearest=hours.reduce((best,h)=>Math.abs(h.time-i.peak)<Math.abs((best?.time??0)-i.peak)?h:best,null);
   if(!nearest||nearest.clouds>40||nearest.fog>50||(nearest.precipitation??0)>0.2)continue;
   alerts.push({kind:'event',key:`${state.siteKey}:iss:${Math.round(i.peak/600000)}`,
     title:'Stjerneradar · ISS på himlen',body:`Mulig belyst ISS-passage over ${name} omkring kl. ${formatClock(i.peak,tz)}. Skydække ca. ${Math.round(nearest.clouds)} %.`,
     when:i.peak,tab:'events',priority:4});
  }
  for(const e of [...eclipses,...comets]){
   if(e.time-now<12*3600000||e.time-now>36*3600000||!e.verified)continue;
   const nearest=hours.reduce((best,h)=>Math.abs(h.time-e.time)<Math.abs((best?.time??0)-e.time)?h:best,null);
   if(!nearest||nearest.clouds>40)continue;
   // Daytime solar eclipses are possible; do not require astronomical darkness for these.
   if(e.type==='comet'&&nearest.rating?.score<eventThreshold)continue;
   alerts.push({kind:'event',key:`${state.siteKey}:${e.type}:${e.id}`,title:`Stjerneradar · ${e.name}`,
     body:`${name}: Mulig observation ${formatDate(e.time,tz)} kl. ${formatClock(e.time,tz)}. Forventet skydække ${Math.round(nearest.clouds)} %. Kontroller sikkerhed og lokal synlighed.`,
     when:e.time,tab:'events',priority:3});
  }
 }
 const priority={clearing:0,late:1,event:2,early:3};
 const uniques=new Set();
 return alerts.sort((a,b)=>priority[a.kind]-priority[b.kind]||b.priority-a.priority||a.when-b.when)
  .filter(a=>{if(uniques.has(a.key))return false;uniques.add(a.key);return readyToSend(state,a,now,tz);});
}
