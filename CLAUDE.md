# EvalAI – AI Attitude Mapper

Webový dotazník (10 otázek) pro workshopy a přednášky Inspiruj.se. Mapuje účastníky na 2D plochu: **zkušenost s AI × postoj k AI**. Animal metaphor (sebe + AI + důvod) slouží jako kvalitativní validátor a outlier detector.

Use case: na začátku workshopu Milos zobrazí QR kód, účastníci vyplní telefonem (~3 min), Milos pak živě promítne scatter plot a komentuje skupinu. Sekundárně: použitelné pro přednášky a firemní průzkumy.

---

## Aktuální stav

Fáze: **v0.2 — workshop-ready, čeká se na ostrý test.** (Detailní stav po session 2026-04-28 je v [`HANDOFF.md`](HANDOFF.md).)

- [x] Analýza 5 přepisů (~60 účastníků z workshopů ČEZ, Eon, ČSOB, PF Komplet)
- [x] Design dotazníku, scoring formule, codebook zvířat (viz `docs/design.md`, Q7 už nesedí)
- [x] Scaffold projektu + git init
- [x] Frontend dotazníku (`src/index.html`) + auto-advance + result screen po submitu
- [x] Apps Script backend (zápis do Google Sheets) + Claude tools API
- [x] LLM scoring pro animal otázky (Claude API, `claude-sonnet-4-6`) + interpretace pro účastníka
- [x] Live dashboard (SVG scatter plot, čte z Sheets, auto-refresh 10 s)
- [x] Admin `/start` page s QR kódem a live counterem
- [x] Export dat z dashboardu do JSON / MD
- [x] Deploy na Netlify (`famous-torte-f2e74a.netlify.app`)
- [ ] První ostrý test na workshopu
- [ ] Re-kalibrace vah z reálných dat
- [ ] Vlastní subdoména (volitelné)

---

## Stack

- **Frontend:** vanilla HTML + JS (single-page form), bez frameworku, bez build stepu. Mobile-first, čeština.
- **Hosting:** Netlify, build z GitHub repa, auto-deploy z `main`.
- **Backend:** Google Apps Script jako webhook → zápis do Google Sheets na Milošově osobním Google účtu.
- **LLM scoring:** Claude API. Volá se z Apps Script po submitu, hodnotí jen Q10 (zvíře + důvod), vrací JSON s modifikátory + archetype.
- **Dashboard:** druhá HTML stránka, čte z Sheets přes published JSON. Auto-refresh 10 s. Knihovna na scatter plot bude zvolena při stavbě (pravděpodobně Chart.js nebo D3, podle toho co bude lehčí).

---

## Struktura repa

```
evalai/
├── CLAUDE.md          # tento soubor – kontext pro Claude
├── README.md          # technický README pro GitHub (přijde později)
├── .gitignore
├── docs/
│   └── design.md      # design dokument: dotazník, scoring, codebook
├── src/               # frontend
│   ├── index.html     # dotazník
│   ├── dashboard.html # live scatter plot
│   ├── style.css
│   └── app.js
├── apps-script/       # Google Apps Script (zkopíruje se do editoru ručně)
│   └── webhook.gs
└── data/
    └── transcripts/   # kalibrační přepisy (referenční, neveřejné)
```

Prázdné složky se zatím nezakládají, vzniknou při prvním souboru v nich.

---

## Workflow

### Development
- Frontend: editovat `src/*.html`, otevírat lokálně v prohlížeči, žádný build
- Apps Script: lokálně v `apps-script/webhook.gs` jako referenční zdroj, deploy ručně přes Apps Script editor (web app)
- Před commitem: smoke test (vyplnit dotazník end-to-end, ověřit zápis do Sheetů a vykreslení v dashboardu)

### Deploy
- Push do GitHub `main` → Netlify automaticky deployne frontend
- Apps Script: nasazení samostatně přes editor.apps.google.com (Deploy → New deployment → Web app, anyone with link)

### Workshop flow (cílový)
1. Milos vygeneruje workshop_id (např. `cez-2026-04-27`)
2. Zobrazí QR → `dotaznik.inspiruj.se/?w=cez-2026-04-27`
3. Účastníci vyplní telefonem (~3 min)
4. Milos přepne na `dotaznik.inspiruj.se/dashboard?w=cez-2026-04-27`
5. Body naskakují v reálném čase, hover ukáže jméno + zvíře

---

## Klíčové designové principy

