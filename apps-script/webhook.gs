/**
 * EvalAI — Apps Script webhook
 *
 * Co tenhle skript dělá:
 *   doPost(e)  — přijme JSON z formuláře, spočítá X/Y skóre, zavolá
 *                Claude API pro animal modifikátor a zapíše řádek do Sheets.
 *   doGet(e)   — vrátí JSON s body všech účastníků (filtruje podle
 *                workshop_id z query parametru w). Pro dashboard.
 *
 * SETUP:
 *   1. Otevři script.google.com → New project, vlož sem celý tento soubor.
 *   2. Vytvoř Google Sheet, jeho ID zkopíruj sem dole do SPREADSHEET_ID.
 *   3. Project Settings → Script Properties:
 *        ANTHROPIC_API_KEY = sk-ant-...   (z console.anthropic.com)
 *   4. Deploy → New deployment → Type: Web app
 *      Execute as: Me, Who has access: Anyone with the link.
 *      Zkopíruj URL — patří do src/config.js (webhookUrl + dashboardJsonUrl).
 *
 * Scoring formule jsou v souladu s docs/design.md sekce 4.
 */

// ════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '17ykmmC2LHVc871aoGU0vFEUygzl-vF1Jn1ISamaV8JI';
const SHEET_NAME = 'submissions';        // v1 (jaro 2026) — NEMĚNIT
const SHEET_NAME_V2 = 'submissions_v2';  // v2 (podzim 2026) — tab se vytvoří sám

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// header row pro v1 sheet — pořadí MUSÍ odpovídat appendRow níž
const SHEET_HEADERS = [
  'submission_id', 'timestamp', 'workshop_id', 'name', 'duration_sec',
  'answers_json',
  'score_x_raw', 'score_y_raw',
  'archetype', 'animal_x_mod', 'animal_y_mod', 'animal_note',
  'score_x_final', 'score_y_final', 'outlier_flag',
  'interpretation',
  'age', 'education', 'field', 'gender',
  'user_agent', 'version',
];

// header row pro v2 sheet — nový tab si Apps Script založí sám včetně hlavičky
const SHEET_HEADERS_V2 = [
  'submission_id', 'timestamp', 'workshop_id', 'name', 'duration_sec',
  'answers_json',
  'score_x', 'score_y', 'archetype',
  'work_context', 'org_index',
  'interpretation', 'animal_note',
  'age', 'education', 'field', 'role', 'gender',
  'user_agent', 'version',
];

