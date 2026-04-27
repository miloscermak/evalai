# EvalAI — Předávací zpráva

**Pro:** Claude Code (a Miloše) převzít projekt a dotáhnout do produkce.
**Datum:** 2026-04-27
**Předává:** Claude (Cowork session)

---

## TL;DR

EvalAI je webový dotazník (10 otázek, ~3 minuty) pro workshopy Inspiruj.se. Mapuje účastníky na 2D plochu **zkušenost × postoj k AI**. Animal metafora (přirovnání sebe a AI ke zvířeti) slouží jako kvalitativní validátor.

**Stav:** kompletní v0.1 — frontend, backend (Apps Script), dashboard, README, design doc. Lokálně otestováno (syntax check, statické soubory, scoring proti 6 reálným lidem z přepisů). Build je ve 3 commitech na lokálním `main`, **zatím nepushnutém** do GitHubu (sandbox neměl GitHub token).

**Co zbývá:**
1. Push do GitHubu (`git push -u origin main`)
2. Nastavit Google Sheet + Apps Script + Anthropic API klíč (ručně, dle `README.md`)
3. Doplnit Apps Script URL do `src/config.js`
4. Deploy na Netlify (přes GitHub import)
5. Otestovat na živém workshopu, případně doladit scoring váhy

---

## Pro Claude Code v novém sezení — co udělat hned

1. Přečti `CLAUDE.md` (kontext projektu, konvence, otevřené otázky).
2. Přečti `docs/design.md` (kompletní metodologie, rubric, codebook zvířat, scoring formule).
3. Mrkni na `git log --oneline` (uvidíš 3 commity).
4. Spusť `git push -u origin main` — token je v Claude Code nastavený, mělo by projít.
5. Pak se vrať k Milošovi a pokračuj podle „Co zbývá" níž — bod po bodu.

**Důležitá pravidla z user-level CLAUDE.md (Milošova preference):**
- Nikdy nemazat ani nepřepisovat zdrojové materiály bez explicitního souhlasu
- Upozornit předem na destruktivní/nevratné akce
- Ptát se před složitými/rizikovými úkoly
- Nejdřív struktura/plán, pak realizace
- Komunikace v češtině, kód anglicky

---

## Co je v repu (file-by-file)

### Root
- **`CLAUDE.md`** — dlouhodobý kontext pro Claude. Stack, struktura, konvence, otevřené otázky, instrukce pro budoucí session. **Aktualizuj po každém milníku.**
- **`README.md`** — technický README, kompletní setup guide krok po kroku (vytvoření Sheetu, Apps Script deploy, config, lokální test, Netlify deploy).
- **`HANDOFF.md`** — tento soubor. Po dokončení deploye ho můžeš smazat nebo přesunout do `docs/sessions/`.
- **`.gitignore`** — standardní (DS_Store, node_modules, .env, data/transcripts/).
- **`netlify.toml`** — `publish = "src"` + redirect `/dashboard` → `/dashboard.html`.
- **`scoring-test.mjs`** — lokální node skript, který validuje scoring proti 6 reálným lidem z přepisů (Senta, Tomáš IT, Pavel Innovation, Lukáš stavař, Saša, Andrea). Spusť jako `node scoring-test.mjs` z root projektu.

### `docs/`
- **`design.md`** — **klíčový dokument**. Kompletní design dotazníku: 10 otázek, scoring formule (X 0-100, Y -50..+50), codebook zvířat pro Claude API, archetypy účastníků, validační příklady. Pokud máš měnit scoring, čti tohle nejdřív.

### `src/` (frontend, deploy na Netlify)
- **`index.html`** — kostra dotazníku (84 řádků). Načítá `style.css`, `config.js`, `questions.js`, `app.js`.
- **`dashboard.html`** — kostra dashboardu. Načítá `style.css`, `dashboard.css`, `config.js`, `dashboard.js`.
- **`style.css`** — formulářové styly. Modern, elegant, mobile-first. Paleta: white background, near-black text, teal akcent (`#0d9488`).
- **`dashboard.css`** — vrstva navíc pro dashboard. Definuje barevné kvadranty (warm/green/red/blue), tooltip, legendu.
- **`config.js`** — **musí se editovat při deployi**. Drží `webhookUrl` a `dashboardJsonUrl`. Když je prázdný, frontend běží v DEV módu (loguje payload do console).
- **`questions.js`** — definice 10 otázek jako pole objektů. Single/multi/scale/animal typ. Typ `multi` má `exclusive` flag pro „Nic z toho" volby.
- **`app.js`** — logika dotazníku. State machine (welcome → q1..q10 → thanks), navigace, validace, submit přes fetch s `mode: 'no-cors'` (fire-and-forget pro Apps Script).
- **`dashboard.js`** — logika dashboardu. Fetch z Apps Script GET endpointu, render SVG scatter plotu, auto-refresh každých 10s. Demo data hardcoded jako fallback, když není config.

