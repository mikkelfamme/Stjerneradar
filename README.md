# Stjerneradar · V1.0

Privat dansk iPhone-app (PWA) med timeprognose for nattehimlen, stjernekort, astronomiske begivenheder og **rigtige Web Push-notifikationer**, når Cloudflare-delen er opsat.

**Vigtig status:** Dette ZIP-arkiv er **kildefiler og deployment-opsætning**, ikke en udgivet eller færdigtestet app på din telefon. Brugerfladen kan lægges på GitHub Pages direkte; push kræver, at du opretter en Cloudflare Worker med D1, installerer iPhone-hjemmeskærmsappen og tester en faktisk pushmeddelelse. Der følger ingen API-nøgler eller kontoadgang med.

## Hvad er implementeret?

- **I nat:** Stjerneindeks 0–100, timebaserede skyer/månelys/mørke, bedste sammenhængende tidsvindue, observationsemner, sol- og månetider og begrundelse for scoren.
- **7 dage:** Timevisning og score for op til syv observationsnætter, med længere prognoser markeret som mere usikre.
- **Stjernekort:** Beregnet horisont, stjerner, stjernebilleder, planeter, Måne og vejledende Mælkevejsbånd, tidskontrol/zoom og objektvalg. Det er ikke en AR-kompasapp.
- **Begivenheder:** Vejledende IMO-meteordatoer, lokalt beregnede formørkelser, og — efter tilslutning af Worker — ISS-passager fra aktuelle TLE-banedata med kontrol af mørke og rumstationens sollys. Verificerede kometer kan føjes til kilderegisteret.
- **Steder:** GPS med tilladelse, stednavnssøgning, favoritter, valg af primært pushsted, sammenligning og OpenStreetMap-kort.
- **Indstillinger:** Observation med øje/kikkert/teleskop, manuelt angivet lysmiljø, personlige tærskler, 4 varselstyper, status, test og mulighed for at slette lokale/serverlagrede data.
- **Push:** Serverkontrol hvert 30. minut med tidligt varsel (12–36 timer før), sent varsel (30–90 min før), uventet opklaring og meteor-/ISS-begivenheder. Maksimum to almindelige beskeder/døgn samt op til to særlige. Deduplikation og ingen udsendelse i stilleperioden **23:00–07:00 i primærstedets tidszone**. Af sikkerhedshensyn udsendes heller ikke i de sidste 10 minutter inden kl. 23, og Web Push-beskeder sendes med kort levetid.
- **Offline:** Skallerne og senest hentede vejrprognose gemmes lokalt. Gamle prognoser mærkes; de bruges ikke til automatisk udsendelse af nye varsler.

**Begrænsninger:** Lysforurening er selvvurderet, ikke en verificeret Bortle-/skyglow-klasse. Kometer tilføjes kun med verificeret kilde (registeret starter tomt). Meteorernes peakdatoer er vejledende og ikke live-observationer. ISS-synlighed afhænger af TLE-nøjagtighed og en forenklet jordskyggemodel. Et ægte udendørs-/iPhone-testforløb og kalibrering af Stjerneindekset mangler stadig. Appen lover ikke fuld astronomisk seeing- eller lysstyrkemåling.

## 1. Pak ud og åbn projektet

1. Pak `Stjerneradar_GitHub_V1.0.zip` ud, og åbn mappen `stjerneradar`.
2. Du behøver **ikke** at installere Node-pakker for at vise selve appen.
3. Lokal afprøvning på en computer (Python 3):

   ```bash
   cd stjerneradar
   python3 -m http.server 5173
   ```

   Åbn `http://localhost:5173/` i en browser. Den skal have internet til første hentning af Astronomy Engine, Leaflet, vejrprognoser og kort. Lokale prognoser kan fejle, hvis browserens netværk/API’er blokeres.