// ════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    // Routing podle verze dotazníku: v2 (index.html) vs. v1 (/v1, zmrazená).
    // Obě verze běží souběžně, každá zapisuje do vlastního sheetu.
    const result = (String(payload.formVersion) === '2')
      ? processSubmissionV2(payload)
      : processSubmission(payload);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const workshop = (params.w || params.workshop || '').trim();
    // ?v=2 čte v2 sheet; bez parametru zůstává v1 (staré dashboardy fungují dál)
    const data = (String(params.v) === '2')
      ? readSubmissionsV2(workshop)
      : readSubmissions(workshop);
    return jsonResponse({ ok: true, count: data.length, points: data });
  } catch (err) {
    console.error('doGet error:', err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════════
// CORE: process one submission
// ════════════════════════════════════════════════════════════════════════

function processSubmission(payload) {
  const a = payload.answers || {};
  const lang = (payload.lang === 'en') ? 'en' : 'cs';  // whitelist; default cs

  const xRaw = scoreX(a);
  const yRaw = scoreY(a);

  // Tvrdý scoring → finální pozice. Zvířata na X/Y NEMAJÍ vliv.
  const xFinal = clamp(xRaw, 0, 100);
  const yFinal = clamp(yRaw + 50, 0, 100);  // yRaw je -50..+50, normalizujeme na 0..100
  const quadrant = deriveQuadrant(xFinal, yFinal);

  // Claude píše dvě textová pole: tvrdé hodnocení dotazníku + měkkou
  // poetickou úvahu nad kombinací zvířat. Žádné modifikátory, žádný
  // alternativní archetype. Pokud API selže, použijeme prázdné stringy.
  // Lang ovlivňuje JEN jazyk výstupu — scoring, sheet schema beze změny.
  let llm = { interpretation: '', animal_note: '' };
  try {
    llm = generateFeedback(a, xFinal, yFinal, quadrant, lang);
  } catch (err) {
    console.warn('Claude API call failed, falling back to empty:', err);
    llm.animal_note = '[Claude API error: ' + err + ']';
  }

  const submission_id = generateId();

  // Sheet schema držíme stabilní (kvůli starým řádkům a dashboard čtení).
  // animal_x_mod / animal_y_mod jsou nově vždy 0, archetype = kvadrant.
  const demo = a.q11 || {};
  const row = [
    submission_id,
    payload.timestamp || new Date().toISOString(),
    payload.workshopId || '',
    payload.name || '',
    payload.durationSec || '',
    JSON.stringify(a),
    xRaw, yRaw,
    quadrant, 0, 0, llm.animal_note,
    xFinal, yFinal, false,
    llm.interpretation,
    demo.age || '', demo.education || '', demo.field || '', demo.gender || '',
    (payload.userAgent || '').slice(0, 200),
    payload.version || '',
  ];

  appendRow(row);

  return {
    submission_id,
    score_x: xFinal,
    score_y: yFinal,
    archetype: quadrant,
    interpretation: llm.interpretation,
    animal_self: a.q10 ? a.q10.animalSelf || '' : '',
    animal_ai:   a.q10 ? a.q10.animalAi   || '' : '',
    animal_note: llm.animal_note,
  };
}

function deriveQuadrant(x, y) {
  if (x >= 50 && y >= 50) return 'optimistic_power_user';
  if (x >= 50 && y <  50) return 'realistic_power_user';
  if (x <  50 && y >= 50) return 'casual_enthusiast';
  return 'casual_skeptic';
}

// ════════════════════════════════════════════════════════════════════════
// V2 (podzim 2026) — nový dotazník: X z aktivit, vyrovnané Y, org index
// Návrh a zdůvodnění: docs/design-v2.md
// ════════════════════════════════════════════════════════════════════════

function processSubmissionV2(payload) {
  const a = payload.answers || {};
  const lang = (payload.lang === 'en') ? 'en' : 'cs';

  const xFinal = clamp(scoreX2(a), 0, 100);
  const yFinal = clamp(scoreY2(a) + 50, 0, 100);
  const quadrant = deriveQuadrant(xFinal, yFinal);
  const workContext = a.c0 || '';
  const orgIndex = orgIndexV2(a);   // '' když sekce C nebyla vyplněna

  let llm = { interpretation: '', animal_note: '' };
  try {
    llm = generateFeedbackV2(a, xFinal, yFinal, quadrant, orgIndex, lang);
  } catch (err) {
    console.warn('Claude API call failed (v2), falling back to empty:', err);
    llm.animal_note = '[Claude API error: ' + err + ']';
  }

  const submission_id = generateId();
  const demo = a.q11 || {};
  const row = [
    submission_id,
    payload.timestamp || new Date().toISOString(),
    payload.workshopId || '',
    payload.name || '',
    payload.durationSec || '',
    JSON.stringify(a),
    xFinal, yFinal, quadrant,
    workContext, orgIndex,
    llm.interpretation, llm.animal_note,
    demo.age || '', demo.education || '', demo.field || '', demo.role || '', demo.gender || '',
    (payload.userAgent || '').slice(0, 200),
    payload.version || '',
  ];

  appendRowV2(row);

  return {
    submission_id,
    score_x: xFinal,
    score_y: yFinal,
    archetype: quadrant,
    org_index: orgIndex,
    interpretation: llm.interpretation,
    animal_self: a.q10 ? a.q10.animalSelf || '' : '',
    animal_ai:   a.q10 ? a.q10.animalAi   || '' : '',
    animal_note: llm.animal_note,
  };
}

// ──────── scoring X v2 (praxe, 0–100) ────────
//
// X = 30×šíře use-casů + 25×hloubka technik + 20×míra delegace + 12×frekvence
//     + 8×placené + 5×šíře nástrojů.
// Kalibrační kotvy (viz scoring-test-v2.mjs):
//   X≈50 — denní uživatel, 3–4 use-casy, 1 placený nástroj, deleguje ověřitelné úkoly
//   X≥75 — power user (agenti/automatizace, více placených, širší záběr)
// Důvod přestavby: jarní data 2026 ukázala saturaci frekvence (67 % daily+)
// — rozlišuje to, CO lidi s AI dělají, ne jak často sedí u chatbota.
// Refresh podzim 2026: přibyla A6 (delegace) s váhou 20 — „kolik práce si troufneš
// pustit z ruky" dnes rozlišuje líp než šíře nástrojů (ta spadla z 10 na 5).
// A4 nově odlišuje vlastní peníze (závazek) od firemní licence (dostal ji, nevybral si).

function scoreX2(a) {
  const A2_USE = {
    writing: 1, summary: 1, research: 1, translate: 1, data: 1,
    coding: 1, media: 1, brainstorm: 1, none: 0,
  };
  const A3_ACTS = {
    long_prompt: 10, chatbot_max: 15, custom_assistant: 15,
    vibecoding: 20, automation: 20, agent: 25, none: 0,
  };
  const A1_FREQ  = { never: 0, monthly: 0.25, weekly: 0.5, daily: 0.85, always: 1 };
  const A4_PAID  = { no: 0, employer: 0.3, one: 0.6, multi: 1 };
  const A6_DELEG = { never: 0, small: 0.3, verify: 0.6, long: 1 };

  const breadth = capSum(asArray(a.a2), A2_USE, 8) / 8;
  const depth   = capSum(asArray(a.a3), A3_ACTS, 105) / 105;
  const deleg   = A6_DELEG[a.a6] || 0;
  const freq    = A1_FREQ[a.a1] || 0;
  const paid    = A4_PAID[a.a4] || 0;
  const toolCnt = asArray(a.a5).filter(function (v) { return v !== 'none'; }).length;
  const tools   = Math.min(toolCnt, 6) / 6;

  return Math.round(30 * breadth + 25 * depth + 20 * deleg + 12 * freq + 8 * paid + 5 * tools);
}

// ──────── scoring Y v2 (postoj, -50 až +50) ────────
//
// Tři vyvážené likertové položky, každá míří jinam:
//   B1 = moje práce (osobní dopad), B2 = tempo vývoje (rychlost a kontrola),
//   B3 = společnost. Dřív B1 mixovala „svět i můj život" a splývala s B3.
// B4 (obavy) do Y NEVSTUPUJE — počet zaškrtnutých políček měří přemýšlivost,
// ne pesimismus (přemýšlivý optimista si jimi škrtal až 9 bodů). Zůstává jako
// kvalitativní vrstva pro LLM a firemní report („co vaše lidi nejvíc trápí").
// Váha 50/6 ≈ 8.33 → tři položky × ±2 kroky = plný rozsah ±50 bez komprese.

function scoreY2(a) {
  const W = 50 / 6;
  const b1 = a.b1 ? (a.b1 - 3) * W : 0;   // moje práce bude zajímavější a lepší
  const b2 = a.b2 ? (a.b2 - 3) * W : 0;   // radost vs. obavy z tempa vývoje
  const b3 = a.b3 ? (a.b3 - 3) * W : 0;   // dopad na společnost

  return clamp(Math.round(b1 + b2 + b3), -50, 50);
}

// ──────── org index v2 (0–100, per respondent) ────────
//
// 5E-lite po vzoru Public First: průměr normalizovaných položek C1–C5 bez vah.
// „Nechci odpovědět" (na) se vynechává; prázdná sekce C → ''.
// Firemní agregát = průměr přes work_context='employee' (dělá se v reportu,
// ne tady). Detaily mapování: docs/design-v2.md.

function orgIndexV2(a) {
  const parts = [];
  const C1 = { provided_paid: 1, provided_basic: 0.5, own_tools: 0.25, no_ai: 0 };
  const C2 = { no: 1, sometimes: 0.5, regularly: 0 };
  const LIK = { agree: 1, rather_agree: 0.75, dk: 0.5, rather_disagree: 0.25, disagree: 0 };

  if (C1[a.c1] !== undefined) parts.push(C1[a.c1]);
  if (C2[a.c2] !== undefined) parts.push(C2[a.c2]);
  [a.c3, a.c4, a.c5].forEach(function (v) {
    if (LIK[v] !== undefined) parts.push(LIK[v]);
  });

  if (!parts.length) return '';
  const sum = parts.reduce(function (s, x) { return s + x; }, 0);
  return Math.round(100 * sum / parts.length);
}

// ════════════════════════════════════════════════════════════════════════
// SCORING — X (zkušenost, 0-100)
// ════════════════════════════════════════════════════════════════════════
//
// Verze 2026-05-13: dvousložkový X.
//   Core  (Q1 + Q2 + Q4, max 130) = intenzita reálného používání — váha 0.7
//   Bonus (Q3 + Q5, max 150)      = rozsah a pokročilost — váha 0.3
//
// Důvod: stará formule (vážený součet / 280) dávala 53 % váhy na "šíři a
// pokročilost" (Q3+Q5). Daily user s 1 nástrojem bez agentů končil na X≈36,
// i když AI fakticky používá denně. Po rebalance je X=50 typický denní
// uživatel jednoho nástroje, X≥75 jen skutečný power user.
// Validováno dry-runem na 131 reálných odpovědích (CAK/online/bioptic).

function scoreX(a) {
  const Q1 = { never: 0, lt6m: 10, '6m_2y': 25, gt2y: 40 };
  const Q2 = { never: 0, monthly: 10, weekly: 20, daily: 35, always: 50 };
  const Q3_TOOLS = {
    chatgpt: 5, claude: 5, gemini: 5, copilot: 5, perplexity: 5,
    notebooklm: 10, image: 10, audio: 10, video: 10,
    other: 8,
    // legacy alias pro stará submission před 2026-04-29 (label byl "Vlastní AI nástroj v práci")
    internal: 8,
    none: 0,
  };
  const Q4 = { no: 0, one: 20, multi: 40 };
  // Q5 — od 2026-04-29 přepracováno. Hierarchie: prompty < chatbot na maximum
  // < vibecoding/automatizace < agent (nejpokročilejší). Cap 90 = sum všech 5.
  const Q5_ACTS = {
    long_prompt: 10,
    chatbot_max: 15,
    vibecoding:  20,
    automation:  20,
    agent:       25,
    // legacy aliasy pro stará submission
    custom_gpt:  15,
    own_data:    15,
    api:         20,
    none:         0,
  };

  const q1 = Q1[a.q1] || 0;
  const q2 = Q2[a.q2] || 0;
  const q3 = capSum(asArray(a.q3), Q3_TOOLS, 60);
  const q4 = Q4[a.q4] || 0;
  const q5 = capSum(asArray(a.q5), Q5_ACTS, 90);

  const corePct  = (q1 + q2 + q4) / 130 * 100;   // max 130
  const bonusPct = (q3 + q5)      / 150 * 100;   // max 150
  return Math.round(0.7 * corePct + 0.3 * bonusPct);
}

// ════════════════════════════════════════════════════════════════════════
// SCORING — Y (postoj, -50 až +50)
// ════════════════════════════════════════════════════════════════════════

function scoreY(a) {
  // Q6 — "AI bude do 5 let stejně dobrá jako lidi"
  // Tahle otázka NENÍ čistě o postoji — měří víru v sílu AI. Souhlas mírně
  // koreluje s optimismem (lidé, kteří věří v sílu AI, ji většinou přijímají),
  // ale slabě. Vážíme jen ±10.
  const q6 = a.q6 ? (a.q6 - 3) * 5 : 0;

  // Q7 — "AI změní svět i můj život k lepšímu"
  // Přímá otázka na valenci, nejsilnější optimismus signál. Vážíme ±20.
  const q7 = a.q7 ? (a.q7 - 3) * 10 : 0;

  // Q8 — počet negativních obav × −3, "none" = +5
  const concerns = asArray(a.q8);
  let q8;
  if (concerns.length === 1 && concerns[0] === 'none') {
    q8 = 5;
  } else {
    const negativeCount = concerns.filter(c => c !== 'none').length;
    q8 = -3 * negativeCount;
  }

  // Q9 — "Vývoj a používání AI bude třeba tvrdě regulovat a omezovat"
  // OBRÁCENÝ směr: souhlas = AI je nebezpečná → pesimismus. Vážíme ±10.
  const q9 = a.q9 ? (3 - a.q9) * 5 : 0;

  return clamp(q6 + q7 + q8 + q9, -50, 50);
}

// ════════════════════════════════════════════════════════════════════════
// FEEDBACK — Claude píše interpretaci (z tvrdých dat) + animal note (z Q10)
// ════════════════════════════════════════════════════════════════════════
//
// Metodika: kvadrant se odvozuje deterministicky z X/Y (Q1–Q9). Claude tu
// pozici NEMĚNÍ — jen ji slovně okomentuje a u animal note kreativně rozvine
// vztah obou zvířat. Zvířata jsou výslovně „měkká věda", ne klasifikační vstup.

function generateFeedback(answers, xFinal, yFinal, quadrant, lang) {
  const prompt = buildFeedbackPrompt(answers, xFinal, yFinal, quadrant, lang);
  return callClaudeFeedback(prompt, lang);
}

function generateFeedbackV2(answers, xFinal, yFinal, quadrant, orgIndex, lang) {
  const prompt = buildFeedbackPromptV2(answers, xFinal, yFinal, quadrant, orgIndex, lang);
  return callClaudeFeedback(prompt, lang);
}

// Sdílené volání Claude API (v1 i v2) — tools API vynutí strukturovaný výstup.
function callClaudeFeedback(prompt, lang) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY není v Script Properties.');
  }

  const toolDescription = (lang === 'en')
    ? 'Record the participant\'s feedback — a hard interpretation of the questionnaire and a poetic reflection on the two animals.'
    : 'Zaznamenej slovní hodnocení účastníka — interpretaci dotazníku a poetickou úvahu nad zvířaty.';

  const tool = {
    name: 'record_feedback',
    description: toolDescription,
    input_schema: {
      type: 'object',
      properties: {
        interpretation: { type: 'string', maxLength: 700 },
        animal_note:    { type: 'string', maxLength: 700 },
      },
      required: ['interpretation', 'animal_note'],
    },
  };

  const response = UrlFetchApp.fetch(CLAUDE_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'record_feedback' },
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error('Claude API ' + code + ': ' + body.slice(0, 300));
  }

  const data = JSON.parse(body);
  const toolUse = (data.content || []).find(c => c.type === 'tool_use');
  if (!toolUse || !toolUse.input) {
    throw new Error('Claude nevrátil tool_use blok: ' + body.slice(0, 300));
  }

  return {
    interpretation: String(toolUse.input.interpretation || '').slice(0, 700),
    animal_note:    String(toolUse.input.animal_note    || '').slice(0, 700),
  };
}

