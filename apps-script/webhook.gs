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
const SHEET_NAME = 'submissions';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// header row pro sheet — pořadí MUSÍ odpovídat appendRow níž
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

// ════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result  = processSubmission(payload);
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
    const data = readSubmissions(workshop);
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

  const xRaw = scoreX(a);
  const yRaw = scoreY(a);

  // Tvrdý scoring → finální pozice. Zvířata na X/Y NEMAJÍ vliv.
  const xFinal = clamp(xRaw, 0, 100);
  const yFinal = clamp(yRaw + 50, 0, 100);  // yRaw je -50..+50, normalizujeme na 0..100
  const quadrant = deriveQuadrant(xFinal, yFinal);

  // Claude píše dvě textová pole: tvrdé hodnocení dotazníku + měkkou
  // poetickou úvahu nad kombinací zvířat. Žádné modifikátory, žádný
  // alternativní archetype. Pokud API selže, použijeme prázdné stringy.
  let llm = { interpretation: '', animal_note: '' };
  try {
    llm = generateFeedback(a, xFinal, yFinal, quadrant);
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
  if (x <  50 && y >= 50) return 'beginner_enthusiast';
  return 'beginner_skeptic';
}

// ════════════════════════════════════════════════════════════════════════
// SCORING — X (zkušenost, 0-100)
// ════════════════════════════════════════════════════════════════════════

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

  const sum = q1 + q2 + q3 + q4 + q5;        // max 280
  return Math.round((sum / 280) * 100);
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

  // Q9 — "AI bude regulována jako drogy"
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

function generateFeedback(answers, xFinal, yFinal, quadrant) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY není v Script Properties.');
  }

  const prompt = buildFeedbackPrompt(answers, xFinal, yFinal, quadrant);

  const tool = {
    name: 'record_feedback',
    description: 'Zaznamenej slovní hodnocení účastníka — interpretaci dotazníku a poetickou úvahu nad zvířaty.',
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

function buildFeedbackPrompt(a, xFinal, yFinal, quadrant) {
  // Lidsky čitelné popisky odpovědí pro Claude (ať si nemusí domýšlet kódy).
  const Q1 = { never: 'AI nikdy nepoužil(a)', lt6m: 'méně než 6 měsíců', '6m_2y': '6 měsíců až 2 roky', gt2y: 'víc než 2 roky' };
  const Q2 = { never: 'nepoužívá', monthly: 'měsíčně', weekly: 'týdně', daily: 'denně', always: 'několikrát denně' };
  const Q3 = {
    chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', copilot: 'Microsoft Copilot',
    perplexity: 'Perplexity', notebooklm: 'NotebookLM', image: 'generování obrázků',
    audio: 'generování audia', video: 'generování videa', other: 'jiný AI nástroj',
    internal: 'vlastní firemní AI nástroj', none: 'žádný',
  };
  const Q4 = { no: 'jen text', one: 'jednu modalitu navíc', multi: 'více modalit (obrázek/audio/video/data)' };
  const Q5 = {
    long_prompt: 'píše komplexní prompty', chatbot_max: 'využívá chatboty na maximum (projekty, deep research)',
    vibecoding: 'vibecoduje vlastní aplikace', automation: 'staví automatizace',
    agent: 'buduje agenty / asistenty na delegování úkolů',
    custom_gpt: 'staví custom GPT', own_data: 'pracuje s vlastními daty', api: 'volá API přímo',
    none: 'nic z pokročilých technik',
  };
  const Q8 = {
    hallucinations: 'halucinace / chybné odpovědi', privacy: 'soukromí a data',
    jobs: 'dopad na pracovní místa', authenticity: 'autenticita a důvěra v obsah',
    ethics: 'etické otázky', dependence: 'závislost / atrofie dovedností',
    none: 'žádné výrazné obavy',
  };
  const SCALE = { 1: '1 (zcela nesouhlasím)', 2: '2', 3: '3 (neutrálně)', 4: '4', 5: '5 (zcela souhlasím)' };

  const list = (arr, dict) => (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map(v => dict[v] || v).join(', ');

  const q10 = a.q10 || {};
  const animalSelf = String(q10.animalSelf || '').slice(0, 80);
  const reasonSelf = String(q10.reasonSelf || '').slice(0, 400);
  const animalAi   = String(q10.animalAi   || '').slice(0, 80);
  const reasonAi   = String(q10.reasonAi   || '').slice(0, 400);

  const QUAD_LABEL = {
    optimistic_power_user: 'Optimistický power user (vysoká zkušenost, optimismus)',
    realistic_power_user:  'Realistický power user (vysoká zkušenost, skepticky střízlivý postoj)',
    beginner_enthusiast:   'Začátečník-nadšenec (nízká zkušenost, optimismus)',
    beginner_skeptic:      'Začátečník-skeptik (nízká zkušenost, skeptický postoj)',
  };

  return [
    'Jsi zkušený lektor AI, který hodnotí účastníka workshopu.',
    'Tvým úkolem je napsat dvě krátké pasáže slovního hodnocení.',
    '',
    '## Tvrdá data z dotazníku (zdroj klasifikace)',
    '',
    '- Q1 zkušenost: ' + (Q1[a.q1] || a.q1 || '?'),
    '- Q2 frekvence: ' + (Q2[a.q2] || a.q2 || '?'),
    '- Q3 nástroje: ' + (list(a.q3, Q3) || '—'),
    '- Q4 modality: ' + (Q4[a.q4] || a.q4 || '?'),
    '- Q5 pokročilé techniky: ' + (list(a.q5, Q5) || '—'),
    '- Q6 „AI bude do 5 let stejně dobrá jako lidi": ' + (SCALE[a.q6] || '?'),
    '- Q7 „AI změní svět i můj život k lepšímu": ' + (SCALE[a.q7] || '?'),
    '- Q8 obavy: ' + (list(a.q8, Q8) || '—'),
    '- Q9 „AI by měla být regulována jako drogy": ' + (SCALE[a.q9] || '?'),
    '',
    '## Vypočítané skóre (deterministicky z Q1–Q9, nehýbej s ním)',
    '',
    '- X (zkušenost, 0–100): **' + xFinal + '**',
    '- Y (postoj, 0–100; 50 = neutrál): **' + yFinal + '**',
    '- Kvadrant: **' + (QUAD_LABEL[quadrant] || quadrant) + '**',
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
