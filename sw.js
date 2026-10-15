/* Stjerneradar V1.1 service worker: offline shell. ntfy is a separate iPhone app. */
const VERSION='stjerneradar-1.1.0';
const SHELL=['./','./index.html','./app.js','./astro.js','./core.js','./iss-core.js','./iss-browser.js','./style.css','./manifest.webmanifest',
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
