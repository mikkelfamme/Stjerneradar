/* Stjerneradar: GitHub Actions alert runner.
 * Primary forecast: Open-Meteo DMI.
 * Alternative: Open-Meteo generic model.
 * Independent backup: MET Norway Locationforecast, with GitHub-state caching.
 * No Cloudflare, Python or server running on the user's phone.
 */
import {weatherUrl, forecastRows, scoreHour, canDispatchPush} from '../core.js';
import {normalizeState, saveSnapshots, proposeAlerts, readyToSend, markSent} from './alert-logic.mjs';
import {resolveAlertSetup} from './alert-config.mjs';
import {createStateClient} from './github-state.mjs';
import {publishNtfy} from './notify-ntfy.mjs';
import {upcomingMeteors, nearbyEclipses, upcomingComets, getFreshTle, upcomingIss} from './events-node.mjs';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const MET_CACHE_MAX_AGE = 3 * HOUR;
const MET_MIN_INTERVAL = 30 * MINUTE;
const MET_CREDIT = '\nVejrdata: MET Norway (bearbejdet): https://api.met.no/ - CC BY 4.0: https://creativecommons.org/licenses/by/4.0/';

const {config, topic, serverUrl: ntfyUrl} = resolveAlertSetup(process.env);
const now = Date.now();
const tz = config.location.tz;
const test = process.env.TEST_MESSAGE === 'true';
const dry = process.env.DRY_RUN === 'true';

if (!canDispatchPush(now, tz)) {
  console.log('Stilleperiode kl. 23-07 i ' + tz + '. Ingen beskeder (heller ikke test) og ingen forsinket koe.');
  process.exit(0);
}

const appUrl = (() => {
  const repo = process.env.GITHUB_REPOSITORY || '';
  const parts = repo.split('/');
  return (process.env.APP_URL || (parts.length === 2 ? `https://${parts[0]}.github.io/${parts[1]}/` : '')).replace(/\/$/, '');
})();

if (test) {
  if (dry) {
    console.log('TEST (toerkoersel): ntfy ville faa en testbesked, men DRY_RUN er slaaet til.');
    process.exit(0);
  }
  const notice = {
    key: 'test:' + now,
    kind: 'test',
    title: 'Stjerneradar \u00b7 Test',
    body: 'Test fra Stjerneradars GitHub Actions. Kontroller at du modtager beskeden i ntfy paa iPhone.',
    tab: 'today'
  };
  const r = await publishNtfy({
    topic, serverUrl: ntfyUrl, authToken: process.env.NTFY_TOKEN || '',
    notice, timezone: tz, now: Date.now(), appUrl
  });
  if (!r.ok) throw Error('ntfy testbesked IKKE sendt: ' + r.skipped);
  console.log('ntfy accepterede testbeskeden (HTTP ' + r.status + '). Kontroller ntfy paa iPhone.');
  process.exit(0);
}

// Astronomy libraries are unnecessary for a simple test notification.
const Astronomy = await import('astronomy-engine');
const satellite = await import('satellite.js');
const gh = createStateClient({
  token: process.env.GITHUB_TOKEN,
  repository: process.env.GITHUB_REPOSITORY,
  sha: process.env.GITHUB_SHA
});
const loaded = await gh.read();
const state = normalizeState(loaded.data, config);
let revision = loaded.sha;
let touched = !loaded.exists || state.siteKey !== loaded.data?.siteKey;
let forecastSource = '';

async function send(alert) {
  if (dry) {
    console.log('TOERKOERSEL: Varsel ' + alert.kind + ' ville blive sendt.');
    return false;
  }
  if (!readyToSend(state, alert, Date.now(), tz)) return false;
  const notice = forecastSource.startsWith('MET Norway')
    ? {...alert, body: alert.body + MET_CREDIT}
    : alert;
  const r = await publishNtfy({
    topic, serverUrl: ntfyUrl, authToken: process.env.NTFY_TOKEN || '',
    notice, timezone: tz, now: Date.now(), appUrl
  });
  if (!r.ok) {
    console.log('Intet sendt:', r.skipped);
    return false;
  }
  markSent(state, alert, Date.now(), tz);
  // Store every accepted notification immediately to limit duplicates.
  revision = await gh.save(state, revision);
  touched = false;
  console.log('ntfy accepterede ' + alert.kind + '. Det er ikke en iPhone-leveringskvittering.');
  return true;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const asNumber = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function retryAfterTime(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Date.now() + seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? date : null;
}

function checkForecast(forecast, source) {
  if (!forecast?.rows?.length || !forecast.rows.some(h =>
    Number.isFinite(h.time) && h.time > now && h.time < now + 2 * HOUR &&
    typeof h.clouds === 'number' && Number.isFinite(h.clouds)
  )) {
    throw Error(source + ': ingen aktuelle prognosetimer med skydakke.');
  }
  return forecast;
}

function fetchError(message, {retryable = false, rateLimited = false} = {}) {
  const error = new Error(message);
  error.retryable = retryable;
  error.rateLimited = rateLimited;
  return error;
}

async function fetchOpenMeteo(url, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {Accept: 'application/json'},
        signal: AbortSignal.timeout(14_000)
      });
      if (response.status === 429) {
        const until = Math.max(Date.now() + HOUR, retryAfterTime(response.headers.get('retry-after')) || 0);
        state.openMeteoBlockedUntil = until;
        touched = true;
        throw fetchError(label + ': HTTP 429 (rate limit).', {rateLimited: true});
      }
      if (!response.ok) {
        throw fetchError(label + ': HTTP ' + response.status, {
          retryable: [408, 425, 500, 502, 503, 504].includes(response.status)
        });
      }
      const forecast = checkForecast(forecastRows(await response.json()), label);
      if (state.openMeteoBlockedUntil) {
        delete state.openMeteoBlockedUntil;
        touched = true;
      }
      return forecast;
    } catch (error) {
      if (error.rateLimited) throw error; // Do not hammer the same rate-limited provider.
      const networkError = /fetch failed|network|timeout|timed out|abort/i.test(String(error?.message || ''));
      if (attempt === 3 || (!error.retryable && !networkError)) throw error;
      const delay = 1_500 * 2 ** (attempt - 1) + Math.round(Math.random() * 600);
      console.warn(`${label}: forsoeg ${attempt}/3 fejlede (${error.message}). Proever igen om ${delay} ms.`);
      await sleep(delay);
    }
  }
  throw Error(label + ': alle forsoeg fejlede.');
}

