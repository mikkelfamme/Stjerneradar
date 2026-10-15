/* Stjerneradar V1.0 — weather scoring and timezone-safe alert decisions.
   This module is deliberately dependency-free so browser, Worker and tests use identical rules. */
export const SCORE_VERSION = '1.0.0';
export const MODES = {
  eyes: 'Blotte øje', binoculars: 'Kikkert', planets: 'Teleskop · planeter', deep: 'Teleskop · deep-sky'
};
export const CLASSES = [
  {min:80,label:'Fremragende',tone:'excellent'},
  {min:60,label:'Gode',tone:'good'},
  {min:40,label:'Begrænsede',tone:'medium'},
  {min:20,label:'Dårlige',tone:'poor'},
  {min:0,label:'Meget dårlige',tone:'poor'}
];
export const WEATHER_VARIABLES = [
  'cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','cloud_cover_2m',
  'visibility','precipitation','temperature_2m',
  'relative_humidity_2m','wind_speed_10m'
];
export function weatherUrl(lat,lon,fallback=false){
  const u=new URL(fallback?'https://api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/dmi');
  const vars=fallback?WEATHER_VARIABLES.filter(x=>x!=='cloud_cover_2m'):WEATHER_VARIABLES;
  const params={latitude:lat,longitude:lon,hourly:vars.join(','),
    forecast_days:8,timezone:'UTC',timeformat:'unixtime'};
  if(!fallback)params.models='dmi_seamless';
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  return u.href;
}

