import * as Astronomy from 'astronomy-engine';
import * as satellite from 'satellite.js';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {weatherUrl,forecastRows,scoreHour,findWindows,clampLocation,isQuiet,canDispatchPush,localDate,localNightKey,formatClock,alertEligibility} from '../core.js';

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const bad=(message,status=400)=>json({error:message},status);
const nowSec=()=>Math.floor(Date.now()/1000);
const modes=new Set(['eyes','binoculars','planets','deep']);
const lights=new Set(['urban','suburban','rural','unknown']);
const CORS_HEADERS=['authorization','content-type','accept'];
const notEmpty=v=>typeof v==='string'&&v.trim().length>0;
function originAllowed(request,env){const origin=request.headers.get('Origin');if(!origin)return true;
 const expected=env.FRONTEND_ORIGIN?.replace(/\/$/,'');
 return origin===expected||(/^(http:\/\/localhost:\d+|http:\/\/127\.0\.0\.1:\d+)$/.test(origin)&&env.ALLOW_LOCALHOST==='true');
}
function corsHeaders(request,env){const origin=request.headers.get('Origin');
 return originAllowed(request,env)&&origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':CORS_HEADERS.join(', ')}:{};
}
function auth(request,env){const bearer=request.headers.get('Authorization')||'';
 const input=bearer.startsWith('Bearer ')?bearer.slice(7):'';
 if(!notEmpty(env.APP_ADMIN_TOKEN)||input.length<32)return false;
 // Fixed-work comparison; this is the only shared write credential in private V1.
 const expected=env.APP_ADMIN_TOKEN;if(input.length!==expected.length)return false;
 let diff=0;for(let i=0;i<input.length;i++)diff|=input.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
async function payload(request){try{const body=await request.json();if(!body||typeof body!=='object')throw Error();return body;}catch{throw new Error('Forventede gyldig JSON i anmodningen.');}}
function installationId(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]{10,90}$/.test(s))throw Error('Ugyldigt installations-id.');return s;}
function safeTimezone(s){if(!notEmpty(s)||s.length>64)throw Error('Ugyldig tidszone.');try{new Intl.DateTimeFormat('en-GB',{timeZone:s});}catch{throw Error('Ugyldig IANA-tidszone.');}return s;}
function validatedSettings(data){const id=installationId(data.installationId),loc=data.location||{};
 const {lat,lon}=clampLocation(loc.lat,loc.lon),tz=safeTimezone(loc.tz||'Europe/Copenhagen');
 const light=lights.has(loc.light)?loc.light:'unknown';
 const mode=modes.has(data.mode)?data.mode:'eyes';const threshold=Number(data.threshold),minHours=Number(data.minHours);
 if(!Number.isInteger(threshold)||threshold<60||threshold>95)throw Error('Varslingsgrænsen skal være 60–95.');
 if(!Number.isInteger(minHours)||minHours<1||minHours>3)throw Error('Minimum varighed skal være 1–3 timer.');
 const name=String(loc.name||'Mit observationssted').trim().slice(0,80);
 const notify={early:data.notify?.early===true,late:data.notify?.late===true,clearing:data.notify?.clearing===true,events:data.notify?.events===true};
 return {id,lat,lon,tz,name,light,mode,threshold,minHours,notify};
}
async function saveSettings(DB,s){const now=Date.now();
 await DB.prepare(`INSERT INTO installations(id,name,lat,lon,tz,light,mode,threshold,min_hours,notify_early,notify_late,notify_clearing,notify_events,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lon=excluded.lon,tz=excluded.tz,light=excluded.light,mode=excluded.mode,
 threshold=excluded.threshold,min_hours=excluded.min_hours,notify_early=excluded.notify_early,notify_late=excluded.notify_late,
 notify_clearing=excluded.notify_clearing,notify_events=excluded.notify_events,updated_at=excluded.updated_at`)
 .bind(s.id,s.name,s.lat,s.lon,s.tz,s.light,s.mode,s.threshold,s.minHours,Number(s.notify.early),Number(s.notify.late),Number(s.notify.clearing),Number(s.notify.events),now,now).run();
 return {ok:true,primary:s.name,updatedAt:now};
}
async function fetchForecast(lat,lon){const urls=[weatherUrl(lat,lon),weatherUrl(lat,lon,true)];
 let lastError='';for(const url of urls){try{const res=await fetch(url,{cf:{cacheEverything:true,cacheTtl:850},signal:AbortSignal.timeout(13000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const api=await res.json();const data=forecastRows(api);
  return {api:{...api,stjerneradar_source:url.includes('/v1/dmi')?'Open-Meteo · DMI/ECMWF':'Open-Meteo · bedste tilgængelige model'},...data};
 }catch(e){lastError=e.message;}}
 throw Error('Vejrtjenesten kunne ikke kontaktes: '+lastError);
}
function skyAt(time,inst){const obs=new Astronomy.Observer(inst.lat,inst.lon,0),date=new Date(time);
 const sunEq=Astronomy.Equator(Astronomy.Body.Sun,date,obs,true,true),moonEq=Astronomy.Equator(Astronomy.Body.Moon,date,obs,true,true);
 const sun=Astronomy.Horizon(date,obs,sunEq.ra,sunEq.dec,'normal');
 const moon=Astronomy.Horizon(date,obs,moonEq.ra,moonEq.dec,'normal');
 return {sunAlt:sun.altitude,moonAlt:moon.altitude,moonFraction:Astronomy.Illumination(Astronomy.Body.Moon,date).phase_fraction};
}
function ratedFuture(forecast,inst,start=Date.now()){return forecast.rows.filter(x=>x.time>=start-3600000&&x.time<start+7*86400000)
 .map(h=>({...h,rating:scoreHour(h,skyAt(h.time,inst),{mode:inst.mode,light:inst.light})}));}
async function cachedTle(env){const key='iss_tle_25544';const current=Date.now();
 const existing=await env.DB.prepare('SELECT contents,updated_at,expires_at FROM external_cache WHERE key=?').bind(key).first();
 if(existing&&existing.expires_at>current)return parseTle(existing.contents,existing.updated_at);
 try{const res=await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE',{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('CelesTrak HTTP '+res.status);
  const txt=await res.text();const parsed=parseTle(txt,current);
  await env.DB.prepare('INSERT INTO external_cache(key,contents,updated_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET contents=excluded.contents,updated_at=excluded.updated_at,expires_at=excluded.expires_at')
   .bind(key,txt,current,current+2*3600000).run();return parsed;
 }catch(e){if(existing&&current-existing.updated_at<3*86400000)return parseTle(existing.contents,existing.updated_at);
  throw Error('ISS-banedata ikke tilgængelige: '+e.message);}
}
function parseTle(txt,checkedAt){const lines=txt.trim().split(/\r?\n/);const l1=lines.find(l=>l.startsWith('1 25544')),l2=lines.find(l=>l.startsWith('2 25544'));
 if(!l1||!l2)throw Error('CelesTrak returnerede ikke ISS-banedata.');
 const yy=Number(l1.slice(18,20)),year=yy>=57?1900+yy:2000+yy;
 const age=Date.now()-(Date.UTC(year,0,1)+(Number(l1.slice(20,32))-1)*86400000);
 if(!Number.isFinite(age)||age>72*3600000||age<-86400000)throw Error('ISS-banedata er forældede.');
 return {line1:l1,line2:l2,epochAgeHours:Math.round(age/3600000),checkedAt};
}
function sunlit(position,time){const sun=Astronomy.GeoVector(Astronomy.Body.Sun,new Date(time),true);
 const u=[sun.x,sun.y,sun.z],sunR=Math.hypot(...u),r=[position.x,position.y,position.z];
 const dot=(r[0]*u[0]+r[1]*u[1]+r[2]*u[2])/sunR;
 const distance=Math.sqrt(Math.max(0,r.reduce((a,b)=>a+b*b,0)-dot*dot));
 return dot>0||distance>6378.137; // Cylindrical umbra approximation (not a full penumbra model).
}
function issPasses(tle,lat,lon,start=Date.now(),hours=48){const sat=satellite.twoline2satrec(tle.line1,tle.line2),
 obs={latitude:lat*Math.PI/180,longitude:lon*Math.PI/180,height:0};
 const step=120000,end=start+hours*3600000,out=[];let current=null;
 const inst={lat,lon};
 for(let t=start;t<=end;t+=step){
  const date=new Date(t),pv=satellite.propagate(sat,date);
  if(!pv?.position||typeof pv.position==='boolean')continue;
  const eci=pv.position,gmst=satellite.gstime(date);
  const look=satellite.ecfToLookAngles(obs,satellite.eciToEcf(eci,gmst));
  const alt=look.elevation*180/Math.PI;
  let valid=alt>=10;
  if(valid)valid=skyAt(t,inst).sunAlt<=-6&&sunlit(eci,t);
  if(valid){if(!current)current={start:t,end:t,peak:t,maxAltitude:alt};
   else current.end=t; if(alt>current.maxAltitude){current.maxAltitude=alt;current.peak=t;}}
  else if(current){if(current.maxAltitude>=15&&current.end-current.start>=240000)out.push({...current,end:current.end+step});current=null;}
 }
 if(current&&current.maxAltitude>=15&&current.end-current.start>=240000)out.push({...current,end:current.end+step});
 return out;
}
function getVapid(env){if(!env.VAPID_PRIVATE_KEY||!env.VAPID_PUBLIC_KEY||!env.VAPID_SUBJECT)throw Error('VAPID secrets/config mangler i Worker.');
 return {subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY};
}
async function deliver(env,inst,notice){
 // Re-check quiet period directly before every gateway request, including tests.
 if(!canDispatchPush(Date.now(),inst.tz))return {accepted:0,reason:'stilleperiode eller sikkerhedsmargin'};
 const result=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions WHERE installation_id=?').bind(inst.id).all();
 if(!result.results?.length)return {accepted:0,reason:'intet aktivt pushabonnement'};
 const vapid=getVapid(env),base=env.FRONTEND_URL||env.FRONTEND_ORIGIN||'';
 if(!base.startsWith('https://'))throw Error('FRONTEND_URL skal være en gyldig HTTPS URL.');
 let accepted=0,errors=[];
 for(const row of result.results){
  if(!canDispatchPush(Date.now(),inst.tz))break;
  try{
   const subscription={endpoint:row.endpoint,expirationTime:null,keys:{p256dh:row.p256dh,auth:row.auth}};
   const data={title:notice.title,body:notice.body,tag:notice.tag,url:base+(notice.tab?'?tab='+notice.tab:'')};
   const push=await buildPushPayload({data:JSON.stringify(data),options:{ttl:300}},subscription,vapid);
   const res=await fetch(row.endpoint,push);
   if(res.ok)accepted++;
   else if(res.status===404||res.status===410){await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(row.endpoint).run();errors.push('abonnement udløbet');}
   else errors.push('push-gateway HTTP '+res.status);
  }catch(e){errors.push(String(e.message||e).slice(0,110));}
 }
 return {accepted,reason:errors.join('; ')||'Pushudbyder accepterede afsendelsen'};
}
async function ordinaryCount(DB,inst,now){const day=localDate(now,inst.tz);
 const r=await DB.prepare("SELECT COUNT(*) AS n FROM sent_notices WHERE installation_id=? AND local_date=? AND status='sent' AND kind IN ('early','late','clearing')").bind(inst.id,day).first();
 return Number(r?.n||0);
}
async function eventCount(DB,inst,now){const day=localDate(now,inst.tz);
 const r=await DB.prepare("SELECT COUNT(*) AS n FROM sent_notices WHERE installation_id=? AND local_date=? AND status='sent' AND kind='event'").bind(inst.id,day).first();
 return Number(r?.n||0);
}
async function sendOnce(env,inst,key,kind,notice,now=Date.now()){
 if(!canDispatchPush(Date.now(),inst.tz))return {accepted:0,reason:'stilleperiode'};
 const localDay=localDate(now,inst.tz);
 const lock=await env.DB.prepare('INSERT OR IGNORE INTO sent_notices(installation_id,notice_key,kind,local_date,status,sent_at) VALUES(?,?,?,?,?,?)')
  .bind(inst.id,key,kind,localDay,'reserved',Date.now()).run();
 if(!lock.meta?.changes){await env.DB.prepare('UPDATE installations SET dedup_count=dedup_count+1 WHERE id=?').bind(inst.id).run();
  return {accepted:0,reason:'duplikat undertrykt'};}
 try{const result=await deliver(env,inst,notice);
  if(result.accepted){await env.DB.prepare('UPDATE sent_notices SET status=?,sent_at=?,detail=? WHERE installation_id=? AND notice_key=?')
   .bind('sent',Date.now(),result.reason,inst.id,key).run();}
  else await env.DB.prepare('DELETE FROM sent_notices WHERE installation_id=? AND notice_key=?').bind(inst.id,key).run();
  return result;
 }catch(e){await env.DB.prepare('DELETE FROM sent_notices WHERE installation_id=? AND notice_key=?').bind(inst.id,key).run();throw e;}
}
// Meteor peaks are approximate DATE markers. Do not advertise an exact peak hour.
const METEOR_DATES=[['Kvadrantiderne',1,3],['Lyriderne',4,22],['Eta-Aquariderne',5,6],
 ['Delta-Aquariderne',7,30],['Perseiderne',8,12],['Draconiderne',10,8],
 ['Orioniderne',10,21],['Leoniderne',11,17],['Geminiderne',12,14],['Ursiderne',12,22]];
function nearbyMeteors(now){const out=[];const year=new Date(now).getUTCFullYear();
 for(let y=year;y<=year+1;y++)for(const [name,m,d] of METEOR_DATES){const date=Date.UTC(y,m-1,d,12),hours=(date-now)/3600000;
  if(hours>=12&&hours<=36)out.push({name,date,key:'meteor:'+name+':'+y});}
 return out;
}
async function evaluateInstallation(env,inst){const now=Date.now();let reason='Intet nyt varsel';
 try{if(isQuiet(now,inst.tz))reason='Stilleperiode 23–07';
 else{
 const forecast=await fetchForecast(inst.lat,inst.lon);
 if(now-forecast.fetchedAt>3*3600000)throw Error('Vejrprognosen er forældet.');
 const hours=ratedFuture(forecast,inst,now),allWindows=findWindows(hours,inst.threshold,inst.min_hours)
  .filter(w=>w.end>now&&w.start<=now+36*3600000).sort((a,b)=>a.start-b.start);
 let ordinary=await ordinaryCount(env.DB,inst,now);
 for(const window of allWindows){
  if(ordinary>=2)break;
  for(const kind of ['late','early']){
   if(kind==='late'&&!inst.notify_late||kind==='early'&&!inst.notify_early)continue;
   const eligible=alertEligibility({now,scheduledFor:now,timezone:inst.tz,kind,windowStart:window.start,windowEnd:window.end,
    threshold:inst.threshold,windowScore:window.score,windowHours:window.lengthHours,minimumHours:inst.min_hours,
    ageMinutes:(now-forecast.fetchedAt)/60000,ordinaryToday:ordinary});
   if(!eligible.ok)continue;
   const night=localNightKey(window.start,inst.tz),key=`${inst.lat.toFixed(3)}:${inst.lon.toFixed(3)}:${night}:${kind}`;
   const when=`${formatClock(window.start,inst.tz)}–${formatClock(window.end,inst.tz)}`;
   const r=await sendOnce(env,inst,key,kind,{title:kind==='early'?'Stjerneradar: Lovende stjernenat':'Stjerneradar: Snart klar himmel',
    body:`${inst.name}: ${window.score}/100, bedste udsigt ${when}. Prognose – ikke garanti.`,tag:key,tab:'today'});
   if(r.accepted){ordinary++;reason=kind+' sendt';}else reason=r.reason;
   if(ordinary>=2)break;
  }
 }
 // Only signal unexpected clearing when the previous saved forecast was significantly worse.
 if(inst.notify_clearing&&ordinary<2){for(const window of allWindows.filter(w=>w.start>=now&&w.start<now+3*3600000)){
  const previous=await env.DB.prepare('SELECT score,saved_at FROM forecast_snapshots WHERE installation_id=? AND hour_time=?')
   .bind(inst.id,window.start).first();
  if(previous&&now-previous.saved_at<12*3600000&&previous.score<=inst.threshold-20&&window.score>=inst.threshold){
   const key=`${inst.lat.toFixed(3)}:${inst.lon.toFixed(3)}:${localNightKey(window.start,inst.tz)}:clearing:${window.start}`;
   const r=await sendOnce(env,inst,key,'clearing',{title:'Stjerneradar: Det klarer op!',
    body:`${inst.name}: Vejret er forbedret til ${window.score}/100 fra kl. ${formatClock(window.start,inst.tz)}.`,tag:key,tab:'today'});
   if(r.accepted){ordinary++;reason='opklaring sendt';}break;
  }
 }}
 // Update score baseline only after comparing previous snapshots.
 const prepared=hours.filter(h=>h.time>=now-3600000&&h.time<=now+48*3600000&&h.rating.score!==null).map(h=>[inst.id,h.time,h.rating.score,now]);
 for(const row of prepared){await env.DB.prepare('INSERT INTO forecast_snapshots(installation_id,hour_time,score,saved_at) VALUES(?,?,?,?) ON CONFLICT(installation_id,hour_time) DO UPDATE SET score=excluded.score,saved_at=excluded.saved_at').bind(...row).run();}
 await env.DB.prepare('DELETE FROM forecast_snapshots WHERE installation_id=? AND hour_time<?').bind(inst.id,now-86400000).run();
 // Special event notices, separate two/day quota.
 if(inst.notify_events&&(await eventCount(env.DB,inst,now))<2){
  for(const met of nearbyMeteors(now)){
   const k=met.key,dayHours=hours.filter(h=>Math.abs(h.time-met.date)<18*3600000&&h.rating?.sunAlt<-12);
   const best=dayHours.sort((a,b)=>b.rating.score-a.rating.score)[0];
   if(best?.rating.score>=Math.max(60,inst.threshold-10)){
    const r=await sendOnce(env,inst,k,'event',{title:'Meteorregn på vej: '+met.name,
     body:`Aktiviteten topper omkring datoen. ${inst.name}: prognose ${best.rating.score}/100 i den nærliggende nat.`,tag:k,tab:'events'});
    if(r.accepted){reason='meteornotifikation sendt';break;}
   }
  }
 }
 if(inst.notify_events&&(await eventCount(env.DB,inst,now))<2){
  try{const tle=await cachedTle(env),passes=issPasses(tle,inst.lat,inst.lon,now,4);
   for(const pass of passes){const minutes=(pass.peak-now)/60000;
    if(minutes<30||minutes>120)continue;
    const localHour=hours.reduce((best,h)=>Math.abs(h.time-pass.peak)<Math.abs((best?.time??0)-pass.peak)?h:best,null);
    if(!localHour||localHour.clouds>40||localHour.fog>50||localHour.precipitation>0.2)continue;
    const key='iss:'+Math.round(pass.peak/(10*60000));
    const r=await sendOnce(env,inst,key,'event',{title:'ISS kan ses i nærheden',
      body:`Mulig belyst passage ved ${inst.name} omkring kl. ${formatClock(pass.peak,inst.tz)}. Skydække ${Math.round(localHour.clouds)} %.`,tag:key,tab:'events'});
    if(r.accepted){reason='ISS-notifikation sendt';break;}
   }
  }catch(e){console.warn('ISS not checked:',e.message);}
 }
 }
 }catch(e){reason='Kontrolfejl: '+String(e.message).slice(0,150);console.error('Stjerneradar check:',inst.id,reason);}
 await env.DB.prepare('UPDATE installations SET last_check_at=?,last_reason=? WHERE id=?').bind(Date.now(),reason,inst.id).run();
 return reason;
}
async function handler(request,env,ctx){const url=new URL(request.url),path=url.pathname;
 if(!originAllowed(request,env))return bad('Websidens origin er ikke tilladt.',403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request,env)});
 if(request.method==='GET'&&path==='/api/health')return json({ok:true,service:'Stjerneradar',time:new Date().toISOString()});
 if(request.method==='GET'&&path==='/api/config')return json({vapidPublicKey:env.VAPID_PUBLIC_KEY||'',quietHours:'23–07',origin:env.FRONTEND_ORIGIN||''});
 if(request.method==='GET'&&path==='/api/forecast'){
  if(!auth(request,env))return bad('Privat adgangsnøgle mangler.',401);
  const {lat,lon}=clampLocation(url.searchParams.get('lat'),url.searchParams.get('lon'));
  const data=await fetchForecast(lat,lon);return json(data.api,200,{'Cache-Control':'public, max-age=180'});
 }
 if(request.method==='GET'&&path==='/api/iss'){
  if(!auth(request,env))return bad('Privat adgangsnøgle mangler eller er forkert.',401);
  const {lat,lon}=clampLocation(url.searchParams.get('lat'),url.searchParams.get('lon'));
  const tle=await cachedTle(env),passes=issPasses(tle,lat,lon,Date.now(),48);
  return json({passes,source:'CelesTrak TLE/SGP4; jordskygge approksimeret',tleEpochAgeHours:tle.epochAgeHours,computedAt:Date.now()});
 }
 // All database read/write and test-send routes below are authenticated.
 if(!auth(request,env))return bad('Privat adgangsnøgle mangler eller er forkert.',401);
 if(request.method==='POST'&&path==='/api/settings'){
  const s=validatedSettings(await payload(request));return json(await saveSettings(env.DB,s));
 }
 if(request.method==='POST'&&path==='/api/push/subscribe'){
  const data=await payload(request),id=installationId(data.installationId),s=data.subscription||{},endpoint=String(s.endpoint||'');
  if(!endpoint.startsWith('https://')||endpoint.length>2100||!notEmpty(s.keys?.p256dh)||!notEmpty(s.keys?.auth))return bad('Ugyldigt Web Push-abonnement.');
  const found=await env.DB.prepare('SELECT id FROM installations WHERE id=?').bind(id).first();if(!found)return bad('Gem varslingsindstillinger først.',409);
  const time=Date.now();await env.DB.prepare(`INSERT INTO subscriptions(endpoint,installation_id,p256dh,auth,created_at,updated_at)
  VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET installation_id=excluded.installation_id,p256dh=excluded.p256dh,
  auth=excluded.auth,updated_at=excluded.updated_at`).bind(endpoint,id,s.keys.p256dh,s.keys.auth,time,time).run();
  return json({ok:true,message:'Pushabonnement oprettet',quiet:'23–07'});
 }
 if(request.method==='POST'&&path==='/api/push/unsubscribe'){
  const data=await payload(request),id=installationId(data.installationId);
  await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=? AND installation_id=?').bind(String(data.endpoint||''),id).run();
  return json({ok:true});
 }
 if(request.method==='POST'&&path==='/api/push/test'){
  const data=await payload(request),id=installationId(data.installationId);
  const inst=await env.DB.prepare('SELECT * FROM installations WHERE id=?').bind(id).first();if(!inst)return bad('Enheden er ikke registreret.',404);
  if(!canDispatchPush(Date.now(),inst.tz))return bad('Test er blokeret af stilleperioden kl. 23–07 samt sikkerhedsmargin.',409);
  const r=await deliver(env,inst,{title:'Stjerneradar · Test',body:'Pushforbindelsen fungerer. Du får kun normale varsler, når forholdene opfylder dine regler.',tag:'test-'+Date.now(),tab:'today'});
  if(!r.accepted)return bad('Push kunne ikke sendes: '+r.reason,503);
  return json({ok:true,accepted:r.accepted,message:`Pushudbyder accepterede ${r.accepted} besked(er). Kontrollér visning på din iPhone.`});
 }
 if(request.method==='GET'&&path==='/api/status'){
  const id=installationId(url.searchParams.get('installationId'));
  const inst=await env.DB.prepare('SELECT * FROM installations WHERE id=?').bind(id).first();if(!inst)return bad('Enheden er ikke registreret.',404);
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE installation_id=?').bind(id).first();
  const sent=await env.DB.prepare("SELECT MAX(sent_at) AS time FROM sent_notices WHERE installation_id=? AND status='sent'").bind(id).first();
  return json({subscriptionCount:count?.n||0,lastCheckAt:inst.last_check_at,lastReason:inst.last_reason,lastSentAt:sent?.time||null,deduplicatedCount:inst.dedup_count,
   primary:inst.name,quietHours:'23–07'});
 }
 if(request.method==='POST'&&path==='/api/delete'){
  const data=await payload(request),id=installationId(data.installationId);
  for(const table of ['sent_notices','forecast_snapshots','subscriptions','installations'])
    await env.DB.prepare(`DELETE FROM ${table} WHERE ${table==='installations'?'id':'installation_id'}=?`).bind(id).run();
  return json({ok:true});
 }
 if(request.method==='POST'&&path==='/api/admin/check'){
  const id=installationId((await payload(request)).installationId);
  const inst=await env.DB.prepare('SELECT * FROM installations WHERE id=?').bind(id).first();if(!inst)return bad('Ukendt installation.',404);
  const reason=await evaluateInstallation(env,inst);return json({ok:true,reason});
 }
 return bad('Ukendt rute.',404);
}
export default {
 async fetch(request,env,ctx){
  try{const response=await handler(request,env,ctx),h=new Headers(response.headers);
   Object.entries(corsHeaders(request,env)).forEach(([k,v])=>h.set(k,v));
   h.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers:h});
  }catch(e){console.error('Stjerneradar API:',e);const r=bad(e.message?.slice(0,180)||'Serverfejl',400);
   const h=new Headers(r.headers);Object.entries(corsHeaders(request,env)).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});}
 },
 async scheduled(controller,env,ctx){const job=async()=>{
  try{const list=await env.DB.prepare(`SELECT i.* FROM installations i WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.installation_id=i.id) LIMIT 50`).all();
   for(const inst of list.results||[])await evaluateInstallation(env,inst);
  }catch(e){console.error('Stjerneradar scheduled:',e);}
 };ctx.waitUntil(job());}
};
