/* Build one public, fresh ISS-TLE dataset for all favorite locations. Runs only in GitHub Actions. */
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseTle} from '../iss-core.js';
const output=process.argv[2]||'site/iss-tle.json';
const now=Date.now();
let result={status:'unavailable',checkedAt:new Date(now).toISOString(),source:'CelesTrak'};
try{
 const response=await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE',{signal:AbortSignal.timeout(16000),headers:{'User-Agent':'Stjerneradar/1.1 (public ISS predictions)'}});
 if(!response.ok)throw Error('CelesTrak HTTP '+response.status);
 const tle=parseTle(await response.text(),now);
 result={status:'ok',checkedAt:new Date(now).toISOString(),source:'CelesTrak NORAD 25544',line1:tle.line1,line2:tle.line2,epoch:new Date(tle.epoch).toISOString()};
 console.log('ISS: gyldigt TLE, epoch alder '+tle.epochAgeHours+' timer.');
}catch(error){console.warn('ISS: TLE ikke tilgængeligt; appen skjuler passager:',error.message);}
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
