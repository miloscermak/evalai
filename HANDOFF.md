# EvalAI — Předávací zpráva

**Aktualizace:** 2026-05-13
**Předává:** Claude Code (session 2026-05-13) → další session
**Stav:** v0.5 — X-osa formule přepracována na dvousložkový model (Core 0.7 / Bonus 0.3). Frontend committen, **Apps Script čeká na manuální redeploy** + spuštění `backfillScores()` na existujících 131 řádcích.

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
