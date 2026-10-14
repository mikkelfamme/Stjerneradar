# Stjerneradar — kravspecifikation V1.0

**Status:** Klar til brugerens godkendelse, **ingen kode er skrevet**.  
**Dato:** 14. oktober 2026  
**Formål:** Privat, dansk mobilapp (PWA) til iPhone, med reel pushvarsling om gode observationsforhold på nattehimlen.

## 1. Produktidé og succeskriterium

Stjerneradar skal besvare tre spørgsmål for en valgt lokation:

1. **Hvornår?** Hvornår bliver det bedst at observere nattehimlen, time for time og op til syv dage frem?
2. **Hvad?** Hvilke stjerner, stjernebilleder, planeter og særlige himmelbegivenheder kan faktisk ses derfra?
3. **Hvor?** Hvilke af mine gemte eller nærliggende steder giver de bedste forhold?

Appen må ikke ligestille solnedgang med fuldt mørke. Den skal skelne mellem skumring, astronomisk nat og månelys samt mellem observation med det blotte øje og kikkert/teleskop. Prognoser skal mærkes som **estimater**, ikke observationer eller garantier.

### Fastlagte brugerbeslutninger

| Emne | Krav |
|---|---|
| Enhed | iPhone-optimeret PWA med hjemmeskærmsinstallation |
| Lokation | Automatisk GPS, manuel stedvælger og gemte favoritsteder |
| Prognose | Timedata for de næste 7 dage og bedste sammenhængende tidsvindue |
| Observationsmåder | Det blotte øje, kikkert og teleskop |
| Begivenheder | Stjerner/stjernebilleder, planeter, Mælkevejen, meteorregn, ISS, relevante kometer og formørkelser |
| Visualisering | Interaktivt stjernekort og kort til sammenligning af observationssteder |
| Varsling | Tidligt varsel og opdatering tæt på gode forhold; særlige begivenheder og uventet opklaring |
| Stilleperiode | **Der sendes aldrig pushbeskeder fra 23:00 til 07:00, lokaltid** |
| Design | Dansk, mørk og mobilførst; samme enkle designfamilie som Stueform/Nordlysradar |
| Relation til Nordlysradar | Selvstændig app, valgfrit link mellem apps |

## 2. Navigationsstruktur og skærme

### A. Forside: »I nat«
- Primært observationssted, GPS-status, datakilde og »sidst opdateret«.
- **Stjerneindeks 0–100** og tydelig konklusion: fremragende/gode/begrænsede/dårlige forhold.
- Bedste sammenhængende observationsvindue i lokal tid, fx »22:00–23:30«.
- Timegraf: stjerneindeks, skydække og månelys. Farver suppleres med tekst.
- Solnedgang, astronomisk mørke (når det forekommer), måneopgang/-nedgang og månefase.
- Vejrdata: samlet/lavt/mellem/højt skydække, sigtbarhed, tågerisiko, nedbør, vind, luftfugtighed og temperatur.
- Kort liste: »Dette kan du se« med tilhørende klokken, retning og højde over horisonten.
- Kort og konkret »Hvorfor denne score?« med de vigtigste positive og negative faktorer.

### B. Syv døgn
- Kort pr. nat med bedste vindue, score og prognosesikkerhed.
- Udvidelse til timegraf for hver nat; ingen kunstig sammenlægning af forhold før og efter midnat.
- Længere prognoser (dag 5–7) beskrives tydeligt som mere usikre.
- Nætter uden astronomisk mørke vises korrekt, fx i den danske højsommer; lyse objekter kan stadig være mulige.

### C. Stjernekort
- Interaktivt kort med stjerner, stjernebilleder, horisont, verdenshjørner, Månen og synlige planeter.
- Valg af sted og tidspunkt; tidslinje, zoom og tryk på objekter.
- Objektkort: navn, kategori, retning (azimut), højde (altitude), anbefalet observationstid, synlighed og kikkert-/teleskopinformation.
- Kortet må ikke kalde objekter »synlige«, alene fordi de er over horisonten; mørke, skyer og lysstyrke vurderes også.
- Telefonkompas/AR-pegetilstand er en **senere udvidelse**, da sensoradgang og nøjagtighed varierer.

