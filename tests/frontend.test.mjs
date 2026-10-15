import test from 'node:test';
import assert from 'node:assert/strict';

test('GitHub-Pages brugerflade viser ntfy-opsætning uden Cloudflare-parring',async()=>{
 const elements={app:{innerHTML:''}};
 const listeners={};let copied='';
 const makeElement=()=>({setAttribute:()=>{},classList:{add:()=>{},remove:()=>{}},textContent:'',style:{}});
 const mem=new Map();
 Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:k=>elements[k]||null,addEventListener:(type,fn)=>{listeners[type]=fn;},querySelector:()=>null,createElement:makeElement,body:{append:()=>{}}}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,clipboard:{writeText:async text=>{copied=text;}}}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{}}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?tab=settings'}});
 Object.defineProperty(globalThis,'history',{configurable:true,value:{replaceState:()=>{}}});
 const oldSetTimeout=globalThis.setTimeout;globalThis.setTimeout=()=>0;
 try{
  await import('../app.js');
  assert.match(elements.app.innerHTML,/Opret alarmkanal/);
  assert.match(elements.app.innerHTML,/STJERNERADAR_ALERT_CONFIG/);
  assert.doesNotMatch(elements.app.innerHTML,/New repository secret.*NTFY_TOPIC/);
  assert.ok(typeof listeners.click==='function');
  await listeners.click({target:{closest:()=>({dataset:{action:'generate-topic'}})}});
  const topic=JSON.parse(mem.get('stjerneradar.v1')).pushTopic;
  assert.match(topic,/^stjerner-[a-f0-9]{48}$/);
  assert.match(elements.app.innerHTML,/Kopiér kanal/);
  await listeners.click({target:{closest:()=>({dataset:{action:'copy-topic'}})}});
  assert.equal(copied,topic);
  await listeners.click({target:{closest:()=>({dataset:{action:'copy-alert-config'}})}});
  const secret=JSON.parse(copied);
  assert.equal(secret.ntfyTopic,topic);
  assert.equal(secret.ntfyServer,'https://ntfy.sh');
  assert.equal(secret.location.tz,'Europe/Copenhagen');
  assert.equal(secret.schema_version,2);
  assert.match(elements.app.innerHTML,/ntfy/);
  assert.doesNotMatch(elements.app.innerHTML,/Cloudflare Worker-adresse/);
  assert.doesNotMatch(elements.app.innerHTML,/VAPID_PUBLIC_KEY/);
 }finally{globalThis.setTimeout=oldSetTimeout;}
});
