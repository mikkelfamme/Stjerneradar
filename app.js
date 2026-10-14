import {MODES,forecastRows,weatherUrl,scoreHour,scoreClass,groupNights,bestWindow,formatClock,formatDate,confidence,clampLocation,localNightKey} from './core.js';
import {lib,skyAt,planetPositions,skyObjects,nextAstronomyTimes,starsNow,CONSTELLATIONS,phaseName,meteorEvents,eclipseEvents,milkyWayBand,azimuthDirection} from './astro.js';

const STORAGE='stjerneradar.v1';
const DEFAULT={
  favorites:[{id:'copenhagen',name:'København (eksempel)',lat:55.6761,lon:12.5683,tz:'Europe/Copenhagen',light:'unknown'}],
  selectedId:'copenhagen',primaryId:'copenhagen',mode:'eyes',threshold:80,minHours:1,
  notify:{early:true,late:true,clearing:true,events:true},apiBase:'',token:'',
  instanceId:'',activeTab:'today',selectedNight:'',chartTime:0,skyTime:0,skyZoom:1,selectedObject:'',openEvent:'',
  nordlysUrl:'',compareRadius:30
};
function getStored(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'{}');return {...structuredClone(DEFAULT),...x,notify:{...DEFAULT.notify,...x.notify},favorites:Array.isArray(x.favorites)&&x.favorites.length?x.favorites:structuredClone(DEFAULT.favorites)};}catch{return {...DEFAULT};}}
let state=getStored();if(!state.instanceId)state.instanceId=crypto.randomUUID?.()||'sr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const app=document.getElementById('app');
let weather=null,loading=false,weatherError='',astronomyAvailable=false,issPasses=[],issError='',comparison={},mapInstance=null,alertStatus=null,searchResults=[];
let toastTimer=0,verifiedEvents=[];
const TABS=[['today','I nat','moon'],['week','7 dage','calendar'],['sky','Stjernekort','stars'],['events','Begivenheder','sparkles'],['places','Steder','pin']];
const ICONS={
 moon:'<path d="M20.4 15.2A9 9 0 0 1 8.8 3.6 9 9 0 1 0 20.4 15.2Z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
 stars:'<path d="m12 2 1.7 7 7.3 3-7.3 3L12 22l-1.7-7L3 12l7.3-3L12 2Z"/><path d="m19 2 .5 2 2.5 1-2.5 1-.5 2-.6-2L17 5l1.4-1Z"/>',
 sparkles:'<path d="m12 3 2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1L12 3ZM4 3l.6 2.4L7 6l-2.4.6L4 9l-.6-2.4L1 6l2.4-.6L4 3Z"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M9 2h6l.8 3 2.7 1.4 2.8-.9 2.6 4.5-2.2 2.2v2.7l2.2 2.2-2.6 4.4-2.8-1-2.7 1.5L15 24H9l-.8-2.9-2.7-1.4-2.8.9-2.6-4.5 2.2-2.2v-2.7L.1 9l2.6-4.4 2.8 1L8.2 4Z"/>',
 cloud:'<path d="M20 16.8a4 4 0 0 0-1-7.8A7 7 0 0 0 6 10a4 4 0 0 0-2 7h15"/>',
 eye:'<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 thermometer:'<path d="M9 15V5a3 3 0 0 1 6 0v10a5 5 0 1 1-6 0Z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
 refresh:'<path d="M20 6v5h-5M4 18v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 4M4 13l2 4a7 7 0 0 0 12-2"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 home:'<path d="M3 11 12 3l9 8v10H3V11Z"/>',
 telescope:'<path d="m3 6 12-4 3 6L6 12zM12 10l5 9m-5-4-3 6m8-2 3 2"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-3 7-3-7 7-3-1 3Z"/>'
};
function ic(name,size=19){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.stars}</svg>`;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function save(){try{const copy={...state};localStorage.setItem(STORAGE,JSON.stringify(copy));}catch(e){console.warn('Kunne ikke gemme lokale indstillinger',e);}}
function place(){return state.favorites.find(p=>p.id===state.selectedId)||state.favorites[0];}
function primary(){return state.favorites.find(p=>p.id===state.primaryId)||state.favorites[0];}
function timeFormat(t){return formatClock(t,place().tz||'Europe/Copenhagen');}
function fmt(t){return formatDate(t,place().tz||'Europe/Copenhagen');}
function labelScore(s){return s===null||s===undefined?'Ukendt':scoreClass(s).label;}
function weatherFresh(){return weather&&Date.now()-weather.fetchedAt<3*3600000&&!weather.cachedStale;}
function getRatedHours(){if(!weather||!lib())return [];
 return weather.rows.map(w=>({...w,rating:scoreHour(w,skyAt(w.time,place()),{mode:state.mode,light:place().light||'unknown'})}));}
let rated=[];
function forecastNightList(){const t=Date.now(),grouped=groupNights(rated.filter(h=>h.time>=t-3600000),place().tz);
 return grouped.filter(n=>n.hours.some(h=>h.time>=t)).slice(0,7).map(n=>{
  const nightHours=n.hours.filter(h=>h.rating?.sunAlt<0);
  const eligible=nightHours.filter(h=>h.time>=t);
  const best=bestWindow(eligible,state.minHours)||bestWindow(eligible,1);
  return {...n,nightHours,best,top:nightHours.length?Math.max(...nightHours.map(h=>h.rating?.score??0)):null};
 });}
function chartHours(hours){const first=hours.filter(h=>h.rating?.sunAlt<0);if(first.length<=9)return first;
 const win=bestWindow(first,1);const idx=win?first.findIndex(h=>h.time===win.start):Math.max(0,first.findIndex(h=>h.time>=Date.now()));
 const from=Math.max(0,Math.min(first.length-9,idx-3));return first.slice(from,from+9);
}
function timeline(hours){const h=chartHours(hours);if(!h.length)return '<p class="muted tiny">Ingen natlige timedata for den valgte dato.</p>';
 return `<div class="timeline">${h.map(x=>`<button class="time-item ${state.chartTime===x.time?'active':''}" data-action="select-hour" data-time="${x.time}" title="${timeFormat(x.time)}: ${x.rating?.score??'ukendt'} / 100, skyer ${x.clouds??'?'} %"><span class="time-score">${x.rating?.score??'–'}</span><span class="time-bar ${x.rating?.score<40?'low':''}"><span style="height:${Math.max(3,x.rating?.score??0)}%"></span></span><span class="time-label">${timeFormat(x.time)}</span></button>`).join('')}</div>`;
}
function headline(title,subtitle='',right=''){return `<div class="page-title"><div><p class="eyebrow">STJERNERADAR · ${esc(place().name)}</p><h1>${esc(title)}</h1>${subtitle?`<div class="subtitle">${subtitle}</div>`:''}</div>${right}</div>`;}
function note(label,text,icon='info'){return `<div class="insight"><span class="dot">${ic(icon,13)}</span><div><strong>${esc(label)}</strong><br><span class="muted">${esc(text)}</span></div></div>`;}
function baseShell(content){const tab=state.activeTab;
 return `<div class="app-shell"><header class="topbar"><div class="brand"><div class="brand-icon">✦</div><span>Stjerneradar</span></div><button class="location-pill" data-action="locations">${ic('pin',13)} ${esc(place().name)}</button><button aria-label="Indstillinger" title="Indstillinger" class="icon-button" data-action="settings">${ic('gear',19)}</button></header>${content}</div><nav class="tabs" aria-label="Hovednavigation">${TABS.map(([id,name,icon])=>`<button class="tab ${tab===id?'active':''}" aria-current="${tab===id?'page':'false'}" data-action="tab" data-tab="${id}"><span class="tab-icon">${ic(icon,22)}</span><span>${name}</span></button>`).join('')}</nav>`;}
function weatherBanner(){if(!lib())return '<div class="notice error">Astronomiberegninger er utilgængelige. Kontrollér forbindelsen til Astronomy Engine. Appen viser ingen opdigtede scores.</div>';
 if(loading&&!weather)return '<div class="notice">Henter DMI-vejrprognose…</div>';
 if(!weather)return `<div class="notice error">${esc(weatherError||'Ingen vejrudsigtsdata.')}</div><button class="button secondary" data-action="reload">Prøv igen</button>`;
 if(!weatherFresh())return '<div class="notice warn">Viser gemte/ældre vejrdata. Prognosen er ikke frisk nok til nye varsler.</div>';
 return '';}
function renderToday(){const nights=forecastNightList(),night=nights[0],now=Date.now(),h=night?.nightHours||[],future=h.filter(x=>x.time>=now);
 const best=bestWindow(future,state.minHours)||bestWindow(future,1);
 const activeHour=h.find(x=>x.time===state.chartTime)||h.find(x=>x.time>=now)||h[0];
 const high=best?.score??(future.length?Math.max(...future.map(x=>x.rating?.score??0)):null);
 const summary=high===null?'Afventer prognose':high>=80?'En lovende stjernenat':high>=60?'Gode muligheder':high>=40?'Begrænset stjernesyn':'Svære forhold i nat';
 const sky=activeHour?skyAt(activeHour.time,place()):null;
 const times=lib()?nextAstronomyTimes(now,place()):null;
 const objs=sky&&weatherFresh()?skyObjects(activeHour?.time||now,place(),activeHour?.rating).filter(o=>o.visibleCandidate).slice(0,4):[];
 const moon=sky?`${Math.round(sky.moonFraction*100)} %`: '–';
 return `${headline('Nattehimlen i aften',`Vejr og astronomi fra ${esc(place().name)}`)}${weatherBanner()}
 <section class="panel main-hero"><div class="hero-top"><span>${ic('stars',15)} Prognose for i nat</span><span class="chip ${high!==null&&high>=80?'':'muted'}">${esc(labelScore(high))}</span></div>
 <div class="hero-mid"><div class="hero-description">${esc(summary)}<small>${weatherFresh()?'Beregnet stjerneindeks · ikke garanti for klar himmel':'Kan ikke bruges til live-varsel'}</small></div>
 <div class="score-ring" style="--fill:${high??0}%"><div class="score-inner"><span class="score-n">${high??'–'}</span><span class="score-max">AF 100</span></div></div></div>
 <div class="hero-foot"><div>${ic('clock',15)} Bedste sammenhængende vindue<strong>${best?`${timeFormat(best.start)}–${timeFormat(best.end)}`:'Intet godt vindue'}</strong></div><span>${best?`${best.lengthHours} t · snit ${best.score}`:'Afventer passende forhold'}</span></div></section>
 <div class="metric-grid"><div class="metric"><div class="metric-icon">${ic('cloud')}</div><b>${activeHour?.clouds!==null&&activeHour?.clouds!==undefined?Math.round(activeHour.clouds)+' %':'–'}</b><span>Skydække</span></div>
 <div class="metric"><div class="metric-icon">${ic('moon')}</div><b>${moon}</b><span>${sky?.moonAlt>0?'Månen er oppe':'Månelys'}</span></div>
 <div class="metric"><div class="metric-icon">${ic('eye')}</div><b>${activeHour?.visibility?Math.round(activeHour.visibility/1000)+' km':'–'}</b><span>Sigtbarhed</span></div></div>
 <div class="section-head"><h2>Time for time</h2><button class="small-link" data-action="tab" data-tab="week">Se 7 dage ${ic('arrow',12)}</button></div><div class="panel">${timeline(h)}<p class="window-note">${activeHour?`Kl. ${timeFormat(activeHour.time)}: <b>${activeHour.rating?.score??'–'}/100</b> · sky ${Math.round(activeHour.clouds??0)} % · temperatur ${Math.round(activeHour.temp??0)}°`:'Ingen tilgængelige timeprognoser.'}</p></div>
 <div class="section-head"><h2>Hvad kan du se?</h2><button class="small-link" data-action="tab" data-tab="sky">Åbn stjernekort ${ic('arrow',12)}</button></div>
 ${objs.length?objs.map(o=>`<button class="object-row" data-action="show-object" data-object="${esc(o.id)}"><span class="object-symbol">${o.type==='moon'?'☾':'✦'}</span><span class="row-copy"><b>${esc(o.name)}</b><span>${esc(o.tool)} · ${azimuthDirection(o.azimuth)} · ${Math.round(o.altitude)}° over horisonten</span></span><span class="row-right">Se kort ${ic('chevron',14)}</span></button>`).join(''):
 `<div class="panel"><p class="muted tiny">${!weatherFresh()?'Friske data kræves for at anbefale objekter.':'Ingen sikre objektforslag i de valgte timer. Prøv et andet tidspunkt eller et sted med fri horisont.'}</p></div>`}
 <div class="section-head"><h2>Hvorfor denne score?</h2></div><div class="panel">
 ${(activeHour?.rating?.reason||['Astronomidata eller vejrdata mangler']).map((r,i)=>note(i===0?'Observationsforhold':i===1?'Lysforhold':i===2?'Måneforhold':'Bemærk',r,i===0?'cloud':i===1?'stars':'moon')).join('')}
 ${times?`<div class="insight"><span class="dot">${ic('clock',13)}</span><div><strong>Sol, måne og mørke</strong><br><span class="muted">Solnedgang: ${times.sunset?timeFormat(times.sunset):'ingen i perioden'} · Astronomisk mørke: ${times.astroDark?timeFormat(times.astroDark):'ikke i perioden'} · Næste månenedgang: ${times.moonset?timeFormat(times.moonset):'ikke i perioden'}</span></div></div>`:''}
 </div><p class="footnote">Stjerneindekset er en heuristisk prognose, ikke en måling. Skydata: Open-Meteo/DMI og ECMWF. Lysforurening er ${esc(place().light==='unknown'?'ikke målt': 'manuelt vurderet')}. Senest hentet: ${weather?fmt(weather.fetchedAt)+' '+timeFormat(weather.fetchedAt):'–'}.</p>`;
}
function createSvgGraph(hours,id='graph'){const h=hours.filter(x=>x.rating?.score!==null&&x.rating?.score!==undefined).slice(0,20);
 if(h.length<2)return '<p class="muted tiny">Ingen grafdata.</p>';
 const W=340,H=152,x=i=>32+i*(296/(h.length-1)),y=v=>125-v*1.04;
 const line=key=>h.map((a,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(a[key]).toFixed(1)}`).join(' ');
 const scorepath=h.map((a,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(a.rating.score).toFixed(1)}`).join(' ');
 return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeprognose: indeks og skydække">${[0,50,100].map(v=>`<path class="grid" d="M32 ${y(v)}H328"/><text x="3" y="${y(v)+4}">${v}</text>`).join('')}
 <path class="cloudline" d="${line('clouds')}"/><path class="line" d="${scorepath}"/>
 ${h.map((a,i)=>`<circle cx="${x(i)}" cy="${y(a.rating.score)}" r="3" fill="#83ded0"><title>${timeFormat(a.time)} · Score ${a.rating.score}, skyer ${a.clouds}%</title></circle>`).join('')}
 <text x="32" y="147">${timeFormat(h[0].time)}</text><text x="280" y="147">${timeFormat(h[h.length-1].time)}</text></svg><p class="map-legend">Turkis: Stjerneindeks · Stiplet: Skydække (%) · Tryk på datapunkter for værdier</p>`;
}
function renderWeek(){const nights=forecastNightList();const opened=state.selectedNight||nights[0]?.key;
 return `${headline('De næste 7 nætter','Find det bedste sammenhængende tidsvindue – også på tværs af midnat')}${weatherBanner()}
 ${nights.length?nights.map(n=>{const openedNow=opened===n.key;
  const first=n.nightHours[0];const score=n.best?.score??null;
  const date=Date.parse(n.key+'T12:00:00Z');
  return `<button class="forecast-row ${openedNow?'active':''}" data-action="night" data-night="${n.key}"><div class="object-symbol">${ic('moon')}</div><div class="row-copy"><b>${esc(formatDate(date,place().tz,{weekday:'long',day:'numeric',month:'short'}))}</b><span>${n.best?timeFormat(n.best.start)+'–'+timeFormat(n.best.end)+' · '+confidence((n.best.start-Date.now())/3600000):'Intet passende vindue'}</span></div><div class="night-score ${score<40?'quality-low':score<60?'quality-medium':''}">${score??'–'}</div></button>
  ${openedNow?`<div class="forecast-detail">${createSvgGraph(n.nightHours)}${timeline(n.nightHours)}
  <p class="tiny muted">Bedste observationsvindue: ${n.best?`${timeFormat(n.best.start)}–${timeFormat(n.best.end)}`:'intet i de aktuelle data'}.</p>
  <p class="tiny muted">${first?`${Math.round(first.clouds)} % skydække ved nattens start.`:''} Prognosen er et estimat og bliver mere usikker længere fremme.</p></div>`:''}`;
 }).join(''):'<div class="panel"><p class="muted">Prognosen kunne ikke beregnes.</p></div>'}
 <p class="footnote">Kort sigt: under 48 timer. Mellemlangt sigt: 2–4 døgn. Langt sigt: 5–7 døgn. Dette er ikke procentsikkerhed.</p>`;
}
function skyPosition(alt,az,zoom=1){const theta=az*Math.PI/180,r=Math.min(1.9,(90-alt)/90*zoom)*166;
 return {x:180+Math.sin(theta)*r,y:180-Math.cos(theta)*r};}
