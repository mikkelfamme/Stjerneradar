# Stjerneradar V1.1 – installation uden Python eller Cloudflare

Denne vejledning er skrevet til Windows + GitHub + iPhone. **Du skal ikke bruge Kommandoprompt, Python, Cloudflare, Vercel eller Node på din computer.** GitHub installerer det nødvendige under de automatiske kørsler.

## 1. Download ZIP og læg koden på GitHub

1. Download **Stjerneradar_GitHub_V1.1.zip**, og vælg **Udpak alle** i Windows.
2. Opret et tomt repository på GitHub: **New repository → navn `stjerneradar` → Create repository**. Vælg `Public`, medmindre du har en GitHub-plan, hvor Pages fungerer for private repos.
3. Åbn repositoryet, vælg **Add file → Upload files**. Vælg **alle filer og mapper inde i den udpakkede projektmappe** – også `.github` (med undermappen `workflows`). Filerne skal ligge direkte i repository-roden: `index.html`, `app.js`, `.github/workflows/pages.yml`, `.github/workflows/alerts.yml` osv., og **ikke** inde i en ekstra `stjerneradar/`-mappe.
4. Vælg **Commit changes**. Hvis du allerede har uploadet den gamle version, så upload/overskriv de nye filer. Den gamle `worker/`-mappe kan efterfølgende slettes fra repoet; den bruges ikke mere.

> **Kontrol:** I GitHubs filoversigt skal du på øverste niveau kunne se `index.html`, `core.js`, `OPSAETNING.md` og mappen `.github`. Klik på `.github/workflows/` og bekræft, at **både** `pages.yml` og `alerts.yml` findes. GitHub web-upload kan variere med browser. Hvis du ikke kan uploade en mappe, vælg dens filer og behold den korrekte mappeplacering ved at oprette filerne på GitHub med deres sti.

## 2. Slå GitHub Pages til

1. I repositoryet: **Settings → Pages**.
2. Under **Build and deployment → Source**: vælg **GitHub Actions**.
3. Åbn **Actions**. Workflowet **Stjerneradar - Udgiv app** skal starte efter et push. Ellers vælg workflowet og tryk **Run workflow**.
4. Når kørslen er grøn, finder du din adresse under **Settings → Pages**, normalt `https://DIT_BRUGERNAVN.github.io/stjerneradar/`.
5. Åbn adressen på din iPhone i Safari. Vælg **Del → Føj til hjemmeskærm**, og åbn det nye Stjerneradar-ikon.

