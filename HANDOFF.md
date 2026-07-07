# EvalAI — Předávací zpráva

**Aktualizace:** 2026-07-07
**Předává:** Claude Code (session 2026-07-07 — analýza jarních dat + v2 firemní dotazník) → další session
**Stav:** v1.0-rc — **v2 dotazník implementován, čeká na redeploy Apps Scriptu a push.** Souběh v1 (zmrazená, `/v1`) + v2 (hlavní, `/`). Detailní návrh a zdůvodnění: `docs/design-v2.md`.

## Změny v session 2026-07-07 (analýza dat + v2)

### Analýza jarních dat (467 validních odpovědí, 22 akcí)

- Frekvence saturovaná (67 % daily+, 85 % >6 měsíců) → X přestavěn na aktivity.
- Y komprimované (sd 16), Q7 dominovala (r=0.86) → vyrovnané váhy, nové B2/B3.
- Zvířecí důvody vyplněny jen z 33 % → tap-chips.
- Chyběla organizační vrstva → sekce C (5E-lite dle Public First) + Org Readiness Index.

### Co je hotové (committed, NEnasazené)

- **`src/questions.js`** = v2 (A1–A5 praxe, B1–B4 postoj, C0–C5 organizace s gate
  otázkou a freelance variantami, q10 s chips, q11 + role). Stará struktura
  zmrazena v **`src/questions-v1.js`**, stránka **`src/v1.html`**.
- **`src/app.js`** — sdílený pro obě verze: `showIf` (podmíněné otázky),
  `variantOn` (variantní znění), `optKeyPrefix` (likert), chips s max 3,
  `.v2` i18n overridy, `formVersion` v payloadu, dynamický počet otázek.
- **`src/i18n.js`** — ~150 nových klíčů CZ+EN pro v2.
- **`apps-script/webhook.gs`** — routing podle `payload.formVersion`; v2:
  `scoreX2` (35 šíře + 30 hloubka + 15 frekvence + 10 placené + 10 nástroje),
  `scoreY2` (B1 ±15, B2 ±15, B3 ±10, obavy −3), `orgIndexV2` (průměr C1–C5),
  nový tab `submissions_v2` (vytvoří se sám), `buildFeedbackPromptV2` (CZ/EN,
  vč. chips a org kontextu), `testSubmissionV2`. doGet: `?v=2` čte v2 tab.
- **`src/dashboard.js/.html/.css`** — `?v=1` pro jarní data (default v2),
  badge AI Readiness (průměr org_index zaměstnanců, od n≥3).
- **`src/start.html/.js`** — volba verze dotazníku (v2 default), QR/dashboard
  linky a counter respektují verzi.
- **`netlify.toml`** — redirect `/v1`.
- **`scoring-test-v2.mjs`** — 12 kalibračních kotev, všechny prochází.
- **Smoke test v prohlížeči prošel:** CZ i EN, freelance varianty, skip sekce C
  (c0=none → c1–c5 vypadnou z payloadu), chips max 3, v1 regrese OK.
- **Bezpečnost:** `evalai260524.csv` (jména účastníků!) odstraněn z gitu,
  `*.csv`/`*.xlsx` v .gitignore. POZOR: soubor zůstává v git historii na
  GitHubu — úplné odstranění vyžaduje `git filter-repo` + force push (čeká
  na Milošovo rozhodnutí).

### Co musí Milos udělat ručně (V TOMTO POŘADÍ!)

1. **Apps Script redeploy NEJDŘÍV** (nový webhook.gs je zpětně kompatibilní,
   v1 provoz nenaruší): script.google.com → vložit `apps-script/webhook.gs`
   → Deploy → Manage deployments → New version. URL se nemění.
2. V Apps Script editoru spustit **`testSubmissionV2`** → ověřit, že se vytvořil
   tab `submissions_v2` a řádek má skóre + interpretaci.
3. **Pak teprve `git push`** (Netlify nasadí frontend v2).
4. Smoke test: `kdojsem.inspiruj.se` (v2 CZ), `/?lang=en`, `/v1` (stará verze),
   `/dashboard?w=<test>` (v2 data), `/start` (volba verze).
5. Smazat testovací řádky z `submissions_v2`.

### Otevřené úkoly do další session

- **Generátor firemního reportu** (deliverable pro firmy): AI Readiness Index
  + 5E rozpad + mapa + benchmark + shadow AI % + doporučení. Návrh struktury
  v `docs/design-v2.md`.
