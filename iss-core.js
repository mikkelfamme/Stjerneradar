/* TLE parser + approximate Earth-shadow-aware ISS visibility. Astronomy Engine and satellite.js injected. */
export function parseTle(text,at=Date.now()){
 const lines=String(text||'').trim().split(/\r?\n/),line1=lines.find(l=>/^1 25544/.test(l)),line2=lines.find(l=>/^2 25544/.test(l));
 if(!line1||!line2||line1.length<63||line2.length<63)throw Error('ISS-TLE mangler eller er ugyldig.');
 const y=+line1.slice(18,20),year=y>=57?1900+y:2000+y;
 const epoch=Date.UTC(year,0,1)+(Number(line1.slice(20,32))-1)*86400000;
 const age=at-epoch;
 if(!Number.isFinite(age)||age>72*3600000||age< -86400000)throw Error('ISS-banedata er for gamle.');
 return {line1,line2,epoch,epochAgeHours:Math.round(age/3600000)};
}
function sunlit(pos,time,A){const sun=A.GeoVector(A.Body.Sun,new Date(time),true);
 const u=[sun.x,sun.y,sun.z],m=Math.hypot(...u),r=[pos.x,pos.y,pos.z];
 if(!m)return false;
 const dot=r.reduce((s,v,i)=>s+v*u[i]/m,0),dist=Math.sqrt(Math.max(0,r.reduce((s,v)=>s+v*v,0)-dot*dot));
 return dot>0||dist>6378.137;
}
function sunAltitude(time,loc,A){const observer=new A.Observer(loc.lat,loc.lon,0),date=new Date(time);
 const sun=A.Equator(A.Body.Sun,date,observer,true,true);
 return A.Horizon(date,observer,sun.ra,sun.dec,'normal').altitude;
}
export function calculateIssPasses(tle,loc,now,A,S,hours=48){
 if(!A?.Observer||!S?.twoline2satrec)return [];
 const {line1,line2}=typeof tle==='string'?parseTle(tle,now):parseTle(tle.line1+'\n'+tle.line2,now);
 const sat=S.twoline2satrec(line1,line2),p={latitude:loc.lat*Math.PI/180,longitude:loc.lon*Math.PI/180,height:0};
 const dt=120000,end=now+hours*3600000;const found=[];let curr=null;
 for(let t=now;t<=end;t+=dt){
  const d=new Date(t),pv=S.propagate(sat,d);if(!pv?.position||typeof pv.position==='boolean')continue;
  const ecf=S.eciToEcf(pv.position,S.gstime(d)),look=S.ecfToLookAngles(p,ecf),alt=look.elevation*180/Math.PI;
  const valid=alt>=10&&sunAltitude(t,loc,A)<=-6&&sunlit(pv.position,t,A);
  if(valid){if(!curr)curr={start:t,end:t,peak:t,maxAltitude:alt};else curr.end=t;
   if(alt>curr.maxAltitude){curr.maxAltitude=alt;curr.peak=t;}}
  else if(curr){if(curr.maxAltitude>=15&&curr.end-curr.start>=240000)found.push({...curr,end:curr.end+dt});curr=null;}
 }
 if(curr&&curr.maxAltitude>=15&&curr.end-curr.start>=240000)found.push({...curr,end:curr.end+dt});
 return found;
}
