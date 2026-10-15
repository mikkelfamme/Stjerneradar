/* External observations for the GitHub Actions alert job. */
import {readFile} from 'node:fs/promises';
import {meteorEvents} from '../astro.js';
import {parseTle,calculateIssPasses} from '../iss-core.js';
export function upcomingMeteors(now){return meteorEvents(new Date(now),1);}
export function nearbyEclipses(now,loc,A){const output=[];
 try{let lunar=A.SearchLunarEclipse(new Date(now));for(let k=0;k<3;k++){
  const time=lunar.peak.date.getTime();if(time>now+40*3600000)break;
  const obs=new A.Observer(loc.lat,loc.lon,0),eq=A.Equator(A.Body.Moon,new Date(time),obs,true,true);
  const moon=A.Horizon(new Date(time),obs,eq.ra,eq.dec,'normal');
  if(moon.altitude>0)output.push({id:`lunar-${time}`,type:'lunar',name:'Måneformørkelse',time,verified:true});
  lunar=A.NextLunarEclipse(lunar.peak);
 }}catch(e){console.warn('Måneformørkelse kunne ikke beregnes:',e.message);}
 try{let solar=A.SearchLocalSolarEclipse(new Date(now),new A.Observer(loc.lat,loc.lon,0));
  for(let k=0;k<2;k++){const time=solar.peak.time.date.getTime();if(time>now+40*3600000)break;
   output.push({id:`solar-${time}`,type:'solar',name:'Solformørkelse – brug solfilter',time,verified:true});
   solar=A.NextLocalSolarEclipse(solar.peak.time);
  }
 }catch(e){console.warn('Solformørkelse kunne ikke beregnes:',e.message);}
 return output;
}
export async function upcomingComets(now){
 try{const raw=JSON.parse(await readFile(new URL('../verified-events.json',import.meta.url),'utf8'));
  return Array.isArray(raw)?raw.filter(e=>e?.type==='comet'&&typeof e.url==='string'&&e.url.startsWith('https://')&&e.verifiedAt&&
   Number.isFinite(Date.parse(e.time))&&Date.now()-Date.parse(e.verifiedAt)<90*86400000).map(e=>({id:e.id,name:e.name,
    type:'comet',time:Date.parse(e.time),verified:true})):[];
 }catch{return [];}
}
export async function getFreshTle(now,previous,fetchFn=fetch){
 if(previous&&Number.isFinite(previous.checkedAt)&&now-previous.checkedAt<6*3600000){
  try{parseTle(previous.line1+'\n'+previous.line2,now);return {tle:previous,fetched:false};}catch{}
 }
 try{
  const r=await fetchFn('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE',{
   signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Stjerneradar/1.1 (private alert job)'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const p=parseTle(await r.text(),now);return {tle:{line1:p.line1,line2:p.line2,checkedAt:now},fetched:true};
 }catch(error){console.warn('Aktuelle ISS-data ikke tilgængelige:',error.message);
  if(previous){try{parseTle(previous.line1+'\n'+previous.line2,now);return {tle:previous,fetched:false};}catch{}}
  return {tle:null,fetched:false};
 }
}
export function upcomingIss(now,loc,A,S,tle){
 if(!tle)return [];
 try{return calculateIssPasses(tle,loc,now,A,S,4);}catch(e){console.warn('ISS-beregning kunne ikke gennemføres:',e.message);return [];}
}
