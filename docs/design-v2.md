# EvalAI v2 — návrh pro podzimní firemní sezónu

**Stav: NÁVRH k diskusi (2026-07-07).** Vychází z analýzy 467 jarních odpovědí (22 akcí),
metodologie Public First AI Index (https://indexaiglobalpublicservices.publicfirst.co/)
a rozhodnutí Miloše ze session 2026-07-07:

1. Jeden dotazník ~4 min (10 individuálních otázek + organizační modul)
2. Produkt = workshop + firemní report; assessment slouží i jako prodejní nástroj
   („změříme vaše lidi → doporučíme, jaký workshop potřebujete")
3. Čistý řez: v2 scoring, jarní data zůstávají jako benchmark (přemapovat co jde)
4. Zvířata: tap-chips + nepovinný volný text

---

## Proč se mění (shrnutí analýzy jarních dat)

| Zjištění | Číslo | Důsledek |
|---|---|---|
| Frekvence saturovaná | 67 % daily/always, 85 % používá >6 měsíců | Q1 (délka) vyhodit, frekvenci zredukovat na kotvu |
| Aktivity rozlišují | uvnitř daily skupiny X p10=44 → p90=90; rozptyl dělá Q5/Q4/Q3 | X přestavět na „co děláš", ne „jak často" |
| Y komprimované | sd 16 vs. 24 u X; Q7 koreluje s Y r=0,86 (2× váha) | vyrovnat váhy, vyměnit Q6 (67 % lidí dává 4–5) |
| Q9 (regulace) dvojznačná | měří governance preferenci i pesimismus zároveň | nahradit čistou societal otázkou |
| Zvířecí důvody chybí | vyplněno jen ~33 % | chips + volný text |
| Chybí org. vrstva | dotazník měří jen jednotlivce | nový modul 5E-lite → firemní index |
| Medián vyplnění 205 s | nad 3min cílem už teď | rozpočet v2: ~240 s |

---

## Architektura v2

Tři měřené vrstvy + jedna měkká:

| Vrstva | Otázky | Výstup | Zpracování |
|---|---|---|---|
| **X — praxe** (dřív „zkušenost") | A1–A5 | X 0–100 | deterministický scoring |
| **Y — postoj** | B1–B4 | Y 0–100 | deterministický scoring |
| **O — organizace** (NOVÉ) | C1–C5 | Org Readiness Index 0–100 + 5 subskóre | průměr normalizovaných položek (Public First styl, bez vah) |
| **Zvířata** (měkká) | D1 | animal_note | Claude, nezasahuje do skóre |

Kvadranty na mapě X×Y zůstávají (osvědčily se). Org vrstva se NEpromítá do
pozice jednotlivce — je to agregát pro firemní report.

---

## Sekce A — Praxe s AI (osa X)

**A1 — frekvence (kotva, single):**
„Jak často AI nástroje reálně používáš?"
- vůbec / párkrát za měsíc / párkrát týdně / denně / je to součást skoro každé mé pracovní hodiny

**A2 — use-casy (multi, NOVÁ — jádro změny „co děláš"):**
„Co s AI opravdu děláš? Označ všechno, co jsi dělal(a) v posledním měsíci."
- psaní a úprava textů
- shrnutí dokumentů, schůzek nebo dlouhých materiálů
- rešerše a vyhledávání informací
- analýza dat či tabulek
- programování / skripty
- tvorba obrázků, audia nebo videa
- brainstorming, rozhodování, druhý názor
- nic z toho *(exclusive)*

**A3 — hloubka (multi, evoluce dnešní Q5):**
„Které z těchto pokročilejších věcí ovládáš?"
- dlouhé strukturované prompty
- vlastní GPT / Projects / nahrávání vlastních souborů
- automatizace (Make, Zapier, n8n…)
- vibecoding (tvorba aplikací pomocí AI)
- agenti (Claude Code, Deep Research, operátoři…)
- nic z toho *(exclusive)*

**A4 — placené licence (beze změny = dnešní Q4):** ne / jedna / více

**A5 — nástroje (zachovat dnešní Q3, beze změny hodnot):**
drží kontinuitu benchmarku + firmy zajímá, co lidi reálně používají.

**Scoring X (návrh, kalibrovat dry-runem na přemapovaných jarních datech):**
```
breadth% = počet A2 use-casů / 7
depth%   = vážený součet A3 (long_prompt 10, custom 15, automation 20,
           vibecoding 20, agent 25) / 90
core%    = 0.45×breadth + 0.55×depth
support% = (A1 frekvence /4 + A4 /2 + počet A5 nástrojů /6, průměr)
X = round(70×core% + 30×support%)
```
Cíl kalibrace: X=50 ≈ denní uživatel se 3–4 use-casy bez pokročilých technik;
X≥75 jen skuteční power useři. Před nasazením spustit scoring-test na jarních
datech (A2 u nich chybí → imputovat z Q5/Q3, jen pro sanity check rozptylu).

## Sekce B — Postoj (osa Y)

Vyrovnané váhy, žádná položka nesmí mít >35 % rozsahu.

**B1 (= dnešní Q7, funguje):** „AI změní můj život a práci k lepšímu." 1–5, váha ±15
**B2 (NAHRAZUJE Q6):** „Z tempa, jakým se AI vyvíjí, mám spíš radost než obavy." 1–5, váha ±15
**B3 (NAHRAZUJE Q9):** „Společnosti jako celku AI spíš pomůže, než ublíží." 1–5, váha ±10
**B4 (= dnešní Q8, obavy multi, beze změny hodnot):** −3 za obavu, „žádné" +5

`Y_raw ∈ −49…+49 → Y = Y_raw + 50`. Cíl: sd Y ≥ 20 (jaro: 16,3).

## Sekce C — Organizace (5E-lite, NOVÁ)

Inspirace Public First: Enablement, Empowerment, Education, Embedding
(+ Enthusiasm už měří osa Y — do org indexu vstoupí agregát Y týmu).

**C1 Enablement:** „Dává ti zaměstnavatel AI nástroje, které potřebuješ?"
- ano, placené a dostačující / jen základní či omezené / ne, používám vlastní / ne a AI v práci nepoužívám

**C2 Shadow AI:** „Používáš v práci i soukromé AI účty (vlastní ChatGPT apod.)?"
- pravidelně / občas / ne
*(→ samostatná metrika do reportu — pro management často nejsilnější číslo)*

**C3 Empowerment:** „Je ti jasné, co v práci s AI smíš a co ne?" 1–5

**C4 Education:** „Dostal(a) jsi od zaměstnavatele k AI školení nebo podporu?"
- ano, opakovaně / jednorázově / ne, ale zvládám to sám(a) / ne a chybí mi to

**C5 Embedding:** „AI je běžnou součástí pracovních postupů v mém týmu." 1–5

**Org Readiness Index** = průměr normalizovaných (0–1) položek C1–C5 + průměr
Y týmu jako Enthusiasm → ×100. Bez vah (Public First přístup). Reportovat jen
při n≥8 respondentů z firmy. Pro veřejný `online` mód sekci C zobrazit taky
(jen s neutrálním úvodem „pokud pracuješ…" + Skip), data se hodí do benchmarku.

## Sekce D — Zvířata (chips + text)

Struktura zůstává (zvíře self + zvíře AI), přidávají se tap-chips po výběru zvířete:

„Proč právě tohle zvíře?" — 1–3 ťuknutí + nepovinný volný text:
- pro self: zvědavé / opatrné / hravé / vytrvalé / rychlé / věrné / nezávislé / dravé
- pro AI: chytré / rychlé / užitečné / nevyzpytatelné / všudypřítomné / cizí a tajemné / nebezpečné / přátelské

Chips jsou dál **měkká vrstva** — do X/Y/O nevstupují. Claude je dostane spolu
s volným textem → animal_note přestane být naslepo (jaro: důvod jen u 33 %).
Chips se ukládají strukturovaně → později kvantitativní analýza sentimentu zvířat.

## Demografie (Q11) — jedna změna

Přidat pole **`role`**: vedení firmy / vedoucí týmu / specialista / jiné.
Pro firemní report klíčové (klasické zjištění „management si myslí × lidi dělají").
Zbytek beze změny.

---

## Firemní report (placený deliverable)

Generuje Claude z dat workshopu/assessmentu, formát 1× A4 + příloha:

1. **AI Readiness Index** 0–100 + rozpad na 5E (radar/bar)
2. **Mapa lidí** (scatter X×Y, podíly kvadrantů)
3. **Benchmark:** percentil vs. český benchmark (jarní data + rostoucí DB), vs. obor
4. **Shadow AI %** + top use-casy + top obavy
5. **Zvěřinec:** top zvířata + 2–3 anonymní citace důvodů
6. **Doporučení:** kde je mezera (skills × enablement × governance) → jaký typ
   workshopu/intervence — tohle je prodejní smyčka „změříme → doporučíme → školíme"

## Prodejní flow

1. Firmě se nabídne „změření" (levné/v ceně) → rozešle se link zaměstnancům
2. Report ukáže mezery → doporučení konkrétního workshopu
3. Workshop se živou mapou (dnešní wow moment zůstává)
4. (Později) re-test po 3 měsících → report o posunu → opakovaný byznys

## Datová kontinuita

- Jarní sheet se nemění, zůstává benchmarkem v1.
- v2 zapisuje do **nového sheetu/tabu** (čistý řez, žádné žonglování se sloupci).
- Přemapování jara pro benchmark: Q3/Q4 1:1, Q5→A3 1:1, Q7→B1 1:1, Q8→B4 1:1;
  A2 (use-casy) a sekce C u jarních dat chybí → benchmark bude mít dvě úrovně
  („plný v2" vs. „jarní částečný").

## Implementační kroky (další sessions)

1. [ ] Odsouhlasit znění otázek (tento dokument) s Milošem
2. [ ] i18n.js — CZ + EN texty nových otázek
3. [ ] questions.js + app.js — nové struktury (A2, C1–C5, chips, role)
4. [ ] webhook.gs — scoring v2, nový sheet, nové ANSWER_LABELS
5. [ ] Dry-run kalibrace X/Y na přemapovaných jarních datech (scoring-test.mjs rozšířit)
6. [ ] Dashboard: přepínač v1/v2 datasetů + zobrazení Org Indexu
7. [ ] Report generátor (skript / Apps Script) + šablona
8. [ ] Manuální redeploy Apps Script (Milos) + smoke test