### D. Begivenheder
- Kalender for meteorregn, lokale formørkelser, udvalgte kometer og synlige ISS-passager.
- Dato/tid for lokalt synligt vindue, retning, anbefalet udstyr og kilde.
- For meteorregn: tidspunkt for maksimum, radiantens højde, månelys og skyforhold; ZHR må **ikke** fremstilles som forventet antal meteorer, brugeren vil se.
- For ISS: kun faktiske, potentielt synlige passager, ikke alle geografiske overflyvninger.
- For kometer: tydelig markering af lysstyrkeusikkerhed og om optik er nødvendig.

### E. Steder
- GPS-position opdateres, når appen åbnes eller brugeren vælger »Opdater position«.
- Manuel søgning på sted/område og oprettelse af flere favoritsteder.
- Ét sted vælges som **primært varslingssted**. Push bruger dette, indtil det ændres.
- Sammenligning af stedernes skydække, måne-/mørkeforhold og lysforurening.
- Kort over potentielt mørkere steder inden for justerbar radius, **kun baseret på verificeret og lovligt anvendelig lyskildedata**. Hvis tilstrækkelige data mangler, vises ingen falsk præcis mørkeklassifikation.

### F. Indstillinger
- Valg mellem »Blotte øje«, »Kikkert«, »Teleskop – planeter« og »Teleskop – svage objekter«.
- Push til/fra, tidligt varsel til/fra, kort-før-varsel til/fra, uventet opklaring til/fra, særlige begivenheder til/fra.
- Stilleperiode: **23:00–07:00 som fast standard valgt af brugeren**, kan kun ændres ved aktiv handling.
- Justerbar alarmgrænse og minimumsvarighed for observationsvindue.
- Testnotifikation, tilladelsesstatus, instruktion til hjemmeskærmsinstallation og fejlfindingshjælp.
- Ryd favoritsteder, slet push-abonnement og data, vis kilde/licensoplysninger.

## 3. Stjerneindeks og faglig beregning

### Hovedprincip

Indekset skal måle **praktiske observationsforhold**, ikke blot andelen af skyfri himmel. Score beregnes mindst pr. time. Det bedste tidspunkt er det bedste **sammenhængende** observationsvindue, ikke et enkelt godt øjeblik.

**Faktorer**:

1. **Skydække — tungest vægt:** samlet skydække samt lave, mellemste og høje skylag. Meget tæt skydække giver en hård øvre grænse for scoren.
2. **Solens position:** solnedgang er ikke det samme som astronomisk mørke; skumringsfaser beregnes ud fra solens højde under horisonten (bl.a. -6°, -12° og -18°).
3. **Månelys:** oplyst andel **og** Månens højde over horisonten; månen under horisonten må ikke straffe scoren. Måne–objekt-vinkel kan indgå i vurdering af konkrete mål.
4. **Luft og sigtbarhed:** tåge, nedbør, dis/sigtbarhed og indikatorer for atmosfærisk gennemsigtighed. Teleskop-»seeing« mærkes kun som et **usikkert estimat**, hvis den ikke måles/modelberegnes direkte af en valid datakilde.
5. **Lysforurening:** stedets langtidsforhold og begrænsninger for svage objekter. En skyfri byhimmel må ikke automatisk beskrives som god til Mælkevejen.
6. **Objekttype:** Månen og lyse planeter kan være interessante, selv når månelyset forringer svage stjerner. Deep-sky, planeter og meteorer får derfor forskellige vurderinger.

### Output
- **Stjerneindeks 0–100** (generel stjernesynlighed).
- **Måltilpasset vurdering** for blotte øje/kikkert, planeter i teleskop og svage deep-sky-objekter.
- Forklaring af score med konkrete tal: fx »Skydække 12 %, Månen under horisonten, astronomisk mørke fra kl. 21:14«.
- Usikkerhedsmarkering på prognosen (kort sigt / mellemlangt / længere sigt); **ingen opdigtet procentsikkerhed**.

### Foreløbige scoreklasser (skal kalibreres)

| Score | Visning |
|---|---|
| 0–19 | Meget dårlige forhold |
| 20–39 | Dårlige forhold |
| 40–59 | Begrænsede forhold |
| 60–79 | Gode forhold |
| 80–100 | Fremragende forhold |

