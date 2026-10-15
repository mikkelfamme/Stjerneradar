/* One JSON secret contains the generated ntfy topic and all preferences.
   Older V1.1 secrets are deliberately ignored to prevent sending to the wrong channel. */
import {parseConfig} from './alert-logic.mjs';
import {validateNtfy} from './notify-ntfy.mjs';
export function resolveAlertSetup(env){
 const config=parseConfig(env.STJERNERADAR_ALERT_CONFIG);
 const topic=config.ntfyTopic||'';
 if(!topic)throw Error('Alarmkanal mangler. Aabn Stjerneradar > Indstillinger > Opret alarmkanal > Kopier GitHub-hemmelighed. Opdater STJERNERADAR_ALERT_CONFIG med hele JSON-teksten.');
 const serverUrl=config.ntfyServer||'https://ntfy.sh';
 const valid=validateNtfy({topic,serverUrl});
 return {config,topic:valid.topic,serverUrl:valid.serverUrl};
}