// Slovníky odpovědí pro LLM — lokalizované. Klíče (q1, q2, q3…) odpovídají
// value kódům z frontendu (src/questions.js + src/i18n.js).
// EN slovníky musí slovně sedět s EN labely v i18n.js, ale tady jsou pro LLM
// (ne pro UI), takže lze zvolit kratší/popisnější formy.
const ANSWER_LABELS = {
  cs: {
    Q1: { never: 'AI nikdy nepoužil(a)', lt6m: 'méně než 6 měsíců', '6m_2y': '6 měsíců až 2 roky', gt2y: 'víc než 2 roky' },
    Q2: { never: 'nepoužívá', monthly: 'měsíčně', weekly: 'týdně', daily: 'denně', always: 'několikrát denně' },
    Q3: {
      chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', copilot: 'Microsoft Copilot',
      perplexity: 'Perplexity', notebooklm: 'NotebookLM', image: 'generování obrázků',
      audio: 'generování audia', video: 'generování videa', other: 'jiný AI nástroj',
      internal: 'vlastní firemní AI nástroj', none: 'žádný',
    },
    Q4: { no: 'neplatí za AI', one: 'jeden placený nástroj', multi: 'dva a víc placených nástrojů' },
    Q5: {
      long_prompt: 'píše komplexní prompty', chatbot_max: 'využívá chatboty na maximum (projekty, deep research)',
      vibecoding: 'vibecoduje vlastní aplikace', automation: 'staví automatizace',
      agent: 'buduje agenty / asistenty na delegování úkolů',
      custom_gpt: 'staví custom GPT', own_data: 'pracuje s vlastními daty', api: 'volá API přímo',
      none: 'nic z pokročilých technik',
    },
    Q8: {
      hallucinations: 'halucinace / chybné odpovědi', privacy: 'soukromí a data',
      jobs: 'dopad na pracovní místa', authenticity: 'autenticita a důvěra v obsah',
      dependency: 'závislost na AI', ethics: 'etické otázky', safety: 'bezpečnost a zneužití',
      unknown: 'strach z neznámého', ecology: 'ekologická zátěž',
      dependence: 'závislost / atrofie dovedností',
      none: 'žádné výrazné obavy',
    },
    SCALE: { 1: '1 (zcela nesouhlasím)', 2: '2', 3: '3 (neutrálně)', 4: '4', 5: '5 (zcela souhlasím)' },
    QUAD: {
      optimistic_power_user: 'Optimistický power user (pokročilý uživatel, optimismus)',
      realistic_power_user:  'Realistický power user (pokročilý uživatel, skepticky střízlivý postoj)',
      casual_enthusiast:     'Běžný uživatel-nadšenec (základní použití, optimismus)',
      casual_skeptic:        'Běžný uživatel-skeptik (základní použití, skeptický postoj)',
      beginner_enthusiast:   'Začátečník-nadšenec (legacy)',
      beginner_skeptic:      'Začátečník-skeptik (legacy)',
    },
  },
  en: {
    Q1: { never: 'never used AI', lt6m: 'less than 6 months', '6m_2y': '6 months to 2 years', gt2y: 'more than 2 years' },
    Q2: { never: 'never', monthly: 'monthly', weekly: 'weekly', daily: 'daily', always: 'many times a day' },
    Q3: {
      chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', copilot: 'Microsoft Copilot',
      perplexity: 'Perplexity', notebooklm: 'NotebookLM', image: 'image generation',
      audio: 'audio generation', video: 'video generation', other: 'another AI tool',
      internal: 'in-house company AI tool', none: 'none',
    },
    Q4: { no: 'does not pay for any AI', one: 'one paid tool', multi: 'two or more paid tools' },
    Q5: {
      long_prompt: 'writes complex, deliberate prompts',
      chatbot_max: 'pushes chatbots to the max (projects, deep research)',
      vibecoding: 'vibecodes their own apps', automation: 'builds automations',
      agent: 'builds agents / assistants to delegate tasks to',
      custom_gpt: 'builds custom GPTs', own_data: 'works with their own data', api: 'calls APIs directly',
      none: 'none of the advanced techniques',
    },
    Q8: {
      hallucinations: 'hallucinations / false answers', privacy: 'privacy and data',
      jobs: 'job loss', authenticity: 'authenticity and trust in content',
      dependency: 'dependence on AI', ethics: 'ethical questions', safety: 'safety and misuse',
      unknown: 'fear of the unknown', ecology: 'environmental footprint',
      dependence: 'dependence / skill atrophy',
      none: 'no major concerns',
    },
    SCALE: { 1: '1 (strongly disagree)', 2: '2', 3: '3 (neutral)', 4: '4', 5: '5 (strongly agree)' },
    QUAD: {
      optimistic_power_user: 'Optimistic power user (advanced user, optimistic)',
      realistic_power_user:  'Realistic power user (advanced user, skeptical and grounded)',
      casual_enthusiast:     'Casual enthusiast (basic usage, optimistic)',
      casual_skeptic:        'Casual skeptic (basic usage, skeptical)',
      beginner_enthusiast:   'Casual enthusiast (legacy)',
      beginner_skeptic:      'Casual skeptic (legacy)',
    },
  },
};

