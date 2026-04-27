# AI Attitude Dotazník – design dokument

**Verze:** 1.0 (kalibrace na 5 přepisech, ~60 účastníků)
**Autor:** Miloš + Claude
**Status:** k revizi a schválení

---

## 1. Cíl

Krátký dotazník (10 otázek, ~3 minuty), který každého účastníka workshopu/přednášky umístí na 2D mapu:

- **Osa X = Zkušenost s AI** (nezkušený ↔ zkušený)
- **Osa Y = Postoj k AI** (pesimismus ↔ optimismus)

Sběr probíhá přes QR kód → webový dotazník → data do Google Sheets → live dashboard se scatter plotem (každý účastník bod, jméno + zvíře v tooltipu).

Dotazník doplňuje (nikoli nahrazuje) ústní intro u workshopů a slouží jako primární metoda u přednášek a větších cohort.

---

## 2. Závěry z analýzy přepisů

### 2.1 Co skutečně diferencuje účastníky

**Silné objektivní signály experience (v pořadí důležitosti):**

1. **Spektrum nástrojů** – kdo používá pouze ChatGPT vs. kdo má v rotaci 4+ nástrojů včetně specializovaných (NotebookLM, MidJourney, Suno, 11Labs, Perplexity)
2. **Placená verze** – mít alespoň jednu placenou licenci je velmi silný signál. Free uživatelé vs. plus uživatelé jsou jiné kategorie.
3. **Pokročilé techniky** – custom GPTs, projekty, agenti, API, vibe coding, automation
4. **Frekvence** – „každovteřinová" / denně / týdně / občas / nikdy
5. **Délka aktivního používání** – kdo používá od 2023 vs. kdo začal letos

**Silné signály postoje (v pořadí důležitosti):**

1. **Future framing** – „velká příležitost" vs. „bojím se"
2. **Trust ve výstupy** – „lživé odpovědi" / „už nedokážu verifikovat" vs. „překvapivě přesné"
3. **Konkrétní obavy** (ekologie, etika, ztráta vlastního myšlení, bezpečnost, halucinace, ztráta práce)
4. **Self-efficacy** – „zvládnu to osvojit" vs. „nevím jak na to"
5. **Animal + důvod** (validátor, ne primární zdroj)

### 2.2 Pozorované archetypy účastníků

Z dat vyšlo 6 distinktivních archetypů, které pokrývají ~95 % účastníků. Jsou to klastry, ne kvadranty – některé sedí na hraně mezi kvadranty.

**1. Optimistický power user (pravý horní kvadrant, +X / +Y)**
- Příklady: Senta, Tomáš IT, Pavlína, Alena (komunikace, Eon), Roman, Jirka Kratochýl
- Markery: 4+ nástroje, placené, agenti/automatizace, „úžasné", konkrétní bohaté use cases

**2. Realistický power user (pravý spodní, +X / mírně −Y)**
- Příklady: Pavel (Innovation, ČEZ), Alena (finance, Eon), Mašek
- Markery: vysoká experience, ale s respektem k limitům – „AI zima", „verifikace náročná", „bojím se víc, čím víc s tím pracuju". Důležitá skupina, kterou nelze plést se začátečníky-pesimisty.

**3. Pragmatický uživatel (mid X / mírně +Y)**
- Příklady: většina středního managementu – Pepa ČSOB, Pavel Eon, Lukáš (Eon), Jakub
- Markery: 1–2 nástroje, free/plus, konkrétní use cases, „pomáhá mi to s X", bez výrazné ideologie

**4. Začátečník-nadšenec (−X / +Y)**
- Příklady: Lukáš stavař, Radka, Kateřina, Mirek
- Markery: nízká experience, ale „chci se naučit", „strašně mě to baví", chce konkrétní use cases

**5. Začátečník-skeptik / bojící se (−X / −Y)**
- Příklady: Saša, Andrea (ČSOB), Vláďa, Jana (finance, PF)
- Markery: nepoužívá nebo minimálně, „bojím se", „lživé odpovědi", konkrétní obavy (ekologie, autenticita)

**6. Manager-by-proxy (variabilní X)**
- Příklady: Jirka Mlýnář, Honza (ČSOB)
- Markery: sám nepoužívá, ale tým ano, vidí to spíš zvenčí. Tady experience-skóre dělá problém – mají kontext bez praxe.

### 2.3 Kódování zvířat (codebook)