function skySVG(t){if(!lib())return '<div class="map-placeholder">Der mangler data til det astronomiske stjernekort. Opret forbindelse til Astronomy Engine.</div>';
 const st=starsNow(t,place()).filter(o=>o.altitude>=0),pl=planetPositions(t,place()).filter(o=>o.altitude>0),
 moon=skyAt(t,place());const mo=moon?.moonAlt>0?{id:'Moon',name:'Månen',type:'moon',altitude:moon.moonAlt,azimuth:moon.moonAz}:null;
 const entries=[...st,...pl,...(mo?[mo]:[])],byId=new Map(entries.map(o=>[o.name,o]));
 const p=o=>skyPosition(o.altitude,o.azimuth,state.skyZoom);const circleLine=(a,b)=>{const pa=byId.get(a),pb=byId.get(b);if(!pa||!pb)return '';const aa=p(pa),bb=p(pb);
  return `<line x1="${aa.x}" y1="${aa.y}" x2="${bb.x}" y2="${bb.y}" stroke="#7395ad" stroke-width=".75" opacity=".50"/>`;};
 const lines=CONSTELLATIONS.flatMap(g=>g.links.map(([a,b])=>circleLine(a,b))).join('');
 const galactic=milkyWayBand(t,place());let path='',penUp=true;
 for(const point of galactic){if(point.altitude<0){penUp=true;continue;}
   const q=p(point);path+=(penUp?'M':'L')+q.x.toFixed(1)+' '+q.y.toFixed(1)+' ';penUp=false;
 }
 const galacticGuide=path?`<path d="${path}" stroke="#82bbcf" opacity=".08" stroke-width="33" fill="none" stroke-linejoin="round"/><path d="${path}" stroke="#c3dce7" opacity=".15" stroke-width="9" fill="none"/>`:'';
 return `<div class="sky-wrap"><svg class="sky-svg" viewBox="0 0 360 360" role="img" aria-label="Interaktivt kort over nattehimlen i ${esc(place().name)} kl. ${timeFormat(t)}">
 <defs><radialGradient id="skyGrad"><stop stop-color="#1a4160"/><stop offset="1" stop-color="#091525"/></radialGradient><clipPath id="horizonClip"><circle cx="180" cy="180" r="166"/></clipPath></defs>
 <circle cx="180" cy="180" r="166" fill="url(#skyGrad)" stroke="#45708b" stroke-width="1"/>
 <circle cx="180" cy="180" r="110.7" fill="none" stroke="#52728d" stroke-width=".7" stroke-dasharray="3 5" opacity=".45"/>
 <circle cx="180" cy="180" r="55.3" fill="none" stroke="#52728d" stroke-width=".7" stroke-dasharray="3 5" opacity=".45"/>
 <path d="M14 180H346M180 14V346" stroke="#426079" stroke-width=".7" opacity=".3"/>
 ${[['N',180,11],['Ø',351,184],['S',180,356],['V',9,184]].map(([txt,x,y])=>`<text x="${x}" y="${y}" text-anchor="middle" fill="#b0e2e0">${txt}</text>`).join('')}
 <g clip-path="url(#horizonClip)">${galacticGuide}${lines}
 ${st.map(o=>{const a=p(o),r=Math.max(.9,4-Math.max(0,o.mag)*.72);return `<g data-action="sky-object" data-object="${esc(o.id)}" class="sky-star"><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="${r.toFixed(2)}" fill="#e0f1f7" opacity="${o.mag>2.7?'.7':'1'}"/><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="10" fill="transparent"/><title>${esc(o.name)} · ${Math.round(o.altitude)}°</title></g>`;}).join('')}
 ${pl.map(o=>{const a=p(o);return `<g class="sky-planet" data-action="sky-object" data-object="${esc(o.id)}"><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="5" fill="#f7d59c" stroke="#fff0"/><text x="${(a.x+8).toFixed(1)}" y="${(a.y-8).toFixed(1)}">${esc(o.name)}</text><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="12" fill="transparent"/></g>`;}).join('')}
 ${mo?(()=>{const a=p(mo);return `<g class="sky-planet" data-action="sky-object" data-object="Moon"><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="8" fill="#d5e5ee"/><circle cx="${(a.x+4).toFixed(2)}" cy="${(a.y-2).toFixed(2)}" r="7" fill="#193854" opacity=".7"/><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="13" fill="transparent"/><text x="${(a.x+12).toFixed(1)}" y="${(a.y-11).toFixed(1)}">Månen</text></g>`;})():''}
 </g><text x="180" y="184" text-anchor="middle" opacity=".38">ZENIT</text></svg></div>`;
}
function renderSky(){const t=state.skyTime||Date.now(),s=skyAt(t,place());
 const objects=lib()?[...starsNow(t,place()),...planetPositions(t,place()),...(s?.moonAlt>0?[{id:'Moon',name:'Månen',type:'moon',altitude:s.moonAlt,azimuth:s.moonAz}]:[])]:[];
 const o=objects.find(x=>x.id===state.selectedObject)||objects.find(x=>x.type==='planet')||objects[0];
 let offset=Math.round((t-Date.now())/1800000);offset=Math.max(0,Math.min(48,offset));
 return `${headline('Stjernekort',`Himlens positioner i ${esc(place().name)} · set fra horisonten`)}${!lib()?weatherBanner():''}
 <div class="panel" style="padding:12px"><div class="section-head"><h2>Himlen kl. ${timeFormat(t)}</h2><span class="chip muted">${s?.sunAlt<=-18?'Astronomisk mørke':s?.sunAlt<0?'Skumring':s?'Dagslys':'Ingen data'}</span></div>
 ${skySVG(t)}<div class="field" style="margin-top:13px"><label for="sky-slider">Flyt tidspunktet (næste 24 timer)</label><div class="range-row"><input type="range" id="sky-slider" min="0" max="48" step="1" value="${offset}" data-action="sky-time"><span>${timeFormat(t)}</span></div></div>
 <div class="field"><label for="sky-zoom">Zoom</label><div class="range-row"><input id="sky-zoom" type="range" min="1" max="1.8" step="0.1" value="${state.skyZoom}" data-action="sky-zoom"><span>${Math.round(state.skyZoom*100)} %</span></div></div>
 <div class="object-details">${o?`<b>${esc(o.name)}</b><p class="tiny muted" style="margin-bottom:0">${azimuthDirection(o.azimuth)} (${Math.round(o.azimuth)}°) · ${Math.round(o.altitude)}° over horisonten · ${o.type==='planet'?'Planeten er over horisonten, men sky og mørke bestemmer, om du kan observere den.':o.type==='moon'?'Månelys påvirker især svage stjerner.':'Lys stjerne · beregnet koordinat.'}</p>`:'<span class="muted tiny">Tryk på en stjerne eller planet for flere oplysninger.</span>'}</div>
 </div><div class="notice">Kortet er beregnet for din valgte position. Den diskrete Mælkevejsstribe er en vejledende galaktisk retning – ikke en garanti for synlig Mælkevej. Kortet følger ikke telefonens pegeretning, og terræn er ikke modelleret.</div>
 <div class="section-head"><h2>Planeter over horisonten</h2></div>
 ${(lib()?planetPositions(t,place()).filter(p=>p.altitude>0):[]).map(p=>`<button class="object-row" data-action="sky-object" data-object="${p.id}"><span class="object-symbol">✦</span><span class="row-copy"><b>${p.name}</b><span>${azimuthDirection(p.azimuth)} · ${Math.round(p.altitude)}° · ${p.id==='Neptune'||p.id==='Uranus'?'Kræver normalt teleskop':'Kikkert/teleskop kan forbedre oplevelsen'}</span></span>${ic('chevron',15)}</button>`).join('')||'<div class="panel"><p class="muted tiny">Ingen planeter er over horisonten på det valgte tidspunkt.</p></div>'}
 <p class="footnote">Stjernekortets beregninger kommer fra Astronomy Engine (MIT). Stjerners J2000-koordinater giver vejledende positioner. Ingen kompas/AR-tilstand i V1.</p>`;
}
function eventCard(e){const open=state.openEvent===e.id;
 let tag=e.type==='meteor'?'METEORREGN':e.type==='iss'?'ISS-PASSAGE':e.type==='eclipse'?'FORMØRKELSE':'KOMET';
 const text=e.type==='meteor'?'Maksimum omkring '+fmt(e.time):fmt(e.time)+' kl. '+timeFormat(e.time);
 return `<button class="event-row" data-action="event" data-event="${esc(e.id)}"><span class="object-symbol">${e.type==='iss'?'✧':e.type==='meteor'?'☄':e.type==='eclipse'?'◐':'✦'}</span><span class="row-copy"><b>${esc(e.name)}</b><span>${esc(text)}</span></span><span class="row-right">${ic('chevron',17)}</span></button>
 ${open?`<div class="event-detail"><span class="event-tag">${tag}</span><p>${esc(e.description)}</p>
 ${e.type==='iss'?`<p class="muted tiny">Højeste vinkel: ${Math.round(e.maxAltitude)}° · varighed ca. ${Math.round((e.end-e.time)/60000)} min.</p>`:''}
 <div class="calendar-meta">Kilde: ${esc(e.source||'')}. <a href="${esc(e.url||'#')}" target="_blank" rel="noopener noreferrer">Se kilden ↗</a></div></div>`:''}`;
}
function renderEvents(){let events=[];
 if(lib())events.push(...eclipseEvents(new Date(),place(),370));
 events.push(...meteorEvents(new Date(),2));
 events.push(...verifiedEvents);
 events.push(...issPasses.map(e=>({...e,id:'iss-'+e.time,type:'iss',name:'ISS – mulig synlig passage',source:'CelesTrak (TLE, beregnet)',url:'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE',
  description:`En beregnet passage med rumstationen over horisonten, mens der er skumring/mørke. De faktiske lysforhold afhænger af skyer, banedata og Jordens skygge.`})));
 events=events.sort((a,b)=>a.time-b.time).filter(e=>e.time>=Date.now()-86400000).slice(0,45);
 return `${headline('På nattehimlen','Meteorregn, planeter, formørkelser og ISS-passager')}${weatherBanner()}
 <div class="panel"><div class="section-head"><h2>Kommende begivenheder</h2><span class="chip muted">${events.length} registreret</span></div><div class="notice">Meteorregn er angivet med omtrentlige årlige peakdatoer – ikke et garanteret antal meteorer. Forholdene afhænger af skyer, måne og observationssted.</div>
 ${events.length?events.map(eventCard).join(''):'<p class="muted tiny">Ingen verificerede begivenheder i den valgte periode.</p>'}</div>
 <div class="panel"><h2 style="font-size:16px">ISS og kometer</h2>
 <p class="tiny muted">${issPasses.length?`${issPasses.length} beregnede, potentielt synlige ISS-passager er vist ovenfor.`:state.apiBase?`Ingen verificerede ISS-passager er tilgængelige. ${esc(issError)}`:'Tilslut Cloudflare-backenden i Indstillinger for aktuelle ISS-passager fra CelesTrak.'}</p>
 <p class="tiny muted">Kometers position og lysstyrke ændrer sig. Appen viser kun verificerede kometposter fra et vedligeholdt kilderegister (${verifiedEvents.length} registreret). Uden verificerede oplysninger vises ingen kometanbefaling.</p></div>
 <div class="notice warn">Ved solformørkelse: Se aldrig direkte på Solen uden et godkendt solfilter. Et almindeligt teleskop eller en kikkert uden egnet solfilter kan give alvorlig øjenskade.</div>`;
}
function renderPlaces(){return `${headline('Dine observationssteder','Gem steder, vælg primært varslingssted og sammenlign vejr')}
 <div class="panel"><div class="section-head"><h2>Find et sted</h2></div><div class="search-box"><input id="place-search" autocomplete="off" placeholder="Søg by eller område…" aria-label="Søg lokation"><button class="button" data-action="place-search">Søg</button></div><div id="search-results" class="search-results ${searchResults.length?'':'hidden'}">${searchResults.map((p,i)=>`<button data-action="save-search" data-index="${i}">${esc(p.name)}${p.admin1?', '+esc(p.admin1):''}, ${esc(p.country||'')}</button>`).join('')}</div>
 <div class="inline-actions" style="margin-top:12px"><button class="button secondary" data-action="gps">${ic('compass',16)} Brug min GPS</button><button class="button secondary" data-action="compare">${ic('refresh',16)} Sammenlign</button></div></div>
 <div class="section-head"><h2>Gemte steder</h2><span class="chip muted">${state.favorites.length} gemt</span></div>
 ${state.favorites.map(p=>`<div class="place-row"><span class="object-symbol">${ic('pin',20)}</span><span class="row-copy"><b>${esc(p.name)} ${state.primaryId===p.id?'<span class="chip" style="margin-left:3px">Pushsted</span>':''}</b><span>${p.lat.toFixed(3)}, ${p.lon.toFixed(3)} · ${p.light==='urban'?'By':p.light==='suburban'?'Forstad':p.light==='rural'?'Land':'Lysmiljø ikke angivet'} ${comparison[p.id]?.best?'· '+comparison[p.id].best.score+'/100':''}</span></span>
 <button class="icon-button" aria-label="Vælg ${esc(p.name)}" title="Vælg sted" data-action="select-place" data-id="${esc(p.id)}">${state.selectedId===p.id?ic('check',16):ic('chevron',17)}</button>
 ${state.primaryId!==p.id?`<button class="icon-button" aria-label="Vælg som pushsted" title="Vælg som pushsted" data-action="primary-place" data-id="${esc(p.id)}">${ic('bell',16)}</button>`:''}
 ${state.favorites.length>1?`<button class="icon-button" aria-label="Fjern sted" title="Slet sted" data-action="delete-place" data-id="${esc(p.id)}">${ic('trash',16)}</button>`:''}</div>`).join('')}
 <div class="panel"><div class="section-head"><h2>Observationskort</h2></div><div id="location-map" class="map-placeholder">Indlæser kort fra OpenStreetMap…</div><p class="map-legend">Kort © OpenStreetMap-bidragydere. Markørerne viser dine gemte steder, ikke beregnet lysforurening. Ingen automatisk rangering af mørke steder uden verificerede data.</p></div>
 <div class="notice">Et sted med samme skyprognose kan have vidt forskellig himmelkvalitet på grund af lysforurening. Vælg dit vurderede lysmiljø under Indstillinger, når stedet er aktivt.</div>`;
}
function toggleRow(key,name,description){return `<div class="toggle-row"><div><strong>${esc(name)}</strong><span>${esc(description)}</span></div><button class="switch ${state.notify[key]?'on':''}" aria-label="${esc(name)}" aria-pressed="${state.notify[key]}" data-action="toggle" data-key="${key}"></button></div>`;}
function renderSettings(){const installed=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const permission=typeof Notification!=='undefined'?Notification.permission:'ikke understøttet';
 return `${headline('Indstillinger','Tilpas observationsform, lokation og dine varsler')}
 <div class="panel"><div class="section-head"><h2>Observation</h2></div><div class="field"><label for="observe-mode">Sådan vil jeg observere</label><select id="observe-mode" data-field="mode">${Object.entries(MODES).map(([k,v])=>`<option value="${k}" ${state.mode===k?'selected':''}>${v}</option>`).join('')}</select></div>
 <div class="field"><label for="light-field">Lysmiljø i ${esc(place().name)} (din egen vurdering)</label><select id="light-field" data-field="light"><option value="unknown" ${place().light==='unknown'?'selected':''}>Ukendt / ikke målt</option><option value="urban" ${place().light==='urban'?'selected':''}>By med meget lys</option><option value="suburban" ${place().light==='suburban'?'selected':''}>Forstad / mellem</option><option value="rural" ${place().light==='rural'?'selected':''}>Mørkt område på landet</option></select><small>Dette er din vurdering, ikke et automatisk Bortle-estimat. Ukendt mørke begrænser anbefaling af deep-sky.</small></div></div>
 <div class="panel"><div class="section-head"><h2>${ic('bell',19)} Pushnotifikationer</h2></div>
 <div class="notice ${!supported?'warn':''}">${supported?`Systemtilladelse: ${esc(permission)}. ${installed?'Åbnet som installeret app.':'På iPhone skal appen føjes til hjemmeskærmen, før push kan aktiveres.'}`:'Denne browser understøtter ikke Web Push. Brug iPhone med iOS 16.4+ og en hjemmeskærmsinstalleret app.'}</div>
 <div class="field"><label for="backend-url">Cloudflare Worker-adresse</label><input id="backend-url" data-field="apiBase" type="url" autocomplete="url" placeholder="https://stjerneradar-api.…workers.dev" value="${esc(state.apiBase)}"><small>Kræves for baggrundsvarsler og ISS. Indtast din worker-URL, når backenden er deployet.</small></div>
 <div class="field"><label for="pair-key">Privat parringsnøgle</label><input id="pair-key" data-field="token" type="password" autocomplete="off" placeholder="APP_ADMIN_TOKEN" value="${esc(state.token)}"><small>Den nøgle du selv opretter i Cloudflare. Gemmes lokalt på denne enhed; aldrig i GitHub-koden.</small></div>
 <div class="inline-actions"><button class="button" data-action="enable-push" ${!supported?'disabled':''}>${ic('bell',16)} Aktivér push</button><button class="button secondary" data-action="test-push">Send test</button><button class="button secondary" data-action="check-status">Status</button></div>
 <div class="inline-actions" style="margin-top:9px"><button class="button secondary" data-action="sync-push">Gem varsler</button><button class="button danger" data-action="disable-push">Afmeld push</button></div>
 <p class="tiny muted">Primært varslingssted: <b>${esc(primary().name)}</b>. GPS opdateres ikke i baggrunden.</p>
 <div class="toggle-row"><div><strong>Stilleperiode: kl. 23–07</strong><span>Ingen afsendte pushbeskeder – heller ikke test eller særlige begivenheder. Fast valgt regel for V1.</span></div><span class="chip">Altid aktiv</span></div>
 ${toggleRow('early','Tidligt varsel','12–36 timer før en lovende nat.')}
 ${toggleRow('late','Sidste varsel','30–90 minutter før mulighedens start.')}
 ${toggleRow('clearing','Uventet opklaring','Når prognosen forbedres markant.')}
 ${toggleRow('events','Særlige begivenheder','Meteorregn og relevante verificerede observationer.')}
 <div class="field"><label for="alert-threshold">Minimum Stjerneindeks for almindeligt varsel</label><div class="range-row"><input id="alert-threshold" type="range" min="60" max="95" step="5" value="${state.threshold}" data-field="threshold"><span id="threshold-value">${state.threshold}/100</span></div></div>
 <div class="field"><label for="minimum-hours">Mindste sammenhængende tidsvindue</label><select id="minimum-hours" data-field="minHours">${[1,2,3].map(i=>`<option value="${i}" ${state.minHours===i?'selected':''}>${i} ${i===1?'time':'timer'}</option>`).join('')}</select></div>
 ${alertStatus?`<div class="notice">Pushstatus: ${esc(alertStatus.message||alertStatus.error||JSON.stringify(alertStatus))}${alertStatus.lastSentAt?' · Sidste afsendelse: '+fmt(alertStatus.lastSentAt)+' '+timeFormat(alertStatus.lastSentAt):''}</div>`:''}
 </div>
 <div class="panel"><div class="section-head"><h2>Nordlysradar</h2></div><div class="field"><label for="nordlys-url">Link til din Nordlysradar-app (valgfrit)</label><input id="nordlys-url" data-field="nordlysUrl" type="url" placeholder="https://…" value="${esc(state.nordlysUrl||'')}"></div>${/^https:\/\//.test(state.nordlysUrl||'')?`<a class="button secondary" href="${esc(state.nordlysUrl)}" target="_blank" rel="noopener noreferrer">Åbn Nordlysradar ↗</a>`:''}</div>
 <div class="panel"><div class="section-head"><h2>Installér på iPhone</h2></div><p class="tiny muted">Åbn Stjerneradar i Safari via HTTPS, vælg Del → Føj til hjemmeskærm, og åbn ikonet. Gå dernæst til Indstillinger → Aktivér push og tillad beskeder.</p><p class="tiny muted">Hvis iOS Fokus er aktivt, kan visning eller leveringstid ændres. Tjenesten bekræfter kun, at pushudbyderen har accepteret afsendelsen.</p></div>
 <div class="panel"><div class="section-head"><h2>Privatliv og data</h2></div><p class="tiny muted">GPS kræver tilladelse. Kun det valgte varslingssted og dit pushabonnement sendes til din private Worker. Favoritter lagres på din telefon. Ingen positionshistorik.</p>
 <button class="button danger" data-action="wipe">${ic('trash',15)} Slet lokale indstillinger og abonnement</button></div>
 <div class="footnote">Data: <a target="_blank" rel="noopener" href="https://open-meteo.com/en/docs/dmi-api">Open-Meteo / DMI</a>, <a target="_blank" rel="noopener" href="https://github.com/cosinekitty/astronomy">Astronomy Engine</a>, <a target="_blank" rel="noopener" href="https://www.imo.net/">IMO</a>, <a target="_blank" rel="noopener" href="https://celestrak.org/">CelesTrak</a> og OpenStreetMap. Brugsrettighederne gælder kun privat ikke-kommerciel brug.</div>`;
}
function render(){astronomyAvailable=!!lib();let body;
 if(state.activeTab==='today')body=renderToday();
 else if(state.activeTab==='week')body=renderWeek();
 else if(state.activeTab==='sky')body=renderSky();
 else if(state.activeTab==='events')body=renderEvents();
 else if(state.activeTab==='places')body=renderPlaces();
 else if(state.activeTab==='settings')body=renderSettings();
 else body=renderToday();
 if(mapInstance){try{mapInstance.remove();}catch{}mapInstance=null;}
 app.innerHTML=baseShell(body);
 if(state.activeTab==='places')setTimeout(drawMap,80);
}
function toast(msg){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=msg;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),4500);}
async function loadForecast(force=false){const target=place();const id=target.id,key=`srforecast:${target.lat.toFixed(3)}:${target.lon.toFixed(3)}`;
 let cached;try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(cached?.rows?.length&&(!force||!navigator.onLine)){weather={...cached,cachedStale:Date.now()-cached.fetchedAt>3*3600000};rated=getRatedHours();render();}
 if(!force&&cached?.fetchedAt&&Date.now()-cached.fetchedAt<20*60000)return;
 loading=true;weatherError='';render();
 try{
  const preferred=state.apiBase&&state.token?`${state.apiBase.replace(/\/$/,'')}/api/forecast?lat=${target.lat}&lon=${target.lon}`:weatherUrl(target.lat,target.lon);
  const candidates=[preferred,weatherUrl(target.lat,target.lon),weatherUrl(target.lat,target.lon,true)];
  let parsed,failed='';
  for(const url of [...new Set(candidates)]){
   try{
    const res=await fetch(url,{signal:AbortSignal.timeout(14000),headers:url.includes('/api/forecast')?{Authorization:`Bearer ${state.token}`}:{}});
    if(!res.ok)throw Error('HTTP '+res.status);
    const json=await res.json();
    if(url.includes('/v1/forecast'))json.stjerneradar_source='Open-Meteo · generel prognose (fallback)';
    parsed=forecastRows(json);break;
   }catch(e){failed=e.message;}
  }
  if(!parsed)throw new Error('Kunne ikke hente vejrprognose: '+failed);
  if(target.id!==place().id)return;
  weather=parsed;localStorage.setItem(key,JSON.stringify(parsed));rated=getRatedHours();
 }catch(e){weatherError=e?.message||'Vejrtjenesten kan ikke kontaktes.';
  if(!cached?.rows?.length){weather=null;rated=[];}else weather={...cached,cachedStale:true};}
 finally{if(id===place().id){loading=false;render();}}
}
async function selectPlace(p){state.selectedId=p.id;state.selectedNight='';state.chartTime=0;state.skyTime=0;
 save();weather=null;rated=[];issPasses=[];comparison={};render();await loadForecast();loadISS();}