**Sikkerhedsregler:** Massivt skydække kan aldrig udløse varsel om »fremragende«. Påstanden »Mælkevejen synlig« kræver mørkt sted, tilstrækkeligt mørke og passende sæson/geometri. Hvis en datakilde mangler, skal usikkerheden vises frem for at opfinde en score. Beregningsvægte og datagrænser versionsstyres og testes på realistiske cases.

## 4. Notifikationer — obligatorisk V1-funktion

### Typer

| Type | Standard | Betingelse |
|---|---|---|
| **Tidligt varsel** | 12–36 timer før | Lovende, tilstrækkeligt lang observationstid og troværdig prognose |
| **Sidste varsel** | 30–90 min før | De opdaterede forhold er fortsat gode; ellers annulleres varslet |
| **Uventet opklaring** | Ved ny prognose | Betydelig forbedring fra seneste prognose og mindst ca. 60 min brugbart vindue |
| **Særlig begivenhed** | Forud for begivenheden | Lokal synlighed og vejrudsigt vurderet; begivenheden er relevant for brugerens observationsmåder |

### Alarmlogik

- Pushsystemet kører på en server/scheduler, **også når appen er helt lukket**.
- **Afsend aldrig** notifikationer fra og med kl. 23:00 til før kl. 07:00 i det valgte varslingssteds tidszone. Gælder også sjældne begivenheder og prøvealarm (test sendes kun inden for tilladt interval).
- En begivenhed efter kl. 23 kan varsles **før** kl. 23; aldrig efterfølgende næste morgen, hvis den er afsluttet.
- Kontroller stilleperioden **igen umiddelbart før udsendelse**, ikke kun når beskeden planlægges. Tidszone og sommertid skal testes.
- Maksimalt **to almindelige** pushbeskeder pr. døgn som udgangspunkt; særlige begivenheder har separat, begrænset kvote.
- Maksimalt én tidlig og én sen notifikation pr. observationsvindue; deduplikation med `location + event/window + notice_type`.
- Hvis prognosen forringes kraftigt, kan en varslet mulighed markeres som annulleret i appen; en korrektion sendes kun før kl. 23 og kun hvis den er væsentlig.
- **Foreløbigt alarmniveau: 80/100 i mindst 60 sammenhængende minutter**. Brugeren kan ændre tærsklen. Lokationsspecifikke mørkebegrænsninger må ikke føre til vildledende varsler.
- Der sendes ikke varsler på udløbne, fejlbehæftede eller forældede prognosedata.
- Vis seneste succesfulde varsling, antal undertrykte duplikater og årsag, hvis push er inaktivt.

### iPhone-opsætning

1. Åbn webappen via HTTPS og vælg »Føj til hjemmeskærm«.
2. Åbn den installerede app og tryk aktivt på »Aktivér notifikationer«.
3. Tillad notifikationer i iOS, opret Web Push-abonnement, gem det på serveren.
4. Send en **testnotifikation** inden for den tilladte periode og vis bekræftet resultat (eller konkret fejl).

**Begrænsning:** En PWA kan ikke antages at opdatere GPS kontinuerligt i baggrunden. Varsling tager udgangspunkt i det aktivt valgte primære sted. Leveringstidspunkt kan desuden påvirkes af iOS, netværk og Fokus-indstillinger; der gives ikke løfte om levering på sekundet.

## 5. Datakilder og teknisk anbefaling