function buildFeedbackPrompt(a, xFinal, yFinal, quadrant, lang) {
  const L = ANSWER_LABELS[lang] || ANSWER_LABELS.cs;
  const list = (arr, dict) => (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map(v => dict[v] || v).join(', ');

  const q10 = a.q10 || {};
  const animalSelf = String(q10.animalSelf || '').slice(0, 80);
  const reasonSelf = String(q10.reasonSelf || '').slice(0, 400);
  const animalAi   = String(q10.animalAi   || '').slice(0, 80);
  const reasonAi   = String(q10.reasonAi   || '').slice(0, 400);

  if (lang === 'en') {
    return [
      'You are an experienced AI instructor evaluating a workshop participant.',
      'Your task: write two short passages of feedback. Write entirely in English.',
      '',
      '## Hard data from the questionnaire (source of classification)',
      '',
      '- Q1 experience: ' + (L.Q1[a.q1] || a.q1 || '?'),
      '- Q2 frequency: ' + (L.Q2[a.q2] || a.q2 || '?'),
      '- Q3 tools: ' + (list(a.q3, L.Q3) || '—'),
      '- Q4 paid services: ' + (L.Q4[a.q4] || a.q4 || '?'),
      '- Q5 advanced techniques: ' + (list(a.q5, L.Q5) || '—'),
      '- Q6 "Within 5 years AI will match humans in most sophisticated skills": ' + (L.SCALE[a.q6] || '?'),
      '- Q7 "AI will change the world and my life for the better": ' + (L.SCALE[a.q7] || '?'),
      '- Q8 concerns: ' + (list(a.q8, L.Q8) || '—'),
      '- Q9 "AI development and use will need to be strictly regulated and restricted": ' + (L.SCALE[a.q9] || '?'),
      '',
      '## Computed scores (deterministic from Q1–Q9, do not change them)',
      '',
      '- X (experience, 0–100): **' + xFinal + '**',
      '- Y (attitude, 0–100; 50 = neutral): **' + yFinal + '**',
      '- Quadrant: **' + (L.QUAD[quadrant] || quadrant) + '**',
      '',
      '## Soft data — projective animals (Q10)',
      '',
      '- Compares themself to: "' + (animalSelf || '—') + '"',
      '  Reason: ' + (reasonSelf ? '"' + reasonSelf + '"' : '(not given)'),
      '- Compares AI to: "' + (animalAi || '—') + '"',
      '  Reason: ' + (reasonAi ? '"' + reasonAi + '"' : '(not given)'),
      '',
      '## What to write',
      '',
      'Call the tool record_feedback. Address the participant as "you" (informal but respectful).',
      'No filler like "you can clearly see…", "for sure…", "keep up the good work". Be specific, not generic.',
      'You MUST write both fields entirely in English — even if the participant\'s animal answers contain a non-English word, your response stays in English.',
      '',
      '### Field "interpretation" (3–4 sentences, max 700 chars) — HARD ANALYSIS',
      'Based EXCLUSIVELY on Q1–Q9 and the computed quadrant. Do not mix in the animals here.',
      '- Name the user type in one sentence (stay aligned with the quadrant).',
      '- Highlight 1 concrete signal from the answers (e.g. specific tools in Q3, an advanced technique from Q5, a concern from Q8, or a tension between Q6/Q7/Q9).',
      '- Add 1–2 sentences of concrete recommendation for where to take their AI use next — tailored to what they actually do. Must be actionable, not boilerplate.',
      '',
      '### Field "animal_note" (3–4 sentences, max 700 chars) — POETIC REFLECTION',
      'Here you have freedom. Reflect on the RELATIONSHIP between the two animals (self × AI) and connect it with what you know about this person from the hard data. Allow yourself a metaphor, a small theory, a touch of provocation. The goal is to entertain and surprise, not to classify. This is explicitly "soft science" — no claims about the user type, no predictions. Just a poetic punchline.',
      '',
      'Call record_feedback with both fields filled in.',
    ].join('\n');
  }

  // ─── CZ (default) ───
  return [
    'Jsi zkušený lektor AI, který hodnotí účastníka workshopu.',
    'Tvým úkolem je napsat dvě krátké pasáže slovního hodnocení. Piš výhradně česky.',
    '',
    '## Tvrdá data z dotazníku (zdroj klasifikace)',
    '',
    '- Q1 zkušenost: ' + (L.Q1[a.q1] || a.q1 || '?'),
    '- Q2 frekvence: ' + (L.Q2[a.q2] || a.q2 || '?'),
    '- Q3 nástroje: ' + (list(a.q3, L.Q3) || '—'),
    '- Q4 placené služby: ' + (L.Q4[a.q4] || a.q4 || '?'),
    '- Q5 pokročilé techniky: ' + (list(a.q5, L.Q5) || '—'),
    '- Q6 „AI bude do 5 let stejně dobrá jako lidi": ' + (L.SCALE[a.q6] || '?'),
    '- Q7 „AI změní svět i můj život k lepšímu": ' + (L.SCALE[a.q7] || '?'),
    '- Q8 obavy: ' + (list(a.q8, L.Q8) || '—'),
    '- Q9 „Vývoj a používání AI bude třeba tvrdě regulovat a omezovat": ' + (L.SCALE[a.q9] || '?'),
    '',
    '## Vypočítané skóre (deterministicky z Q1–Q9, nehýbej s ním)',
    '',
    '- X (zkušenost, 0–100): **' + xFinal + '**',
    '- Y (postoj, 0–100; 50 = neutrál): **' + yFinal + '**',
    '- Kvadrant: **' + (L.QUAD[quadrant] || quadrant) + '**',
    '',
    '## Měkká data — projektivní zvířata (Q10)',
    '',
    '- Sebe přirovnává k: "' + (animalSelf || '—') + '"',
    '  Důvod: ' + (reasonSelf ? '"' + reasonSelf + '"' : '(neuvedeno)'),
    '- AI přirovnává k: "' + (animalAi || '—') + '"',
    '  Důvod: ' + (reasonAi ? '"' + reasonAi + '"' : '(neuvedeno)'),
    '',
    '## Co napsat',
    '',
    'Vyplň tool record_feedback. Oslovuj účastníka „ty" (neformálně, ale s respektem).',
    'Žádné fráze typu „je vidět, že…", „určitě…", „pokračuj v dobré práci". Buď konkrétní, ne generický.',
    'Obě pole piš výhradně česky — i když účastník napsal zvířata anglicky nebo jinak, ty odpovídáš česky.',
    '',
    '### Pole "interpretation" (3–4 věty, max 700 znaků) — TVRDÁ ANALÝZA',
    'Vychází VÝHRADNĚ z Q1–Q9 a vypočítaného kvadrantu. Zvířata sem nepleť.',
    '- Pojmenuj typ uživatele jednou větou (drž se kvadrantu).',
    '- Vyzdvihni 1 konkrétní signál z odpovědí (např. konkrétní nástroje v Q3, pokročilá technika z Q5, obavy z Q8, nebo rozpor mezi Q6/Q7/Q9).',
    '- Přidej 1–2 věty s konkrétním doporučením, kam dál směřovat používání AI — na míru tomu, co reálně dělá. Doporučení musí být akční, ne floskule.',
    '',
    '### Pole "animal_note" (3–4 věty, max 700 znaků) — POETICKÁ ÚVAHA',
    'Tady máš volnost. Uvažuj nad VZTAHEM mezi oběma zvířaty (sebe × AI) a propoj to s tím, co o člověku víš z tvrdých dat. Můžeš si dovolit metaforu, malou teorii, lehkou provokaci. Cílem je čtenáře pobavit a překvapit, ne klasifikovat. Tohle je explicitně „slabá věda" — žádná tvrzení o typu uživatele, žádné předpovědi. Jen poetická pointa.',
    '',
    'Zavolej tool record_feedback s oběma poli vyplněnými.',
  ].join('\n');
}

// ──────── LLM slovníky + prompt pro v2 ────────

const ANSWER_LABELS_V2 = {
  cs: {
    A1: { never: 'AI skoro nepoužívá', monthly: 'párkrát za měsíc', weekly: 'párkrát týdně', daily: 'denně', always: 'mnohokrát denně, součást práce' },
    A2: {
      writing: 'psaní a úprava textů', summary: 'shrnutí dokumentů a schůzek',
      research: 'rešerše a vyhledávání', translate: 'překlady a cizojazyčná komunikace',
      data: 'analýza dat a tabulek',
      coding: 'programování/skripty', media: 'tvorba obrázků/audia/videa',
      brainstorm: 'brainstorming a druhý názor', none: 'nic',
    },
    A3: {
      long_prompt: 'píše komplexní prompty', chatbot_max: 'využívá chatboty na maximum (projekty, deep research)',
      custom_assistant: 'krmí AI vlastními dokumenty a daty (projekty, znalostní báze)',
      vibecoding: 'vibecoduje vlastní aplikace', automation: 'staví automatizace',
      agent: 'buduje agenty / asistenty', none: 'nic z pokročilých technik',
    },
    A4: { no: 'neplatí za AI', employer: 'neplatí sám, licenci má od zaměstnavatele', one: 'jeden placený nástroj', multi: 'dva a víc placených nástrojů' },
    A5: {
      chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', copilot: 'Microsoft 365 Copilot',
      perplexity: 'Perplexity', notebooklm: 'NotebookLM', coding_agent: 'coding agenti (Claude Code, Cursor)',
      image: 'generování obrázků', audio: 'generování audia',
      video: 'generování videa', other: 'jiný chatbot', none: 'žádný',
    },
    A6: {
      never: 'nedeleguje, vede AI krok za krokem', small: 'deleguje jen drobnosti',
      verify: 'deleguje úkoly, které si umí zkontrolovat', long: 'deleguje i mnohahodinové úkoly',
    },
    B4: {
      hallucinations: 'halucinace / chybné odpovědi', jobs: 'dopad na pracovní místa',
      authenticity: 'autenticita a vlastní myšlení', dependency: 'závislost na AI',
      ethics: 'etické otázky a soukromí', safety: 'bezpečnost a zneužití',
      unknown: 'strach z neznámého', ecology: 'ekologická zátěž', none: 'žádné výrazné obavy',
    },
    C0: { employee: 'zaměstnanec', freelance: 'na volné noze / podniká', none: 'nepracuje / sekci přeskočil(a)' },
    C1: { provided_paid: 'má placené a dostačující nástroje', provided_basic: 'jen základní/omezené nástroje', own_tools: 'firemní nemá, používá vlastní', no_ai: 'AI k práci nepoužívá' },
    C2: { regularly: 'pravidelně používá soukromé účty k práci (shadow AI)', sometimes: 'občas používá soukromé účty k práci', no: 'soukromé účty k práci nepoužívá' },
    LIK: { agree: 'souhlasí', rather_agree: 'spíše souhlasí', dk: 'neví', rather_disagree: 'spíše nesouhlasí', disagree: 'nesouhlasí', na: 'nechce odpovědět' },
    CHIP: {
      curious: 'zvědavé', cautious: 'opatrné', playful: 'hravé', persistent: 'vytrvalé',
      fast: 'rychlé', loyal: 'věrné', independent: 'nezávislé', predator: 'dravé',
      smart: 'chytré', useful: 'užitečné', unpredictable: 'nevyzpytatelné',
      everywhere: 'všudypřítomné', alien: 'cizí a tajemné', dangerous: 'nebezpečné', friendly: 'přátelské',
    },
    SCALE: { 1: '1 (zcela nesouhlasím)', 2: '2', 3: '3 (neutrálně)', 4: '4', 5: '5 (zcela souhlasím)' },
    QUAD: {
      optimistic_power_user: 'Optimistický power user (pokročilý uživatel, optimismus)',
      realistic_power_user:  'Realistický power user (pokročilý uživatel, skepticky střízlivý postoj)',
      casual_enthusiast:     'Běžný uživatel-nadšenec (základní použití, optimismus)',
      casual_skeptic:        'Běžný uživatel-skeptik (základní použití, skeptický postoj)',
    },
  },
  en: {
    A1: { never: 'hardly uses AI', monthly: 'a few times a month', weekly: 'a few times a week', daily: 'daily', always: 'many times a day, part of their work' },
    A2: {
      writing: 'writing and editing text', summary: 'summarising documents and meetings',
      research: 'research and finding information', translate: 'translation and cross-language communication',
      data: 'analysing data and spreadsheets',
      coding: 'programming/scripts', media: 'creating images/audio/video',
      brainstorm: 'brainstorming and second opinions', none: 'nothing',
    },
    A3: {
      long_prompt: 'writes complex, deliberate prompts', chatbot_max: 'pushes chatbots to the max (projects, deep research)',
      custom_assistant: 'feeds AI their own documents and data (projects, knowledge bases)',
      vibecoding: 'vibecodes their own apps', automation: 'builds automations',
      agent: 'builds agents / assistants', none: 'none of the advanced techniques',
    },
    A4: { no: 'does not pay for any AI', employer: 'does not pay personally, has an employer licence', one: 'one paid tool', multi: 'two or more paid tools' },
    A5: {
      chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', copilot: 'Microsoft 365 Copilot',
      perplexity: 'Perplexity', notebooklm: 'NotebookLM', coding_agent: 'coding agents (Claude Code, Cursor)',
      image: 'image generation', audio: 'audio generation',
      video: 'video generation', other: 'another chatbot', none: 'none',
    },
    A6: {
      never: 'does not delegate, guides AI step by step', small: 'delegates only small things',
      verify: 'delegates tasks they can verify', long: 'delegates even multi-hour tasks',
    },
    B4: {
      hallucinations: 'hallucinations / false answers', jobs: 'job loss',
      authenticity: 'authenticity and original thinking', dependency: 'dependence on AI',
      ethics: 'ethics and data privacy', safety: 'safety and misuse',
      unknown: 'fear of the unknown', ecology: 'environmental footprint', none: 'no major concerns',
    },
    C0: { employee: 'an employee', freelance: 'self-employed / runs a business', none: 'not working / skipped the section' },
    C1: { provided_paid: 'has paid and sufficient tools', provided_basic: 'only basic/limited tools', own_tools: 'no company tools, uses their own', no_ai: 'does not use AI for work' },
    C2: { regularly: 'regularly uses private accounts for work (shadow AI)', sometimes: 'sometimes uses private accounts for work', no: 'does not use private accounts for work' },
    LIK: { agree: 'agrees', rather_agree: 'somewhat agrees', dk: 'not sure', rather_disagree: 'somewhat disagrees', disagree: 'disagrees', na: 'prefers not to answer' },
    CHIP: {
      curious: 'curious', cautious: 'cautious', playful: 'playful', persistent: 'persistent',
      fast: 'fast', loyal: 'loyal', independent: 'independent', predator: 'a predator',
      smart: 'smart', useful: 'useful', unpredictable: 'unpredictable',
      everywhere: 'everywhere', alien: 'alien and mysterious', dangerous: 'dangerous', friendly: 'friendly',
    },
    SCALE: { 1: '1 (strongly disagree)', 2: '2', 3: '3 (neutral)', 4: '4', 5: '5 (strongly agree)' },
    QUAD: {
      optimistic_power_user: 'Optimistic power user (advanced user, optimistic)',
      realistic_power_user:  'Realistic power user (advanced user, skeptical and grounded)',
      casual_enthusiast:     'Casual enthusiast (basic usage, optimistic)',
      casual_skeptic:        'Casual skeptic (basic usage, skeptical)',
    },
  },
};

function buildFeedbackPromptV2(a, xFinal, yFinal, quadrant, orgIndex, lang) {
  const L = ANSWER_LABELS_V2[lang] || ANSWER_LABELS_V2.cs;
  const list = function (arr, dict) {
    return (Array.isArray(arr) ? arr : [arr]).filter(Boolean)
      .map(function (v) { return dict[v] || v; }).join(', ');
  };

  const q10 = a.q10 || {};
  const animalSelf = String(q10.animalSelf || '').slice(0, 80);
  const reasonSelf = String(q10.reasonSelf || '').slice(0, 400);
  const animalAi   = String(q10.animalAi   || '').slice(0, 80);
  const reasonAi   = String(q10.reasonAi   || '').slice(0, 400);
  const chipsSelf  = list(q10.chipsSelf, L.CHIP);
  const chipsAi    = list(q10.chipsAi,   L.CHIP);

  const hasOrg = !!a.c0 && a.c0 !== 'none';

  if (lang === 'en') {
    const lines = [
      'You are an experienced AI instructor evaluating a workshop participant.',
      'Your task: write two short passages of feedback. Write entirely in English.',
      '',
      '## Hard data from the questionnaire (source of classification)',
      '',
      '- A1 frequency: ' + (L.A1[a.a1] || a.a1 || '?'),
      '- A2 what they use AI for: ' + (list(a.a2, L.A2) || '—'),
      '- A3 advanced techniques: ' + (list(a.a3, L.A3) || '—'),
      '- A6 delegating whole tasks: ' + (L.A6[a.a6] || a.a6 || '?'),
      '- A4 paid services: ' + (L.A4[a.a4] || a.a4 || '?'),
      '- A5 tools: ' + (list(a.a5, L.A5) || '—'),
      '- B1 "Thanks to AI, my work will get more interesting and better": ' + (L.SCALE[a.b1] || '?'),
      '- B2 "The pace of AI development brings me more joy than worry": ' + (L.SCALE[a.b2] || '?'),
      '- B3 "AI will help society more than harm it": ' + (L.SCALE[a.b3] || '?'),
      '- B4 concerns: ' + (list(a.b4, L.B4) || '—'),
    ];
    if (hasOrg) {
      lines.push('');
      lines.push('## Work context (section C — conditions their organisation creates)');
      lines.push('');
      lines.push('- Works as: ' + (L.C0[a.c0] || a.c0));
      if (a.c1) lines.push('- Tools from employer: ' + (L.C1[a.c1] || a.c1));
      if (a.c2) lines.push('- Private AI accounts for work: ' + (L.C2[a.c2] || a.c2));
      if (a.c3) lines.push('- "It\'s clear what I may do with AI at work": ' + (L.LIK[a.c3] || a.c3));
      if (a.c4) lines.push('- "I have enough support for using AI": ' + (L.LIK[a.c4] || a.c4));
      if (a.c5) lines.push('- "Considering AI is a normal part of our work": ' + (L.LIK[a.c5] || a.c5));
      if (orgIndex !== '') lines.push('- Org readiness index (0–100): ' + orgIndex);
    }
    lines.push(
      '',
      '## Computed scores (deterministic, do not change them)',
      '',
      '- X (practice, 0–100): **' + xFinal + '**',
      '- Y (attitude, 0–100; 50 = neutral): **' + yFinal + '**',
      '- Quadrant: **' + (L.QUAD[quadrant] || quadrant) + '**',
      '',
      '## Soft data — projective animals (Q10)',
      '',
      '- Compares themself to: "' + (animalSelf || '—') + '"',
      '  Tags: ' + (chipsSelf || '(none)'),
      '  Reason: ' + (reasonSelf ? '"' + reasonSelf + '"' : '(not given)'),
      '- Compares AI to: "' + (animalAi || '—') + '"',
      '  Tags: ' + (chipsAi || '(none)'),
      '  Reason: ' + (reasonAi ? '"' + reasonAi + '"' : '(not given)'),
      '',
      '## What to write',
      '',
      'Call the tool record_feedback. Address the participant as "you" (informal but respectful).',
      'No filler like "you can clearly see…", "for sure…", "keep up the good work". Be specific, not generic.',
      'You MUST write both fields entirely in English.',
      '',
      '### Field "interpretation" (3–4 sentences, max 700 chars) — HARD ANALYSIS',
      'Based EXCLUSIVELY on sections A, B' + (hasOrg ? ', C' : '') + ' and the computed quadrant. Do not mix in the animals here.',
      '- Name the user type in one sentence (stay aligned with the quadrant).',
      '- Highlight 1 concrete signal from the answers (a use-case from A2, a technique from A3, a concern from B4' + (hasOrg ? ', or a workplace signal from section C — e.g. shadow AI, missing support' : '') + ').',
      '- Add 1–2 sentences of concrete, actionable recommendation for where to take their AI use next — tailored to what they actually do' + (hasOrg ? ' and to their workplace conditions' : '') + '.',
      '',
      '### Field "animal_note" (3–4 sentences, max 700 chars) — POETIC REFLECTION',
      'Here you have freedom. Reflect on the RELATIONSHIP between the two animals (self × AI), use the tags and reasons, and connect it with what you know about this person from the hard data. Allow yourself a metaphor, a small theory, a touch of provocation. The goal is to entertain and surprise, not to classify. No claims about the user type, no predictions. Just a poetic punchline.',
      '',
      'Call record_feedback with both fields filled in.'
    );
    return lines.join('\n');
  }

  // ─── CZ (default) ───
  const lines = [
    'Jsi zkušený lektor AI, který hodnotí účastníka workshopu.',
    'Tvým úkolem je napsat dvě krátké pasáže slovního hodnocení. Piš výhradně česky.',
    '',
    '## Tvrdá data z dotazníku (zdroj klasifikace)',
    '',
    '- A1 frekvence: ' + (L.A1[a.a1] || a.a1 || '?'),
    '- A2 na co AI používá: ' + (list(a.a2, L.A2) || '—'),
    '- A3 pokročilé techniky: ' + (list(a.a3, L.A3) || '—'),
    '- A6 delegace celých úkolů: ' + (L.A6[a.a6] || a.a6 || '?'),
    '- A4 placené služby: ' + (L.A4[a.a4] || a.a4 || '?'),
    '- A5 nástroje: ' + (list(a.a5, L.A5) || '—'),
    '- B1 „Díky AI bude moje práce zajímavější a lepší": ' + (L.SCALE[a.b1] || '?'),
    '- B2 „Z tempa vývoje AI mám spíš radost než obavy": ' + (L.SCALE[a.b2] || '?'),
    '- B3 „Společnosti AI spíš pomůže, než ublíží": ' + (L.SCALE[a.b3] || '?'),
    '- B4 obavy: ' + (list(a.b4, L.B4) || '—'),
  ];
  if (hasOrg) {
    lines.push('');
    lines.push('## Pracovní kontext (sekce C — podmínky, které vytváří organizace)');
    lines.push('');
    lines.push('- Pracuje jako: ' + (L.C0[a.c0] || a.c0));
    if (a.c1) lines.push('- Nástroje od zaměstnavatele: ' + (L.C1[a.c1] || a.c1));
    if (a.c2) lines.push('- Soukromé AI účty k práci: ' + (L.C2[a.c2] || a.c2));
    if (a.c3) lines.push('- „Je mi jasné, co s AI smím": ' + (L.LIK[a.c3] || a.c3));
    if (a.c4) lines.push('- „Mám k AI dostatečnou podporu": ' + (L.LIK[a.c4] || a.c4));
    if (a.c5) lines.push('- „Zvažování AI je běžnou součástí práce": ' + (L.LIK[a.c5] || a.c5));
    if (orgIndex !== '') lines.push('- Org readiness index (0–100): ' + orgIndex);
  }
  lines.push(
    '',
    '## Vypočítané skóre (deterministicky, nehýbej s ním)',
    '',
    '- X (praxe, 0–100): **' + xFinal + '**',
    '- Y (postoj, 0–100; 50 = neutrál): **' + yFinal + '**',
    '- Kvadrant: **' + (L.QUAD[quadrant] || quadrant) + '**',
    '',
    '## Měkká data — projektivní zvířata (Q10)',
    '',
    '- Sebe přirovnává k: "' + (animalSelf || '—') + '"',
    '  Štítky: ' + (chipsSelf || '(žádné)'),
    '  Důvod: ' + (reasonSelf ? '"' + reasonSelf + '"' : '(neuvedeno)'),
    '- AI přirovnává k: "' + (animalAi || '—') + '"',
    '  Štítky: ' + (chipsAi || '(žádné)'),
    '  Důvod: ' + (reasonAi ? '"' + reasonAi + '"' : '(neuvedeno)'),
    '',
    '## Co napsat',
    '',
    'Vyplň tool record_feedback. Oslovuj účastníka „ty" (neformálně, ale s respektem).',
    'Žádné fráze typu „je vidět, že…", „určitě…", „pokračuj v dobré práci". Buď konkrétní, ne generický.',
    'Obě pole piš výhradně česky.',
    '',
    '### Pole "interpretation" (3–4 věty, max 700 znaků) — TVRDÁ ANALÝZA',
    'Vychází VÝHRADNĚ ze sekcí A, B' + (hasOrg ? ', C' : '') + ' a vypočítaného kvadrantu. Zvířata sem nepleť.',
    '- Pojmenuj typ uživatele jednou větou (drž se kvadrantu).',
    '- Vyzdvihni 1 konkrétní signál z odpovědí (use-case z A2, technika z A3, obava z B4' + (hasOrg ? ', nebo pracovní signál ze sekce C — třeba shadow AI či chybějící podpora' : '') + ').',
    '- Přidej 1–2 věty s konkrétním akčním doporučením, kam dál směřovat používání AI — na míru tomu, co reálně dělá' + (hasOrg ? ' a jaké má v práci podmínky' : '') + '.',
    '',
    '### Pole "animal_note" (3–4 věty, max 700 znaků) — POETICKÁ ÚVAHA',
    'Tady máš volnost. Uvažuj nad VZTAHEM mezi oběma zvířaty (sebe × AI), využij štítky i důvody, a propoj to s tím, co o člověku víš z tvrdých dat. Můžeš si dovolit metaforu, malou teorii, lehkou provokaci. Cílem je čtenáře pobavit a překvapit, ne klasifikovat. Žádná tvrzení o typu uživatele, žádné předpovědi. Jen poetická pointa.',
    '',
    'Zavolej tool record_feedback s oběma poli vyplněnými.'
  );
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════
// SHEET I/O
// ════════════════════════════════════════════════════════════════════════

function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRow(row) {
  const sheet = getSheet();
  sheet.appendRow(row);
}

// v2 tab — vytvoří se sám při prvním submitu (nový tab = žádný ruční
// zásah do hlavičky, na rozdíl od přidávání sloupců do existujícího sheetu)
function getSheetV2() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME_V2);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_V2);
    sheet.appendRow(SHEET_HEADERS_V2);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS_V2);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRowV2(row) {
  getSheetV2().appendRow(row);
}