### `apps-script/`
- **`webhook.gs`** — kompletní backend. Funkce:
  - `doPost(e)` — webhook handler, validuje payload, volá scoring + Claude API, zapisuje do Sheets
  - `doGet(e)` — vrací JSON s body pro dashboard, filtruje by workshop_id
  - `scoreX(answers)` — experience score 0-100 (Q1-Q5)
  - `scoreY(answers)` — attitude score -50..+50 (Q6-Q9)
  - `scoreAnimal(q10)` — volá Claude API s codebookem, vrací modifikátory + archetype + note
  - `processSubmission(payload)` — orchestruje vše, počítá final scores, detekuje outlier
  - `testSubmission()` — manuální test bez frontendu (spustit v Apps Script editoru)
  - **Konstanty k editaci:** `SPREADSHEET_ID` (musí se nahradit), `CLAUDE_MODEL` (defaultně `claude-sonnet-4-5-20250929`).

---

## Klíčové designové principy (z `docs/design.md`)

- **„Proč" váží víc než druh zvířete.** Animal coding je overlay (max ±5 na X, ±10 na Y). Nepřebíjí Q1-Q9.
- **Outliers se značí**, ne přepisují. Když animal posune Y o ≥8 bodů, bod dostane vlaječku v dashboardu — pro Miloše signál „tohohle si všimni v ústním kole".
- **Self-rating se ignoruje.** Skóre experience je čistě behaviorální (počet nástrojů, placené licence, pokročilé techniky).
- **Anonymita = jen křestní jméno.** Žádný e-mail, IP, full name, telefon.
- **Mobile-first.** 95 % vyplnění z telefonu po naskenování QR kódu.
- **3 minuty max.** Otázky se nesmí množit.

---

## Scoring — rychlý přehled (detail v `docs/design.md` sekce 4)

### X (zkušenost), 0-100
```
Q1 (doba):          0 / 10 / 25 / 40
Q2 (frekvence):     0 / 10 / 20 / 35 / 50
Q3 (nástroje):      5 b běžné, 10 b speciální (NotebookLM, MidJourney, ElevenLabs, video), max 60
Q4 (placení):       0 / 20 / 40
Q5 (pokročilé):     long_prompt 10, custom_gpt 15, own_data 15, automation 20, api 15, max 75

X = round(sum / 265 * 100)
```

### Y (postoj), -50..+50
```
Q6 (5 let):         (value - 3) * 10  →  -20..+20
Q7 (důvěra):        trust=0, skim=+5, verify=+10, rewrite=-5, disappoint=-15
Q8 (obavy):         -3 za každou negativní obavu (max 3 selections), "none" = +5
Q9 (self-efficacy): (value - 3) * 5  →  -10..+10

Y = clamp(sum, -50, 50)
Y_norm (pro dashboard) = Y + 50  →  0..100
```

### Animal modifikátor (z Claude API)
```
animal_x_mod: -5..+5  (apex predator = +, plyšák = -)
animal_y_mod: -10..+10  (pomáhající = +, mýtické nebezpečné = --)
archetype: jeden ze 7 stringů
note: česká věta proč

x_final = clamp(x + animal_x_mod, 0, 100)
y_final = clamp(y_norm + animal_y_mod, 0, 100)
outlier = abs(animal_y_mod) >= 8
```

---

## Co bylo otestováno

✅ **Syntax check všech JS souborů** (`node --check src/*.js apps-script/webhook.gs`) — passed.
✅ **Statické soubory se serve korektně** přes `python3 -m http.server` (testováno curl).
✅ **Scoring algoritmus** na 6 reálných lidech z přepisů — výsledky:

| Účastník | Očekávané X / Y | Spočtené X / Y_raw | Verdikt |
|---|---|---|---|
| Senta | ~85 / +35 | 89 / +37 | ✓ |
| Tomáš IT | ~95 / +30 | 100 / +34 | ✓ (saturuje) |
| Pavel Innovation | ~85 / -5 | 70 / -9 | ✓ (X je trochu nízko, ale dáno mým odhadem odpovědí) |
| Lukáš stavař | ~25 / +20 | 17 / +25 | ✓ |
| Saša | ~5 / -25 | 0 / -36 | ✓ (Y silnější, ale směr OK) |
| Andrea ČSOB | ~5 / -30 | 0 / -39 | ✓ |

