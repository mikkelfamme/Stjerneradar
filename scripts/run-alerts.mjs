/* Friendly error output in GitHub Actions, without exposing private ntfy topics. */
import {appendFileSync} from 'node:fs';
import {resolveAlertSetup} from './alert-config.mjs';
const summary=process.env.GITHUB_STEP_SUMMARY;
function note(text){if(summary){try{appendFileSync(summary,text+'\n');}catch{}}}
function abort(error){
 const msg=String(error?.message||error||'Ukendt fejl').replace(/[\r\n]+/g,' ').slice(0,700);
 console.error('::error title=Stjerneradar varsler::'+msg);
 console.error('Hjaelp: Aabn Stjerneradar > Indstillinger > Opret alarmkanal, og kopier GitHub-hemmeligheden til STJERNERADAR_ALERT_CONFIG. Der kraeves kun EN Secret.');
 note('### Varslingskontrol: fejl\n'+msg+'\n\n**Løsning:** Stjerneradar → Indstillinger → Opret alarmkanal → Kopiér GitHub-hemmelighed → GitHub Secret `STJERNERADAR_ALERT_CONFIG`.');
 process.exitCode=1;
}
if(!process.env.STJERNERADAR_ALERT_CONFIG&&process.env.GITHUB_EVENT_NAME==='schedule'){
 console.log('Stjerneradar er endnu ikke sat op med GitHub Secret STJERNERADAR_ALERT_CONFIG. Automatisk kontrol springes over indtil aktivering.');
 note('### Stjerneradar er endnu ikke tilsluttet\nOpret alarmkanal i appen, og indsæt `STJERNERADAR_ALERT_CONFIG` i GitHub Secrets.');
}else{
 try{resolveAlertSetup(process.env);await import('./check-alerts.mjs');note('### Stjerneradar: varslingskontrol gennemført\nEn grøn kørsel beviser ikke nødvendigvis, at en notifikation blev vist på iPhone; kontroller ntfy-appen.');}
 catch(e){abort(e);}
}
