import test from 'node:test';import assert from 'node:assert/strict';
import {scoreHour,isQuiet,canDispatchPush,findWindows,alertEligibility,localNightKey} from '../core.js';
const clear={clouds:0,low:0,mid:0,high:0,fog:0,visibility:25000,precipitation:0};
const night={sunAlt:-25,moonAlt:-15,moonFraction:1};
test('fuldmåne under horisonten giver ingen straf',()=>{
  assert.equal(scoreHour(clear,night,{mode:'eyes',light:'rural'}).score,100);
  assert.ok(scoreHour(clear,{...night,moonAlt:40},{mode:'eyes',light:'rural'}).score<80);
});
test('planetbedømmelse tolererer fuldmåne bedre end deep-sky',()=>{
 const astro={sunAlt:-23,moonAlt:45,moonFraction:1};
 assert.ok(scoreHour(clear,astro,{mode:'planets',light:'rural'}).score>scoreHour(clear,astro,{mode:'deep',light:'rural'}).score);
});
test('overskyet eller dagslys kan ikke give fremragende score',()=>{
 assert.ok(scoreHour({...clear,clouds:100},night,{mode:'eyes'}).score<20);
 assert.equal(scoreHour(clear,{...night,sunAlt:15},{mode:'eyes'}).score,0);
});
test('sommerskumring kan ikke snyde sig til mørke',()=>{
 assert.ok(scoreHour(clear,{...night,sunAlt:-14},{mode:'eyes'}).score<=63);
});
test('stilleperiode respekterer DST og skarpe grænser',()=>{
 const t=(s)=>new Date(s).getTime();const z='Europe/Copenhagen';
 assert.equal(isQuiet(t('2026-10-14T20:59:00Z'),z),false); // 22.59 summer
 assert.equal(isQuiet(t('2026-10-14T21:00:00Z'),z),true); // 23.00 summer
 assert.equal(isQuiet(t('2026-10-15T04:59:00Z'),z),true); // 06.59 summer
 assert.equal(isQuiet(t('2026-10-15T05:00:00Z'),z),false); // 07.00 summer
 assert.equal(isQuiet(t('2026-12-01T22:00:00Z'),z),true); // 23.00 winter
 assert.equal(isQuiet(t('2026-12-02T06:00:00Z'),z),false); // 07.00 winter
});
test('en midnat krydsning hører til samme observationsnat',()=>{
 const z='Europe/Copenhagen';
 assert.equal(localNightKey(Date.parse('2026-10-14T21:00:00Z'),z),localNightKey(Date.parse('2026-10-15T00:00:00Z'),z));
});
test('vinduer kræver sammenhæng og skiller ved manglende timer',()=>{
 const t=Date.parse('2026-10-14T21:00:00Z');const hours=[0,1,4,5].map((i)=>({time:t+i*3600000,rating:{score:90}}));
 const w=findWindows(hours,80,2);assert.equal(w.length,2);assert.equal(w[0].lengthHours,2);
});
test('varsler blokeres i stilleperiode, dubletter og gamle data',()=>{
 const now=Date.parse('2026-10-14T19:30:00Z');const basic={now,timezone:'Europe/Copenhagen',kind:'late',windowStart:now+60*60000,windowEnd:now+120*60000,
  threshold:80,windowScore:90,windowHours:2,ageMinutes:35};
 assert.equal(alertEligibility(basic).ok,true);
 assert.equal(alertEligibility({...basic,now:Date.parse('2026-10-14T21:15:00Z')}).ok,false);
 assert.equal(alertEligibility({...basic,alreadySent:true}).ok,false);
 assert.equal(alertEligibility({...basic,ageMinutes:200}).ok,false);
});

test('push blokeres fra 22.50 med 10 minutters leveringbuffer og i stilleperioden',()=>{
 const tz='Europe/Copenhagen';
 assert.equal(canDispatchPush(Date.parse('2026-10-14T20:45:00Z'),tz),true); // 22.45
 assert.equal(canDispatchPush(Date.parse('2026-10-14T20:50:00Z'),tz),false); // 22.50
 assert.equal(canDispatchPush(Date.parse('2026-10-15T04:59:00Z'),tz),false); // 06.59
 assert.equal(canDispatchPush(Date.parse('2026-10-15T05:00:00Z'),tz),true); // 07.00
});

test('dårlig sigtbarhed og tæt tåge begrænser stjerneindekset',()=>{
 const low=scoreHour({...clear,visibility:500,fog:95},night,{mode:'eyes',light:'rural'});
 assert.ok(low.score<=18);
});
test('ukendt lysmiljø stopper sikker deep-sky-anbefaling',()=>{
 const unknown=scoreHour(clear,night,{mode:'deep',light:'unknown'});
 assert.ok(unknown.score<80);
 assert.ok(unknown.reason.some(r=>r.includes('ikke målt')));
});
test('ingen positive alerts når vejrscoren er for lav eller vinduet er slut',()=>{
 const now=Date.parse('2026-10-14T18:00:00Z');
 const base={now,timezone:'Europe/Copenhagen',kind:'late',windowStart:now+40*60000,
  windowEnd:now+120*60000,threshold:80,windowScore:90,windowHours:2,ageMinutes:15};
 assert.equal(alertEligibility({...base,windowScore:60}).ok,false);
 assert.equal(alertEligibility({...base,windowEnd:now-1}).ok,false);
 assert.equal(alertEligibility({...base,ordinaryToday:2}).ok,false);
});