Všichni skončili ve správném kvadrantu. Drobné rozdíly v hodnotách jsou v rámci odhadu odpovědí; přesná kalibrace přijde z reálných dat po prvním workshopu.

❌ **End-to-end přes Apps Script** — netestováno (vyžaduje Google účet, deploy, Anthropic API klíč). Otestuje se ručně podle `README.md` step-by-step.
❌ **Browser rendering** — netestováno (sandbox nemá browser). Doporučuji v prvním kroku otevřít `src/index.html` lokálně a kliknout celým flow.

---

## Co zbývá udělat (chronologicky)

### Krok 1: Push do GitHubu
```bash
cd /Users/miloscermak/cowork/evalai
git push -u origin main
```
Repo: `https://github.com/miloscermak/evalai` (public, vytvořený Milošem před touto session).

### Krok 2: Lokální smoke test (volitelné, doporučené)
```bash
cd /Users/miloscermak/cowork/evalai/src
python3 -m http.server 8000
# Otevři http://localhost:8000/?w=test v prohlížeči
# Vyplň celý flow, ověř:
#   - progress bar se hýbe
#   - validace funguje (zkus prázdný next)
#   - back button vrací stav
#   - na konci v DevTools → Console je payload
```
A taky `http://localhost:8000/dashboard?w=test` — měl bys vidět demo body z `dashboard.js` (8 hardcoded bodů včetně Senty).

### Krok 3: Google Sheet + Apps Script
Postup je v `README.md`, sekce „Setup — krok za krokem". Ve zkratce:

