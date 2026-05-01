# EvalAI — Předávací zpráva

**Aktualizace:** 2026-04-29 (z Cowork session)
**Předává:** Claude (Cowork) → Claude Code
**Stav:** v0.3 — kompletní rework Q3/Q5/Q6/Q7/Q9 + UX fix po submitu. Změny zatím **nejsou pushnuté ani redeploynuté.**

---

## ⚠️ POZOR — co Claude Code MUSÍ udělat hned

Tato session udělala změny v `apps-script/webhook.gs` (scoring formule pro X/Y) a v `src/questions.js` (nové texty otázek a values). Backend a frontend musí jít synchronně, jinak nový frontend pošle hodnoty, které starý webhook neumí ohodnotit.

**Konkrétně:**

1. **Push do GitHubu** — `git push origin main`. Tím se Netlify auto-deployne nový frontend.
2. **Manual redeploy Apps Scriptu** — toto Netlify NEUDĚLÁ:
   - Otevři https://script.google.com → projekt EvalAI
   - Otevři `webhook.gs` v editoru, zkopíruj sem celý obsah z `apps-script/webhook.gs` v repu (nebo jen sekce, co se změnily — `scoreX` a `scoreY`)
   - Cmd-S (uložit)
   - **Deploy → Manage deployments → existing deployment → Edit (tužka) → Version: New version → Deploy**
   - URL ZŮSTÁVÁ STEJNÁ. Žádné `config.js` se nemění.
3. **Smoke test** — vyplň jeden dotazník na dev workshop_id (`smoke-2026-04-29`) a zkontroluj Sheet, že nový řádek má smysluplné X/Y a všechny answer values jsou rozeznané (žádné NaN ani 0 v `score_x_raw` u člověka, který reálně něco používá).

Pokud Apps Script redeploy zapomeneš → frontend pošle `q3: ['other']` a starý webhook to nezná → score_x bude nižší než má být. (V `webhook.gs` jsou legacy aliasy pro staré values, ale ne pro nové.)

---

## TL;DR

EvalAI je webový dotazník (10 otázek, ~3 min) pro workshopy Inspiruj.se. Mapuje účastníky na 2D plochu **zkušenost × postoj k AI**. Po vyplnění **každý účastník vidí svůj výsledek** (mini-mapa s tečkou + archetype + 2-3 věty interpretace od Claude), Milos paralelně sleduje **dashboard se všemi tečkami** workshopu a po skončení může data **stáhnout jako JSON nebo MD**.

**Co je živé a otestované:**
- ✅ Frontend deploynutý na Netlify (auto-deploy z `main`)
- ✅ Apps Script webhook s Claude tools API pro animal scoring + interpretaci
- ✅ Per-user result screen po submitu (mini-mapa + Claudova interpretace v ČJ)
- ✅ Admin `/start` page pro spouštění workshopů (QR kód + live counter)
- ✅ Dashboard s live daty, kvadranty, export do JSON / MD
- ✅ Smoke test (Miloš jako účastník) — submit → Sheet → result screen → dashboard → export

**Co zbývá:**
1. Push + Apps Script redeploy + smoke test (viz POZOR sekce výš)
2. Vlastní subdoména (např. `dotaznik.inspiruj.se`) místo default Netlify URL
3. První ostrý workshop a re-kalibrace vah z reálných dat
4. (Volitelné) Update `docs/design.md` — Q3, Q5, Q6, Q7, Q9 jsou aktuálně mimo synchronizaci s `src/questions.js` a `apps-script/webhook.gs` (které jsou ground truth)

---

## Cowork session 2026-04-29 — co se změnilo

Milos po tom, co testoval flow v UI, navrhl 5 úprav otázek a 1 UX fix. Implementováno v jednom commitu `feat: rework Q3/Q5/Q6/Q7/Q9 + computing screen po submitu`:

**Q3 (nástroje):**
- `internal` (label „Vlastní AI nástroj v práci") → `other` (label „Jiný AI nástroj"), pozice posunutá hned za Microsoft Copilot — chatboti drží pohromadě
- Scoring: 8 b za `other`, plus zachovaný legacy alias `internal: 8` pro stará data v Sheet

