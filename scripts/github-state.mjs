/* Small durable alert state on a dedicated branch. Never stores ntfy topic or coordinates. */
const BRANCH='stjerneradar-alert-state',FILE='alerts-state.json';
function apiUrl(repository,path){if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw Error('GITHUB_REPOSITORY mangler eller er ugyldig.');
 return `https://api.github.com/repos/${repository}${path}`;}
export function createStateClient({token,repository,sha,fetchFn=fetch}){
 if(!token||!repository||!sha)throw Error('GITHUB_TOKEN, GITHUB_REPOSITORY eller GITHUB_SHA mangler.');
 const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
 async function github(method,path,body){
  const r=await fetchFn(apiUrl(repository,path),{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const text=await r.text();let data={};try{data=JSON.parse(text);}catch{}
  if(!r.ok&&r.status!==404&&r.status!==422)throw Error(`GitHub API ${method} ${r.status} (${String(data.message||'fejl').slice(0,110)}). Kontroller workflowets contents: write.`);
  return {status:r.status,data};
 }
 async function read(){
  const result=await github('GET',`/contents/${FILE}?ref=${BRANCH}`);
  if(result.status===404)return {exists:false,data:null,sha:null};
  if(result.status!==200||result.data?.type!=='file')throw Error('GitHub statefil kunne ikke læses.');
  const raw=Buffer.from(result.data.content||'','base64').toString('utf8');
  try{return {exists:true,data:JSON.parse(raw),sha:result.data.sha};}catch{throw Error('GitHub statefil er ugyldig JSON - stop for at undgå dubletter.');}
 }
 async function save(content,lastSha){
  const encoded=Buffer.from(JSON.stringify(content,null,2)+'\n').toString('base64');
  // First run: create state branch at default-branch commit, not on main.
  if(!lastSha){
   const r=await github('GET',`/git/ref/heads/${BRANCH}`);
   if(r.status===404){const c=await github('POST','/git/refs',{ref:`refs/heads/${BRANCH}`,sha});
    if(c.status!==201&&c.status!==422)throw Error('Kunne ikke oprette GitHub state-branch.');}
  }
  const previous=lastSha?{sha:lastSha}:{};
  const saved=await github('PUT',`/contents/${FILE}`,{message:'Stjerneradar: opdater varslingshukommelse',content:encoded,branch:BRANCH,...previous});
  if(saved.status!==200&&saved.status!==201)throw Error('GitHub kunne ikke gemme varslingshukommelsen (mulig samtidig kørsel).');
  return saved.data.content?.sha||null;
 }
 return {read,save,BRANCH};
}
