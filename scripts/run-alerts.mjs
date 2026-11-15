/* GitHub Actions entrypoint: specific, safe diagnostics; never log secrets. */
import {appendFileSync} from 'node:fs';
import {resolveAlertSetup} from './alert-config.mjs';

const summary = process.env.GITHUB_STEP_SUMMARY;
function note(text) {
  if (summary) {
    try { appendFileSync(summary, text + '\n'); } catch { /* Summary is optional. */ }
  }
}

function abort(error) {
  const msg = String(error?.message || error || 'Ukendt fejl')
    .replace(/[\r\n]+/g, ' ').slice(0, 700);
  const setupError = /STJERNERADAR_ALERT_CONFIG|alarmkanal mangler|ntfy.?topic|ugyldig JSON/i.test(msg);
  const weatherError = /Open-Meteo|MET Norway|prognose|skydakke|vejrdata/i.test(msg);

  console.error('::error title=Stjerneradar varsler::' + msg);

  if (setupError) {
    const help = 'Kontroller GitHub Secret STJERNERADAR_ALERT_CONFIG. Kopier hele JSON-teksten fra Stjerneradar > Indstillinger > Opret alarmkanal.';
    console.error('Hjaelp: ' + help);
    note('### Stjerneradar: fejl i opsaetningen\n' + msg + '\n\n' + help);
  } else if (weatherError) {
    const help = 'Vejrprognosen kunne ikke hentes. Stjerneradar sender derfor ikke usikre varsler. Tjek kildefejlene i loggen og proev igen ved naeste planlagte koersel. Du skal ikke aendre GitHub Secrets.';
    console.error('Hjaelp: ' + help);
    note('### Stjerneradar: vejrdata kunne ikke hentes\n' + msg + '\n\n' + help);
  } else {
    const help = 'Aabn det fejlede trin i GitHub Actions og find den foerste konkrete fejl. Undlad at aendre GitHub Secrets uden en konfigurationsfejl.';
    console.error('Hjaelp: ' + help);
    note('### Stjerneradar: teknisk fejl\n' + msg + '\n\n' + help);
  }
  process.exitCode = 1;
}

if (!process.env.STJERNERADAR_ALERT_CONFIG && process.env.GITHUB_EVENT_NAME === 'schedule') {
  console.log('Stjerneradar er endnu ikke sat op med GitHub Secret STJERNERADAR_ALERT_CONFIG. Automatisk kontrol springes over indtil aktivering.');
  note('### Stjerneradar er endnu ikke tilsluttet\nOpret alarmkanal i appen, og indsaet `STJERNERADAR_ALERT_CONFIG` i GitHub Secrets.');
} else {
  try {
    resolveAlertSetup(process.env);
    await import('./check-alerts.mjs');
    note('### Stjerneradar: varslingskontrol gennemfoert\nEn groen koersel betyder ikke noedvendigvis, at en notifikation er vist paa iPhone; kontroller ntfy.');
  } catch (error) {
    abort(error);
  }
}