function metForecastFromJson(json) {
  const timeseries = json?.properties?.timeseries;
  if (!Array.isArray(timeseries) || !timeseries.length) {
    throw Error('MET Norway: svaret indeholder ingen prognosetimer.');
  }
  const rows = timeseries.map(item => {
    const instant = item?.data?.instant?.details || {};
    const nextHour = item?.data?.next_1_hours?.details || {};
    const windMs = asNumber(instant.wind_speed);
    return {
      time: Date.parse(item?.time || ''),
      clouds: asNumber(instant.cloud_area_fraction),
      low: asNumber(instant.cloud_area_fraction_low),
      mid: asNumber(instant.cloud_area_fraction_medium),
      high: asNumber(instant.cloud_area_fraction_high),
      fog: asNumber(instant.fog_area_fraction),
      visibility: null, // Not provided in the compact response; do not invent a value.
      precipitation: asNumber(nextHour.precipitation_amount),
      precipitationProb: asNumber(nextHour.probability_of_precipitation),
      temp: asNumber(instant.air_temperature),
      humidity: asNumber(instant.relative_humidity),
      wind: windMs === null ? null : windMs * 3.6 // MET: m/s; Open-Meteo: km/h.
    };
  }).filter(h => Number.isFinite(h.time) && h.clouds !== null)
    .sort((a, b) => a.time - b.time);
  if (!rows.length) throw Error('MET Norway: skydakke mangler i prognosen.');
  return {
    rows,
    source: 'MET Norway \u00b7 Locationforecast (reservekilde)',
    fetchedAt: Date.now(),
    providerTimezone: 'UTC'
  };
}

function cachedMetForecast(cache) {
  if (!cache || !Array.isArray(cache.rows) || !Number.isFinite(cache.fetchedAt)) return null;
  if (Date.now() - cache.fetchedAt > MET_CACHE_MAX_AGE) return null;
  try {
    return checkForecast({
      rows: cache.rows,
      source: 'MET Norway \u00b7 Locationforecast (cache)',
      fetchedAt: cache.fetchedAt,
      providerTimezone: 'UTC'
    }, 'MET Norway cache');
  } catch {
    return null;
  }
}

function metNextRequestAt(response, checkedAt) {
  const expires = Date.parse(response.headers.get('expires') || '');
  return Math.max(checkedAt + MET_MIN_INTERVAL, Number.isFinite(expires) ? expires : 0);
}