| Behov | Valgt/foreslået løsning | Bemærkning |
|---|---|---|
| Vejr i Danmark | **Open-Meteo, DMI Forecast API** | DMI HARMONIE AROME for kort sigt, ECMWF til længere sigt; skydække i lag, tåge og sigtbarhed. Open-Meteos gratis API er til **ikke-kommerciel** brug og har grænser. |
| Sol, Måne og planeter | **Astronomy Engine** (JS/TS, MIT) | Positioner, månefase, horisontkoordinater, opgang/nedgang og astronomisk skumring. |
| Meteorregn | **International Meteor Organization (IMO)** | Årlig opdateret kalender og faktatjek af aktivitet og maksimaltidspunkt. |
| ISS | **Aktuelle baneelementer** + **satellite.js** | Kræver vurdering af både belyst rumstation og mørke hos observatøren. Gamle orbitdata må ikke bruges ukritisk. |
| Kometer og formørkelser | Verificerede begivenhedskilder og astronomiske beregninger | Kun relevante, lokaliserede og dokumenterede begivenheder. Ingen opdigtede lysstyrker. |
| Stjernekort | Licenseret katalog over lyse stjerner + koordinatberegning i Astronomy Engine | Egen enkel mobilrenderer for at undgå afhængighed af tung ekstern planetariumskomponent. |
| Lysforurening | Verificeret skyglow-/night-sky-datasæt efter licenskontrol | Satellitmålt lys fra Jorden er ikke automatisk lig med observeret himmellysstyrke; Bortle-klasse er et estimat. |
| Push/server | **Cloudflare Workers + Cron Triggers** | Planlagte kontroller ca. hver 30. minut, med ekstra kontrol ved opdateret vejrprognose; Cron bruger UTC, lokal tidslogik håndteres i applikationen. |
| Gemte varsler | **Cloudflare D1** | Push-abonnementer, primært sted, indstillinger og deduplikation. |
| Frontend | **React + TypeScript + Vite/PWA**, kildekode i GitHub | Kan hostes på GitHub Pages via HTTPS. Worker/serverdel hostes særskilt. |

### Hostingbeslutning

**Anbefalet til den første private version:** GitHub som versionsstyring, GitHub Pages som frontend og Cloudflare Workers + D1 som backend. Det holder appen i samme enkle PWA-familie som brugerens øvrige apps uden at foregive, at GitHub Pages alene kan sende push. Cloudflare har en gratis plan med kvoter; konkrete anvendelsesgrænser kontrolleres ved opsætning.

### Sikkerhed og privatliv

- Kun lokationsadgang ved brugerens tilladelse; ingen unødvendig baggrundssporing.
- Gem nødvendige koordinater til primært varslingssted og favoritsteder; undgå positionshistorik som standard.
- Opbevar VAPID-nøgler og backend-hemmeligheder som server-secrets, **aldrig i klientens GitHub-kode**.
- Push endpoints er personlige tekniske identifikatorer og beskyttes som sådanne.
- Ingen login nødvendig i V1 med én personlig installation; server-endpoints beskyttes mod uautoriseret ændring.
- Mulighed for at slette push-abonnement, steder og indstillinger.
- Hvis en udvidet offentligt tilgængelig version planlægges, revurderes adgangskontrol, databehandlingsgrundlag og API-licenser.

## 6. Visuelt design og brugervenlighed

- Nattemørkt, roligt design med dyb blå/sort baggrund, klare tal og diskrete stjerne-/måneikoner.
- Primær kortvisning: **Stjerneindeks + bedste tidspunkt + »Hvad kan jeg se?«** uden scroll til de vigtigste oplysninger.
- Progressive detaljer: korte forklaringer først, fulde vejr-/astronomidata ved tryk.
- Timegraf skal have læsbare værdier ved berøring; farver må ikke være eneste informationsbærer.
- Stjerner og animationer er dekorative, ikke datakilder. Ingen præcisionspåstande ud fra illustrationer.
- Danske tekster, 24-timers klokkeslæt og brugerens valgte steds tidszone.
- Fornuftig offline-tilstand: vis seneste cache med dato, men **ingen live- eller pushgaranti**, når data er forældede.
- Mulighed for at åbne Nordlysradar gennem et almindeligt link; apps deler ikke automatisk varslingsdata.

## 7. Afgrænsning og rækkefølge

### V1 — skal med ved første release
- PWA til iPhone, installationshjælp og reelle iOS Web Push-notifikationer.
- Automatisk GPS og favoritsteder, valgt primært varslingssted.
- DMI/Open-Meteo-baseret timeprognose for syv døgn.
- Stjerneindeks 0–100 med måne, skyer, mørke, tåge/sigtbarhed og lokal lysforurening, så langt gyldige data rækker.
- Indekstilpasning til blotte øje/kikkert samt planet- og deep-sky-teleskopobservation.
- Sol-/månetider, skumring, stjernekort og planetpositioner.
- Begivenhedskalender med verificeret meteoraktivitet og synlighed for ISS, kometer og formørkelser, når de er relevante.
- Kort/sammenligning af favoritsteder. Mørkekort og automatisk »bedste sted« vises kun, hvis datadækning og rettigheder er afklaret.
- Push med tidlig og sen vurdering, uventet opklaring, stilleperiode 23–07, testfunktion, deduplikation og korrekte fejltilstande.