4. Udviklertest: Installer **Node.js 20+** og kør i projektets rodmappe:

   ```bash
   npm test
   ```

   Scoring, vinduer, stilleperioder og varselsbeslutninger testes uden yderligere installation.

### Projektstruktur

```text
stjerneradar/
├── index.html                   # Startside (GitHub Pages)
├── style.css                    # Mobilvenlig mørk styling
├── app.js                       # Fem skærme, indstillinger og Web Push-abonnement
├── astro.js                     # Stjerner, Mælkevej, Måne, planeter, formørkelser
├── core.js                      # Fælles scoring og tidszoneregler
├── verified-events.json        # Tomt register over manuelt verificerede kometer
├── sw.js                        # Service Worker (offline + pushvisning)
├── manifest.webmanifest         # Installerbar iPhone PWA
├── icons/                       # Appikoner
├── worker/
│   ├── index.js                 # Cloudflare API, scheduler, ISS og Web Push
│   ├── wrangler.toml            # Cloudflare-konfiguration; kræver dine ID'er
│   ├── package.json             # Worker-afhængigheder
│   └── migrations/0001_initial.sql
├── scripts/generate-vapid.mjs   # Nøglegenerator; output opbevares privat
├── tests/core.test.mjs
├── .github/workflows/pages.yml  # Automatisk GitHub Pages-udgivelse
└── docs/kravspecifikation-godkendt.md
```

**Teknisk note:** Brugerfladen er lavet i ren, moderne JavaScript (ES-moduler) i stedet for den foreslåede React/TypeScript/Vite-kombination. Den bruger ellers den aftalte arkitektur med GitHub Pages, Cloudflare Workers og D1. Det holder den statiske PWA nem at uploade og versionsstyre uden et frontend-buildtrin.

## 2. Læg frontend på GitHub Pages