- Benchmark z jarních dat: přemapovat Q3/Q4/Q5/Q7/Q8 → v2 ekvivalenty,
  spočítat percentily podle oborů.
- Po prvních ostrých v2 akcích: kalibrace X2/Y2 na reálných datech.
- Rozhodnout git historii (filter-repo kvůli CSV se jmény).
- Carry-over: sync `docs/design.md` (v1 dokumentace).

---

# Předchozí stav (2026-05-24)

**Stav:** v0.6 — **bilingva implementována.** Frontend, dashboard a backend prompt podporují `?lang=en`. Sheet schema beze změny. Čeká se na manuální redeploy Apps Script a smoke test obou jazykových verzí.

## Změny v session 2026-05-24 (EN i18n)

### Co je hotové (committed)

- **Nový `src/i18n.js`** — jeden objekt `{ cs, en }` s ~170 klíči (meta, welcome, form, result, archetype, minimap, dashboard, export, sections, q1–q11 včetně všech options). Helper `window.t(key, lang, vars)` s fallbackem CS → EN → klíč. `window.evalaiGetLang()` čte `?lang=` z URL (whitelist cs|en, default cs).
- **Refactor `src/questions.js`** — odstraněny textové labely, ponechána struktura (id, type, value kódy, weights, caps). Render skládá i18n klíče (`q1.opt.gt2y`).
- **Refactor `src/app.js`** — `state.lang` propagován všude, mini-map labely a archetype názvy lokalizovány, `lang` v POST payloadu, dynamický `<html lang>` + `<title>`. Footer doplněn o přepínací odkaz `English version` / `Česká verze`.
- **Refactor `src/dashboard.js` + `src/dashboard.html`** — legend, axis, kvadrantní labely, tooltip, export do MD/JSON jsou lokalizované. Plurál účastníků se větví (CZ má 3 formy, EN 2). `toLocaleString(locale)` bere lokálu z i18n klíče.
- **Refactor `apps-script/webhook.gs`** — `processSubmission` extrahuje `lang` z payloadu, `buildFeedbackPrompt(lang, …)` má dvě paralelní verze (CZ/EN). Slovníky odpovědí (`ANSWER_LABELS.cs` / `.en`) lokalizované. Tool description také větvená. System prompt explicitně instruuje „Write entirely in English" / „Piš výhradně česky" — i když účastník napsal zvíře jinojazyčně.

### Co se NEzměnilo

- **Sheet schema** — žádný nový sloupec `lang`. Bylo to vědomé rozhodnutí (jednodušší deploy, ztrácí čistou filtraci CZ/EN, ale lze odvodit z workshop_id nebo z jazyka `interpretation`).
- **Scoring** — `scoreX`, `scoreY`, `deriveQuadrant`, `backfillScores` beze změny.
- **`src/start.html` / `src/start.js`** — admin zůstává CZ.
- **`netlify.toml`** — žádné routing změny, `?lang=en` je jen query param.
- **`src/style.css`** — bez českých stringů.

### Co musí Milos udělat ručně po pull

1. **Apps Script redeploy** (nutné, jinak EN dotazník dostane CZ odpovědi):
   - script.google.com → projekt EvalAI → `webhook.gs`
   - Cmd-A → vložit obsah z `apps-script/webhook.gs` → Cmd-S
   - Deploy → Manage deployments → tužka → Version: New version → Deploy (URL zůstává)
2. **Smoke test CZ** (regrese): otevřít `kdojsem.inspiruj.se`, projít celý dotazník česky → ověřit, že vše funguje stejně jako před změnou.
3. **Smoke test EN**: otevřít `kdojsem.inspiruj.se/?lang=en` → projít, ověřit, že `interpretation` i `animal_note` v Sheetu jsou anglicky.
4. **Dashboard EN**: `kdojsem.inspiruj.se/dashboard.html?lang=en&w=<wid>` → legenda, osy, kvadranty, export do MD anglicky.

### Otevřené úkoly do další session

- Smoke test po deployi (CZ regrese + EN end-to-end).
- Pokud Claude občas sklouzne do CZ při `?lang=en`, posílit `You MUST write entirely in English.` v systém promptu (`webhook.gs`, `buildFeedbackPrompt`).
- (Carry-over z předchozí session 2026-05-24): kalibrační analýza z 205 datapointů, cleanup šumu v Sheetu, sync `docs/design.md`.

### Rollback

- Tag `v0.5-pre-redesign` (commit `7ea4684`) je bezpečný bod **před** i18n refactorem.
- `git checkout v0.5-pre-redesign` vrátí stav před touto session.

