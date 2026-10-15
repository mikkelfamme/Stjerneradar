import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig,initialState,normalizeState,proposeAlerts,markSent,readyToSend,saveSnapshots,ordinaryCount,specialCount} from '../scripts/alert-logic.mjs';
import {validateNtfy,publishNtfy} from '../scripts/notify-ntfy.mjs';
import {resolveAlertSetup} from '../scripts/alert-config.mjs';
import {parseTle} from '../iss-core.js';

const options={location:{name:'Teststed',lat:55.6761,lon:12.5683,tz:'Europe/Copenhagen',light:'rural'},mode:'eyes',threshold:80,minHours:1,notify:{early:true,late:true,clearing:true,events:true}};
const config=parseConfig(JSON.stringify(options));
const T=Date.parse('2026-10-15T10:00:00Z'); // 12:00 CEST, outside quiet hours
function hours(start,score=90,count=2){return Array.from({length:count},(_,i)=>({time:start+i*3600000,clouds:5,fog:0,
 rating:{score,sunAlt:-25}}));}
const fresh=()=>initialState(config);
const notices=(state,now,h,extra={})=>proposeAlerts({state,config,now,hours:h,...extra});

test('tolker konfiguration og afviser ugyldige koordinater og tidszone',()=>{
 assert.equal(config.threshold,80);assert.equal(config.location.tz,'Europe/Copenhagen');
 assert.throws(()=>parseConfig('{}'));
 assert.throws(()=>parseConfig(JSON.stringify({...options,location:{...options.location,lat:150}})));
 assert.throws(()=>parseConfig(JSON.stringify({...options,location:{...options.location,tz:'København'}})));
});
test('tidligt varsel 12-36 timer før (ikke efter 36)',()=>{
 assert.ok(notices(fresh(),T,hours(T+24*3600000)).some(a=>a.kind==='early'));
 assert.equal(notices(fresh(),T,hours(T+40*3600000)).filter(a=>a.kind==='early').length,0);
});
test('sent varsel 30-90 minutter før',()=>{
 assert.ok(notices(fresh(),T,hours(T+60*60000)).some(a=>a.kind==='late'));
 assert.equal(notices(fresh(),T,hours(T+110*60000)).filter(a=>a.kind==='late').length,0);
});
test('ukendt eller lavt indeks giver ikke almindelige varsler',()=>{
 assert.equal(notices(fresh(),T,hours(T+60*60000,42)).length,0);
});
test('stilleperiode og 10 minutters margin blokerer alt',()=>{
 const p=Date.parse('2026-10-15T20:55:00Z'); // 22:55 CEST
 assert.equal(notices(fresh(),p,hours(p+3600000)).length,0);
 const q=Date.parse('2026-10-15T21:10:00Z'); // 23:10 CEST
 assert.equal(notices(fresh(),q,hours(q+3600000),{meteors:[{id:'m',name:'Test',time:q+24*3600000}]}).length,0);
});
test('deduplikation efter afsendt tidlig notifikation',()=>{
 const state=fresh();const first=notices(state,T,hours(T+24*3600000));
 assert.equal(first[0].kind,'early');markSent(state,first[0],T,config.location.tz);
 assert.equal(notices(state,T+30*60000,hours(T+24*3600000)).length,0);
});
test('højst 2 almindelige varsler på en lokal kalenderdag',()=>{
 const state=fresh();markSent(state,{key:'early:1',kind:'early'},T,config.location.tz);
 markSent(state,{key:'late:1',kind:'late'},T,config.location.tz);
 assert.equal(ordinaryCount(state,T,config.location.tz),2);
 assert.equal(readyToSend(state,{kind:'early',key:'third'},T,config.location.tz),false);
});
test('ISS og meteorregn har særskilt dagskvote',()=>{
 const state=fresh(),time=T+60*60000;
 const alerts=notices(state,T,hours(time),{iss:[{peak:time, maxAltitude:54}]});
 assert.ok(alerts.some(a=>a.kind==='event'&&a.key.includes(':iss:')));
 const event=alerts.find(a=>a.kind==='event');
 markSent(state,event,T,config.location.tz);assert.equal(specialCount(state,T,config.location.tz),1);
 assert.equal(readyToSend(state,event,T,config.location.tz),false);
});
test('uventet opklaring kræver en faktisk gemt dårligere prognose',()=>{
 const state=fresh(),start=T+3600000;
 assert.equal(notices(state,T,hours(start)).some(a=>a.kind==='clearing'),false);
 state.snapshots[start]={score:40,checkedAt:T-2*3600000};
 assert.equal(notices(state,T,hours(start)).some(a=>a.kind==='clearing'),true);
});
test('baseline snapshots og skiftet varslingssted',()=>{
 const state=fresh();saveSnapshots(state,hours(T+24*3600000),T);
 assert.equal(state.snapshots[T+24*3600000].score,90);
 const p=parseConfig(JSON.stringify({...options,location:{...options.location,lat:55.9}}));
 assert.notEqual(state.siteKey,normalizeState(state,p).siteKey);
});
test('ntfy topic mindst 20 tilfældige tegn, og HTTPS',()=>{
 assert.throws(()=>validateNtfy({topic:'test'}));
 assert.throws(()=>validateNtfy({topic:'a'.repeat(24),serverUrl:'http://ntfy.sh'}));
 assert.equal(validateNtfy({topic:'a'.repeat(24)}).serverUrl,'https://ntfy.sh');
});
test('ntfy sender uden server-cache og accepteret svar betyder kun HTTP-succes',async()=>{
 const requests=[];const fake=async(u,options)=>{requests.push({u,options});return {ok:true,status:200};};
 const r=await publishNtfy({topic:'a'.repeat(24),notice:{kind:'early',body:'Test',tab:'today'},timezone:'Europe/Copenhagen',
 now:T,clock:()=>T,appUrl:'https://example.github.io/stjerneradar/',fetchFn:fake});
 assert.equal(r.accepted,true);assert.equal(requests.length,1);
 assert.equal(requests[0].options.headers['X-Cache'],'no');
 assert.equal(requests[0].options.headers['X-Click'],'https://example.github.io/stjerneradar/?tab=today');
});
test('ntfy blokerer test og særvarsler i stilleperioden uden at kalde netværk',async()=>{
 let called=false;const late=Date.parse('2026-10-15T21:15:00Z');
 const r=await publishNtfy({topic:'b'.repeat(25),notice:{kind:'event',body:'Test'},timezone:'Europe/Copenhagen',
 now:late,clock:()=>late,fetchFn:()=>{called=true;}});
 assert.equal(r.ok,false);assert.equal(called,false);
});
test('ISS med ugyldig TLE må ikke vises som verificeret',()=>{
 assert.throws(()=>parseTle('Ingen baneelementer'));
});