1. Opret et GitHub-repository med navnet **`stjerneradar`** (privat repository kan være muligt afhængigt af abonnement; GitHub Pages' webadresse bør betragtes som offentligt tilgængelig). Koden indeholder ingen adgangsnøgler.
2. Upload alle filerne **fra mappen `stjerneradar/` direkte til repository-roden**, inklusive den skjulte mappe `.github` med workflowet.
3. Vælg `main` som standardgren. Under **Settings → Pages → Build and deployment**, vælg **GitHub Actions** (ikke “Deploy from a branch”).
4. Workflowet `.github/workflows/pages.yml` udgiver ved hvert push til `main`.
5. Kontrollér **Actions → Udgiv Stjerneradar til GitHub Pages**, at jobben `deploy` er grøn.
6. Din URL bliver normalt `https://DIT-BRUGERNAVN.github.io/stjerneradar/`.

Hvis repoet hedder noget andet, skal `FRONTEND_URL` nedenfor ændres tilsvarende. Worker-kilden og hemmeligheder udgives **ikke** i Pages-artifactet. `.github/workflows/pages.yml` kopierer kun de relevante offentlige filer.

**Alternativ med Git på din computer:** Opret først et tomt GitHub-repository og følg GitHubs anvisning, eller kør i projektets rod:

```bash
git init
git add .
git commit -m "Stjerneradar V1.0"
git branch -M main
git remote add origin https://github.com/DIT-BRUGERNAVN/stjerneradar.git
git push -u origin main
```

## 3. Opret Cloudflare Worker og database (nødvendig for push)

Du skal have en **Cloudflare-konto** og Node.js installeret. Denne del udføres på en computer med internet. Du kan ikke bruge GitHub Pages alene til pushvarsler, der skal sendes, mens appen er lukket.

Åbn en terminal:

```bash
cd stjerneradar/worker
npm install
npx wrangler login
npx wrangler d1 create stjerneradar-db --location=weur
```

Den sidste kommando returnerer bl.a. et **database_id**. Åbn `worker/wrangler.toml` og indsæt det i `database_id`.

I samme fil retter du disse felter under `[vars]`:

```toml
FRONTEND_ORIGIN = "https://DIT-BRUGERNAVN.github.io"
FRONTEND_URL = "https://DIT-BRUGERNAVN.github.io/stjerneradar/"
VAPID_PUBLIC_KEY = "PUBLIC_KEY_DER_BLIVER_GENERERET"
VAPID_SUBJECT = "mailto:din-egen-email@example.com"
```

**`FRONTEND_ORIGIN` indeholder IKKE `/stjerneradar/`**. `FRONTEND_URL` gør. De skal stemme med din faktiske GitHub Pages-adresse, ellers blokerer browserens sikkerhedsregler Worker-API'et.

### 3A. Generér nøgler

Fra `worker/`:

```bash
node ../scripts/generate-vapid.mjs
```

Kommandoen viser én **offentlig** og én **privat** VAPID-nøgle. Den offentlige indsættes som `VAPID_PUBLIC_KEY` i `wrangler.toml`.

Den private indtastes **kun** som Cloudflare secret:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

Lav også en separat, lang parringsnøgle til din app:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put APP_ADMIN_TOKEN
```

Når den sidste kommando beder om en værdi, indsætter du den tilfældige parringsnøgle fra den foregående kommando. Gem en kopi i din private adgangskodeadministrator. **Hverken den private VAPID-nøgle eller `APP_ADMIN_TOKEN` må stå i GitHub-filerne eller en chatbesked.**

Hvis `wrangler secret put` kræver, at workeren allerede eksisterer, vælg at oprette en Worker fra CLI'en, og kør derefter hemmelighedskommandoerne igen. **Udskift ikke** nøgler efter iPhone er tilmeldt, uden at afmelde og genaktivere push.

### 3B. Opret tabeller og udgiv backend

Fra `worker/`:

```bash
npx wrangler d1 migrations apply stjerneradar-db --remote
npx wrangler deploy
```

Du får en URL som `https://stjerneradar-api.DIT-SUBDOMAENE.workers.dev`.

Kontrollér:

```bash
curl https://stjerneradar-api.DIT-SUBDOMAENE.workers.dev/api/health
```

Forventet svar indeholder `"ok":true`. Gem denne **Worker-URL**, ikke `/api/health`-adressen. Under Cloudflare **Workers & Pages → stjerneradar-api** kan du kontrollere Cron Trigger hvert 30. minut.

> Den periodiske kontrol kræver, at din Worker er aktiv, D1 er oprettet, hemmelighederne er indsat, og mindst ét aktivt pushabonnement findes. Før dette vil intet blive sendt. Afhængig af Cloudflares plan/kvoter kan særligt hyppige kald eller mange installationssteder medføre ekstra forbrug.

## 4. Installer på iPhone og aktivér push

1. Åbn `https://DIT-BRUGERNAVN.github.io/stjerneradar/` i **Safari** på din iPhone.
2. Tryk på delingsikonet → **Føj til hjemmeskærm**. Åbn herefter det nye **Stjerneradar-ikon** fra hjemmeskærmen. Web Push kræver understøttet iOS og en hjemmeskærmsinstalleret app.
3. Åbn **Steder**. Brug GPS eller gem din ønskede lokation. Tryk på klokkeikonet ved stedet, der skal være **primært varslingssted**. Appen overvåger dette sted, selvom du rejser til et andet.
4. Gå til **Indstillinger**. Vælg observationsform og evt. lysmiljø. Indtast den fulde **Cloudflare Worker-adresse** og din private **APP_ADMIN_TOKEN** (parringsnøglen fra trin 3A).
5. Tryk **Gem varsler**. Tryk derefter **Aktivér push** og tillad beskeder i iOS.
6. I tidsrummet **07:00–22:49 lokal tid** trykker du **Send test**. Tjek både, at appen viser succes, og at iPhone faktisk viser beskeden. Testen blokeres i stilleperioden og de sidste 10 minutter før den.
7. Tryk **Status**; du bør se mindst ét abonnement og senere et tidspunkt for serverens sidste kontrol. Du kan justere niveau (som standard 80/100) og vælge varslingstyper og trykke **Gem varsler** igen.

**Sådan fungerer to varsler:** Hvis natten først ser god ud 12–36 timer før, kan du få et tidligt varsel. Når der fortsat er gode forhold 30–90 minutter før observationsvinduet, kan du få et nyt. Hvis prognosen er blevet ringere, udløser scoren ikke et nyt positivt varsel. Uventet opklaring og relevant meteor-/ISS-begivenhed kan også give besked.

**Stilleperioden er et serverkrav:** Workeren kontrollerer tiden både ved beslutningen og lige før hver afsendelse. For at mindske risikoen for forsinket levering holder den også 10 minutters sikkerhedsmargin før kl. 23 og bruger en push-levetid på fem minutter. iOS, Fokus-tilstand og netværk kan dog påvirke, *hvornår* telefonen endeligt viser en accepteret besked; det kan en PWA ikke garantere præcist.

## 5. Tilføj verificerede kometer (valgfrit)

`verified-events.json` starter som en tom liste `[]`. Formålet er netop **ikke** at opfinde kometnavne, datoer og lysstyrker. Når du har opdaterede og verificerede data, indsætter du poster som:

```json
[
  {
    "id": "comet-unik-identifikator-2026",
    "type": "comet",
    "name": "Verificeret kometnavn",
    "time": "2026-12-15T20:00:00Z",
    "description": "Bekræftet observationsvindue og forventet instrumentbehov. Beskriv usikkerheden i lysstyrken.",
    "source": "Navn på verificeret astronomisk kilde",
    "url": "https://example.com/astronomy-source",
    "verifiedAt": "2026-12-01T12:00:00Z"
  }
]
```

**Ovenstående er kun et formatskema, ikke en faktisk kometbegivenhed**. Brug reelle observationer og kildehenvisninger. Kometer vises i appen, men udløser ikke automatiske komet-push i V1.0 uden yderligere validering af lokal position/lysstyrke.

## 6. Fejlfinding

| Symptom | Kontrol |
|---|---|
| Helt tom/hængende skærm | JavaScript i browser, tilgængeligt netværk til Astronomy Engine første gang, opdater siden |
| Ingen vejrdata | Online? Kan din internetforbindelse hente Open-Meteo? Appen forsøger både DMI-model og generel fallback |
| Ingen ISS-resultater | Er Cloudflare Worker-adresse og token korrekt? Er CelesTrak tilgængelig, og er TLE nyere end 72 timer? |
| “Origin ikke tilladt” | Kontrollér `FRONTEND_ORIGIN` (kun domænet) og `FRONTEND_URL` (hele hjemmesideadressen) |
| Ingen beskedtilladelse | Installer PWA på iPhone-hjemmeskærmen, åbn ikonet og giv aktiv tilladelse i iOS |
| Test blokeret | Stilleperiode kl. 23–07 eller de sidste 10 minutter før 23 |
| Serverstatus: 0 abonnementer | Tryk **Aktivér push** igen i den installerede app, kontroller VAPID og adgangskode |
| Varsler kommer ikke, men test virker | Tjek Stjerneindeks/tærskel, serverens Cron Trigger og sidste kontrol/status; en god nat er ikke garanteret |
| “Gem varsler” mislykkes | Kontroller Worker-URL, token, internetforbindelse og database-migration |
| Cloudflare deploy/install fejler | Kør `npm install` inde i `worker/`, opdatér Node til mindst 20, kontroller konto og `wrangler.toml` |

Til lokal udvikling med Cloudflare og browser på `localhost` kan du midlertidigt sætte `ALLOW_LOCALHOST = "true"` i `wrangler.toml` under `[vars]`. Fjern dette igen fra publiceret opsætning, hvis lokal adgang ikke skal være mulig. `wrangler dev --test-scheduled` kan bruges til lokal scheduled-test. Ved lokal test af database skal du først køre `npm run db:local` i `worker/`.

## 7. Data, privatliv og sikkerhed

- Kun favoritsteder og visningsvalg gemmes i telefonens lokale lager. Du giver aktivt tilladelse til GPS.
- Det aktive primærsted, dit push-abonnement og nødvendig duplikat-historik gemmes i **din** Cloudflare D1-database. Ingen kontinuerlig GPS-tracking eller positionshistorik er implementeret.
- Den private adgangsnøgle indtastes på den installerede enhed og opbevares i dens lokale browserlager. Den må ikke deles. Hvis telefonen kompromitteres, bør du rotere `APP_ADMIN_TOKEN`.
- Backend kræver et langt Bearer-token på alle abonnements-/datahandlinger. CORS begrænser browserkald til den specificerede GitHub Pages-origin. Workeren er bygget til **én privat ejer**, ikke en offentlig flerbrugerapp.
- Afmeld push i Indstillinger, eller brug **Slet lokale indstillinger og abonnement**. Fjern evt. Worker og D1-databasen fra Cloudflare for fuld sletning af servermiljø.
- GitHub Pages er ikke en privat backend, selvom repository er privat. Del ikke adgangsnøgler i commit-historik eller frontend-filer.

### Kilder og ophavsret

- [Open-Meteo – DMI API](https://open-meteo.com/en/docs/dmi-api) og [vilkår](https://open-meteo.com/en/terms) (gratis data for ikke-kommerciel brug, relevante grænser og attribution).
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) – astronomiberegning, MIT.
- [satellite.js](https://github.com/shashwatak/satellite-js) og [CelesTrak](https://celestrak.org/) – ISS-banedata og positionsberegning; respekter CelesTraks hyppighed og vilkår.
- [IMO](https://www.imo.net/) – meteorregnkalender, datoer er vejledende indtil validering af det aktuelle år.
- [Leaflet](https://leafletjs.com/) og [OpenStreetMap](https://www.openstreetmap.org/copyright) – kort og bidragyderattribution.
- [WebCrypto Web Push](https://github.com/block65/webcrypto-web-push) – VAPID- og AES128GCM-understøttelse, MIT.

## 8. Teststatus, udeståender og releasekriterier

**Maskinelt gennemført i kildeleverancen:** `node --check` af browser- og Worker-JavaScript samt Node-automatiserede test af scoring og tidszoner. Der er ikke installeret Worker-pakker og gennemført online deployment i udviklingsmiljøet her.

**Følgende kræver manuel afprøvning efter setup:**

1. GitHub Actions ender med grøn deploy, og alle fem faner indlæses i Safari.
2. Vejrprognoser og lokale måne-/planettider ser troværdige ud sammenholdt med verificerede eksterne kilder.
3. En ægte iPhone modtager testpush, **også med PWA lukket**.
4. Stilleperioden skal verificeres på en aktiv Worker, herunder sommertidskift. Lokaltidslogikken er unittestet; end-to-end-forsinkelse er ikke.
5. Før en god nat: tidlig og sen notifikation, ingen dubletter, intet nyt positivt varsel når vejret forringes.
6. ISS-passager vurderes mod en anerkendt uafhængig kilde; forældede TLE bliver afvist.
7. Stjerneindeksets vægte vurderes på faktiske observationsnætter. Det er en transparent heuristik, ikke en kalibreret observationsmåling.

**Funktioner fra den godkendte ønskeliste, som fortsat kræver rigtige datakilder eller finpudsning:** dynamisk overvågning af nye kometer og kildeverificerede mørkekort; fuld måling af atmosfærisk seeing; streng real-world kalibrering. Appen foregiver ikke at have disse data.

Godkendt grundlag: [`docs/kravspecifikation-godkendt.md`](./docs/kravspecifikation-godkendt.md).