---

# Předchozí session

**Aktualizace:** 2026-05-24 (ranní session)
**Stav po session:** v0.5 — 6+ ostrých workshopů proběhlo, **205 datapointů** v Sheetu (2026-04-27 → 2026-05-22). Workshop flow ověřen. Otevřená je kalibrace vah z reálných dat a sync `docs/design.md`.

## Změny v session 2026-05-24

- **Aktualizace stavu v CLAUDE.md** — odškrtnut „První ostrý test na workshopu", přidán seznam proběhlých workshopů a statistika.
- **Snapshot databáze:** `evalai260524.csv` (205 řádků) stažený z Drive jako pracovní offline kopie pro analýzu. Není v gitu (přidat do `.gitignore`?). Ground truth zůstává Google Sheet.
- **Distribuce skóre** (n=206 vč. testů):
  - Workshop_id: cak 59, online 45, hluboka 30, salesforce 15, bioptic 14, vse 12, bratislava 12, workshop284 4 + ~15 šum (`test*`, `unknown`, `?w=cak`, `Masterclass`)
  - Kvadranty: casual_skeptic 62 (30 %), optimistic_power_user 57 (28 %), casual_enthusiast 47 (23 %), realistic_power_user 40 (19 %)
  - X avg 49.6, Y avg 51.0 — rebalance X-osy (Core 0.7 / Bonus 0.3) trefil střed mapy podle plánu
  - Demografie vyplněna v 98 % — i online publikum to skipuje minimálně
  - Verze: vše 0.1.0 (3 řádky bez verze, asi starší)

### Otevřené úkoly po této session

1. **Kalibrační analýza** — z 146 workshopových + 45 online datapointů odvodit:
   - jestli prahy kvadrantů (50/50) sedí, nebo je posunout (3-stavová klasifikace?)
   - kde leží 90. percentil Q5 — jestli cap 90 nedosahuje nikdo (= OK) nebo se trefuje strop (= roztříštit)
   - korelace mezi self-rating (Q6) a behaviorálním X — sanity check, že self-rating je opravdu šum
   - rozdíly online vs. workshop publikum (sebevýběr vs. firemní)
2. **Cleanup Sheet:** smazat / přefiltrovat šum (`?w=cak`, `unknown`, `test*`, `Masterclass`, `smoke-*`). Před mazáním se Miloš musí explicitně potvrdit.
3. **Sync `docs/design.md`** s aktuálním stavem otázek a scoringu.

---

## Historie: session 2026-05-13

**Stav po session:** X-osa formule přepracována na dvousložkový model (Core 0.7 / Bonus 0.3). Frontend committen, Apps Script redeploynut, `backfillScores()` spuštěn (cca 131 řádků přepsáno).

## Změny v session 2026-05-13

- **Analýza dat z CAK (n=60)** ukázala, že 53 % advokátů končilo v `beginner_skeptic` kvadrantu i přes denní používání AI. Strukturální problém: stará formule dávala 53 % váhy na šíři/pokročilost (Q3+Q5), takže denní uživatel ChatGPT bez agentů byl strukturálně pod X=50.
- **Nová X formule:** `X = 0.7 × (Q1+Q2+Q4)/130 + 0.3 × (Q3+Q5)/150` (procenta × 100, zaokrouhleno). Individuální váhy odpovědí beze změny.
- **Přejmenování archetypů:** `beginner_enthusiast` → `casual_enthusiast`, `beginner_skeptic` → `casual_skeptic`. Důvod: „beginner" evokoval čas, ne pokročilost. Power user kvadranty zachovány.
- **`backfillScores()`** v `apps-script/webhook.gs` — jednorázová funkce pro přepočet všech existujících řádků v Sheetu. Spustit ručně z Apps Script editoru po deployi.
- **Checkpoint:** git tag `v0.4-pre-x-rebalance` (commit `e544199`) pro případný rollback.

### Co musí Milos udělat ručně po pull:

1. Apps Script editor → vložit aktuální obsah `apps-script/webhook.gs` → Save
2. Deploy → Manage deployments → tužka → New version → Deploy (URL zůstává)
3. **Spustit funkci `backfillScores`** z editoru (vybrat z dropdownu „Select function" → Run). Vypíše do logu počet přepsaných řádků (čekáme cca 131).
4. Smoke test: jedna nová submission přes `kdojsem.inspiruj.se` → ověřit, že X sedí s lokálním přepočtem.

---

## Předchozí stav (do 2026-05-08)

---

## TL;DR

Dotazník je live a sbírá data online. Milos sbírá pár dní (od 2026-05-08), pak se na výstup spolu podíváme a podle reálného rozložení rekalibrujeme váhy.

**Co je hotové a otestované:**
- ✅ Frontend deploynutý (Netlify auto-deploy z `main`) na `kdojsem.inspiruj.se`
- ✅ Apps Script webhook redeploynutý s novou logikou (hard scoring + Claude píše interpretation + animal_note)
- ✅ Q11 demografie (volitelná) zapojená end-to-end, sloupce v Sheetu doplněny
- ✅ Online mód (`workshop_id = "online"` default), workshop mód přes `?w=` parametr funguje
- ✅ Result screen: kvadrant z deterministicky vypočítaného X/Y, mini-mapa zvětšena (žádný překryv popisek), 3-4 věty tvrdé interpretace + 3-4 věty poetické úvahy o zvířatech
- ✅ Q9 reformulováno na „Vývoj a používání AI bude třeba tvrdě regulovat a omezovat" (méně ambivalentní)

**Co následuje:**
1. Pár dní online sběru (Milos sdílí `kdojsem.inspiruj.se`)
2. Společná analýza dat — jestli scoring sedí, jak vypadá rozložení, jestli kvadranty mají zdravé počty
3. Případná rekalibrace vah a prahů
4. První ostrý workshop
5. (Volitelné) update `docs/design.md`, který je out-of-sync s aktuálními Q-zněními a metodikou

---

## Co se změnilo v sessions 2026-05-07/08

### Metodologický pivot — tvrdá vs. měkká data

Dohodnuto a implementováno: **zvířata už neovlivňují X/Y pozici ani neurčují archetype**. Kvadrant se odvozuje deterministicky z Q1–Q9. Claude dostává všech 10 odpovědí + finální skóre + kvadrant a píše:

- `interpretation` (3–4 věty, max 700 znaků): tvrdá analýza dotazníku s 1 konkrétním signálem (cituje nástroj/techniku/obavu) + 1–2 akční doporučení na míru.
- `animal_note` (3–4 věty, max 700 znaků): poetická úvaha nad vztahem obou zvířat. Žádné klasifikace. Cílem je překvapit a pobavit, ne soudit.

Drops: `animal_x_mod`, `animal_y_mod` (LLM nehýbe pozicí), LLM-derived archetype enum. Kolony v Sheetu zachovány kvůli kompatibilitě, vždy se zapisuje 0 / kvadrant.

**Důvod změny:** session 2026-05-07 detected disonanci u Senty — vysoké X/Y skóre (power-user kvadrant) ale LLM podle zvířat (Delfín + Chobotnice s důvodem „nevíme co to udělá") klasifikoval jako `beginner_skeptic`. To šlo na frontend jako label nadpisu, vznikla rozporná zpráva. Zvířata jsou „příliš slabá věda" pro klasifikaci.

### Q9 reformulace

- **Bylo:** „Používání AI čekají významná omezení a regulace, možná i zákazy — podobně jako třeba užívání drog."
- **Je:** „Vývoj a používání AI bude třeba tvrdě regulovat a omezovat."

Stará formulace byla ambivalentní (predikce vs. preference). Nová jasně měří preferenci pro regulaci = nedůvěru. Scoring zůstává: `(3 - q9) * 5`, souhlas (5) → -10 (pesimismus).

### Q11 — demografie (volitelná)

Nová obrazovka mezi Q10 a submitem. 4 kategorie (věk / vzdělání / obor / pohlaví), všechny s „Nechci uvést", celá obrazovka přeskočitelná. Pomáhá pro budoucí studii. Detail v CLAUDE.md.

### Online mód

- Landing page: krátký intro text o Inspiruj.se a metodice
- Workshop_id pole defaultuje na `online` (editovatelné, blur restoruje default)
- URL `?w=cez-2026-04-27` má prioritu — pole se ukáže jako fixed display (workshop_id locked from URL)
- Self-selection bias dokumentovaný v CLAUDE.md — online dataset slouží jen k validaci scoringu, ne ke kalibraci průměrů firemního publika

### UI

- Result mini-mapa: SIZE 360 → 440, popisky os („↑ optimismus", „← zkušenost") odstraněny, čtyři kvadrantní popisky stačí — žádný překryv.
- Result archetype label: derivuje se z X/Y kvadrantu, ne z LLM (`optimistic_power_user` / `realistic_power_user` / `beginner_enthusiast` / `beginner_skeptic`).

### Sheet schema

4 nové sloupce: `age`, `education`, `field`, `gender` — vloženy mezi `interpretation` a `user_agent`. Při manuálním přidání do existujícího sheetu se Milošovi sloupce posunuly o 1 pozici doleva (přepsaná hlavička místo insertu) — opraveno přejmenováním header rowy. Pro budoucí změny schema: vždy fyzicky **insert column** v Sheets, neměnit text existujících hlaviček.

---

## Architektura textových výstupů (po change)

```
Účastník vyplní dotazník
       ↓
Apps Script webhook
       ↓
scoreX(Q1–Q5)  →  X (0..100)         ← deterministicky
scoreY(Q6–Q9)  →  Y (0..100)         ← deterministicky
deriveQuadrant(X,Y) → archetype       ← deterministicky
       ↓
Claude API (sonnet-4-6, tools API)
  vstup: všech 10 odpovědí + X + Y + kvadrant
  výstup: interpretation (tvrdá) + animal_note (měkká)
       ↓
appendRow do Sheets
       ↓
response do frontendu → result screen
```

---

## Na co si dát pozor v další session

1. **Nemiš tvrdá a měkká data.** Zvířata nesmí ovlivňovat klasifikaci/pozici. Pokud by někdy uživatel navrhl „nech LLM korigovat skóre podle zvířat" — to je krok zpět, prošli jsme tím a explicitně jsme to opustili.
2. **Apps Script vyžaduje manuální redeploy.** Vždy po změně `webhook.gs` napiš Milošovi explicitní postup. Frontend Netlify auto-deployne sám.
3. **Sheet schema změny:** insert column, ne přepisování hlavičky. Doplnění sloupce do existujícího sheetu Apps Script sám neudělá.
4. **Online dataset má self-selection bias.** Kalibraci vah dělej vždy filtrované podle workshop_id, nemíchej online a workshop publikum.
5. **Tabulkový sloupec `archetype`** obsahuje deterministický kvadrant, ne LLM výstup. Sloupce `animal_x_mod` / `animal_y_mod` jsou vždy 0 (legacy).
6. **`docs/design.md`** je out-of-sync. Ground truth pro otázky a scoring je `src/questions.js` + `apps-script/webhook.gs`. Pokud někdo bude chtít updatnout design dokument, je to čistý task.
7. **Před každou destruktivní akcí na Sheetu se ptej.** Milos má v sheetu jediný zdroj kalibračních dat.

---

## Klíčové URL

- **Dotazník (online):** `https://kdojsem.inspiruj.se`
- **Dotazník (workshop):** `https://kdojsem.inspiruj.se/?w=<workshop_id>`
- **Admin start:** `https://kdojsem.inspiruj.se/start.html`
- **Dashboard (online):** `https://kdojsem.inspiruj.se/dashboard.html?w=online`
- **Dashboard (workshop):** `https://kdojsem.inspiruj.se/dashboard.html?w=<workshop_id>`
- **GitHub:** `github.com/miloscermak/evalai` (private)
- **Apps Script:** `script.google.com` → projekt EvalAI
- **Google Sheet:** ID v `apps-script/webhook.gs` jako `SPREADSHEET_ID`

---

## Otevřené otázky pro další session

1. **Po prvních ~50 online datapointech:** mrknout na rozložení — zda kvadranty mají zhruba vyvážené populace nebo jeden je extrémně přeplněný (případná rekalibrace prahů z 50/50 na něco jiného).
2. **X_max a váhy v `scoreX`:** současný cap 280 (Q1=40 + Q2=50 + Q3=60 + Q4=40 + Q5=90) je teoretický strop. Reálná data ukážou, kde leží 90. percentil — možná snížit X_max, aby tečky neseděly v pravé části zbytečně řídce.
3. **Q5 cap 90:** pětice agentů + automation + vibecoding + chatbot_max + long_prompt = 90. Pokud se ukáže, že to dosahuje málokdo, cap je OK. Pokud naopak hodně lidí trefuje strop, případně rozdělit na více úrovní.
4. **Animal note délka:** 700 znaků = ~3-4 věty. Pokud bude zpětná vazba, že je to moc / málo, doladit max_length v tool schema.
5. **Workshop dashboard CTA:** při zobrazení v projektoru bývá užitečné mít hover/tooltip s archetypem + animal note. Aktuálně dashboard ukazuje jen tečku + hover s jménem. Posílit?
