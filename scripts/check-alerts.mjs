/* GitHub Actions entrypoint. No Cloudflare, no Python, no server running on user's phone. */
import * as Astronomy from 'astronomy-engine';
import * as satellite from 'satellite.js';
import {weatherUrl,forecastRows,scoreHour,canDispatchPush} from '../core.js';
import {parseConfig,normalizeState,saveSnapshots,proposeAlerts,readyToSend,markSent} from './alert-logic.mjs';
import {createStateClient} from './github-state.mjs';
import {validateNtfy,publishNtfy} from './notify-ntfy.mjs';
import {upcomingMeteors,nearbyEclipses,upcomingComets,getFreshTle,upcomingIss} from './events-node.mjs';

const config=parseConfig(process.env.STJERNERADAR_CONFIG);
const topic=process.env.NTFY_TOPIC||'';
const ntfyUrl=process.env.NTFY_SERVER_URL||'https://ntfy.sh';
validateNtfy({topic,serverUrl:ntfyUrl});
const now=Date.now(),tz=config.location.tz;
const test=process.env.TEST_MESSAGE==='true';
const dry=process.env.DRY_RUN==='true';
if(!canDispatchPush(now,tz)){
 console.log('Stilleperiode kl. 23–07 i '+tz+'. Ingen beskeder (heller ikke test) og ingen forsinket kø.');
 process.exit(0);
}
const gh=createStateClient({token:process.env.GITHUB_TOKEN,repository:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA});
const loaded=await gh.read();const state=normalizeState(loaded.data,config);
let revision=loaded.sha;
let touched=!loaded.exists||state.siteKey!==loaded.data?.siteKey;
const appUrl=(process.env.APP_URL||`https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`).replace(/\/$/,'');
async function send(alert){
 if(dry){console.log('TØRKØRSEL: Varsel '+alert.kind+' ville blive sendt ('+alert.key.split(':').slice(-2).join(':')+').');return false;}
 if(!readyToSend(state,alert,Date.now(),tz))return false;
 const r=await publishNtfy({topic,serverUrl:ntfyUrl,authToken:process.env.NTFY_TOKEN||'',notice:alert,timezone:tz,
  now:Date.now(),appUrl});
 if(!r.ok){console.log('Intet sendt:',r.skipped);return false;}
 markSent(state,alert,Date.now(),tz);
 // Persist each accepted message, reducing duplicates after retries or errors.
 revision=await gh.save(state,revision);touched=false;
 console.log('ntfy accepterede '+alert.kind+'. Det er ikke en iPhone-leveringskvittering.');return true;
}
if(test){
 await send({key:'test:'+Date.now(),kind:'test',title:'Stjerneradar · Test',body:'Test fra GitHub Actions: Stjerneradar kan sende beskeder til ntfy. Kontrollér om den vises på din iPhone.',tab:'today'});
 console.log('Testkørsel afsluttet.');process.exit(0);
}

async function downloadForecast(){let last='';
 for(const url of [weatherUrl(config.location.lat,config.location.lon),weatherUrl(config.location.lat,config.location.lon,true)]){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error('HTTP '+r.status);
   const f=forecastRows(await r.json());
   // A new HTTP response is not proof that every model hour was updated.
   if(!f.rows.some(h=>h.time>now&&h.time<now+2*3600000))throw Error('Ingen aktuelle tidsstempler i vejrudsigten.');
   return f;
  }catch(e){last=e.message;}
 }
 throw Error('Ingen opdateret prognose, intet varsel sendt: '+last);
}
const forecast=await downloadForecast();
const obs=new Astronomy.Observer(config.location.lat,config.location.lon,0);
function skyAt(time){const date=new Date(time);
 const sunEq=Astronomy.Equator(Astronomy.Body.Sun,date,obs,true,true);
 const moonEq=Astronomy.Equator(Astronomy.Body.Moon,date,obs,true,true);
 return {sunAlt:Astronomy.Horizon(date,obs,sunEq.ra,sunEq.dec,'normal').altitude,
  moonAlt:Astronomy.Horizon(date,obs,moonEq.ra,moonEq.dec,'normal').altitude,
  moonFraction:Astronomy.Illumination(Astronomy.Body.Moon,date).phase_fraction};
}
const hours=forecast.rows.filter(h=>h.time>=now-3600000&&h.time<=now+7*86400000).map(h=>({...h,
 rating:scoreHour(h,skyAt(h.time),{mode:config.mode,light:config.location.light})}));
let meteors=[],eclipses=[],comets=[],iss=[];
if(config.notify.events){
 meteors=upcomingMeteors(now);
 eclipses=nearbyEclipses(now,config.location,Astronomy);
 comets=await upcomingComets(now);
 const tle=await getFreshTle(now,state.tle);
 if(tle.fetched||state.tle!==tle.tle){state.tle=tle.tle;touched=true;}
 iss=upcomingIss(now,config.location,Astronomy,satellite,state.tle);
}
const alerts=proposeAlerts({config,state,now,hours,meteors,iss,eclipses,comets});
console.log(`Prognosetimer ${hours.length}, kvalificerede varsler ${alerts.length}.`);
for(const alert of alerts){
 if(!canDispatchPush(Date.now(),tz)){console.log('Stilleperiode begyndt under kørsel. Stopper.');break;}
 if(!readyToSend(state,alert,Date.now(),tz))continue;
 await send(alert);
}
// Remember a baseline for genuinely unexpected improvement; write every ~2 hours, not every run.
if(!dry&&(touched||!state.lastSnapshotAt||now-state.lastSnapshotAt>=2*3600000)){
 saveSnapshots(state,hours,now);
 revision=await gh.save(state,revision);
 console.log('Prognosebaseline og varslingshukommelse gemt på separat GitHub-branch.');
}else console.log(dry?'Tørkørsel: ingen tilstand gemt.':'Ingen ny baseline nødvendig.');
