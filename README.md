# Stjerneradar V1.2

Stjerneradar: mobilvenlig Progressive Web App til nattehimlens synlighed, stjernekort, astronomiske begivenheder og tidlige/sene ntfy-varsler.

**NYT I V1.2:** Samme simple ntfy-opsætning som Nordlysradar: **Opret alarmkanal → Kopiér kanal → Kopiér GitHub-hemmelighed**. Der kræves kun **én** GitHub Secret, `STJERNERADAR_ALERT_CONFIG`. En manuel test-push kræver ikke GitHub API-skriverettigheder eller state-branch. Fejl i en manglende Secret forklares i GitHub Actions-jobbet.

**Start her:** Læs [OPSAETNING.md](OPSAETNING.md). Her står, hvordan du opdaterer det eksisterende repo `mikkelfamme/Stjerneradar` direkte på GitHubs hjemmeside – uden Python, Cloudflare eller lokale udviklingsværktøjer.

## Appens funktioner

- **I nat:** Stjerneindeks 0–100, skyer, Måne, astronomisk mørke og bedste tidsvindue.
- **7 dage:** Lokal timeprognose for syv nætter, med tydelig usikkerhed for længere horisonter.
- **Stjernekort:** Interaktivt kort med stjerner, planeter, Måne, Mælkevejens retning og udvalgte stjernebilleder.
- **Begivenheder:** Meteorregn, formørkelser, beregnede ISS-passager og et kildestyret (i starten tomt) kometregister.
- **Steder:** GPS og favoritsteder samt valg af primært varslingssted.
- **Varsler:** Tidligt/sent, uventet opklaring og særlige begivenheder. GitHub Actions beregner automatisk, ntfy sender besked på iPhone.

## Teknisk

| Komponent | Funktion |
|---|---|
| GitHub Pages | Udgiver PWA med HTTPS |
| GitHub Actions `pages.yml` | Udgiver siden og opdaterer ISS-banedata |
| GitHub Actions `alerts.yml` | Prognosekontrol ca. hver 30. minut og manuel test |
| ntfy | Notifikationer i separat iPhone-app |
| Én GitHub Secret | `STJERNERADAR_ALERT_CONFIG` rummer ntfy-kanal og primært varslingssted |
| State-branch `stjerneradar-alert-state` | Husker afsendte varsler uden at gemme koordinater eller topic |
| Open-Meteo/DMI, Astronomy Engine, CelesTrak | Vejr- og astronomidata |

De gamle V1.1-secrets (`STJERNERADAR_CONFIG` og `NTFY_TOPIC`) ignoreres bevidst i V1.2, så en forkert gammel kanal ikke kan få en testbesked. Brug udelukkende den ene nye samlede Secret.

Stilleperioden er låst til **kl. 23–07** i det valgte varslingssteds tidszone. GitHub Actions er ikke en garanteret præcis timer; den kan køre forsinket. ntfy-kvitteringen bekræfter HTTP-accept, ikke at iPhone rent faktisk viste beskeden.

## Tests

GitHub udfører projektets tests ved workflow-kørsel. Lokal Node.js er valgfri:

```bash
npm test
```

37 tests dækker beregninger, stilleperioder, deduplikation, GitHub-state, ntfy-konfiguration, kompatibilitet med V1.1 og UI-kanaloprettelse. Ingen live-ntfy-test er inkluderet i den automatiske testpakke.