Vznikl ze 60 přirovnání. Animal coding **nemá nahradit skóring**, ale validovat ho a obohatit qualitativně. Pravidlo: shoda animal-skóre s Q1–Q9 skórem = ✓; rozpor = příležitost pro pohovor.

#### Sebe → zvíře (dimenze X – self-positioning vůči AI)

| Skupina | Příklady | Modifikátor X | Význam |
|---|---|---|---|
| Apex predators | Lev, tygr, žralok, gepard, vlk | +5 | Confidence, agency, někdy „dravý" přístup |
| Velcí inteligentní | Slon, kůň, kosatka | +3 | Síla bez agrese, často mid-high exp |
| Společenští dravci | Pes (a všechny rasy), kočka | 0 | Loajalita, denní praxe – nejčastější odpověď |
| Pozorovatelé / chytří | Sova, krkavec, opice | +3 | Reflexivní vztah, často mid-high exp |
| Adaptéři | Bobr, surikata, mravenec | 0 | Praktický, „udělám si to sám" |
| Pomalí / opatrní | Lenochod, želva, hroch, krtek | −3 | Pasivita, pomalost, nízká agency |
| Plyšáci / mazlíčci | Mopsík, méďa plyšový, „chlupatá kočka" | −5 | Zranitelnost, malá agency, často nízká exp |
| Mýtické / sebe-zveličení | Drak, Lucifer | +3 | Self-aware ironie, často high exp |

#### AI → zvíře (dimenze Y – percepce nebezpečnosti / přínosnosti)

| Skupina | Příklady | Modifikátor Y | Význam |
|---|---|---|---|
| Pomáhající druzi | Pes, asistenční pes, parťák, delfín | +8 | Důvěra, podřízenost, partnerství |
| Moudří staří | Želva, slon (paměť) | +5 | Respekt + pozitivní |
| Kolektivní inteligence | Mraveniště, úl, vosí roj | +3 | Fascinace, „drobnosti se sčítají" |
| Komplexní/multifunkční | Chobotnice, kraken (neutrální popis) | 0 | Neutrální „šáhne všude" – default |
| Apex predators | Lev, tygr, gepard, vlk, drak | −3 | Síla + respekt + ostrah |
| Chytří podvodníci | Liška, chameleon, krkavec, had | −5 | Inteligence s nedůvěrou („vychytralá", „lživá") |
| Mýtické nebezpečné | Krakatice „co sežere parník", sedmihlavý drak, Lucifer, HAL 9000, Eva z Ex Machina, mloci z Čapka, virus, „šílený zhluk buněk" | −10 | Existenciální obava, kontrola, autonomie |

**Klíčové pravidlo:** Modifikátor se aplikuje JEN POKUD zdůvodnění souhlasí s archetypem. Když Senta řekne „chobotnice = geniální zvíře, miluju je" → +5 (manuální override). Když Andrea řekne „chobotnice strká prsty kam nemá" → −5 (manuální override). **„Proč" váží víc než druh.**

---

## 3. Finální dotazník (10 otázek)

### Sekce A – Zkušenost (5 otázek)

**Q1. Jak dlouho aktivně používáš AI nástroje?**
- a) Vůbec / jen jsem to párkrát zkusil/a
- b) Méně než 6 měsíců
- c) 6 měsíců – 2 roky
- d) Více než 2 roky

**Q2. Jak často AI typicky používáš?**
- a) Vůbec / sporadicky
- b) Občas (párkrát měsíčně)
- c) Pravidelně (alespoň týdně)
- d) Denně
- e) Mnohokrát denně / je to součást mé práce

**Q3. Které AI nástroje jsi za poslední měsíc reálně použil/a? (multi-select)**
- ChatGPT
- Claude
- Gemini
- Microsoft Copilot
- Perplexity
- NotebookLM
- MidJourney / DALL-E / Sora / Veo
- 11ElevenLabs / Suno
- HeyGen / Synthesia
- Vlastní AI nástroj v práci (interní)
- Žádný

**Q4. Platíš za některou AI službu?**
- a) Ne
- b) Ano, jeden placený nástroj
- c) Ano, dvě a více

**Q5. Co z následujícího jsi v posledních 6 měsících dělal/a? (multi-select)**
- Napsal/a jsem prompt přes 100 slov
- Použil/a jsem custom GPT, Project nebo Gem
- Nahrál/a jsem AI vlastní data (PDF, dokumenty, audio)
- Postavil/a jsem si nějakou AI automatizaci nebo agenta
- Použil/a jsem AI API přes kód (vibe coding nebo skutečně)
- Nic z toho

