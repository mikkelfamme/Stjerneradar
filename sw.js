/* Stjerneradar service worker: offline shell + genuine Web Push display. */
const VERSION='stjerneradar-1.0.0';
const SHELL=['./','./index.html','./app.js','./astro.js','./core.js','./style.css','./manifest.webmanifest',
 './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('stjerneradar-')&&n!==VERSION).map(n=>caches.delete(n)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url),same=url.origin===self.location.origin;
 if(!same){
  // Only cache optional third-party browser libraries; do not cache weather APIs.
  if(/^(unpkg\.com)$/.test(url.hostname)&&(/\/astronomy-engine@2\.1\.19\//.test(url.pathname)||/\/leaflet@1\.9\.4\//.test(url.pathname))){
   event.respondWith(caches.open(VERSION).then(async cache=>{try{const net=await fetch(request);if(net.ok||net.type==='opaque')cache.put(request,net.clone());return net;}catch{return await cache.match(request)||Response.error();}}));}
  return;
 }
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const net=await fetch(request);if(net.ok)return net;throw new Error('Offline');}
   catch{return await caches.match('./index.html')||Response.error();}})());return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{data={body:event.data?.text()||''};}
 const title=String(data.title||'Stjerneradar').slice(0,100),body=String(data.body||'Der er nyt om nattehimlen.').slice(0,300);
 const base=self.registration.scope,target=data.url?new URL(String(data.url),base):new URL(base);
 if(target.origin!==new URL(base).origin||!target.href.startsWith(base))target.href=base;
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:new URL('./icons/icon-192.png',base).href,badge:new URL('./icons/icon-192.png',base).href,
  tag:String(data.tag||'stjerneradar').slice(0,100),renotify:false,data:{url:target.href},timestamp:Date.now(),
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=event.notification.data?.url||self.registration.scope;
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const w of windows){if(w.url.startsWith(self.registration.scope)){await w.focus();try{await w.navigate(url);}catch{}return;}}
  await clients.openWindow(url);
 })());
});
