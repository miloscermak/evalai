# EvalAI

Webový dotazník pro workshopy a přednášky **Inspiruj.se**, který každého účastníka umístí na 2D mapu **zkušenost s AI × postoj k AI**. Animal metaphor (přirovnání sebe a AI ke zvířeti) slouží jako kvalitativní validátor a outlier detektor.

Stack: vanilla HTML/JS frontend (Netlify) · Google Apps Script backend · Google Sheets jako databáze · Claude API pro animal scoring.

Design dokument s metodologií a rubric je v [`docs/design.md`](docs/design.md). Kontext pro Claude session je v [`CLAUDE.md`](CLAUDE.md).

---

## Struktura

```
evalai/
├── src/                # frontend (deploy na Netlify)
│   ├── index.html      # dotazník (10 otázek)
│   ├── dashboard.html  # live scatter plot
│   ├── style.css       # formulář
│   ├── dashboard.css   # dashboard
│   ├── config.js       # webhook + dashboard JSON URL
│   ├── questions.js    # 10 otázek (data)
│   ├── app.js          # logika dotazníku
│   └── dashboard.js    # logika dashboardu
├── apps-script/
│   └── webhook.gs      # Apps Script — doPost + doGet + scoring
├── docs/
│   └── design.md       # metodologie, rubric, codebook
├── netlify.toml        # Netlify deploy config
├── CLAUDE.md           # kontext pro AI agenta
└── README.md
```

---

## Setup — krok za krokem

Tenhle setup uděláš jednou. Pak už jen postavíš QR kód a běžíš.

### 1. Google Sheet

1. Jdi na [sheets.new](https://sheets.new) a vytvoř nový Sheet, jméno např. `EvalAI Data`.
2. Z URL si zkopíruj **Sheet ID** — je to ten dlouhý string mezi `/d/` a `/edit`.

### 2. Apps Script

1. Otevři [script.google.com](https://script.google.com) → **New project**.
2. Smaž defaultní kód a vlož celý obsah `apps-script/webhook.gs`.
3. V kódu nahoře nahraď `<<PASTE_YOUR_SHEET_ID_HERE>>` svým Sheet ID z kroku 1.
4. **Project Settings** (ikona ozubeného kolečka vlevo) → **Script Properties** → **Add script property**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: tvůj klíč ze [console.anthropic.com](https://console.anthropic.com/) (formát `sk-ant-...`)
5. **Deploy** (modré tlačítko vpravo nahoře) → **New deployment**:
   - Type: **Web app**
   - Description: `evalai webhook v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Klik na **Deploy** → schval oprávnění (běžně Google chce souhlas s přístupem do Sheetu a externím API).
7. Zkopíruj **Web app URL** — vypadá jako `https://script.google.com/macros/s/AK.../exec`.

> **Test:** v editoru spusť funkci `testSubmission` (`Run` → vyber funkci). Pokud se ti do Sheetu zapíše řádek a v logs uvidíš `Result: { … }`, backend funguje. Smaž testovací řádek ze Sheetu.

### 3. Frontend config

Edituj `src/config.js`:

```js
window.EVALAI_CONFIG = {
  webhookUrl: 'https://script.google.com/macros/s/AK.../exec',
  dashboardJsonUrl: 'https://script.google.com/macros/s/AK.../exec',
  version: '0.1.0',
};
```

(Stejná URL pro oba — Apps Script rozliší `doPost` a `doGet`.)

### 4. Lokální test

```bash
cd src
python3 -m http.server 8000
# nebo: npx serve .
```

Otevři `http://localhost:8000/?w=test`. Vyplň dotazník. Ověř, že do Sheetu spadl řádek s vypočítaným skóre. Pak otevři `http://localhost:8000/dashboard?w=test` a měl bys vidět svou tečku.

### 5. Deploy na Netlify

1. Push do GitHubu (viz dole).
2. Na [netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project** → GitHub → vyber `evalai` repo.
3. Build settings vidí `netlify.toml`, takže nic neřeš. Klik **Deploy**.
4. Netlify ti dá URL typu `evalai-xyz.netlify.app`. Tu přepneš na vlastní subdoménu (např. `dotaznik.inspiruj.se`) v **Domain management**.

---

## Workshop flow

1. **Vyber workshop_id**: krátký, čitelný, např. `cez-2026-04-27`.
2. **Sdílej QR**: odkaz na `https://dotaznik.inspiruj.se/?w=cez-2026-04-27`.
3. **Účastníci vyplní** (~3 min).
4. **Promítni dashboard**: `https://dotaznik.inspiruj.se/dashboard?w=cez-2026-04-27` — body naskakují živě, refresh každých 10 s nebo klávesa `R`.

---

## Push do GitHubu (z Tvého Macu)

Sandbox tady commity vytvořil, ale push do GitHubu vyžaduje tvé credentials. Z terminálu na Macu:

```bash
cd /Users/miloscermak/cowork/evalai
git push -u origin main
```

(Origin už je nastavený na `https://github.com/miloscermak/evalai.git`.)

---

## Údržba a iterace

**Změna scoring vah:** uprav konstanty v `apps-script/webhook.gs` (`scoreX`, `scoreY`). Po deployi nového Apps Script revisionu se skóre nových odpovědí počítá podle nových vah. Pro re-scoring starých odpovědí by šel udělat batch script (zatím není potřeba).

**Změna otázek:** uprav `src/questions.js` a synchronně `apps-script/webhook.gs` (mapování hodnot na body). Měň jen tehdy, když máš důvod — porušíš srovnatelnost se starými daty.

**Animal codebook:** je v promptu uvnitř `apps-script/webhook.gs` ve funkci `buildClaudePrompt`. Pokud zjistíš systematický problém s tím, jak Claude koduje, edituj prompt.

**Re-kalibrace:** po prvních ~50 reálných odpovědích se podívej na rozložení X a Y v Sheetech, případně uprav váhy aby se body smysluplně rozprostřely po všech kvadrantech.

---

## Soukromí

- Žádné PII kromě křestního jména
- Žádné e-maily, telefony, IP
- Sheet je soukromý (jen tvůj Google účet)
- Dashboard URL je „obfuskace, ne autentizace" — kdyby měl být veřejný link nepříjemný, doplníme jednoduché heslo do URL
- Anthropic API přijímá jen Q10 (zvíře + důvod), nikdy jméno

## License

Soukromý projekt Inspiruj.se. Bez licence pro re-use.