function readSubmissions(workshopFilter) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length);
  const values = range.getValues();

  const idx = name => SHEET_HEADERS.indexOf(name);
  const points = [];

  values.forEach(row => {
    const wid = String(row[idx('workshop_id')] || '');
    if (workshopFilter && wid !== workshopFilter) return;

    let animalSelf = '', animalAi = '';
    try {
      const ans = JSON.parse(row[idx('answers_json')] || '{}');
      if (ans.q10) {
        animalSelf = ans.q10.animalSelf || '';
        animalAi   = ans.q10.animalAi   || '';
      }
    } catch (e) { /* ignore */ }

    points.push({
      id: row[idx('submission_id')],
      timestamp: row[idx('timestamp')],
      workshop: wid,
      name: row[idx('name')],
      x: row[idx('score_x_final')],
      y: row[idx('score_y_final')],
      archetype: row[idx('archetype')],
      animal_self: animalSelf,
      animal_ai: animalAi,
      animal_note: row[idx('animal_note')] || '',
      interpretation: row[idx('interpretation')] || '',
      outlier: row[idx('outlier_flag')] === true || row[idx('outlier_flag')] === 'TRUE',
    });
  });

  return points;
}

function readSubmissionsV2(workshopFilter) {
  const sheet = getSheetV2();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS_V2.length);
  const values = range.getValues();

  const idx = function (name) { return SHEET_HEADERS_V2.indexOf(name); };
  const points = [];

  values.forEach(function (row) {
    const wid = String(row[idx('workshop_id')] || '');
    if (workshopFilter && wid !== workshopFilter) return;

    let animalSelf = '', animalAi = '';
    try {
      const ans = JSON.parse(row[idx('answers_json')] || '{}');
      if (ans.q10) {
        animalSelf = ans.q10.animalSelf || '';
        animalAi   = ans.q10.animalAi   || '';
      }
    } catch (e) { /* ignore */ }

    points.push({
      id: row[idx('submission_id')],
      timestamp: row[idx('timestamp')],
      workshop: wid,
      name: row[idx('name')],
      x: row[idx('score_x')],
      y: row[idx('score_y')],
      archetype: row[idx('archetype')],
      work_context: row[idx('work_context')] || '',
      org_index: row[idx('org_index')],
      animal_self: animalSelf,
      animal_ai: animalAi,
      animal_note: row[idx('animal_note')] || '',
      interpretation: row[idx('interpretation')] || '',
      outlier: false,
    });
  });

  return points;
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