async function fetchMetNorway() {
  const cache = state.metNorwayForecastCache;
  const cached = cachedMetForecast(cache);
  const nextRequestAt = Math.max(
    Number(cache?.nextRequestAt) || 0,
    (Number(cache?.fetchedAt) || 0) + MET_MIN_INTERVAL
  );

  if (Date.now() < nextRequestAt) {
    if (cached) {
      console.log('MET Norway: bruger gyldig cache og respekterer serverens udloebstid.');
      return cached;
    }
    throw Error('MET Norway: naeste API-kald er ikke tilladt endnu, og der er ingen tilstraekkeligt frisk cache.');
  }

  const repo = process.env.GITHUB_REPOSITORY || 'mikkelfamme/Stjerneradar';
  const userAgent = `Stjerneradar/1.1 (https://github.com/${repo})`;
  const lat = Number(config.location.lat).toFixed(4);
  const lon = Number(config.location.lon).toFixed(4);
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const headers = {Accept: 'application/json', 'User-Agent': userAgent};
  if (cache?.lastModified) headers['If-Modified-Since'] = cache.lastModified;

  try {
    const response = await fetch(url, {headers, signal: AbortSignal.timeout(16_000)});
    const checkedAt = Date.now();
    if (response.status === 304 && cache?.rows?.length) {
      state.metNorwayForecastCache = {
        ...cache,
        fetchedAt: checkedAt,
        nextRequestAt: metNextRequestAt(response, checkedAt)
      };
      touched = true;
      return checkForecast({
        rows: cache.rows,
        source: 'MET Norway \u00b7 Locationforecast (bekraeftet cache)',
        fetchedAt: checkedAt,
        providerTimezone: 'UTC'
      }, 'MET Norway');
    }
    if (!response.ok) throw Error('MET Norway: HTTP ' + response.status);
    const forecast = checkForecast(metForecastFromJson(await response.json()), 'MET Norway');
    state.metNorwayForecastCache = {
      fetchedAt: checkedAt,
      rows: forecast.rows,
      lastModified: response.headers.get('last-modified') || null,
      nextRequestAt: metNextRequestAt(response, checkedAt)
    };
    touched = true;
    console.log('MET Norway: ny reserveprognose hentet og gemmes i GitHub-state.');
    return forecast;
  } catch (error) {
    if (cached) {
      console.warn('MET Norway kunne ikke hentes (' + error.message + '). Bruger cache under 3 timer gammel.');
      return cached;
    }
    throw error;
  }
}

async function downloadForecast() {
  const problems = [];
  const blockedUntil = Number(state.openMeteoBlockedUntil) || 0;
  if (Date.now() < blockedUntil) {
    console.log('Open-Meteo er sat paa pause pga. tidligere HTTP 429 indtil ' + new Date(blockedUntil).toISOString());
  } else {
    const sources = [
      ['Open-Meteo DMI', weatherUrl(config.location.lat, config.location.lon)],
      ['Open-Meteo standard', weatherUrl(config.location.lat, config.location.lon, true)]
    ];
    for (const [label, url] of sources) {
      try {
        return await fetchOpenMeteo(url, label);
      } catch (error) {
        problems.push(error.message);
        console.warn('Prognosekilde fejlede: ' + error.message);
        if (error.rateLimited) break; // Same provider/IP; switch to independent backup.
      }
    }
  }
  try {
    return await fetchMetNorway();
  } catch (error) {
    problems.push(error.message);
    throw Error('Ingen opdateret prognose, intet varsel sendt. ' + problems.join(' | '));
  }
}

const forecast = await downloadForecast();
forecastSource = forecast.source;
console.log(`Prognose OK fra ${forecast.source}. Timepunkter: ${forecast.rows.length}.`);

const obs = new Astronomy.Observer(config.location.lat, config.location.lon, 0);
function skyAt(time) {
  const date = new Date(time);
  const sunEq = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
  const moonEq = Astronomy.Equator(Astronomy.Body.Moon, date, obs, true, true);
  return {
    sunAlt: Astronomy.Horizon(date, obs, sunEq.ra, sunEq.dec, 'normal').altitude,
    moonAlt: Astronomy.Horizon(date, obs, moonEq.ra, moonEq.dec, 'normal').altitude,
    moonFraction: Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction
  };
}

const hours = forecast.rows
  .filter(h => h.time >= now - HOUR && h.time <= now + 7 * 24 * HOUR)
  .map(h => ({
    ...h,
    rating: scoreHour(h, skyAt(h.time), {mode: config.mode, light: config.location.light})
  }));

let meteors = [], eclipses = [], comets = [], iss = [];
if (config.notify.events) {
  meteors = upcomingMeteors(now);
  eclipses = nearbyEclipses(now, config.location, Astronomy);
  comets = await upcomingComets(now);
  const tle = await getFreshTle(now, state.tle);
  if (tle.fetched || state.tle !== tle.tle) {
    state.tle = tle.tle;
    touched = true;
  }
  iss = upcomingIss(now, config.location, Astronomy, satellite, state.tle);
}

const alerts = proposeAlerts({config, state, now, hours, meteors, iss, eclipses, comets});
console.log(`Prognosetimer ${hours.length}, kvalificerede varsler ${alerts.length}.`);
for (const alert of alerts) {
  if (!canDispatchPush(Date.now(), tz)) {
    console.log('Stilleperiode begyndt under koersel. Stopper.');
    break;
  }
  if (!readyToSend(state, alert, Date.now(), tz)) continue;
  await send(alert);
}

// Save changes to the independent state branch, not main.
// A new MET cache or Open-Meteo cooldown must be persisted even before 2 hours.
if (!dry && (touched || !state.lastSnapshotAt || now - state.lastSnapshotAt >= 2 * HOUR)) {
  saveSnapshots(state, hours, now);
  revision = await gh.save(state, revision);
  console.log('Prognosebaseline, kildecache og varslingshukommelse gemt paa separat GitHub-branch.');
} else {
  console.log(dry ? 'Toerkoersel: ingen tilstand gemt.' : 'Ingen ny baseline noedvendig.');
}