### Sekce B – Postoj (4 otázky)

**Q6. Jak vidíš AI z pohledu příštích 5 let?** (1–5 škála)
- 1: Spíš ohrožení a komplikace
- 2
- 3: Neutrální / nevím
- 4
- 5: Velkou příležitost, kterou bych byl/a špatný neuchopit

**Q7. Když mi AI něco vygeneruje, mám tendenci…**
- a) Spíš tomu věřit a použít to rovnou
- b) Letmo to projít a použít
- c) Důsledně ověřovat fakta a citace
- d) Často to musím přepsat / je to jen koncept
- e) Často mě AI zklamala – odpovědi bývají nepřesné

**Q8. Co tě na AI nejvíc znervózňuje? (vyber max. 3, nebo „Nic z toho")**
- Halucinace / nepravdivé odpovědi
- Ztráta pracovních míst
- Ztráta autenticity a vlastního myšlení
- Závislost na AI
- Etika a soukromí dat
- Bezpečnost a zneužití
- Strach z neznámého / „nevím, co to je"
- Ekologická zátěž
- Nic z toho – nemám výrazné obavy

**Q9. Mám pocit, že AI zvládnu osvojit a smysluplně využít.** (1–5 škála)
- 1: Určitě ne, je to mimo mě
- 5: Určitě ano, učím se průběžně

### Sekce C – Animal (1 otázka, dvě části)

**Q10a. K jakému zvířeti bys přirovnal/a sebe?** (otevřené pole, max 30 znaků)
**Q10b. Proč?** (otevřené pole, max 200 znaků)

**Q10c. K jakému zvířeti bys přirovnal/a AI?** (otevřené pole, max 30 znaků)
**Q10d. Proč?** (otevřené pole, max 200 znaků)

---

## 4. Scoring

### 4.1 Skóre X (Zkušenost), výsledek 0–100

```
X_raw =
  Q1_score    // 0 / 10 / 25 / 40
+ Q2_score    // 0 / 10 / 20 / 35 / 50
+ Q3_score    // viz tabulka níže, max 60
+ Q4_score    // 0 / 20 / 40
+ Q5_score    // viz tabulka níže, max 75

X = clamp(X_raw / 2.6, 0, 100)
```

**Q3 váhy nástrojů:**
- ChatGPT, Claude, Gemini, Copilot, Perplexity: 5 b
- NotebookLM, MidJourney/Sora, 11Labs/Suno, HeyGen: 10 b (signalizují širší expertizu)
- Vlastní AI v práci: 8 b
- max 60 b celkem

**Q5 váhy aktivit:**
- Prompt 100+ slov: 10 b
- Custom GPT/Project: 15 b
- Vlastní data v AI: 15 b
- Automatizace/agent: 20 b
- API/vibe coding: 15 b
- max 75 b celkem

### 4.2 Skóre Y (Postoj), výsledek −50 až +50

```
Y_raw =
  Q6_score    // -20 / -10 / 0 / +10 / +20
+ Q7_score    // viz níže
+ Q8_score    // -3 za každou negativní obavu, +5 za "Nic z toho"
+ Q9_score    // -10 / -5 / 0 / +5 / +10

Y = clamp(Y_raw, -50, +50)
```

**Q7 mapování:**
- a) Slepě věřit: 0 (naivní, ne pesimismus, ale ani konstruktivní)
- b) Letmo projít: +5 (zdravé pragmatické)
- c) Důsledně ověřovat: +10 (kritické myšlení = optimismus s rozumem)
- d) Často přepsat: −5 (mírná frustrace)
- e) Často zklamala: −15 (silný negativní signál)

### 4.3 Animal modifikátory (overlay)

Po automatickém kódování se aplikuje:
- X_final = X + animal_X_modifier (rozmezí ±5)
- Y_final = Y + animal_Y_modifier (rozmezí ±10)

Pokud je rozdíl mezi původním Y skórem a animal modifikátorem velký (>20 bodů), bod v grafu se označí jako **„zajímavý případ"** (jiná barva, vlaječka v tooltipu) – signál pro Miloše, že tohohle člověka stojí za to si všimnout v ústním kole.

### 4.4 LLM-asistované kódování animal otázek

Q10 vyhodnotí na pozadí LLM (Claude nebo GPT-4 přes API) podle promptu:

```
Vstup: zvíře_self="...", důvod_self="...", zvíře_AI="...", důvod_AI="..."
Výstup: { animal_X_mod: -5..+5, animal_Y_mod: -10..+10, archetype: "...", note: "..." }
```

Codebook ze sekce 2.3 je v promptu jako reference. LLM dostane explicitní pravidlo: **„Důvod má prioritu nad druhem zvířete. Pokud důvod jasně neodpovídá archetypu, řiď se důvodem."**

---

## 5. Validace na reálných datech

Test na 6 účastníků z přepisů (jak by je systém umístil):

| Jméno | Předpokládaný kvadrant | X (odhad) | Y (odhad) | Animal sebe → AI |
|---|---|---|---|---|
| Senta | +X / +Y | ~85 | +35 | delfín → chobotnice (+5/0, manuál +5 = miluju) |
| Tomáš IT | +X / +Y | ~95 | +30 | vlk → krkavec/chobotnice (+5/+3) |
| Pavel Innovation | +X / mírně −Y | ~85 | −5 | vlk smečky → 7hlavý drak (+5/−10) |
| Lukáš stavař | −X / +Y | ~25 | +20 | bobr → mraveniště (0/+3) |
| Saša | −X / −Y | ~5 | −25 | žirafa → tajemné cizí (0/−10) |
| Andrea ČSOB | −X / −Y | ~5 | −30 | jorkšír → chobotnice „strká prsty" (−5/−5 manuál) |

Tyto odhady budou cílem prvního testovacího běhu – pokud se výsledné skóre dramaticky liší, ladíme váhy.

---

## 6. Technický stack (návrh k odsouhlasení)

**Frontend (dotazník):**
- Statická HTML+JS stránka, hostovaná na Cloudflare Pages nebo Netlify
- Vlastní subdoména (např. `dotaznik.inspiruj.se` nebo `ai-mapa.inspiruj.se`)
- Mobile-first, Czech texty, zhruba 3 minuty vyplnění
- Branding Inspiruj.se

**Backend:**
- Google Sheets jako databáze
- Google Apps Script jako webhook (přijímá POST z formuláře, zapíše řádek)
- Sekundární výstup: skóre X, Y, animal_X_mod, animal_Y_mod, archetype, timestamp, workshop_id

**Animal scoring:**
- Po submitu se na pozadí volá Claude/GPT API s codebookem v promptu
- Výstup se zapíše do dalšího sloupce v Sheetu
- Stojí ~$0.001 na účastníka (nezpůsobí účet)

**Live dashboard:**
- Druhá stránka na stejné doméně (např. `dotaznik.inspiruj.se/dashboard?w=cez-2026-04-27`)
- Čte z Google Sheets přes published JSON
- Auto-refresh každých 10s
- Scatter plot: čtyři kvadranty, body = účastníci, hover = jméno + zvíře + zdůvodnění
- Filtr: workshop_id (každý workshop má vlastní view + agregovaný „all-time")

**Workshop flow:**
1. Milos zobrazí QR kód na slidu
2. Účastníci scanují, vyplní (3 min)
3. Mezitím Milos něco říká
4. Po vyplnění Milos přepne na dashboard – účastníci vidí sami sebe v mapě
5. Milos komentuje skupinu („vy jste výjimečně optimistická skupina…")

---

## 7. Otevřené otázky pro Miloše

1. **Doména + hosting** – chceš subdoménu na inspiruj.se, nebo vlastní URL? Mám hostovat na Cloudflare Pages (free tier stačí)?
2. **Google Sheet** – který Google účet to má vlastnit? Tvůj osobní, Sentin, nebo nějaký workspace účet inspiruj.se?
3. **Animal LLM API** – preferuješ Claude (Anthropic API) nebo OpenAI? Náklady budou tak $5/měsíc i při intenzivním používání.
4. **Branding** – mám použít barvy/font Inspiruj.se? Pošleš mi logo a brand guideline, nebo budu pracovat s defaultní střízlivou estetikou?
5. **Workshop_id** – chceš zadávat ručně před každým workshopem, nebo generujeme automaticky podle data?
6. **Archetypy v dashboardu** – mám zobrazovat label archetypu („optimistický power user") u každého bodu, nebo je to spíš info pro tebe v exportu?

Po odsouhlasení designu (sekce 3 – otázky a sekce 4 – scoring) postavím prototyp aplikace + dashboardu. Odhad: prototyp do dvou dnů, finální verze po prvním reálném workshopu (kalibrace vah).