function capSum(items, weights, cap) {
  const sum = items.reduce((acc, it) => acc + (weights[it] || 0), 0);
  return Math.min(sum, cap);
}

function generateId() {
  // krátké, čitelné, kolizně prakticky neproblematické pro <10k záznamů na workshop
  return Utilities.getUuid().slice(0, 8);
}

// ════════════════════════════════════════════════════════════════════════
// LOCAL TEST — spustit ručně z editoru pro ověření
// ════════════════════════════════════════════════════════════════════════

function testSubmission() {
  const fakePayload = {
    version: '0.1.0',
    workshopId: 'test-' + new Date().toISOString().slice(0, 10),
    name: 'Tester',
    timestamp: new Date().toISOString(),
    durationSec: 180,
    answers: {
      q1: 'gt2y',
      q2: 'always',
      q3: ['chatgpt', 'claude', 'notebooklm', 'image'],
      q4: 'multi',
      q5: ['long_prompt', 'custom_gpt', 'own_data', 'automation'],
      q6: 5,
      q7: 4,
      q8: ['hallucinations'],
      q9: 5,
      q10: {
        animalSelf: 'vlk',
        reasonSelf: 'Mám rád samostatnost a smečka mě motivuje.',
        animalAi: 'chobotnice',
        reasonAi: 'Geniální zvíře, dosáhne všude a má spoustu vlastních mozků.',
      },
    },
    userAgent: 'apps-script-test/1.0',
  };
  const result = processSubmission(fakePayload);
  console.log('Result:', result);
  return result;
}

