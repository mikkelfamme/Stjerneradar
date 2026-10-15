# Ændringer i Stjerneradar V1.2

**Formål:** Samme ntfy-opsætning som Nordlysradar, uden to manuelle GitHub Secrets.

- Appen genererer et svært gætteligt `stjerner-`-topic lokalt (24 kryptografisk sikre tilfældige bytes).
- `Kopiér kanal` bruges til manuelt abonnement i ntfy på iPhone.
- `Kopiér GitHub-hemmelighed` kopierer én JSON med topic + alle varslingsvalg og primær lokation.
- GitHub Secret er nu `STJERNERADAR_ALERT_CONFIG`. Tidligere separate secrets ignoreres for at forhindre utilsigtet levering til en forkert gammel kanal.
- Testbesked går direkte til ntfy og kræver hverken GitHub state-branch eller `contents: write`.
- Automatiske schedule-kørsler uden opsætning springes over i stedet for at fejle rødt hver halve time.
- Fejl i manuelt workflow vises som tydelig GitHub Actions-fejlmeddelelse med konkret løsning.
- Opdateret service worker til 1.2.0 og network-first for appfiler, så gammel brugerflade ikke hænger unødigt ved.
- 37 automatiske tests bestået.

Hele appens eksisterende fem skærme, favoritter og astronomiske funktioner er bevaret.

Læs **OPSAETNING.md** for vejledning i at opdatere det eksisterende GitHub-repository uden terminal.