**Q5 (pokročilé techniky) — kompletní rework:**
| Hodnota | Label | Body |
|---|---|---|
| `long_prompt` | Píšu prompty, často komplexní a promyšlené | 10 |
| `chatbot_max` | Používám chatbot na maximum (projekty, deep research, plánované úkoly) | 15 |
| `vibecoding` | Píšu vlastní aplikace (vibecoding) | 20 |
| `automation` | Vytvářím automatizace s využitím různých nástrojů | 20 |
| `agent` | Buduju asistenta nebo agenta, na kterého deleguju úkoly | 25 |
| `none` | Nic z toho | 0 |
- Cap zvednutý z 75 na 90 (sum všech 5 = 90)
- Legacy aliasy `custom_gpt: 15`, `own_data: 15`, `api: 20` zachovány v Q5_ACTS pro stará data
- **X_max nyní 280** (bylo 265) → normalizace v `scoreX` aktualizovaná: `Math.round(sum / 280 * 100)`

**Q6 (PROHOZENO + nová formulace):**
- Bylo: „Jak vidíš AI z pohledu příštích 5 let?" (1=ohrožení, 5=příležitost), váha (v-3)*10
- Je: „AI bude do pěti let ve většině sofistikovaných dovedností stejně dobrá jako lidi." (zcela nesouhlasím → zcela souhlasím), **váha (v-3)*5 → ±10**
- Logika: tahle otázka NENÍ čistě o postoji (souhlas může mít optimista i pesimista), proto slabší vážení

**Q7 (PROHOZENO + nová formulace):**
- Bylo: „Když se zeptám AI na něco ze svého oboru, jak kvalitní bývá odpověď?" (1=špatná, 5=dobrá), váha (v-3)*7
- Je: „AI během příštích pěti let změní svět i můj život k lepšímu." (zcela nesouhlasím → zcela souhlasím), **váha (v-3)*10 → ±20**
- Tohle je teď nejsilnější optimismus signál v dotazníku

**Q9 (nová formulace + OBRÁCENÝ scoring):**
- Bylo: „Mám pocit, že AI zvládnu osvojit a smysluplně využít." (self-efficacy, vyšší = optimismus), váha (v-3)*5
- Je: „Používání AI čekají významná omezení a regulace, možná i zákazy — podobně jako třeba užívání drog." (zcela nesouhlasím → zcela souhlasím), **váha (3-v)*5 → ±10**
- **Pozor:** vyšší souhlas = obava → pesimismus, proto OBRÁCENÝ směr `(3-v)*5` místo `(v-3)*5`. Klauzule self-efficacy ze scoringu úplně vypadla.

**UX fix — computing screen po submitu:**
- Před: po kliknutí „Odeslat" zůstal dotazník na obrazovce s tlačítkem „Odesílám…", lidé to nechápali a klikali znovu
- Teď: state má nový flag `computing`. Po kliknutí Odeslat → currentIndex skočí rovnou na thanks screen, dotazník zmizí. Render zobrazí pulzující tři tečky + „Děkujeme za vyplnění. Teď se počítá tvůj výsledek…"
- Když fetch doběhne → `computing=false`, render přejde buď na result screen (s mapou a interpretací), nebo na fallback „Hotovo, díky" + CTA na dashboard

**Validace na 6 lidech z přepisů (`scoring-test.mjs`):** všichni padli do správných kvadrantů. Senta X=79/Y=+27 (top-right), Tomáš X=100/Y=+9 (top-right, mírně níž kvůli concerns), Pavel X=68/Y=−19 (real. power user), Lukáš X=16/Y=+20 (begin. enthusiast), Saša X=0/Y=−41 (begin. skeptic), Andrea X=0/Y=−44 (begin. skeptic).

---

## 🔗 Živé URL