Første gang henter stjernekortet sine biblioteker over internettet. Ved manglende astronomi- eller vejrdata viser appen en fejl i stedet for at opfinde en score. GitHub Pages opdaterer ISS-banedata ca. hver 8. time (afhænger af GitHub Actions' starttid og CelesTraks tilgængelighed).

## 3. Installér ntfy på iPhone

1. Installér **ntfy** fra App Store (se https://ntfy.sh/).
2. Åbn ntfy → vælg **Subscribe / Add subscription**.
3. Opret et **langt, unikt og svært gætteligt topic** (20–64 bogstaver/tal; `_` og `-` er også tilladt). Brug eksempelvis ntfys egen topic-generator. **Del det ikke offentligt**. Almindelige topics på ntfy.sh er ikke adgangskodebeskyttede; enhver, der kender navnet, kan i princippet læse eller sende beskeder.
4. Tillad notifikationer fra ntfy i iPhones indstillinger, og abonnér på topic-navnet. Gem navnet privat.

## 4. Vælg hvor GitHub skal holde øje med stjernerne

1. Åbn den publicerede Stjerneradar-app.
2. Tryk på **Steder**. Brug **Min GPS** eller søg dit foretrukne sted og gem det.
3. På stedets række vælger du **klokkeikonet**, hvis du vil gøre det til **primært varslingssted**. Steder, der blot vises på kortet, bliver ikke automatisk overført til GitHub.
4. Tryk på tandhjulet **Indstillinger**. Vælg observationsform, lysmiljø, varslingsgrænse og hvilke slags varsler, du vil have.
5. Tryk **Kopiér GitHub-opsætning**. Der kopieres en JSON-tekst med koordinater, et tilfældigt installations-id og dine valg. Opbevar den privat.
6. Skift til GitHub → dit repository → **Settings → Secrets and variables → Actions → New repository secret**.
7. Opret secret med præcist navnet **`STJERNERADAR_CONFIG`**. Indsæt hele JSON-teksten som værdi, og gem.

**Vigtigt:** Stjerneradar kan ikke automatisk ændre GitHub Secrets fra telefonen. Når du senere skifter varslingssted eller grænser, skal du trykke **Kopiér GitHub-opsætning** igen og opdatere secretens værdi på GitHub. Foreløbigt defaultsted i appen er **København (eksempel)** – vælg dit eget sted, inden du opretter secret, hvis København ikke er rigtigt.

## 5. Aktivér ntfy-forbindelsen på GitHub

Samme sted på GitHub (**Settings → Secrets and variables → Actions**):

1. Opret en anden secret med præcist navnet **`NTFY_TOPIC`**.
2. Indsæt kun topic-navnet, du netop abonnerede på i ntfy. **Ikke** `https://ntfy.sh/` foran.
3. Det er de to **obligatoriske** secrets. Du skal **ikke** lave API-nøgler, Cloudflare Worker, VAPID eller betale for en server.
4. Hvis du bruger en egen ntfy-server, kan du også tilføje variablen `NTFY_SERVER_URL` (fx `https://ntfy.eksempel.dk`) og eventuelt secret `NTFY_TOKEN`. Ved brug af standardserveren `ntfy.sh` skal de ikke sættes.
5. Valgfrit: Tilføj variablen **`STJERNERADAR_APP_URL`** med din faktiske appadresse, hvis den afviger fra den normale GitHub Pages-adresse.

## 6. Test, at en besked når helt frem

1. Gå til GitHub → **Actions**.
2. Klik **Stjerneradar - Varsler** i venstre menu.
3. Tryk **Run workflow**.
4. Sæt **test_message = true** og **dry_run = false**. Start jobbet.
5. Kontroller, at jobbet er **grønt**, og åbn jobloggen under **Beregn udsigt og send ntfy-varsler**. Du skal se noget i stil med **“ntfy accepterede test”**.
6. Kontroller **selv på iPhone**, at beskeden faktisk er modtaget i ntfy. En grøn GitHub Actions-kørsel eller HTTP 200 er ikke en garanti for, at iPhone viser en besked.

**Test kun mellem kl. 07.00 og 22.50 i det valgte steds tidszone.** Der er en ekstra sikkerhedsmargin inden kl. 23. Test afvises bevidst i stilleperioden. Hvis testen ikke dukker op, kontroller topic-navn, ntfy-abonnement, iOS' meddelelsestilladelse og Fokus-tilstand. Prøv derefter en ny manuel test.

## 7. Automatiske varsler

- GitHub Actions forsøger en kontrol hver **30. minut** (i cron-minutterne `13` og `43` UTC). GitHub kan forsinke eller springe planlagte kørsler over; tidsplanen er ikke et præcist realtidssystem.
- **Tidligt varsel:** 12–36 timer før et sammenhængende godt observationsvindue.
- **Sidste varsel:** 30–90 minutter før. **Uventet opklaring:** Hvis ny prognose er mindst 20 indekspoint bedre end den seneste gemte.
- **Begivenheder:** Relevante meteorregn, mulige belyste ISS-passager, verificerede formørkelser og eventuelle kometer tilføjet med kilde.
- **Stilleperiode:** GitHub-koden sender **ingen** ntfy-beskeder kl. **23.00–07.00** i dit primære steds tidszone. Der stoppes allerede fra **22.50** som forsigtighed. **En forsinket iOS/ntfy-levering kan dog i sjældne tilfælde blive vist senere**. Indstil derfor også iPhones **Fokus/Søvn** til 23–07, hvis du absolut ikke vil forstyrres.
- **Max to almindelige** varsler pr. lokaldøgn og **to særvarsler**. GitHub husker afsendelser i en separat branch, `stjerneradar-alert-state`, så en kørsel ikke varsler gentagne gange om samme nat.
- Der sendes ikke noget, hvis forecast eller astronomidata fejler. Ingen beskeder sættes i kø til næste morgen.
- Efter 60 dages inaktivitet kan GitHub slå tidsplaner fra i offentlige repos. Se Actions-fanen og aktivér workflowet igen ved behov.

### Hvordan stopper jeg varslerne?

Den sikreste og hurtigste metode er **GitHub → Actions → Stjerneradar - Varsler → ⋯ → Disable workflow**. Du kan også fjerne `NTFY_TOPIC`-secret eller afmelde topic i ntfy. At slette lokale indstillinger i Stjerneradar **stopper ikke** GitHub Actions.

## 8. Almindelige fejl

| Symptom | Sandsynlig forklaring / løsning |
|---|---|
| `Python blev ikke fundet` | Ingen betydning længere. Du skal ikke bruge Python. |
| Kun `Stjerneradar - Udgiv app` vises i Actions | Kontrollér at `.github/workflows/alerts.yml` ligger på `main` direkte i repoet. |
| `STJERNERADAR_CONFIG mangler` | Opret secret med JSON fra appens knap **Kopiér GitHub-opsætning**. |
| `NTFY_TOPIC ... 20–64 tegn` | Opret et langt tilfældigt topic uden `/`, mellemrum eller hele ntfy-URL'en. |
| GitHub state-branch kunne ikke oprettes (`403`) | Kontrollér repo Settings → Actions → General → Workflow permissions; Actions skal kunne bruge `contents: write`. Hvis organisationens politik blokerer, må admin give lov. |
| Grøn workflow, men ingen besked | Åbn ntfy på iPhone; kontroller **præcis samme topic**, meddelelsestilladelse og at klokken ikke er i stilleperioden. |
| ISS ikke vist | CelesTrak-data kunne ikke hentes eller var forældede. Se sidste **Stjerneradar - Udgiv app**-kørsel; de vises ikke som sikre passager, når datakilden fejler. |
| App viser en gammel version | Åbn igen i Safari og opdater; PWA-serviceworkeren kan have gemt gamle filer. Luk/genåbn hjemmeskærmsappen efter opdatering. |
| Nattekortet viser ingen score | Tjek internet, Open-Meteo og astronomibiblioteket. Appen opfinder ikke prognoser. |

## Privatliv og tekniske begrænsninger

- Appen kører på **GitHub Pages**. Hvis repositoryet er offentligt, er frontenden offentligt tilgængelig. **Ingen ntfy-topic eller secret lægges i den publicerede side.**
- Dine favoritsteder er lokale. Den lokation, du selv kopierer til GitHub Secret, bruges af det serverkørende varslingsjob. Ingen baggrunds-GPS på iPhone.
- En særlig `stjerneradar-alert-state`-branch gemmer deduplikation og tidsstempler, ikke koordinater eller topic. Ved offentligt repo er branchens indhold synligt; det kan bl.a. afsløre, at nogen har fået et varsel på et tidspunkt.
- Lysforurening er manuelt valgt. Stjerneindekset er en model, ikke en målt observérbarhed eller garanti.
- ISS er beregnet ud fra offentlig TLE med en forenklet skyggemodel. Kometer vises kun med verificerede data, og registeret er tomt, indtil konkrete oplysninger tilføjes.
- Gratis Open-Meteo-datakilder er tiltænkt ikke-kommerciel brug under gældende brugsregler. GitHub og ntfy har egne grænser og tilgængelighedsvilkår.

## Officielle henvisninger

- [GitHub Pages med GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions – tidsplaner](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [ntfy – kom i gang](https://docs.ntfy.sh/)
- [ntfy – publicering og cache](https://docs.ntfy.sh/publish/)
- [Open-Meteo DMI](https://open-meteo.com/en/docs/dmi-api)