async function getGPS(){if(!('geolocation' in navigator)){toast('GPS er ikke tilgængelig i denne browser.');return;}
 toast('Anmoder om din GPS-position…');navigator.geolocation.getCurrentPosition(async position=>{
  try{const {lat,lon}=clampLocation(position.coords.latitude,position.coords.longitude);const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Copenhagen';
   let p=state.favorites.find(x=>x.id==='gps');if(!p){p={id:'gps',name:'Min placering',lat,lon,tz,light:'unknown'};state.favorites.push(p);}else Object.assign(p,{lat,lon,tz,name:'Min placering'});
   await selectPlace(p);toast('GPS-position opdateret.');
  }catch(e){toast('Kunne ikke læse GPS-position: '+e.message);}
 },err=>toast('GPS-adgang fejlede: '+err.message),{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
}
async function searchPlace(){const query=document.getElementById('place-search')?.value.trim();if(!query||query.length<2){toast('Skriv mindst to bogstaver.');return;}
 try{const u=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=da&format=json`;
  const res=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Stedsøgning er midlertidigt utilgængelig.');
  const json=await res.json();searchResults=json.results||[];render();const input=document.getElementById('place-search');if(input)input.value=query;
  if(!searchResults.length)toast('Ingen steder fundet. Prøv et andet stednavn.');
 }catch(e){toast(e.message);}
}
async function addSearchPlace(i){const o=searchResults[i];if(!o)return;
 const {lat,lon}=clampLocation(o.latitude,o.longitude);
 const existing=state.favorites.find(p=>Math.abs(p.lat-lat)<.0001&&Math.abs(p.lon-lon)<.0001);
 const p=existing||{id:crypto.randomUUID?.()||Date.now()+'',name:[o.name,o.admin1].filter(Boolean).join(', '),lat,lon,tz:o.timezone||'Europe/Copenhagen',light:'unknown'};
 if(!existing)state.favorites.push(p);searchResults=[];await selectPlace(p);}
async function changePrimary(id){const p=state.favorites.find(x=>x.id===id);if(!p)return;
 state.primaryId=id;save();render();if(state.apiBase&&state.token)try{await syncSettings();toast('Varslingssted opdateret på serveren.');}catch(e){toast('Kun gemt lokalt. Varslingssted på serveren er ikke opdateret: '+e.message);}else toast('Primært sted valgt. Tilslut Worker for baggrundsvarsler.');}
function deletePlace(id){if(state.favorites.length<2)return;
 const p=state.favorites.find(x=>x.id===id);if(!confirm(`Fjern ${p?.name||'stedet'}?`))return;
 const wasPrimary=state.primaryId===id;state.favorites=state.favorites.filter(x=>x.id!==id);
 if(state.selectedId===id){state.selectedId=state.favorites[0].id;weather=null;rated=[];}
 if(wasPrimary)state.primaryId=state.favorites[0].id;save();render();loadForecast();if(wasPrimary)syncSettings().catch(()=>toast('Pushsted skal synkroniseres fra Indstillinger.'));
}
async function comparePlaces(){toast('Henter sammenlignelige prognoser…');let result={};
 for(const p of state.favorites.slice(0,10)){
  try{let f;
   for(const url of [weatherUrl(p.lat,p.lon),weatherUrl(p.lat,p.lon,true)]){
    try{const res=await fetch(url,{signal:AbortSignal.timeout(13000)});if(!res.ok)continue;f=forecastRows(await res.json());break;}catch{}
   }
   if(!f||!lib())continue;
   const hours=f.rows.filter(h=>h.time>=Date.now()&&h.time<Date.now()+36*3600000&&skyAt(h.time,p)?.sunAlt<0).map(h=>({...h,rating:scoreHour(h,skyAt(h.time,p),{mode:state.mode,light:p.light})}));
   result[p.id]={best:bestWindow(hours,state.minHours)};
  }catch{}
 }
 comparison=result;render();toast('Sammenligning opdateret. Score bygger på skyer, mørke og dine lysmiljøvalg.');
}
function drawMap(){const target=document.getElementById('location-map');if(!target)return;
 const L=globalThis.L;if(!L){target.outerHTML='<div class="map-placeholder">Kortet kræver internetforbindelse til Leaflet/OpenStreetMap.</div>';return;}
 const ps=state.favorites,center=place();target.className='';mapInstance=L.map(target,{zoomControl:true,scrollWheelZoom:false}).setView([center.lat,center.lon],9);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(mapInstance);
 for(const p of ps){L.marker([p.lat,p.lon]).addTo(mapInstance).bindPopup(`<b>${esc(p.name)}</b><br>${p.id===state.primaryId?'Primært varslingssted':'Gemt observationssted'}`);}
 if(ps.length>1){const bounds=L.latLngBounds(ps.map(p=>[p.lat,p.lon]));mapInstance.fitBounds(bounds.pad(.28),{maxZoom:11});}
 setTimeout(()=>mapInstance?.invalidateSize(),150);
}
async function apiCall(path,options={}){const base=state.apiBase?.trim().replace(/\/$/,'');if(!base||!/^https:\/\//.test(base)&&!/^http:\/\/localhost/.test(base))throw new Error('Angiv en gyldig HTTPS-adresse til Cloudflare Worker.');
 const headers={Accept:'application/json',...options.headers};if(state.token)headers.Authorization=`Bearer ${state.token}`;
 if(options.body)headers['Content-Type']='application/json';
 const res=await fetch(base+path,{...options,headers,signal:AbortSignal.timeout(15000)});
 let response;try{response=await res.json();}catch{response={};}
 if(!res.ok)throw Error(response.error||response.message||`Serveren svarede ${res.status}.`);
 return response;
}
async function syncSettings(){const p=primary();if(!state.token)throw Error('Indtast din private parringsnøgle.');
 const result=await apiCall('/api/settings',{method:'POST',body:JSON.stringify({installationId:state.instanceId,
  location:{name:p.name,lat:p.lat,lon:p.lon,tz:p.tz,light:p.light},
  mode:state.mode,threshold:state.threshold,minHours:state.minHours,notify:state.notify})});
 alertStatus={message:'Indstillinger gemt hos Cloudflare',...result};return result;
}
function decodeKey(base64){const padding='='.repeat((4-base64.length%4)%4),raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function enablePush(){// Called as the first async operation from a user gesture.
 if(!('Notification' in globalThis&&'serviceWorker' in navigator&&'PushManager' in globalThis))return toast('Push understøttes ikke her.');
 if(!state.apiBase||!state.token)return toast('Udfyld Worker-URL og parringsnøgle, og gem dem.');
 try{
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Notifikationstilladelse blev ikke givet i iOS.');
  const reg=await navigator.serviceWorker.ready;
  const config=await apiCall('/api/config');if(!config.vapidPublicKey)throw Error('Worker mangler VAPID_PUBLIC_KEY.');
  let subscription=await reg.pushManager.getSubscription();
  if(subscription&&config.vapidPublicKey!==state.lastVapidPublicKey){await subscription.unsubscribe();subscription=null;}
  if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(config.vapidPublicKey)});
  await syncSettings();await apiCall('/api/push/subscribe',{method:'POST',body:JSON.stringify({installationId:state.instanceId,subscription:subscription.toJSON()})});
  state.lastVapidPublicKey=config.vapidPublicKey;save();alertStatus={message:'Pushabonnement er registreret. Test det i appen, når klokken er 07–23.'};render();toast('Push er aktiveret. Tryk Send test for at afprøve det.');
 }catch(e){alertStatus={error:e.message};render();toast('Push kunne ikke aktiveres: '+e.message);}
}
async function testPush(){try{const x=await apiCall('/api/push/test',{method:'POST',body:JSON.stringify({installationId:state.instanceId})});
 alertStatus={message:x.message||'Push er accepteret af pushudbyderen. Den faktiske visning afhænger af iOS.'};render();toast(alertStatus.message);
 }catch(e){alertStatus={error:e.message};render();toast('Test mislykkedes: '+e.message);}}
async function checkStatus(){try{const x=await apiCall(`/api/status?installationId=${encodeURIComponent(state.instanceId)}`);
 alertStatus={message:`${x.subscriptionCount||0} abonnementsenhed(er). ${x.lastCheckAt?'Sidste kontrol: '+new Date(x.lastCheckAt).toLocaleString('da-DK'): 'Ingen planlagt kontrol registreret.'}${x.lastReason?' · '+x.lastReason:''}`,lastSentAt:x.lastSentAt};render();toast('Status hentet.');
 }catch(e){toast('Status kunne ikke hentes: '+e.message);}}
async function disablePush(){try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
 if(sub){if(state.apiBase&&state.token)await apiCall('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({installationId:state.instanceId,endpoint:sub.endpoint})});await sub.unsubscribe();}
 alertStatus={message:'Pushabonnement fjernet på denne enhed.'};render();toast('Push er afmeldt.');
 }catch(e){toast('Kunne ikke afmelde: '+e.message);}}
async function wipe(){if(!confirm('Vil du slette dine lokale steder og indstillinger samt afmelde push?'))return;
 try{await disablePush();if(state.apiBase&&state.token)await apiCall('/api/delete',{method:'POST',body:JSON.stringify({installationId:state.instanceId})});}catch{}
 for(const key of Object.keys(localStorage))if(key.startsWith('srforecast:')||key===STORAGE)localStorage.removeItem(key);
 state={...DEFAULT,notify:{...DEFAULT.notify},favorites:structuredClone(DEFAULT.favorites),instanceId:crypto.randomUUID?.()||'sr-'+Date.now()};save();weather=null;rated=[];alertStatus=null;render();loadForecast();}
async function loadISS(){issPasses=[];issError='';if(!state.apiBase)return;
 try{const p=place();const r=await apiCall(`/api/iss?lat=${p.lat}&lon=${p.lon}`);
 issPasses=(r.passes||[]).map(x=>({...x,time:x.peak??x.start}));
 }catch(e){issError=e.message;}
 if(state.activeTab==='events')render();}
async function installServiceWorker(){if(!('serviceWorker' in navigator))return;
 try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(e){console.warn('Service worker:',e);}}
function navigate(tab){state.activeTab=tab;history.replaceState(null,'',tab==='today'?'./':'?tab='+tab);save();window.scrollTo({top:0,behavior:'instant'});
 render();if(tab==='events')loadISS();}
function updateSettings(e){const field=e.target.dataset.field;if(!field)return;
 let val=e.target.value;if(field==='light')place().light=val;
 else if(field==='threshold'||field==='minHours')state[field]=Number(val);
 else state[field]=val;
 save();if(field==='threshold')document.getElementById('threshold-value').textContent=state.threshold+'/100';
 if(field==='mode'||field==='light'||field==='minHours'){rated=getRatedHours();render();}
}
document.addEventListener('change',e=>{if(e.target?.dataset.field)updateSettings(e);
 if(e.target?.dataset.action==='sky-time'){state.skyTime=Date.now()+Number(e.target.value)*1800000;save();render();}
 if(e.target?.dataset.action==='sky-zoom'){state.skyZoom=Number(e.target.value);save();render();}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
 try{
  if(action==='tab')navigate(b.dataset.tab);
  if(action==='settings')navigate('settings');if(action==='locations')navigate('places');
  if(action==='reload')await loadForecast(true);
  if(action==='night'){state.selectedNight=b.dataset.night;save();render();}
  if(action==='select-hour'){state.chartTime=Number(b.dataset.time);save();render();}
  if(action==='show-object'){state.selectedObject=b.dataset.object;state.skyTime=state.chartTime||Date.now();navigate('sky');}
  if(action==='sky-object'){state.selectedObject=b.dataset.object;save();render();}
  if(action==='event'){state.openEvent=state.openEvent===b.dataset.event?'':b.dataset.event;save();render();}
  if(action==='place-search')await searchPlace();
  if(action==='save-search')await addSearchPlace(Number(b.dataset.index));
  if(action==='select-place')await selectPlace(state.favorites.find(p=>p.id===b.dataset.id));
  if(action==='primary-place')await changePrimary(b.dataset.id);
  if(action==='delete-place')deletePlace(b.dataset.id);
  if(action==='gps')await getGPS();if(action==='compare')await comparePlaces();
  if(action==='toggle'){state.notify[b.dataset.key]=!state.notify[b.dataset.key];save();render();toast('Indstillingen er gemt lokalt. Tryk "Gem varsler" for at opdatere serveren.');}
  if(action==='enable-push')await enablePush();if(action==='test-push')await testPush();
  if(action==='check-status')await checkStatus();if(action==='sync-push'){await syncSettings();render();toast('Varsler gemt på serveren.');}
  if(action==='disable-push')await disablePush();if(action==='wipe')await wipe();
 }catch(error){toast('Der opstod en fejl: '+error.message);}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='place-search'){e.preventDefault();searchPlace();}});
window.addEventListener('online',()=>{if(weather&&!weatherFresh())loadForecast(true);});
async function loadVerifiedEvents(){
 try{
  const response=await fetch('./verified-events.json',{cache:'no-cache'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const raw=await response.json();
  if(!Array.isArray(raw))throw Error('Kilderegister er ikke en liste.');
  const https=url=>typeof url==='string'&&url.startsWith('https://');
  verifiedEvents=raw.filter(e=>e&&e.type==='comet'&&typeof e.id==='string'&&typeof e.name==='string'&&e.name.length<100&&
    Number.isFinite(Date.parse(e.time))&&https(e.url)&&Number.isFinite(Date.parse(e.verifiedAt))&&typeof e.description==='string'&&e.description.length<700)
    .map(e=>({id:e.id,name:e.name,type:'comet',time:Date.parse(e.time),description:e.description,url:e.url,source:e.source||'Verificeret kilde'}));
  if(state.activeTab==='events')render();
 }catch(e){console.warn('Kometregister kunne ikke indlæses:',e.message);}
}
function start(){const q=new URLSearchParams(location.search);const tab=q.get('tab');if(['today','week','sky','events','places','settings'].includes(tab))state.activeTab=tab;
 save();installServiceWorker();render();loadVerifiedEvents();let attempts=0;
 const waitForAstronomy=()=>{
  if(lib()){rated=getRatedHours();render();loadForecast();if(state.activeTab==='events')loadISS();return;}
  if(++attempts<24)setTimeout(waitForAstronomy,250);
  else{render();loadForecast();toast('Astronomy Engine kunne ikke indlæses. Prøv igen med internet.');}
 };waitForAstronomy();
}
start();
