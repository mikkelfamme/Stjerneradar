# Stjerneradar V1.1

**Mobil PWA til nattehimlens synlighed – nu uden Cloudflare, Python eller lokal installation.**

**Læs først [OPSAETNING.md](OPSAETNING.md)** – dansk trin-for-trin-guide til GitHub Pages og iPhone-notifikationer med ntfy.

## Hvad kan appen?

- **I nat:** Stjerneindeks 0–100, skydække i forskellige lag, Måne, mørke og bedste timevindue.
- **7 dage:** timeopdelt forventet nattehimmel; advarsel om usikre prognoser.
- **Stjernekort:** stjerner, planeter, Månen, udvalgte stjernebilleder og vejledende Mælkevejsbånd, tidsvalg og zoom.
- **Begivenheder:** forventede meteorregn, beregnede formørkelser, mulige ISS-passager fra CelesTrak og kildeverificerede kometer (tomt register ved start).
- **Steder:** GPS, stedsøgning, favoritter, sammenligning og kort over egne observationssteder.
- **Varsler:** tidlig/sen, uventet opklaring og særlige begivenheder; **aldrig afsendelse 23–07**, deduplikation og dagsgrænser.

## Arkitektur

| Del | Funktion | Kræver lokal installation? |
|---|---|---|
| GitHub Pages | HTTPS PWA, de fem skærme, sol/måne, stjernekort, vejr | Nej |
| GitHub Actions `pages.yml` | Udgiv app og opdatér frisk ISS-TLE ca. hver 8. time | Nej |
| GitHub Actions `alerts.yml` | Kontrollér prognoser ca. hver halve time | Nej |
| npm på **GitHubs server** | Installerer Astronomy Engine og satellite.js ved jobs | Nej |
| ntfy iPhone-app | Leverer notifikationer uafhængigt af om PWA er åben | Kun ntfy på telefonen |
| GitHub Secrets | Privat topic og varslingssted | Konfigureres på GitHubs hjemmeside |
| Branch `stjerneradar-alert-state` | Deduplikation og tidligere prognose til opklaring | Oprettes automatisk |

**Vigtig forskel fra V1.0:** Dette er **ntfy-push**, ikke iOS Web Push fra Stjerneradar-ikonet. Brugerindstillinger i PWA er lokale; de kopieres til GitHub Secret `STJERNERADAR_CONFIG` fra appens Indstillinger. Følger du kun opsætning af Pages og springer Secrets over, virker appen, men **ingen automatiske notifikationer** bliver sendt.

## Filer

```text
index.html                 startside
app.js                     skærme, GPS, indstillinger, kopiering af varslingsopsætning
core.js                    scoring og tidszone-/stilleperioderegler
astro.js                   himmelkoordinater, planeter og begivenhedskalender
iss-core.js                TLE og beregnede ISS-passager
iss-browser.js             browserens lokale ISS-beregning fra GitHub-opdateret TLE
style.css                  mobilvenligt design
sw.js                      offline skal; ingen Web Push (ntfy håndterer varsler)
manifest.webmanifest       installation på hjemmeskærmen
verified-events.json      verificerede kometer (starter som [])
icons/                     appikoner
scripts/check-alerts.mjs   GitHub Actions-varslingsmotor
scripts/alert-logic.mjs    fælles regler for varselsbeslutninger
scripts/notify-ntfy.mjs    afsendelse til ntfy og stilleperiodecheck
scripts/github-state.mjs   læs/skriv særskilt varslingsbranch
scripts/events-node.mjs   astronomiske særlige begivenheder og TLE
scripts/build-iss-feed.mjs TLE-opdatering til GitHub Pages
.github/workflows/pages.yml  udgivelse + ISS
.github/workflows/alerts.yml automatiske varsler og manuel test
tests/                    30 automatiske tests
OPSAETNING.md              dansk opsætningsvejledning
```

## Kvalitetsgrænser

Stjerneindekset er en transparent heuristik, ikke en målestation. Moonlight justeres for månehøjde; fuldmåne under horisonten tæller ikke negativt. Deep-sky begrænses ved ukendt lysforurening. Hvis prognoser ikke findes, varsles der ikke. En sensor kan ikke forventes at opdatere GPS i baggrunden på iPhone.

GitHub Actions *forsøger* en kørsel efter cron; job kan blive forsinket eller springes over. ntfy returnerer HTTP-accept, som ikke beviser levering på telefonen. Koden forhindrer afsendelse kl. 23–07 i varslingsstedets tidszone, men iOS kan vise allerede afsendte beskeder senere. Brug også Fokus 23–07 for garanteret lydløshed fra telefonens side.

Koden er lavet til **privat, ikke-kommerciel** brug, især på grund af eksterne datakilders vilkår. Den er ikke til kommerciel trafik uden kontrol af kvoter og licenser.

## Test for udviklere (valgfrit)

GitHub Actions kører tests automatisk. Hvis du selv har Node 20+:

```bash
npm test
```

Tests dækker score, månefaser, skyer, nattevinduer, sommer-/vintertid, stilleperioder, ntfy-HTTP, deduplikation og GitHub-varselstider. **Det er ikke nødvendigt at køre dette på Windows.**
