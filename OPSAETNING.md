# Stjerneradar V1.2 – opdatering og ntfy på iPhone

**Denne udgave er lavet til dit eksisterende repository:** https://github.com/mikkelfamme/Stjerneradar

V1.2 virker som Nordlysradar: **Stjerneradar opretter et sikkert, tilfældigt kanalnavn, og du kopierer én samlet GitHub-hemmelighed.** Ingen Python, Cloudflare eller kommandolinje på din computer.

## A. Opdater din eksisterende Stjerneradar

1. Download `Stjerneradar_V1.2_OPDATERING.zip` og vælg **Udpak alle** i Windows.
2. Åbn https://github.com/mikkelfamme/Stjerneradar → **Code → Add file → Upload files**.
3. Upload **filerne og mapperne inde i den udpakkede mappe**. VIGTIGT: `.github/workflows/alerts.yml` skal med, og alle filer skal ligge direkte i repositoryets rod som før. Hvis GitHub spørger om overskrivning, skal du bekræfte ændringerne.
4. Vælg **Commit changes** til `main`.
5. Under **Actions** vil workflowet **Stjerneradar - Udgiv app** udgive den nye version. Under **Settings → Pages** kan du se appadressen. Den er normalt `https://mikkelfamme.github.io/Stjerneradar/` (store/små bogstaver er vigtige).
6. Åbn siden på din iPhone, og genindlæs efter at udgivelsen er gennemført. Hvis den gamle Indstillinger-side stadig vises, luk hjemmeskærmsappen helt og åbn den igen (service worker kan have en gammel cache).

**Du skal ikke oprette et nyt repository, og du skal ikke slette dine gemte steder eller ændre GitHub Pages-indstillingerne.** V1.2 benytter den eksisterende lokale lagring i browseren, så favoritsteder og øvrige valg normalt bevares på samme enhed.

## B. Opret alarmkanal i selve Stjerneradar

1. Åbn den **opdaterede Stjerneradar** → tandhjulet **Indstillinger**.
2. Under **Personlige stjernealarmer** trykker du **Opret alarmkanal**.
3. Appen genererer nu et langt, tilfældigt kanalnavn, der begynder med `stjerner-`. Kanalen er ikke en konto hos ntfy; den opstår automatisk på ntfy.sh, når du abonnerer på eller sender til navnet. Du skal **ikke** selv finde på et navn.
4. Tryk **Kopiér kanal**.
5. Åbn **ntfy** på din iPhone → **Subscribe / Add subscription** → indsæt kanalnavnet → **Subscribe**. Tillad notifikationer til ntfy. Brug serveren `https://ntfy.sh`.

**Vigtigt:** ntfy til iPhone kræver, at du abonnerer i selve ntfy-appen. Stjerneradar kan generere og kopiere navnet, men kan ikke på dine vegne oprette abonnementet inde i iPhone-appen. Det er samme arbejdsgang som i Nordlysradar.

## C. Én GitHub Secret – ikke to

1. Gå tilbage til Stjerneradar → **Indstillinger**.
2. Vælg eventuelt først observationsform, varslingssted og Stjerneindeks-grænse.
3. Tryk **Kopiér GitHub-hemmelighed**. Du kopierer én JSON-tekst med den genererede kanal, det valgte observationssted og dine indstillinger.
4. Gå til GitHub: https://github.com/mikkelfamme/Stjerneradar/settings/secrets/actions
5. Klik **New repository secret** og angiv dette navn **præcis**:

   `STJERNERADAR_ALERT_CONFIG`

6. I **Secret**-feltet indsætter du **hele** den kopierede JSON-tekst, og vælger **Add secret**.

Så er forbindelsen konfigureret. **Du skal ikke oprette `NTFY_TOPIC` eller `STJERNERADAR_CONFIG`.** Gamle værdier fra V1.1 (`NTFY_TOPIC` og `STJERNERADAR_CONFIG`) bruges **ikke** længere. De kan blive stående uden effekt, men du kan slette dem efter en vellykket test, så der ikke opstår tvivl. Du skal IKKE indsætte JSON i en offentlig GitHub-fil eller GitHub issue.

Bemærk: Gemte indstillinger på din telefon synkroniseres ikke automatisk med GitHub Actions. Ændrer du sted, kanal eller indstillinger, skal du trykke **Kopiér GitHub-hemmelighed** igen og **opdatere** samme Secret med den nye JSON.

