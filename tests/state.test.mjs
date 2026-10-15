import test from 'node:test';
import assert from 'node:assert/strict';
import {createStateClient} from '../scripts/github-state.mjs';
const response=(status,value)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(value)});

test('GitHub varsels-state første kørsel opretter separat branch og ikke main',async()=>{
 const calls=[];
 const fake=async(url,options)=>{
  const path=new URL(url).pathname+new URL(url).search;
  calls.push({method:options.method,path,body:options.body?JSON.parse(options.body):undefined});
  if(options.method==='GET'&&path.includes('contents/alerts-state.json'))return response(404,{message:'Not Found'});
  if(options.method==='GET'&&path.includes('git/ref/heads/'))return response(404,{message:'Not Found'});
  if(options.method==='POST'&&path.endsWith('/git/refs'))return response(201,{ref:'refs/heads/stjerneradar-alert-state'});
  if(options.method==='PUT'&&path.includes('contents/alerts-state.json'))return response(201,{content:{sha:'new-file-sha'}});
  throw Error('Unexpected mock GitHub request '+path);
 };
 const github=createStateClient({repository:'example/stjerneradar',token:'test-token',sha:'a'.repeat(40),fetchFn:fake});
 const state=await github.read();assert.equal(state.exists,false);
 const revision=await github.save({schema:1,siteKey:'hash',sent:{},snapshots:{}},state.sha);
 assert.equal(revision,'new-file-sha');
 assert.equal(calls.find(x=>x.method==='POST').body.ref,'refs/heads/stjerneradar-alert-state');
 assert.equal(calls.find(x=>x.method==='PUT').body.branch,'stjerneradar-alert-state');
 assert.ok(!JSON.stringify(calls).includes('ntfy_secret'));
});
test('GitHub API fejl stopper afsendelse før tab af deduplikation',async()=>{
 const github=createStateClient({repository:'example/stjerneradar',token:'test-token',sha:'b'.repeat(40),
 fetchFn:async()=>response(403,{message:'Resource not accessible by integration'})});
 await assert.rejects(()=>github.read(),/contents: write/);
});