### V1.1 — efter fungerende og testet V1
- Valgfri pegetilstand med telefonens orienteringssensorer.
- Mere detaljeret lokale sky-/radarkilder og vejrmodel-sammenligning.
- Personlige lister over ønskede observationsobjekter.
- Registrering af faktiske observationsforhold med feedback til scoring.
- Eventuel integration med Nordlysradar, men uden sammenblanding af indekser og varsler.

**Ikke lovet i PWA V1:** Native iOS-hjemmeskærmswidget, perfekt realtidslokation i baggrunden, eksakt seeing-måling eller garanti for at en sjælden astronomisk begivenhed kan observeres.

## 8. Testplan og acceptkriterier

Appen er først klar, når følgende kan verificeres på en rigtig iPhone:

1. **Push virker med appen lukket** efter installation på hjemmeskærmen og aktiv brugeraccept.
2. Der sendes **nul pushbeskeder** fra 23:00 til 07:00. Test kl. 22:59, 23:00, 06:59 og 07:00 samt sommertidsomstilling.
3. Tidligt varsel kan komme dagen før, og sen opdatering kan annullere en tidligere prognose, hvis skyerne vender tilbage.
4. En fuldmåne **under horisonten** straffer ikke stjernekiggeri om natten, mens fuldmåne **over horisonten** påvirker svage stjerner/deep-sky.
5. Ved samme vejr kan en planet få en bedre teleskopvurdering end et svagt deep-sky-objekt.
6. Overcast, fog og dagslys giver ikke falske varsler om fantastisk nattehimmel.
7. Der anbefales ikke et astronomisk objekt, som er under horisonten, medmindre det tydeligt står som en senere mulighed.
8. Danske sommernætter uden astronomisk mørke behandles korrekt.
9. GPS og favoritsteder virker hver for sig; push følger **primært sted**, ikke en antaget ny baggrundsposition.
10. Forældede data giver synlig advarsel og må ikke udløse nye observationstips.
11. Deduplikation forhindrer gentagne pushbeskeder om samme vindue; stilleperioden kan aldrig omgås af en event-type.
12. Der er synlig datakilde, opdateringstid, kildehenvisning og eventuelt usikkerhedsflag for hver vigtig vurdering.

## 9. Væsentlige tekniske og redaktionelle begrænsninger

- Open-Meteos gratis API er **kun til ikke-kommerciel brug**; appens private brug falder umiddelbart inden for deres beskrevne eksempler, men vilkårene skal følges.
- Kortdata om lysforurening, stjernekataloger og eksterne astronomiske oplysninger kræver kilde- og licenskontrol før offentliggørelse.
- Vejrmodeller må ikke markedsføres som præcise observationer af netop din horisont eller dit teleskops seeing.
- ISS-passager, kometers lysstyrke og formørkelser kræver dedikeret verificering; ingen auto-genererede »begivenheder«, som ikke kan dokumenteres.
- Platformenes gratis kvoter, tilgængelighed og sikkerhed bliver gennemgået ved deployment.

## 10. Research- og dokumentationskilder (kontrolleret 14. oktober 2026)

- [Apple: Sending web push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [WebKit: Web Push for Web Apps on iOS/iPadOS](https://webkit.org/blog/13878/)
- [Open-Meteo: DMI Weather Model API](https://open-meteo.com/en/docs/dmi-api)
- [Open-Meteo: brugs- og licensvilkår](https://open-meteo.com/en/terms)
- [Astronomy Engine (MIT)](https://github.com/cosinekitty/astronomy)
- [IMO: Meteor Shower Calendar 2026](https://imo.net/files/meteor-shower/cal2026.pdf)
- [Satellite.js (MIT)](https://github.com/shashwatak/satellite-js)
- [Cloudflare: Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare: Workers priser og kvoter](https://developers.cloudflare.com/workers/platform/pricing/)
- [Falchi et al.: World Atlas of Artificial Night Sky Brightness](https://doi.org/10.1126/sciadv.1600377)

---

**Næste trin:** Brugerens godkendelse af denne kravspecifikation. Først derefter startes implementering, først med datamodel/scoring og push-backend, dernæst iPhone-PWA og stjernekort.