function testSubmissionV2() {
  const fakePayload = {
    version: '2.0.0',
    formVersion: '2',
    lang: 'cs',
    workshopId: 'test-v2-' + new Date().toISOString().slice(0, 10),
    name: 'Tester',
    timestamp: new Date().toISOString(),
    durationSec: 240,
    answers: {
      a1: 'daily',
      a2: ['writing', 'summary', 'research', 'brainstorm'],
      a3: ['long_prompt', 'chatbot_max'],
      a6: 'verify',
      a4: 'one',
      a5: ['chatgpt', 'claude', 'notebooklm'],
      b1: 4,
      b2: 3,
      b3: 4,
      b4: ['hallucinations', 'authenticity'],
      c0: 'employee',
      c1: 'provided_basic',
      c2: 'sometimes',
      c3: 'rather_disagree',
      c4: 'rather_agree',
      c5: 'dk',
      q10: {
        animalSelf: 'vlk',
        chipsSelf: ['independent', 'persistent'],
        reasonSelf: 'Mám rád samostatnost.',
        animalAi: 'chobotnice',
        chipsAi: ['smart', 'everywhere', 'unpredictable'],
        reasonAi: '',
      },
      q11: { age: '36_45', education: 'vs', field: 'marketing', role: 'specialist', gender: 'male' },
    },
    userAgent: 'apps-script-test/2.0',
  };
  const result = processSubmissionV2(fakePayload);
  console.log('Result:', result);
  return result;
}