- **„Proč" váží víc než druh zvířete.** Animal coding se aplikuje až po Q1–Q9 jako overlay (max ±5 na X, ±10 na Y). Outliers se značí vlaječkou v dashboardu, ne přepisují skóre.
- **Self-rating se ignoruje.** Skóre experience je čistě behaviorální (počet nástrojů, placené licence, pokročilé techniky).
- **Mid-X skeptici ≠ Low-X bojící se.** Archetyp „realistický power user" (Pavel Innovation, Alena Eon) musí být v dashboardu rozpoznatelný od archetypu „začátečník-skeptik" (Saša, Andrea).
- **Anonymita = jen křestní jméno.** Žádný e-mail, IP, full name, telefon.
- **Mobile-first.** Dotazník bude na 95 % vyplňován z telefonu po naskenování QR. Desktop verze je sekundární.
- **3 minuty max.** Když to bude trvat déle, lidi to nedokončí. Otázky se nesmí množit.

---

## Konvence

- **UI a obsah:** čeština
- **Kód, komentáře, commit messages:** angličtina
- **Commit messages:** stručné, imperativ, klidně i 2-3 slova (`add scoring formula`, `fix dashboard refresh`, `init: CLAUDE.md`)
- **CSS:** žádný framework. Vlastní minimalistický styl, dvě hlavní barvy + neutrální paleta.
- **JS:** ES modules. Žádný build step zatím. Až bude potřeba bundling, přidá se Vite.
- **Soubory:** jeden soubor = jedna zodpovědnost. Žádné mega-komponenty.

---

## Bezpečnost a soukromí

- Žádné PII kromě křestního jména
- Sheety jsou soukromé (Milošův Google), publikovaný je jen agregovaný JSON pro dashboard
- Dashboard URL se nesmí veřejně linkovat (workshop_id je obfuskace, ne autentizace – pokud bude potřeba víc, doplníme jednoduché heslo v URL)
- Claude API klíč je v Apps Script Properties, **nikdy v frontendu**
- LLM scoring posílá Claude API jen `{ animal_self, reason_self, animal_ai, reason_ai }`, nic dalšího
- Nikdy nemazat ani nepřepisovat existující data v Sheetech bez explicitního souhlasu Miloše

---

## Otevřené otázky (k vyřešení před / při implementaci)

1. **Doména** – `dotaznik.inspiruj.se`? `mapa.inspiruj.se`? Nebo dočasně Netlify subdoména do prvního testu?
2. **Branding** – mám použít Inspiruj.se barvy/font/logo? Pošle Milos brand guideline?
3. **Claude API klíč** – Milos má existující Anthropic účet, nebo vytvoří nový? Klíč přidáme do Apps Script Properties.
4. **Workshop_id** – ručně do URL při sdílení QR, nebo dropdown v admin view? První verze: ručně do URL.
5. **Archetypy v dashboardu** – label u každého bodu, nebo jen v exportu / hover tooltipu?
6. **GitHub repo** – public, nebo private? Doporučuji private (obsahuje codebook + kalibrační příklady).

---

## Referenční zdroje

- **Design dokument:** [`docs/design.md`](docs/design.md) – kompletní design včetně 10 otázek, scoring formule, codebook zvířat, validační příklady na konkrétních lidech z přepisů.
- **Kalibrační přepisy:** uloží se do `data/transcripts/` (neveřejné, jen pro re-kalibraci vah po prvních ostrých datech).
- **Globální Miloš preferences** (z user-level CLAUDE.md):
  - přímá komunikace, čeština, struktura → realizace
  - oddělovat fakta / interpretaci / doporučení
  - **nikdy nemazat ani nepřepisovat zdrojové materiály bez explicitního souhlasu**
  - upozornit předem na destruktivní nebo nevratné akce
  - kladení upřesňujících otázek před složitými/rizikovými úkoly

---

## Pro Claude (instrukce pro budoucí session)

Když do tohoto projektu vstoupíš znovu:

1. **Přečti tento soubor.** Ne jen prvních pár řádků – všechny sekce mají kontext.
2. **Přečti `docs/design.md`** – tam je veškerá metodologie a kódovací rubric.
3. **Zkontroluj `git log`** – co se od minula stalo.
4. **Zkontroluj sekci „Aktuální stav" výš** – co je hotové a co následuje.
5. **Před netriviální akcí se ptej.** Hlavně před deploy, mazáním, nebo změnou scoring vah.
6. **Po hotovém milníku aktualizuj stav** v tomto souboru a commitni.
