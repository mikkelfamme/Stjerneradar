/* Server-side only. Publishing topic and credentials are GitHub secrets. */
import {canDispatchPush} from '../core.js';
export function validateNtfy({topic,serverUrl='https://ntfy.sh'}){
 if(typeof topic!=='string'||!/^[A-Za-z0-9_-]{20,64}$/.test(topic))throw Error('NTFY_TOPIC skal være en svær-at-gætte streng på 20–64 tegn (bogstaver, tal, _ og -).');
 const server=new URL(serverUrl);
 if(server.protocol!=='https:'||server.username||server.password||server.search||server.hash||server.pathname!=='/')
  throw Error('NTFY_SERVER_URL skal være en HTTPS-origin uden sti, fx https://ntfy.sh');
 return {topic,serverUrl:server.origin};
}
export async function publishNtfy({topic,serverUrl='https://ntfy.sh',authToken='',notice,timezone,now=Date.now(),appUrl='',fetchFn=fetch,clock=Date.now}){
 const settings=validateNtfy({topic,serverUrl});
 // Enforced even for manual test pushes and just before network delivery.
 if(!canDispatchPush(now,timezone)||!canDispatchPush(clock(),timezone))return {ok:false,skipped:'stilleperiode kl. 23–07'};
 const base=settings.serverUrl+'/'+encodeURIComponent(settings.topic);
 const headers={'Content-Type':'text/plain; charset=utf-8','X-Title':'Stjerneradar','X-Priority':'3',
   'X-Cache':'no','X-Tags':notice.kind==='event'?'telescope':'star'};
 if(authToken)headers.Authorization=`Bearer ${authToken}`;
 if(/^https:\/\//.test(appUrl))headers['X-Click']=appUrl.replace(/\/$/,'')+'/?tab='+(notice.tab||'today');
 const r=await fetchFn(base,{method:'POST',headers,body:notice.body,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`ntfy afviste beskeden (HTTP ${r.status}). Kontroller topic, server og evt. token.`);
 return {ok:true,accepted:true,status:r.status};
}
