import {calculateIssPasses,parseTle} from './iss-core.js';
export async function getLocalIssPasses(place){
 const A=globalThis.Astronomy,S=globalThis.satellite;
 if(!A||!S)throw Error('Astronomi- eller satellitbibliotek kunne ikke indlæses.');
 const r=await fetch('./iss-tle.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Aktuelle ISS-data er ikke udgivet af GitHub Actions.');
 const data=await r.json();if(data.status!=='ok')throw Error('CelesTrak-data kunne ikke hentes ved seneste GitHub Pages-udgivelse.');
 const checked=Date.parse(data.checkedAt);
 if(!Number.isFinite(checked)||Date.now()-checked>24*3600000)throw Error('ISS-data er ikke blevet opdateret det sidste døgn.');
 parseTle(data.line1+'\n'+data.line2);
 return calculateIssPasses(data,place,Date.now(),A,S,48);
}
