# EvalAI – AI Attitude Mapper

Webový dotazník (10 otázek + nepovinná demografie) pro workshopy, přednášky a online sběr Inspiruj.se. Mapuje účastníky na 2D plochu: **zkušenost s AI × postoj k AI**. Animal metafora (sebe + AI + důvod) slouží jako kvalitativní barva, **NE** jako klasifikační vstup — viz „Metodologické principy" níž.

Use case: na začátku workshopu Milos zobrazí QR kód, účastníci vyplní telefonem (~3 min), Milos pak živě promítne scatter plot a komentuje skupinu. Sekundárně: online sběr přes `kdojsem.inspiruj.se` pro budoucí studii a kalibraci vah.

---

## Aktuální stav

Fáze: **v0.5 — proběhlo 6+ ostrých workshopů, ~205 datapointů v databázi (2026-04-27 → 2026-05-22).** Workshop flow funguje, máme dost dat na kalibraci vah.

- [x] Frontend dotazníku (10 otázek + Q11 nepovinná demografie + auto-advance + result screen)
- [x] Apps Script backend (zápis do Google Sheets + Claude tools API)
- [x] Hard scoring (Q1–Q9) deterministický, animal vrstva nezasahuje do X/Y
- [x] LLM píše dvě textové pasáže: tvrdá interpretace (Q1–Q9 + akční doporučení) + měkká úvaha o zvířatech
- [x] Live dashboard (SVG scatter plot, kvadranty, auto-refresh 10 s, JSON/MD export)
- [x] Admin `/start` page s QR kódem a live counterem
- [x] Online mód: `workshop_id = "online"` default pro web visitors, oddělený od workshop datasetů
- [x] Volitelná demografie: věk, vzdělání, obor, pohlaví (+ „Nechci uvést" + Skip celé obrazovky)
- [x] Deploy: Netlify auto-deploy z `main` → `kdojsem.inspiruj.se` (default URL `famous-torte-f2e74a.netlify.app` zůstává)
- [x] **Ostré workshopy proběhly:** cak (59), hluboka (30), salesforce (15), bioptic (14), vse (12), bratislava (12), workshop284 (4) + online (45). Demografie vyplněna v 98 %.
- [ ] Kalibrace vah z reálných dat (prahy kvadrantů, váhy Q5/Q6/Q7, X_max) — data jsou, čeká se na analýzu. Prvotní pohled: X avg 49.6, Y avg 51.0 → střed mapy sedí, rebalance X-osy z 2026-05-13 funguje. Kvadranty zhruba vyrovnané (62/57/47/40).
- [ ] Aktualizace `docs/design.md` — z poslední session (Q3/Q5/Q6/Q7/Q9 nová znění + odstraněné LLM modifikátory) je out-of-sync; ground truth je `src/questions.js` + `apps-script/webhook.gs`
- [ ] Drobný cleanup v Sheetu: 1× `?w=cak` (řetězec se vplazil do workshop_id), 5× `unknown`, několik `test*` řádků — pro analýzu filtrovat ven.

---

## Stack

- **Frontend:** vanilla HTML + JS (single-page form), bez frameworku, bez build stepu. Mobile-first, čeština.
- **Hosting:** Netlify, build z GitHub repa, auto-deploy z `main`. Produkční URL: `https://kdojsem.inspiruj.se`.
- **Backend:** Google Apps Script jako webhook → zápis do Google Sheets na Milošově osobním Google účtu. Schema sheetu fixní (viz `SHEET_HEADERS` v `webhook.gs`); přidání sloupců do existujícího sheetu vyžaduje **manuální** zásah do header rowy.
- **LLM:** Claude API (`claude-sonnet-4-6`). Volá se z Apps Script po submitu. Vstup: **všech 10 odpovědí + finální X/Y + kvadrant**. Výstup přes tools API: `interpretation` (3–4 věty tvrdé analýzy + akční doporučení) + `animal_note` (3–4 věty poetické úvahy nad oběma zvířaty). LLM nedělá klasifikaci, nehýbe pozicí.
- **Dashboard:** druhá HTML stránka, čte z Sheets přes Apps Script doGet. Filter `?w=<workshop_id>`. Auto-refresh 10 s.

---

## Struktura repa

```
evalai/
├── CLAUDE.md          # tento soubor – kontext pro Claude
├── HANDOFF.md         # detailní deniční záznam mezi sessions
├── README.md
├── netlify.toml
├── docs/
│   └── design.md      # design dokument (částečně out-of-sync, viz „Aktuální stav")
├── src/               # frontend
│   ├── index.html     # dotazník
│   ├── app.js         # state machine, render, submit
│   ├── questions.js   # definice 10 otázek + q11 demografie
│   ├── style.css
│   ├── dashboard.html # live scatter plot
│   ├── dashboard.js
│   ├── dashboard.css
│   ├── start.html     # admin /start page
│   ├── start.js
│   ├── start.css
│   └── config.js      # webhook URL + dashboard JSON URL
├── apps-script/
│   └── webhook.gs     # zdrojový kód, ručně se kopíruje do Apps Script editoru
└── scoring-test.mjs   # lokální sanity check scoring formulí
```

---

## Workflow

### Development
- Frontend: editovat `src/*`, otevírat lokálně v prohlížeči, žádný build.
- Apps Script: lokálně v `apps-script/webhook.gs` jako referenční zdroj, deploy ručně přes Apps Script editor.
- Před commitem: smoke test (vyplnit dotazník end-to-end, ověřit zápis do Sheetů).

### Deploy
- **Frontend:** push do `main` → Netlify auto-deploy.
- **Apps Script:** **manuální redeploy** vždy, když se mění `webhook.gs`. Postup:
  1. script.google.com → projekt EvalAI → soubor `webhook.gs`
  2. Cmd-A → vložit obsah z `apps-script/webhook.gs` → Cmd-S
  3. Deploy → Manage deployments → tužka u existujícího deployment → Version: New version → Deploy
  4. URL deploymentu **zůstává stejná** (žádné změny v `src/config.js`)
- **Sheet schema:** přidání nového sloupce do existujícího sheetu Apps Script **neudělá sám** — je nutné v Google Sheets ručně doplnit hlavičku do prvního řádku na správnou pozici (insert column + nový label).

### Workshop flow
1. Milos otevře `kdojsem.inspiruj.se/start.html` → zadá workshop_id (např. `cez-2026-04-27`)
2. Zobrazí QR → účastníci vyplní telefonem (~3 min)
3. Milos přepne na `kdojsem.inspiruj.se/dashboard.html?w=cez-2026-04-27`
4. Body naskakují v reálném čase, hover ukáže jméno + zvíře
5. Po skončení: export JSON / MD z dashboardu

### Online flow
- Visitor přijde na `kdojsem.inspiruj.se` (bez `?w=` parametru) → workshop_id se defaultuje na `online`.
- Dashboard pro online dataset: `kdojsem.inspiruj.se/dashboard.html?w=online`.

---

## Metodologické principy

**Tvrdá data ≠ měkká vrstva.** Toto je centrální princip projektu, dohodnutý 2026-05-07.

| | Vstup | Zpracování | Výstup |
|---|---|---|---|
| **Tvrdá data** | Q1–Q9 | Deterministický scoring (vážené součty + clamp) | X (0–100), Y (0–100), kvadrant |
| **Měkká data** | Q10 zvířata | Claude — pouze čte, neklasifikuje | Poetická úvaha (animal_note) |
| **Slovní hodnocení** | Všech 10 + finální X/Y + kvadrant | Claude píše | interpretation s doporučením |

Zvířata se **podílí jen na textu**, ne na pozici. Žádné LLM modifikátory X/Y. Kvadrant na výsledné mapě se odvozuje **deterministicky** z X/Y, ne z LLM výstupu. Důvod: LLM klasifikace ze samotných dvou zvířat je „příliš na vodě" a generovala disonance (vysoké skóre + skeptická zvířata → tečka v power-user kvadrantu, ale label řekl beginner_skeptic).

### Další principy

- **Self-rating se ignoruje.** Skóre experience (X) je čistě behaviorální (frekvence, počet nástrojů, placené licence, pokročilé techniky).
- **Anonymita.** Žádné PII kromě křestního jména. Demografie je kategorická a nepovinná, nedeanonymizuje.
- **Mobile-first.** ~95 % vyplňování z telefonu po QR. Desktop sekundární.
- **3 minuty max.** Když to trvá déle, dropoff. Demografie přidává ~30–45 s, ale je skipovatelná.
- **Online dataset (`workshop_id = "online"`) ≠ workshop dataset.** Web vyplňuje self-selected publikum (Milošovi čtenáři, tech-savvy) — slouží k validaci scoringu, ne ke kalibraci průměrů firemního publika. Při kalibraci vah filtrovat podle workshop_id, ne mixovat.
- **Mid-X skeptici ≠ Low-X bojící se.** Archetyp „realistický power user" musí být v dashboardu rozpoznatelný od archetypu „začátečník-skeptik" (kvadranty to dělají automaticky díky 4-stavové klasifikaci).

---

## Q11 — demografie (volitelná)

Přidaná 2026-05-07 jako separátní obrazovka mezi Q10 a submitem. Nepočítá se do scoringu, slouží pro budoucí studii a sub-grupovou analýzu.

| Pole | Hodnoty |
|---|---|
| `age` | under_25 / 26_35 / 36_45 / 46_55 / 56_65 / over_65 / na |
| `education` | zs / ss_no_matur / ss_matur / vs / na (jedna kategorie VŠ — v ČR málo bakalářů, nemá smysl rozdělovat) |
| `field` | it / marketing / finance / science / health / creative / industry / public / business / student / retired / other / na |
| `gender` | female / male / other / na |

Skip button na obrazovce přeskočí vyplnění úplně (q11 nezůstane v `state.answers`). Každé pole má i položku „Nechci uvést" (`na`) — odlišení od neotevřené obrazovky je v Sheetu užitečné.

---

## Sheet schema

Pořadí sloupců (pevné, viz `SHEET_HEADERS` v `webhook.gs`):

```
A submission_id          L animal_note
B timestamp              M score_x_final
C workshop_id            N score_y_final
D name                   O outlier_flag      (vždy false v současném schema)
E duration_sec           P interpretation
F answers_json           Q age
G score_x_raw            R education
H score_y_raw            S field
I archetype              T gender
J animal_x_mod   (= 0)   U user_agent
K animal_y_mod   (= 0)   V version
```

Pole `archetype` je nyní deterministický kvadrant (`optimistic_power_user` / `realistic_power_user` / `casual_enthusiast` / `casual_skeptic`), ne LLM výstup. `animal_x_mod` a `animal_y_mod` zůstávají v schemu jen kvůli kompatibilitě se starými řádky a vždy se zapisuje 0.

**Pozn. k pojmenování (2026-05-13):** dříve `beginner_enthusiast` / `beginner_skeptic`. Přejmenováno na `casual_*`, protože „beginner" evokuje délku používání, ale levá polovina X-osy zachycuje šíři a pokročilost, ne čas. Stará data v Sheetu jsou přepsána funkcí `backfillScores()`.

**Pozn. k X-osa formuli (2026-05-13):** dvousložkový X = 0.7 × Core% + 0.3 × Bonus%, kde Core = Q1+Q2+Q4 (intenzita reálného používání, max 130), Bonus = Q3+Q5 (rozsah a pokročilost, max 150). Dřív byl prostý vážený součet / 280, který přetlačoval Q5 (32 % váhy) a tlačil typické workshopové publikum pod X=50. Nová formule: X=50 ≈ denní uživatel jednoho nástroje. Checkpoint před změnou: git tag `v0.4-pre-x-rebalance`.

---

## Konvence

- **UI a obsah:** čeština
- **Kód, komentáře, commit messages:** angličtina
- **Commit messages:** stručné, imperativ, klidně i 2-3 slova (`add scoring formula`, `fix dashboard refresh`)
- **CSS:** žádný framework, vlastní minimalistický styl
- **JS:** ES modules, žádný build step
- **Soubory:** jeden soubor = jedna zodpovědnost

---

## Bezpečnost a soukromí

- Žádné PII kromě křestního jména
- Demografie je kategorická a nepovinná, nedeanonymizuje
- Sheety jsou soukromé (Milošův Google), publikovaný je jen agregovaný JSON pro dashboard
- Dashboard URL se nesmí veřejně linkovat (workshop_id je obfuskace, ne autentizace)
- Claude API klíč je v Apps Script Script Properties, **nikdy v frontendu**
- LLM dostává všech 10 odpovědí + skóre. Žádné PII (jméno, IP, user agent) se do LLM neposílá.
- Nikdy nemazat ani nepřepisovat existující data v Sheetech bez explicitního souhlasu Miloše

---

## Pro Claude (instrukce pro budoucí session)

Když do tohoto projektu vstoupíš znovu:

1. **Přečti tento soubor.** Všechny sekce mají kontext, hlavně „Metodologické principy" a „Aktuální stav".
2. **Mrkni na `HANDOFF.md`** — deniční záznam mezi sessions.
3. **Zkontroluj `git log`** — co se od minula stalo.
4. **Pamatuj si rozdělení tvrdá vs. měkká data.** Nikdy nenavrhuj, aby LLM hýbal X/Y nebo dělal klasifikaci kvadrantů.
5. **Apps Script změny vyžadují manuální redeploy** — vždy to napiš Milošovi explicitně, on to udělá.
6. **Před netriviální akcí se ptej.** Hlavně před deploy, mazáním, nebo změnou scoring vah.
7. **Po hotovém milníku aktualizuj stav** v tomto souboru a commitni.