export function clamp(x,min,max){return Math.max(min,Math.min(max,x));}
export function cleanNumber(x){return typeof x==='number' && Number.isFinite(x)?x:null;}
export function forecastRows(api){
  if (!api?.hourly?.time?.length) throw new Error('Vejrdatakilden returnerede ikke gyldige timeprognoser.');
  const h=api.hourly;
  const rows=h.time.map((time,i)=>({
    time:Number(time)*1000,
    clouds:cleanNumber(h.cloud_cover?.[i]),low:cleanNumber(h.cloud_cover_low?.[i]),
    mid:cleanNumber(h.cloud_cover_mid?.[i]),high:cleanNumber(h.cloud_cover_high?.[i]),
    fog:cleanNumber(h.cloud_cover_2m?.[i]),visibility:cleanNumber(h.visibility?.[i]),
    precipitation:cleanNumber(h.precipitation?.[i]),
    precipitationProb:cleanNumber(h.precipitation_probability?.[i]),
    temp:cleanNumber(h.temperature_2m?.[i]),humidity:cleanNumber(h.relative_humidity_2m?.[i]),
    wind:cleanNumber(h.wind_speed_10m?.[i])
  })).filter(r=>Number.isFinite(r.time)&&r.clouds!==null);
  if (!rows.length)throw new Error('Skydække mangler i vejrdata.');
  return {rows,source:api.stjerneradar_source||'Open-Meteo · DMI / ECMWF',fetchedAt:Date.now(),providerTimezone:api.timezone||'UTC'};
}
export function scoreClass(score){return CLASSES.find(c=>score>=c.min)||CLASSES.at(-1);}
/** A transparent heuristic, not a measured sky quality or a probability. */
export function scoreHour(weather,astro,opts={}){
  if(weather?.clouds===null||weather?.clouds===undefined||!Number.isFinite(astro?.sunAlt)||!Number.isFinite(astro?.moonAlt)||!Number.isFinite(astro?.moonFraction))
    return {score:null,reason:['Prognose eller astronomidata mangler'],version:SCORE_VERSION};
  const mode=opts.mode||'eyes';const sky=opts.light||'unknown';
  const c=clamp(weather.clouds,0,100), alt=astro.sunAlt;
  const illumination=clamp(astro.moonFraction,0,1);
  const effectiveMoon=astro.moonAlt>0?illumination*clamp(astro.moonAlt/12,0,1):0;
  const low=weather.low??c,mid=weather.mid??c,high=weather.high??c;
  const layered=clamp(0.55*c+0.25*low+0.12*mid+0.08*high,0,100);
  const moonWeight=mode==='planets'?1:mode==='deep'?36:mode==='binoculars'?27:29;
  const moonPenalty=moonWeight*effectiveMoon;
  const cloudPenalty=layered*0.70;
  const fog=weather.fog??0;
  const fogPenalty=fog>50?Math.min(34,(fog-40)*0.52):Math.max(0,fog-20)*0.12;
  const vis=weather.visibility;
  const visibilityPenalty=vis===null||vis===undefined?0:vis<2000?30:vis<5000?19:vis<10000?8:0;
  const wetPenalty=weather.precipitation!==null&&weather.precipitation>0.5?25:weather.precipitation>0?12:0;
  const airPenalty=Math.max(fogPenalty,visibilityPenalty,wetPenalty);
  const lightPenalty=sky==='urban'?(mode==='deep'?38:mode==='planets'?1:24):sky==='suburban'?(mode==='deep'?22:mode==='planets'?0:11):sky==='rural'?0:0;
  let score=Math.round(clamp(100-cloudPenalty-moonPenalty-airPenalty-lightPenalty,0,100));
  // Horizon/twilight limit. Planets tolerate some twilight, not daylight.
  const darknessCap=mode==='planets'?alt>=0?0:alt>=-4?30:alt>=-8?70:100
    :alt>=0?0:alt>=-6?15:alt>=-12?38:alt>=-18?63:100;
  score=Math.min(score,darknessCap);
  if(c>=95)score=Math.min(score,12);
  else if(c>=85)score=Math.min(score,22);
  else if(c>=70)score=Math.min(score,38);
  if((fog>=85)||(vis!==null&&vis!==undefined&&vis<1000))score=Math.min(score,18);
  if(mode==='deep'&&sky==='unknown')score=Math.min(score,79);
  score=clamp(score,0,100);
  const reason=[
    `Skydække ${Math.round(c)} %`,
    alt<=-18?'Astronomisk mørke':alt<0?'Skumring – ikke fuldt mørkt':'Solen er oppe',
    astro.moonAlt<=0?'Månen er under horisonten':`Månen ${Math.round(illumination*100)} % oplyst`,
  ];
  if(airPenalty>10)reason.push('Dis, tåge eller nedbør forringer forholdene');
  if(sky==='urban')reason.push('Byens lys begrænser svage stjerner');
  if(sky==='unknown')reason.push('Lysforurening ikke målt');
  if(mode==='planets')reason.push('Atmosfærisk seeing er ikke målt');
  return {score,reason,version:SCORE_VERSION,effectiveMoon,moonFraction:illumination,
    moonAlt:astro.moonAlt,sunAlt:alt,clouds:c,mode,light:sky};
}
export function parts(timestamp,tz){
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const p=Object.fromEntries(fmt.formatToParts(new Date(timestamp)).map(x=>[x.type,x.value]));
  return {year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute};
}
export function localDate(timestamp,tz){const x=parts(timestamp,tz);return `${x.year}-${String(x.month).padStart(2,'0')}-${String(x.day).padStart(2,'0')}`;}
export function localNightKey(timestamp,tz){
  // The observational night belongs to the date of its preceding noon.
  const p=parts(timestamp,tz);
  const utc=new Date(Date.UTC(p.year,p.month-1,p.day-(p.hour<12?1:0)));
  return utc.toISOString().slice(0,10);
}
export function isQuiet(timestamp,tz,start=23,end=7){
  const p=parts(timestamp,tz),h=p.hour+p.minute/60;
  return start>end?(h>=start||h<end):(h>=start&&h<end);
}
export function canDispatchPush(timestamp,tz){return !isQuiet(timestamp,tz)&&!isQuiet(timestamp+10*60000,tz);}
export function formatClock(timestamp,tz){return new Intl.DateTimeFormat('da-DK',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp));}
export function formatDate(timestamp,tz,opts={}){return new Intl.DateTimeFormat('da-DK',{timeZone:tz,weekday:'short',day:'numeric',month:'short',...opts}).format(new Date(timestamp));}
export function confidence(hoursAhead){return hoursAhead<48?'Kort sigt':hoursAhead<96?'Mellemlangt sigt':'Langt sigt · usikkert';}
export function groupNights(rows,tz){
  const by=new Map();for(const r of rows){const key=localNightKey(r.time,tz);if(!by.has(key))by.set(key,[]);by.get(key).push(r);}
  return [...by].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,hours])=>({key,hours}));
}
/** Contiguous hourly scores only. A gap in the model series splits a window. */
export function findWindows(hours,minScore=80,minHours=1){
  const output=[];let start=null, prev=null, values=[];
  function flush(){if(start!==null&&values.length>=minHours){output.push({start,end:prev+3600000,
    score:Math.round(values.reduce((a,b)=>a+b,0)/values.length),
    best:Math.max(...values),lengthHours:values.length});}start=null;prev=null;values=[];}
  for(const h of hours){const s=h.rating?.score;
    if(!Number.isFinite(s)||s<minScore||(prev!==null&&h.time-prev!==3600000)){flush();}
    if(Number.isFinite(s)&&s>=minScore){if(start===null)start=h.time;prev=h.time;values.push(s);}
  }flush();return output;
}
export function bestWindow(hours,minimum=1){
  // Score for a window includes its duration; do not claim disconnected hours are a window.
  const candidates=[];for(let threshold=80;threshold>=20;threshold-=10)candidates.push(...findWindows(hours,threshold,minimum));
  const seen=new Set();return candidates.filter(w=>{const key=w.start+'-'+w.end;if(seen.has(key))return false;seen.add(key);return true;})
    .sort((a,b)=>(b.score+Math.min(b.lengthHours,3)*3)-(a.score+Math.min(a.lengthHours,3)*3))[0]||null;
}
export function alertEligibility({now,scheduledFor,timezone='Europe/Copenhagen',kind,windowStart,windowEnd,threshold=80,
   windowScore=0,windowHours=0,minimumHours=1,ageMinutes=999,alreadySent=false,ordinaryToday=0,enabled=true}){
  if(!enabled)return {ok:false,why:'slået fra'};
  if(!canDispatchPush(now,timezone)||!canDispatchPush(scheduledFor??now,timezone))return {ok:false,why:'stilleperiode 23–07 eller sikkerhedsmargin'};
  if(alreadySent)return {ok:false,why:'allerede varslet'};
  if(ageMinutes>180)return {ok:false,why:'forældet vejrprognose'};
  if(windowScore<threshold||windowHours<minimumHours)return {ok:false,why:'forholdene er ikke gode nok'};
  if(windowEnd<=now)return {ok:false,why:'observationsvinduet er afsluttet'};
  if(kind!=='event'&&ordinaryToday>=2)return {ok:false,why:'dagsgrænse nået'};
  const delta=(windowStart-now)/60000;
  if(kind==='early'&&!(delta>=12*60&&delta<=36*60))return {ok:false,why:'uden for tidligt varsel'};
  if(kind==='late'&&!(delta>=30&&delta<=90))return {ok:false,why:'uden for sidste varsel'};
  if(kind==='clearing'&&!(delta>=0&&delta<=180))return {ok:false,why:'uden for opklaringsvarsel'};
  return {ok:true,why:'klar'};
}
export function clampLocation(lat,lon){
  const a=Number(lat),b=Number(lon);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a < -90 || a>90||b < -180||b>180)throw new Error('Ugyldige koordinater.');
  return {lat:Math.round(a*10000)/10000,lon:Math.round(b*10000)/10000};
}
