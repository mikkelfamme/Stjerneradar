import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo='mikkelfamme/Stjerneradar';
const topic='stjerner-'+('ab9c4d12'.repeat(6));
const config=JSON.stringify({schema_version:2,ntfyTopic:topic,ntfyServer:'https://ntfy.sh',
 location:{name:'Teststed',lat:55.6,lon:12.5,tz:'Europe/Copenhagen',light:'suburban'},
 mode:'eyes',threshold:80,minHours:1,notify:{early:true,late:true,clearing:true,events:true}});
function run(extra={},preload=false){return spawnSync(process.execPath,[...(preload?['--import','./tests/support/mock-ntfy.mjs']:[]),'scripts/run-alerts.mjs'],{
 cwd:root,encoding:'utf8',timeout:10000,
 env:{...process.env,STJERNERADAR_ALERT_CONFIG:'',STJERNERADAR_CONFIG:'',NTFY_TOPIC:'',
 GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'workflow_dispatch',TEST_MESSAGE:'false',DRY_RUN:'false',...extra}});
}
test('V1.2 manuel ntfy-test virker med kun samlet Secret uden GitHub API og astronomipakker',()=>{
 const r=run({TEST_MESSAGE:'true',STJERNERADAR_ALERT_CONFIG:config},true);
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/MOCK_NTFY_ACCEPTED/);
 assert.match(r.stdout,/ntfy accepterede testbeskeden/);
 assert.doesNotMatch(r.stdout, new RegExp(topic));
});
test('V1.2 manuel test uden Secret melder vejledning og ikke blot exit code 1',()=>{
 const r=run({TEST_MESSAGE:'true'});
 assert.equal(r.status,1);assert.match(r.stderr,/STJERNERADAR_ALERT_CONFIG/);
 assert.match(r.stderr,/Opret alarmkanal/);
});
test('V1.2 planlagt kørsel uden Secret springes roligt over',()=>{
 const r=run({GITHUB_EVENT_NAME:'schedule'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/springes over/);
});
