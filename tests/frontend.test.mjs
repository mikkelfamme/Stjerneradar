import test from 'node:test';
import assert from 'node:assert/strict';

test('GitHub-Pages brugerflade viser ntfy-opsætning uden Cloudflare-parring',async()=>{
 const elements={app:{innerHTML:''}};
 const mem=new Map();
 Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:k=>elements[k]||null,addEventListener:()=>{}}});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{}}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?tab=settings'}});
 Object.defineProperty(globalThis,'history',{configurable:true,value:{replaceState:()=>{}}});
 const oldSetTimeout=globalThis.setTimeout;globalThis.setTimeout=()=>0;
 try{
  await import('../app.js');
  assert.match(elements.app.innerHTML,/Kopiér GitHub-opsætning/);
  assert.match(elements.app.innerHTML,/ntfy/);
  assert.doesNotMatch(elements.app.innerHTML,/Cloudflare Worker-adresse/);
  assert.doesNotMatch(elements.app.innerHTML,/VAPID_PUBLIC_KEY/);
 }finally{globalThis.setTimeout=oldSetTimeout;}
});