| Co | URL |
|---|---|
| Repo | https://github.com/miloscermak/evalai |
| Netlify deploy | https://famous-torte-f2e74a.netlify.app |
| Admin (spustit workshop) | https://famous-torte-f2e74a.netlify.app/start |
| Dotazník | https://famous-torte-f2e74a.netlify.app/?w=`<workshop_id>` |
| Dashboard | https://famous-torte-f2e74a.netlify.app/dashboard?w=`<workshop_id>` |
| Apps Script web app | https://script.google.com/macros/s/AKfycbxdnG9EIWRwf8mPPAXZPxmb6IQU_O2spp0wQyPQwfS8ae0KQPUC3qX38ARiHer8sBSGHw/exec |
| Google Sheet ID | `17ykmmC2LHVc871aoGU0vFEUygzl-vF1Jn1ISamaV8JI` |

Anthropic API klíč je v Apps Script Properties (`ANTHROPIC_API_KEY`), Claude model je `claude-sonnet-4-6`.

---

## Co se v této session reálně udělalo (chronologicky)

Pro orientaci v `git log` — každý bullet je 1 commit:

1. **`d5806b8` config: set spreadsheet ID and bump Claude model to sonnet-4-6** — propojení Sheetu s Apps Scriptem, upgrade z `sonnet-4-5-20250929` na aktuální alias.
2. **`06f4e9e` config: wire up Apps Script webhook URL** — `src/config.js` dostal `webhookUrl` a `dashboardJsonUrl` (stejná URL pro POST i GET, Apps Script si to rozliší).
3. **`799dc00` fix: use Claude tools API for structured animal scoring** — Claude původně vracel JSON v textu, který selhával na escape. Přepsáno na **structured tool calling** (`tool_choice: { type: 'tool', name: 'record_animal_score' }`). Robustní, JSON není potřeba parsovat regexem.
4. **`11921f1` fix: swap dashboard quadrants and add map CTA after submit** — top-left a bottom-right kvadranty byly prohozené vůči významu os. Top-left je teď „Začátečník-nadšenec" (low X, high Y), bottom-right je „Realistický power user" (high X, low Y). Barvy backgroundů swapnuté konzistentně.
5. **`8fa9ef1` chore: ignore `.claude/` worktrees** — odstranil omylem zacommitnutý submodule.
6. **`1c6dda9` feat: per-user result screen with Claude interpretation** — největší změna session:
   - Frontend submit přepnut z `mode: 'no-cors'` na `mode: 'cors'` (s `text/plain` content-typem, aby nebyl preflight). Teď čteme odpověď.
   - Apps Script tool schema rozšířeno o pole `interpretation` (max 400 znaků, oslovuje účastníka „ty", konkrétní postřeh z přirovnání).
   - Místo prosté „Hotovo, díky" obrazovky se zobrazí **result screen**: mini-mapa s jednou tečkou, archetype label v ČJ, interpretace, animal pár + note, CTA na dashboard.
   - Sheet má nový sloupec `interpretation`.
7. **`3847e9f` feat: rework Q7 to scale, make Q10 reasons optional, auto-advance, hotfix result render** — UX iterace po reálném testu:
   - **Q7 redesign:** dříve kategorie (trust/skim/verify/rewrite/disappoint), teď scale 1-5 „Jak kvalitní bývá odpověď AI v tvém oboru?" (Často špatná → Většinou dobrá). Scoring `(v-3)*7 → -14..+14`.
   - **Q5 první možnost** přejmenovaná z „Napsal/a jsem prompt přes 100 slov" na „Píšu prompty, často komplexní a promyšlené".
   - **Q10 důvody volitelné** — povinná jsou jen samotná zvířata. Prompt pro Claude ošetřuje chybějící důvod.
   - **Auto-advance:** po kliknutí na single/scale odpověď se po 320 ms posune na další otázku (vidíš svůj klik, ale nemusíš mačkat „Pokračovat"). Multi a animal zůstávají manuální.
   - **Hotfix:** result screen se vykreslí jen když server vrátil kompletní data (archetype + score_x). Jinak fallback „Hotovo, díky" s tlačítkem na dashboard. Předtím ukazoval rozbitou mapu s tečkou v (0,0) když Apps Script ještě běžel ve staré verzi.
8. **`ebad820` feat: admin /start page** — `src/start.html` + `src/start.js` + `src/start.css`. Milos zadá ID workshopu, dostane QR kód (knihovna `qrcode-generator` z CDN, ~4 KB), URL pro účastníky s tlačítkem Kopírovat, link na dashboard a live counter (poll po 5 s). Poslední session uložena v `localStorage`.
9. **`ecbf741` feat: dashboard export to JSON and MD** — dvě tlačítka v hlavičce dashboardu:
   - **JSON** — kompletní payload (`workshop_id`, `exported_at`, `count`, `points[]`).
   - **MD** — workshop debrief: hlavička, počty per archetype, počty per kvadrant, sekce ⚑ Outliers, per-účastník blok (jméno, archetype, X/Y, animal pár, interpretace, animal note), seřazené sestupně podle X+Y.
   - Apps Script `doGet` rozšířen o `animal_note` a `interpretation` v odpovědi.

---

## Současná architektura — file map

```
evalai/
├── CLAUDE.md              # dlouhodobý kontext pro AI agenta
├── README.md              # uživatelský setup guide
├── HANDOFF.md             # ← TENHLE SOUBOR
├── netlify.toml           # publish=src + redirecty /dashboard, /start
├── scoring-test.mjs       # validuje X/Y formule na 6 lidech z přepisů
├── docs/
│   └── design.md          # design dotazníku, codebook, scoring (Q7 už nesedí, viz níže)
├── data/
│   └── transcripts/       # kalibrační přepisy (gitignored)
├── apps-script/
│   └── webhook.gs         # backend: doPost + doGet + scoreX/Y/Animal
└── src/                   # frontend (deploy na Netlify)
    ├── index.html         # dotazník
    ├── dashboard.html     # live mapa
    ├── start.html         # admin landing (QR + counter)
    ├── style.css          # base styly + result screen
    ├── dashboard.css      # styly dashboardu + export tlačítka
    ├── start.css          # styly admin stránky
    ├── config.js          # webhookUrl + dashboardJsonUrl (musí se editovat při deployi)
    ├── questions.js       # 10 otázek jako data
    ├── app.js             # logika dotazníku + result screen
    ├── dashboard.js       # SVG render + export JSON/MD
    └── start.js           # admin workflow + QR + counter polling
```

Důležité specifické věci:

- **`apps-script/webhook.gs`** je single source of truth pro backend. Konstanty nahoře jsou nastavené (Sheet ID, model). Po editaci je nutné **kód znovu nahrát do editoru Apps Scriptu, uložit a Deploy → Manage deployments → New version** — viz „Apps Script gotchas" níž.
- **`src/config.js`** drží produkční URL webhooku. Pokud bude potřeba rotovat Apps Script deployment URL, je to jediné místo, kde se to musí změnit.
- **Aktuální stav otázek `docs/design.md` × `src/questions.js` mírně diverguje:** Q7 byla v session přepracována ze 5 kategorií na scale 1-5. Pokud někdy budeš chtít re-kalibrovat váhy, design.md je třeba aktualizovat — ale není to kritické, protože `src/questions.js` a `apps-script/webhook.gs` jsou ground truth.

---

## Workshop flow — jak to celé vypadá

### Pro Miloše (před začátkem)
1. Otevři `https://famous-torte-f2e74a.netlify.app/start`
2. Zadej ID workshopu, např. `cez-2026-04-28` → **Spustit session**
3. Promítni QR kód na plátno (nebo nasdílej URL, kterou tlačítko zkopíruje do clipboardu)
4. V druhém okně si otevři **„Otevřít dashboard →"** — tady budeš sledovat live tečky

### Pro účastníky
1. Skenují QR (mobil) nebo otevřou URL
2. Vyplní 10 otázek — auto-advance u single/scale, manuál u multi a animal Q10. Důvody u zvířat jsou volitelné.
3. Po kliknutí „Odeslat" Claude volá tools API → vrátí archetype + animal modifikátory + interpretaci.
4. Účastník vidí **result screen**: mini-mapu s vlastní tečkou, archetype, interpretaci, animal note, tlačítko na společný dashboard.

### Pro Miloše (po skončení)
1. Klikni **JSON** nebo **MD** v hlavičce dashboardu → soubor se stáhne lokálně.
2. MD je dobrý vstup pro debrief / blogpost / interní zápis. JSON pro re-analýzu.

---

## ⚠️ Apps Script gotchas — důležité

Tohle je nejčastější zdroj zmatku. Apps Script má **dva oddělené módy**:

1. **Editor mode** (testSubmission, ručně spuštěné funkce) — používá živý kód, jaký je v editoru. Stačí `Cmd+S`.
2. **Web app deployment** (volání z Netlify frontendu) — používá kód z **toho commit-snapshotu, který byl deployed**. Editace v editoru ho NEAKTUALIZUJE.

**Kdy je nutný redeploy** (Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy):
- Když měníš `apps-script/webhook.gs`
- A frontend (Netlify) bude volat tu funkci

**Postup:**
1. Otevři https://script.google.com → tvůj projekt
2. Otevři `Code.gs`, smaž obsah, vlož nový kód z https://raw.githubusercontent.com/miloscermak/evalai/main/apps-script/webhook.gs
3. **Cmd+S** (uloží se a editor mode používá nový kód)
4. **Deploy → Manage deployments → ✏️ na existujícím „evalai webhook v1" → Version: New version → Deploy**
5. URL zůstává stejná, není potřeba měnit `src/config.js`

**Symptom „Apps Script není redeployed":** po submitu vidíš na stránce „Hotovo, díky" místo result screenu (fallback se trigguje, protože server vrátil neúplnou odpověď ze starého kódu).

---

## Scoring — aktuální stav

### X (zkušenost), 0-100 — beze změny
```
Q1 (doba):       0 / 10 / 25 / 40
Q2 (frekvence):  0 / 10 / 20 / 35 / 50
Q3 (nástroje):   5b běžné, 10b speciální (notebooklm, image, audio, video, internal=8), max 60
Q4 (placení):    0 / 20 / 40
Q5 (pokročilé):  long_prompt 10, custom_gpt 15, own_data 15, automation 20, api 15, max 75

X = round(sum / 265 * 100)
```

### Y (postoj), -50..+50 — Q7 přepracovaná
```
Q6 (5 let):              (v - 3) * 10  →  -20..+20
Q7 (kvalita v oboru):    (v - 3) * 7   →  -14..+14   ← NEW (scale místo kategorií)
Q8 (obavy):              -3 za každou negativní (max 3), "none" = +5
Q9 (self-efficacy):      (v - 3) * 5   →  -10..+10

Y = clamp(sum, -50, 50)
Y_norm (pro mapu) = Y + 50  →  0..100
```

### Animal modifikátor (z Claude přes tool API)
```
animal_x_mod: -5..+5
animal_y_mod: -10..+10
archetype: 1 ze 7 (optimistic_power_user, realistic_power_user, pragmatic_user,
                    beginner_enthusiast, beginner_skeptic, manager_proxy, unclear)
note: česká věta (max 200) o důvodu
interpretation: 2-3 věty v ČJ pro účastníka, oslovuje „ty" (max 400)

x_final = clamp(x + animal_x_mod, 0, 100)
y_final = clamp(y_norm + animal_y_mod, 0, 100)
outlier = abs(animal_y_mod) >= 8
```

`scoring-test.mjs` byl aktualizován pro Q7-jako-scale a stále trefuje očekávané kvadranty u všech 6 lidí z přepisů.

---

## Co zbývá udělat

### Před prvním ostrým workshopem
1. **Doména (volitelné).** Default `famous-torte-f2e74a.netlify.app` je funkční, ale ošklivá. Až bude jasné, jak Milos chce subdoménu, v Netlify Domain management se přidá CNAME a Netlify si vyřídí SSL.
2. **Smaz testovací řádky ze Sheetu** (před prvním ostrým workshopem). V `submissions` tabu by mělo zůstat jen header row.

### Po prvním ostrém workshopu
1. **Re-kalibrace vah.** Otevři Sheet, podívej se na X / Y rozložení. Pokud všichni v jednom kvadrantu nebo se body shlukují u krajů, uprav konstanty v `apps-script/webhook.gs` (`scoreX`, `scoreY`). Re-deploy.
2. **Outlier threshold.** `Math.abs(animal.y_mod) >= 8` je odhad. Cíl je 5-15 % účastníků s vlaječkou. Pokud moc/málo, uprav v `processSubmission`.
3. **Update `docs/design.md`** s reálnou Q7 formulí a případnými novými váhami.

### Drobné nápady, které by se mohly hodit (z hlavy, NE zarezervované)
- **Sloučit start admin do dashboardu** — místo dvou stránek jedna. Teď to ale funguje, není urgentní.
- **Re-scoring tlačítko v dashboardu** — kdyby se měnily váhy a chtěli jsme staré odpovědi přepočítat. Vyžaduje batch funkci v Apps Scriptu.
- **Heslo pro dashboard** (workshop_id je obfuskace, ne autentizace). Zatím ne nutné.
- **Animal note v tooltip dashboardu** — teď ukazuje jen animal_self/ai bez interpretace. Mohlo by se rozšířit.

---

## Známá rizika a věci k pozorování

⚠️ **Apps Script kvóty.** UrlFetchApp 20 000 volání/den, web app 6 minut na execution. Pro běžný workshop (~50 lidí) zcela dostatečné. Pro velkou firmu (1000+) by to mohlo škrtit.

⚠️ **Claude model alias.** `claude-sonnet-4-6` je alias na nejnovější Sonnet. Pokud Anthropic alias zruší nebo změní pricing, je v jedné konstantě v `webhook.gs`. Snadná oprava.

⚠️ **CORS na Apps Script.** Aktuálně funguje, protože používáme `Content-Type: text/plain` (simple CORS request, žádný preflight). Kdyby se to někdy přehodilo na `application/json`, prohlížeč pošle preflight OPTIONS a Apps Script ho neumí — submission selže. Nedělej tu změnu.

⚠️ **Veřejnost dashboardu.** Apps Script web app je deployed jako **Anyone** (bez Google účtu). Workshop_id je bezpečnostně jen obfuskace. Pokud někdo URL prozradí, kdokoliv může číst. Pro citlivé klienty doplníme query secret.

⚠️ **localStorage v `/start`.** Když Milos zavře tab, nic se neztratí (workshop běží v Sheetu). Když zavřeš tab a obnovíš na jiném zařízení, neuvidíš dříve nastavené ID. Workshop_id si Milos musí pamatovat sám.

⚠️ **`docs/design.md` je výrazně za reálným kódem.** Q7 popsaná tam jako kategorická, ale v kódu je to scale. Pokud někdo otevře design.md jako pravdu, dostane out-of-date info. Aktualizovat při dalším milníku.

---

## Pro Claude Code v dalším sezení

Když se vrátíš:

1. **Přečti tenhle HANDOFF.md.**
2. Pak `CLAUDE.md` pro dlouhodobé instrukce a Milošovy preference.
3. `git log --oneline | head -20` — co se mezitím dělo.
4. Pokud se má pokračovat bezprostředně: zeptej se Miloše, jestli proběhl ostrý workshop a chce re-kalibrovat váhy, nebo má jiný cíl.
5. **Před netriviální akcí** (změna scoringu, mazání ze Sheetu, úprava deployment URL, force push): zeptej se. Milošova preference je „radši double-check než opravovat".

---

## Reference

- **Repo:** https://github.com/miloscermak/evalai
- **Lokální:** `/Users/miloscermak/cowork/evalai`
- **Design:** [`docs/design.md`](docs/design.md) (částečně out-of-date kvůli Q7)
- **Persistent kontext:** [`CLAUDE.md`](CLAUDE.md)
- **Setup guide:** [`README.md`](README.md)

---

**Stav: workshop-ready.** Frontend i backend živé, smoke test prošel, export funguje. Zbývá jen ostrý test. — Claude Code (2026-04-28)