test('DMI og fallback-API får hver deres understøttede vejrvariabler',async()=>{
 const {weatherUrl}=await import('../core.js');
 const dmi=new URL(weatherUrl(55.67,12.56));
 const fallback=new URL(weatherUrl(55.67,12.56,true));
 assert.ok(dmi.searchParams.get('hourly').includes('cloud_cover_2m'));
 assert.equal(fallback.searchParams.get('hourly').includes('cloud_cover_2m'),false);
 assert.equal(dmi.searchParams.get('hourly').includes('precipitation_probability'),false);
});


test('ny ntfy-opsætning kræver kun én samlet GitHub Secret',()=>{
 const topic='stjerner-'+('abcdef01'.repeat(6));
 const newPayload=JSON.stringify({...options,schema_version:2,ntfyTopic:topic,ntfyServer:'https://ntfy.sh'});
 const setup=resolveAlertSetup({STJERNERADAR_ALERT_CONFIG:newPayload});
 assert.equal(setup.topic,topic);
 assert.equal(setup.config.location.name,'Teststed');
 assert.equal(setup.serverUrl,'https://ntfy.sh');
 assert.equal(setup.config.threshold,80);
});
test('gamle V1.1-secrets bruges ikke og kan ikke sende til en forkert kanal',()=>{
 assert.throws(()=>resolveAlertSetup({STJERNERADAR_CONFIG:JSON.stringify(options),NTFY_TOPIC:'z'.repeat(30)}),/STJERNERADAR_ALERT_CONFIG/);
});
test('ugyldig eller manglende samlet Secret giver vejledning frem for skjult fejl',()=>{
 assert.throws(()=>resolveAlertSetup({}),/STJERNERADAR_ALERT_CONFIG/);
 assert.throws(()=>resolveAlertSetup({STJERNERADAR_ALERT_CONFIG:JSON.stringify(options)}),/Opret alarmkanal/);
 assert.throws(()=>resolveAlertSetup({STJERNERADAR_ALERT_CONFIG:JSON.stringify({...options,ntfyTopic:'kort'})}),/NTFY_TOPIC/);
});
test('ny samlet Secret ignorerer gamle indstillinger ved migrering',()=>{
 const topic='stjerner-'+('abcdef09'.repeat(6));
 const mixed=resolveAlertSetup({STJERNERADAR_ALERT_CONFIG:JSON.stringify({...options,ntfyTopic:topic}),
  STJERNERADAR_CONFIG:JSON.stringify(options),NTFY_TOPIC:'legacy-topic-1234567890'});
 assert.equal(mixed.topic,topic);
});