// ════════════════════════════════════════════════════════════════════════
// BACKFILL — jednorázové přepočítání X a archetype na všech existujících
// řádcích podle aktuální verze scoreX a deriveQuadrant.
//
// Spustit ručně z Apps Script editoru po deployi nové formule.
// 1. Apps Script editor → vybrat funkci "backfillScores" → Run
// 2. Zkontrolovat log (Cmd+Enter), vypíše počet přepsaných řádků
// 3. Pokud něco nesedí, je k dispozici git tag v0.4-pre-x-rebalance pro rollback kódu
//
// Důležité: backfill čte answers_json a přepisuje score_x_raw, score_x_final
// a archetype. Y (score_y_raw, score_y_final), LLM texty a metadata zůstávají
// beze změny.
// ════════════════════════════════════════════════════════════════════════

function backfillScores() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    console.log('No data rows.');
    return { updated: 0, skipped: 0 };
  }

  const range = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length);
  const values = range.getValues();
  const idx = name => SHEET_HEADERS.indexOf(name);

  let updated = 0;
  let skipped = 0;

  values.forEach((row, i) => {
    const json = row[idx('answers_json')];
    if (!json) { skipped++; return; }

    let a;
    try { a = JSON.parse(json); }
    catch (e) { skipped++; return; }

    const xRaw   = scoreX(a);
    const xFinal = clamp(xRaw, 0, 100);
    const yFinal = row[idx('score_y_final')];   // Y se nemění
    const quadrant = (typeof yFinal === 'number')
      ? deriveQuadrant(xFinal, yFinal)
      : row[idx('archetype')];                   // fallback, kdyby Y chybělo

    row[idx('score_x_raw')]   = xRaw;
    row[idx('score_x_final')] = xFinal;
    row[idx('archetype')]     = quadrant;
    updated++;
  });

  range.setValues(values);
  console.log('Backfill complete. updated=' + updated + ', skipped=' + skipped);
  return { updated, skipped };
}