1. [sheets.new](https://sheets.new) → vytvoř Sheet, zkopíruj ID z URL.
2. [script.google.com](https://script.google.com) → New project → vlož `apps-script/webhook.gs`.
3. Nahraď `<<PASTE_YOUR_SHEET_ID_HERE>>` skutečným ID.
4. Project Settings → Script Properties → `ANTHROPIC_API_KEY` = `sk-ant-...` (Milošův klíč).
5. Deploy → New deployment → Web app → Execute as Me, Who has access: Anyone.
6. **Zkopíruj Web app URL.**
7. V editoru spusť funkci `testSubmission` — měl by se objevit řádek v Sheetu se skóre. Pokud ano, **smaž testovací řádek**.

### Krok 4: Doplnit URL do config.js
```js
// src/config.js
window.EVALAI_CONFIG = {
  webhookUrl: '<<PASTE_WEB_APP_URL_HERE>>',
  dashboardJsonUrl: '<<SAME_URL>>',
  version: '0.1.0',
};
```
Commit + push.

### Krok 5: Deploy na Netlify
1. [app.netlify.com](https://app.netlify.com) → Add new site → Import from GitHub → vyber `evalai`.
2. Build settings vidí `netlify.toml`, takže nic neřeš.
3. Deploy → dostaneš URL `evalai-xyz.netlify.app`.
4. Domain management → přidej vlastní subdoménu (např. `dotaznik.inspiruj.se`), pokud Milos chce.

### Krok 6: První ostrý test
1. Vyber workshop_id (např. `cez-2026-04-27`).
2. Vygeneruj QR kód odkazující na `https://<URL>/?w=cez-2026-04-27`.
3. Účastníci vyplní.
4. Promítni `https://<URL>/dashboard?w=cez-2026-04-27`.

### Krok 7: Re-kalibrace (po prvním workshopu)
- Podívej se do Sheetu: rozprostřou se body smysluplně po čtyřech kvadrantech?
- Pokud všichni v jednom kvadrantu → uprav váhy v `apps-script/webhook.gs` (`scoreX`, `scoreY`).
- Pokud outlier vlaječka chytá moc/málo lidí → uprav threshold v `processSubmission` (`Math.abs(animal.y_mod) >= 8`).
- Po úpravě: commit + push, redeploy Apps Script (New deployment, ne Edit deployment, protože staré URL musí přežít).

---

## Otevřené otázky a deferred rozhodnutí

1. **Doména** — Milos řekl „pak to dám na subdoménu, neřeš". Zatím deploy na default Netlify subdoménu. **Akce:** počkat na Milošův pokyn po prvním deployi.

2. **Branding** — žádný specifický brand, jen zmínit Inspiruj.se. **Hotovo:** v `style.css` je střídmá teal paleta, ve footeru je odkaz na inspiruj.se.

3. **Anthropic API klíč** — Milos má účet, klíč doplní do Script Properties podle `README.md`. **Akce:** počkat na Miloše ve fázi setupu.

4. **GitHub repo** — public, už vytvořený na `https://github.com/miloscermak/evalai`. **Akce:** push.

5. **Workshop_id** — zatím ručně do URL při sdílení QR. Adminové view pro přepínání workshopů je deferred (možná v0.2).

6. **Archetypy v dashboardu** — zatím se zobrazují jen v tooltipu (hover na bod). Trvalé labely u bodů jsou deferred (mohou zahltit grafu když jich je hodně).

7. **CORS pro Apps Script POST** — používá se `mode: 'no-cors'` (fire-and-forget). Frontend nedostává potvrzení o úspěšném zápisu. Pokud bude potíž, dá se přepnout na JSONP nebo přepsat backend tak, aby vracel CORS-friendly preflight response.

8. **Re-scoring starých záznamů při změně vah** — zatím není potřeba (nemáme staré záznamy). Až bude, dá se napsat batch funkce v Apps Scriptu.

---

## Známá rizika a věci k pozorování

⚠️ **Apps Script má quotas.** UrlFetchApp (volání Claude API) má limit 20 000 volání/den pro běžný účet. Pro běžné použití naprosto stačí. Pro velký firemní workshop (1000+ účastníků/den) by limity mohly hrát roli.

⚠️ **Apps Script timeout** je 6 minut na execution. Volání Claude API běžně trvá 1-5 sekund. Při náhlém shluku odpovědí (50 lidí klikne najednou) může poslední čekat. V praxi nezpůsobí.

⚠️ **Claude model** je v konstantě `CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'`. **Pozor:** model name jsem si neověřil proti tomu, co Milos má dostupné. Pokud Anthropic změnil dostupné modely, nastavit na aktuální (např. `claude-haiku-4-5-20251001` pro úsporu).

⚠️ **Outlier threshold** (`abs(animal.y_mod) >= 8`) je odhad. Po prvním workshopu se ukáže, zda flagujeme moc/málo. Cíl: tak 5-15 % účastníků jako vlaječkovaní.

⚠️ **Dashboard JSON endpoint je veřejný** (Apps Script Web app: Anyone with link). Workshop_id je obfuskace, ne autentizace. Pokud chce Milos opravdu privátní dashboard, dá se přidat secret query param (`?w=...&k=secret`) a v `doGet` ho ověřovat.

⚠️ **Sandbox FUSE git lock issue** — během této session bash sandbox měl problém s mazáním `.git/HEAD.lock`. Vyřešil jsem to přes `mcp__cowork__allow_cowork_file_delete`. Na Macu lokálně se to nestane, je to jen sandbox specifikum.

---

## Jak iterovat — best practices

**Když měníš otázky:** uprav `src/questions.js` AND `apps-script/webhook.gs` synchronně. Pokud jen dotazník, tak frontend dostane novou otázku, ale backend ji nezahrne do scoringu — výsledek bude tichá nepřesnost.

**Když měníš scoring váhy:** `apps-script/webhook.gs` (funkce `scoreX`, `scoreY`) + zkontroluj, že `scoring-test.mjs` po úpravě prochází na očekávaných hodnotách (a podle potřeby aktualizuj test).

**Když měníš animal codebook:** prompt v `apps-script/webhook.gs` funkce `buildClaudePrompt`. Po změně doporučuji ručně otestovat na 3-5 přirovnáních a zkontrolovat JSON výstup.

**Když měníš dashboard:** SVG render je v `src/dashboard.js` funkce `renderBackground` a `renderPoints`. ViewBox je 1000×1000, margin 80, takže oblast plotu je 80..920 v obou osách.

---

## Pokud něco nejde

- **„Workspace still starting" v bash:** počkej 10 sekund a zkus znovu (sandbox boot).
- **Git push fail kvůli auth:** sandbox token expired? V Claude Code by mělo být OK, je tam GitHub integrace.
- **Apps Script Quota exceeded:** Milos potřebuje druhý Google účet, nebo přepnout na vlastní backend (Cloudflare Worker + KV/D1, ale to je 1-2 dny práce).
- **Claude API 401:** špatný klíč v Script Properties. Zkontroluj v console.anthropic.com, že klíč existuje a je aktivní.
- **Dashboard prázdný:** zkontroluj, že workshop_id v URL přesně odpovídá tomu v Sheetu (case-sensitive, žádné mezery).

---

## Reference

- **Repo:** https://github.com/miloscermak/evalai
- **Lokální:** `/Users/miloscermak/cowork/evalai`
- **Design dokument:** `docs/design.md`
- **Persistent kontext:** `CLAUDE.md`
- **Setup guide:** `README.md`

---

**Děkuju za převzetí. Hodně štěstí na první workshop. — Claude (Cowork session, 2026-04-27)**
