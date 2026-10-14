/* Accurate celestial calculations use Astronomy Engine (MIT, browser build).
   It is loaded before this module by index.html. When unavailable, this module
   explicitly reports unavailable data instead of inventing object positions. */
export function lib(){return globalThis.Astronomy||null;}
export function observer(place){const A=lib();return A?new A.Observer(place.lat,place.lon,0):null;}
export function horizontal(body,date,place){
 const A=lib();if(!A)return null;
 try{const obs=observer(place);const eq=A.Equator(body,new Date(date),obs,true,true);
 const hz=A.Horizon(new Date(date),obs,eq.ra,eq.dec,'normal');
 return {name:body,altitude:hz.altitude,azimuth:hz.azimuth,ra:eq.ra,dec:eq.dec};
 }catch{return null;}
}
export function skyAt(time,place){
 const A=lib();if(!A)return null;
 const Sun=horizontal(A.Body.Sun,time,place),Moon=horizontal(A.Body.Moon,time,place);
 if(!Sun||!Moon)return null;
 try{const illum=A.Illumination(A.Body.Moon,new Date(time));
 return {sunAlt:Sun.altitude,moonAlt:Moon.altitude,moonAz:Moon.azimuth,moonFraction:illum.phase_fraction,
   phaseAngle:A.MoonPhase(new Date(time))};
 }catch{return null;}
}
export const PLANETS=[
 {id:'Mercury',name:'Merkur',magnitude:0.2,type:'planet'},
 {id:'Venus',name:'Venus',magnitude:-4.0,type:'planet'},
 {id:'Mars',name:'Mars',magnitude:0.5,type:'planet'},
 {id:'Jupiter',name:'Jupiter',magnitude:-2.4,type:'planet'},
 {id:'Saturn',name:'Saturn',magnitude:0.7,type:'planet'},
 {id:'Uranus',name:'Uranus',magnitude:5.7,type:'planet'},
 {id:'Neptune',name:'Neptun',magnitude:7.8,type:'planet'}
];
export function planetPositions(time,place){const A=lib();if(!A)return [];
 return PLANETS.map(p=>{const h=horizontal(A.Body[p.id],time,place);return h?{...h,...p}:null}).filter(Boolean);
}
export function nextAstronomyTimes(time,place){
 const A=lib();if(!A)return null;const o=observer(place),start=new Date(time);
 function seek(body,direction,altitude=null){
  try{const t=altitude===null?A.SearchRiseSet(body,o,direction,start,2):A.SearchAltitude(body,o,direction,start,2,altitude);
   return t?.date?.getTime()??null;
  }catch{return null;}
 }
 return {sunset:seek(A.Body.Sun,-1),sunrise:seek(A.Body.Sun,1),astroDark:seek(A.Body.Sun,-1,-18),
 moonrise:seek(A.Body.Moon,1),moonset:seek(A.Body.Moon,-1)};
}
export function phaseName(angle){
 if(angle<18||angle>=342)return 'Nymåne';if(angle<72)return 'Tiltagende månesegl';
 if(angle<108)return 'Første kvarter';if(angle<162)return 'Tiltagende måne';
 if(angle<198)return 'Fuldmåne';if(angle<252)return 'Aftagende måne';
 if(angle<288)return 'Sidste kvarter';return 'Aftagende månesegl';
}
// J2000 right ascension (hours), declination (degrees), visual magnitude. Bright-star subset.
// Positions are rendered using correct sidereal rotation in Astronomy.Horizon.
export const STARS=[
 ['Polaris',2.5303,89.264,2.0],['Vega',18.6156,38.783,0.0],['Deneb',20.6905,45.28,1.25],
 ['Altair',19.8464,8.868,0.77],['Capella',5.2782,45.998,0.08],['Arcturus',14.261,19.182,-0.05],
 ['Betelgeuse',5.9195,7.407,0.5],['Rigel',5.2423,-8.202,0.13],['Sirius',6.7525,-16.716,-1.46],
 ['Procyon',7.655,5.225,0.34],['Castor',7.5767,31.888,1.58],['Pollux',7.7553,28.026,1.14],
 ['Dubhe',11.062,61.75,1.8],['Merak',11.03,56.382,2.37],['Phecda',11.897,53.695,2.44],
 ['Megrez',12.257,57.033,3.31],['Alioth',12.9,55.96,1.77],['Mizar',13.3987,54.925,2.23],
 ['Alkaid',13.792,49.313,1.86],['Caph',0.1529,59.149,2.28],['Schedar',0.6751,56.537,2.24],
 ['Gamma Cas',0.945,60.717,2.5],['Ruchbah',1.4303,60.235,2.68],['Segin',1.906,63.67,3.35],
 ['Alpheratz',0.1398,29.09,2.07],['Mirach',1.162,35.62,2.05],['Almach',2.065,42.33,2.1],
 ['Bellatrix',5.4189,6.35,1.64],['Mintaka',5.5334,-0.299,2.25],['Alnilam',5.6036,-1.202,1.69],
 ['Alnitak',5.6793,-1.943,1.75],['Saiph',5.795,-9.669,2.09],['Aldebaran',4.5987,16.51,0.86],
 ['Antares',16.49,-26.43,1.06],['Spica',13.4199,-11.16,0.98],['Regulus',10.1395,11.967,1.35],
 ['Fomalhaut',22.9608,-29.622,1.16],['Achernar',1.6286,-57.237,0.46],
 ['Elnath',5.438,28.607,1.65],['Menkalinan',5.993,44.948,1.9],
 ['Sadr',20.37,40.257,2.23],['Gienah',20.77,33.97,2.48],['Albireo',19.512,27.959,3.05],
 ['Kochab',14.845,74.156,2.08],['Pherkad',15.345,71.834,3.0]
].map(([name,ra,dec,mag])=>({id:name,name,ra,dec,mag,type:'star'}));
export const CONSTELLATIONS=[
 {name:'Karlsvognen',names:['Dubhe','Merak','Phecda','Megrez','Alioth','Mizar','Alkaid'],links:[['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez'],['Megrez','Dubhe'],['Megrez','Alioth'],['Alioth','Mizar'],['Mizar','Alkaid']]},
 {name:'Cassiopeia',names:['Caph','Schedar','Gamma Cas','Ruchbah','Segin'],links:[['Caph','Schedar'],['Schedar','Gamma Cas'],['Gamma Cas','Ruchbah'],['Ruchbah','Segin']]},
 {name:'Orion',names:['Betelgeuse','Bellatrix','Mintaka','Alnilam','Alnitak','Rigel','Saiph'],links:[['Betelgeuse','Bellatrix'],['Bellatrix','Mintaka'],['Mintaka','Alnilam'],['Alnilam','Alnitak'],['Alnitak','Saiph'],['Saiph','Rigel'],['Rigel','Alnitak'],['Betelgeuse','Alnitak']]},
 {name:'Sommertrekanten',names:['Vega','Deneb','Altair'],links:[['Vega','Deneb'],['Deneb','Altair'],['Altair','Vega']]},
 {name:'Andromeda',names:['Alpheratz','Mirach','Almach'],links:[['Alpheratz','Mirach'],['Mirach','Almach']]}
];
export function starsNow(time,place){const A=lib();if(!A)return [];
 const o=observer(place),dt=new Date(time);
 return STARS.map(s=>{
  // Stars are supplied in J2000. Precession is negligible for this overview chart.
  const hor=A.Horizon(dt,o,s.ra,s.dec,'normal');return {...s,altitude:hor.altitude,azimuth:hor.azimuth};
 }).filter(s=>s.altitude>0);
}
/** Approximate galactic equator from the IAU 1958/J2000 rotation. This is a map guide, not an assertion of visible Milky Way brightness. */
export function milkyWayBand(time,place){
 const A=lib();if(!A)return [];
 const o=observer(place),d=new Date(time),points=[];
 for(let degree=0;degree<=360;degree+=5){
  const l=degree*Math.PI/180,cy=Math.cos(l),sy=Math.sin(l);
  // Transpose of the J2000 equatorial-to-galactic rotation matrix.
  const x=-0.0548755604*cy+0.4941094279*sy;
  const y=-0.8734370902*cy-0.4448296300*sy;
  const z=-0.4838350155*cy+0.7469822445*sy;
  const ra=((Math.atan2(y,x)*12/Math.PI)%24+24)%24;
  const dec=Math.asin(Math.max(-1,Math.min(1,z)))*180/Math.PI;
  const h=A.Horizon(d,o,ra,dec,'normal');
  points.push({longitude:degree,altitude:h.altitude,azimuth:h.azimuth});
 }
 return points;
}
export function skyObjects(time,place,weatherRating){
 const sky=skyAt(time,place);if(!sky)return [];
 const planets=planetPositions(time,place).filter(p=>p.altitude>=8);
 const moon=horizontal(lib().Body.Moon,time,place);
 const objects=[...planets];if(moon?.altitude>5)objects.unshift({id:'Moon',name:'Månen',...moon,type:'moon',magnitude:-12});
 for(const p of objects){p.visibleCandidate=!!(sky.sunAlt<=-6 && (weatherRating?.score??0)>=30);
  p.tool=p.id==='Uranus'||p.id==='Neptune'?'Teleskop':p.id==='Moon'?'Blotte øje / kikkert':p.id==='Jupiter'||p.id==='Saturn'?'Kikkert / teleskop':'Blotte øje / kikkert';}
 return objects.sort((a,b)=>b.altitude-a.altitude);
}
export function eclipseEvents(start,place,days=370){
 const A=lib();if(!A)return [];const end=+start+days*86400000,res=[];
 try{
  let lunar=A.SearchLunarEclipse(new Date(start));
  for(let i=0;i<5&&lunar.peak.date.getTime()<end;i++){
   const t=lunar.peak.date.getTime(), moon=horizontal(A.Body.Moon,t,place);
   if(moon&&moon.altitude>0)res.push({id:'lunar-'+t,type:'eclipse',name:`${lunar.kind==='total'?'Total':lunar.kind==='partial'?'Delvis':'Halvskygge'} måneformørkelse`,time:t,
    description:'Månen er over horisonten ved maksimum. Lokal synlighed afhænger af vejrforhold.',url:'https://eclipse.gsfc.nasa.gov/eclipse.html',source:'Astronomy Engine / NASA'});
   lunar=A.NextLunarEclipse(lunar.peak);
  }
 }catch{/* Lack of eclipse data must not invent events. */}
 try{let solar=A.SearchLocalSolarEclipse(new Date(start),observer(place));
  for(let i=0;i<3&&solar.peak.time.date.getTime()<end;i++){
   const t=solar.peak.time.date.getTime();res.push({id:'solar-'+t,type:'eclipse',name:`${solar.kind==='total'?'Total':solar.kind==='annular'?'Ringformet':'Delvis'} solformørkelse`,time:t,
    description:'Beregnet synlig fra dette sted. Se aldrig direkte på Solen uden korrekt solfilter.',url:'https://eclipse.gsfc.nasa.gov/eclipse.html',source:'Astronomy Engine / NASA'});
   solar=A.NextLocalSolarEclipse(solar.peak.time);
  }
 }catch{}
 return res.sort((a,b)=>a.time-b.time);
}
// IMO annual showers: approximate *date* of activity peak, NOT guaranteed exact peak hour.
export const METEORS=[
 ['Kvadrantiderne',1,3,'1.–5. januar'],['Lyriderne',4,22,'14.–30. april'],
 ['Eta-Aquariderne',5,6,'19. april–28. maj'],['Sydlige Delta-Aquarider',7,30,'12. juli–23. august'],
 ['Perseiderne',8,12,'17. juli–24. august'],['Draconiderne',10,8,'6.–10. oktober'],
 ['Orioniderne',10,21,'2. oktober–7. november'],['Leoniderne',11,17,'6.–30. november'],
 ['Geminiderne',12,14,'4.–20. december'],['Ursiderne',12,22,'17.–26. december']
];
export function meteorEvents(start=new Date(),years=2){const y=start.getUTCFullYear(),limit=+start+years*366*86400000,res=[];
 for(let yy=y;yy<=y+years;yy++)for(const [name,m,d,activity] of METEORS){
  const time=Date.UTC(yy,m-1,d,12);if(time<+start-86400000||time>=limit)continue;
  res.push({id:`meteor-${name}-${yy}`,type:'meteor',name,time,
   description:`Forventet aktivitetsmaksimum omkring denne dato. Aktiv periode: ${activity}. Faktisk lokal synlighed afhænger af radiant, månelys og skydække; ZHR er ikke et løfte om antal meteorer.`,
   source:'IMO – vejledende årlig dato',url:'https://www.imo.net/resources/calendar/'});
 }return res.sort((a,b)=>a.time-b.time);
}
export function azimuthDirection(az){return ['N','NØ','Ø','SØ','S','SV','V','NV'][Math.round((((az%360)+360)%360)/45)%8];}
