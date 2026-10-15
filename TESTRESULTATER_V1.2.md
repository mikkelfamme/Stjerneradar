# Stjerneradar V1.2 – testresultater

- **37 automatiske tests bestået** lokalt i en isoleret Node.js-runtime.
- Frontend-testen genererer en ny tilfældig kanal med Web Crypto, kopierer den og kontrollerer den samlede GitHub-konfiguration.
- Parse-/konfigurationstest kontrollerer, at **kun** `STJERNERADAR_ALERT_CONFIG` er nødvendig, og at gamle Secrets ikke kan sende til en forkert kanal.
- **Integrationssimulation:** Workflowets manuelle teststi starter uden GitHub-token og uden astronomipakker og sender (med et mock HTTP-transportlag) en POST til den genererede ntfy-kanal. Ingen besked blev sendt til den rigtige ntfy.sh-service under testen.
- Fehltest: Manglende Secret giver exit code 1 med handlingsanvisning, ikke en tavs fejl.
- En planlagt kørsel uden Secret afsluttes uden rød fejl og informerer om manglende aktivering.
- Øvrige tests: nat-/måne-/skyberegning, stilleperioder, deduplikation, GitHub-state og datakildeskift.

**Mangler live-verifikation:** End-to-end-modtagelse på ejerens iPhone via GitHub Actions og ntfy.sh. Dette skal gennemføres med en manuel test efter opdatering af GitHub Secret.

**Logadgang:** Jobbet fra 15. oktober 2026 viste exit code 1 i varslingssteppet, men de private loglinjer kunne ikke hentes via offentlig GitHub-webvisning. Den præcise oprindelige årsag er derfor ikke verificeret.