## D. Test, om beskeden kommer frem

1. Gå til https://github.com/mikkelfamme/Stjerneradar/actions.
2. Vælg workflowet **Stjerneradar - Varsler** i venstre side.
3. Tryk **Run workflow**, vælg `main` og sæt **`test_message` = true**, **`dry_run` = false**.
4. Kør workflowet og åbn kørslen. En vellykket log skal vise: **`ntfy accepterede testbeskeden (HTTP ...)`**.
5. Kontrollér at testbeskeden faktisk lander i **ntfy-appen** på din iPhone.

Testbeskeder sendes **kun mellem kl. 07 og ca. 22.50** i dit varslingssteds tidszone. Stjerneradar sender aldrig nye ntfy-notifikationer kl. 23–07. ntfy/telefonen kan levere en allerede accepteret besked senere; brug iPhones **Fokus/Søvn 23–07** som ekstra sikkerhed.

**V1.2-rettelse:** Testen sender direkte til ntfy og kræver ikke en GitHub-branch eller GitHub API-skriverettigheder. Det fjerner en unødig fejlkilde fra V1.1. En grøn GitHub-kørsel beviser, at ntfy accepterede beskeden; du skal stadig kontrollere modtagelsen på iPhone.

## E. Kontrollér de automatiske varsler

Når testen kommer frem, kan du køre workflowet **igen med `test_message = false` og `dry_run = true`** for at kontrollere prognoser uden at sende varsler. Kør derefter en normal kontrol (begge `false`), så GitHub kan oprette varslingshistorik. Repoets workflow skal have adgang til at skrive på state-branchen; se GitHub **Settings → Actions → General → Workflow permissions** ved en `403`.

GitHub Actions kontrollerer forholdene omkring hver halve time (`13` og `43` minutter efter timen UTC), men GitHub kan forsinke planlagte kørsler. Der er ingen notifikationer i stilleperioden, heller ikke om sjældne begivenheder. Højst to almindelige og to særlige varsler pr. kalenderdag.

## F. Hvis det stadig fejler

| Fejl/observation | Hvad gør du? |
|---|---|
| `STJERNERADAR_ALERT_CONFIG mangler` | Opret den ENE Secret på GitHub med JSON fra appens **Kopiér GitHub-hemmelighed**. |
| `Alarmkanal mangler` | Tryk **Opret alarmkanal** i appen og kopiér en NY samlet Secret. |
| `NTFY_TOPIC skal være ...` | Den samlede Secret har en ugyldig topic; kopiér igen fra appen, ikke kun kanalnavnet. |
| Testjobbet er grønt, men der kommer ingen besked | Kontrollér at ntfy abonnerer på *samme* kanal; se ntfy-notifikationstilladelse, netforbindelse og Fokus. Test igen mellem 07 og 22.50. |
| Testen bliver ikke sendt i stilleperioden | Det er tilsigtet. Send ny test efter kl. 07 på varslingsstedet. |
| `GitHub API 403` ved normale kontroller | Kontrollér **Actions → General → Workflow permissions**. Test-notifikationer kræver ikke GitHub state-skriveadgang; automatisk deduplikation gør. |
| Gamle knapper/indstillinger vises | Tjek at `app.js` er overskrevet i repoet, at Pages-udgivelsen er grøn, og genåbn PWA'en. |
| Kun en ZIP-fil vises i repoet | ZIP skal **udpakkes på Windows**; upload *indholdet*, ikke ZIP-filen. |

## Privatliv

Appen gemmer kanalnavnet lokalt på den enhed, hvor det oprettes. GitHub Secret skjuler det for besøgende i repoet. Offentlige ntfy.sh-topics er **ikke adgangskodebeskyttede**; dit lange tilfældige kanalnavn fungerer som en hemmelig nøgle. Del ikke kanalnavnet offentligt. En anden, som får det, kan muligvis lytte eller sende til kanalen. Stjerneradar lægger ikke emnet ind i offentlige GitHub Pages-filer.

Koden og 37 automatiske tests kan køres på GitHub uden Python på din Windows-pc. En rigtig iPhone-levering kan først verificeres efter GitHub-opsætning.
