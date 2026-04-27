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

const SPREADSHEET_ID = '<<PASTE_YOUR_SHEET_ID_HERE>>';
const SHEET_NAME = 'submissions';

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// header row pro sheet — pořadí MUSÍ odpovídat appendRow níž
const SHEET_HEADERS = [
  'submission_id', 'timestamp', 'workshop_id', 'name', 'duration_sec',
  'answers_json',
  'score_x_raw', 'score_y_raw',
  'archetype', 'animal_x_mod', 'animal_y_mod', 'animal_note',
  'score_x_final', 'score_y_final', 'outlier_flag',
  'user_agent', 'version',
];

// ════════════════════════════════════════════════════════════════════════
// HTTP HANDLERS
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result  = processSubmission(payload);
    return jsonResponse({ ok: true, id: result.submission_id });
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
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

  // animal modifikátor přes Claude API
  let animal = { x_mod: 0, y_mod: 0, archetype: '', note: '' };
  try {
    if (a.q10) animal = scoreAnimal(a.q10);
  } catch (err) {
    console.warn('Claude API call failed, falling back to neutral:', err);
    animal.note = '[Claude API error: ' + err + ']';
  }

  const xFinal = clamp(xRaw + animal.x_mod, 0, 100);
  // Y_raw je v rozsahu cca -50..+50 → normalizace na 0..100 pro dashboard
  const yNorm = clamp(yRaw + 50, 0, 100);
  const yFinal = clamp(yNorm + animal.y_mod, 0, 100);

  // outlier: animal posunul Y o víc než 15 bodů — stojí za pohovor
  const outlier = Math.abs(animal.y_mod) >= 8;

  const submission_id = generateId();

  const row = [
    submission_id,
    payload.timestamp || new Date().toISOString(),
    payload.workshopId || '',
    payload.name || '',
    payload.durationSec || '',
    JSON.stringify(a),
    xRaw, yRaw,
    animal.archetype, animal.x_mod, animal.y_mod, animal.note,
    xFinal, yFinal, outlier,
    (payload.userAgent || '').slice(0, 200),
    payload.version || '',
  ];

  appendRow(row);

  return { submission_id, score_x: xFinal, score_y: yFinal, archetype: animal.archetype };
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
    internal: 8,
    none: 0,
  };
  const Q4 = { no: 0, one: 20, multi: 40 };
  const Q5_ACTS = {
    long_prompt: 10, custom_gpt: 15, own_data: 15,
    automation: 20, api: 15,
    none: 0,
  };

  const q1 = Q1[a.q1] || 0;
  const q2 = Q2[a.q2] || 0;
  const q3 = capSum(asArray(a.q3), Q3_TOOLS, 60);
  const q4 = Q4[a.q4] || 0;
  const q5 = capSum(asArray(a.q5), Q5_ACTS, 75);

  const sum = q1 + q2 + q3 + q4 + q5;        // max 265
  return Math.round((sum / 265) * 100);
}

// ════════════════════════════════════════════════════════════════════════
// SCORING — Y (postoj, -50 až +50)
// ════════════════════════════════════════════════════════════════════════

function scoreY(a) {
  // Q6 — 1..5 lineárně −20..+20
  const q6 = a.q6 ? (a.q6 - 3) * 10 : 0;

  // Q7 — kategorie
  const Q7 = {
    trust:      0,
    skim:       5,
    verify:    10,
    rewrite:   -5,
    disappoint: -15,
  };
  const q7 = Q7[a.q7] || 0;

  // Q8 — počet negativních obav × −3, "none" = +5
  const concerns = asArray(a.q8);
  let q8;
  if (concerns.length === 1 && concerns[0] === 'none') {
    q8 = 5;
  } else {
    const negativeCount = concerns.filter(c => c !== 'none').length;
    q8 = -3 * negativeCount;
  }

  // Q9 — 1..5 lineárně −10..+10
  const q9 = a.q9 ? (a.q9 - 3) * 5 : 0;

  return clamp(q6 + q7 + q8 + q9, -50, 50);
}

// ════════════════════════════════════════════════════════════════════════
// SCORING — Animal (Claude API)
// ════════════════════════════════════════════════════════════════════════

function scoreAnimal(q10) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY není v Script Properties.');
  }

  const animalSelf = String(q10.animalSelf || '').slice(0, 60);
  const reasonSelf = String(q10.reasonSelf || '').slice(0, 400);
  const animalAi   = String(q10.animalAi   || '').slice(0, 60);
  const reasonAi   = String(q10.reasonAi   || '').slice(0, 400);

  const prompt = buildClaudePrompt(animalSelf, reasonSelf, animalAi, reasonAi);

  const response = UrlFetchApp.fetch(CLAUDE_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error('Claude API ' + code + ': ' + body.slice(0, 200));
  }

  const data = JSON.parse(body);
  const text = (data.content && data.content[0] && data.content[0].text) || '';

  // Claude vrátí JSON v bloku — vytáhneme ho regexem
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Claude nevrátil JSON: ' + text.slice(0, 200));
  }

  const parsed = JSON.parse(match[0]);
  return {
    x_mod:     clamp(parsed.animal_x_mod || 0, -5, 5),
    y_mod:     clamp(parsed.animal_y_mod || 0, -10, 10),
    archetype: String(parsed.archetype || '').slice(0, 80),
    note:      String(parsed.note      || '').slice(0, 300),
  };
}

function buildClaudePrompt(animalSelf, reasonSelf, animalAi, reasonAi) {
  return [
    'Jsi expert na kvalitativní kódování projektivních přirovnání.',
    'Účastník workshopu o AI uvedl tato přirovnání:',
    '',
    '— K jakému zvířeti přirovnává sebe: "' + animalSelf + '"',
    '  Důvod: "' + reasonSelf + '"',
    '',
    '— K jakému zvířeti přirovnává AI: "' + animalAi + '"',
    '  Důvod: "' + reasonAi + '"',
    '',
    'Tvůj úkol: vrať JEDEN JSON objekt s těmito klíči:',
    '',
    '  animal_x_mod: integer od -5 do +5',
    '    Modifikátor osy X (zkušenost / agency vůči AI).',
    '    Pravidla:',
    '    +3 až +5: dravec/inteligent (lev, tygr, vlk, žralok, sova, krkavec) S důvodem o agenci, ovládání, dravosti.',
    '    +1 až +2: velcí inteligentní (slon, kůň) nebo jasně sebevědomé přirovnání.',
    '    0: pes, kočka (nejčastější neutrální volby), bobr, mravenec.',
    '    -1 až -3: pomalí/opatrní (želva, hroch, krtek, lenochod) — pasivita, opatrnost.',
    '    -3 až -5: plyšáci/mazlíčci (mopsík, plyšový méďa, "chlupatá kočka") — zranitelnost, malá agency.',
    '    Důvod má prioritu nad druhem zvířete.',
    '',
    '  animal_y_mod: integer od -10 do +10',
    '    Modifikátor osy Y (postoj k AI — pesimismus/optimismus).',
    '    Pravidla:',
    '    +6 až +10: pomáhající druzi (parťák, věrný pes, asistenční pes, delfín jako přítel, moudrá želva, slon-paměť).',
    '    +1 až +5: kolektivní inteligence (mraveniště, úl) jako fascinace, ne hrozba.',
    '    0: chobotnice/kraken s neutrálním nebo "geniální" popisem (oblíbená neutrální default volba).',
    '    -1 až -3: apex predator (tygr, lev, drak) jako "síla, kterou je třeba respektovat".',
    '    -4 až -6: chytří podvodníci (liška, chameleon, krkavec, had) s důvodem o nedůvěře, "lživosti", vychytralosti.',
    '    -7 až -10: mýtické nebezpečné nebo existenciální (krakatice "co sežere parník", sedmihlavý drak, Lucifer, HAL 9000, Eva z Ex Machina, mloci z Čapka, virus, "šílený zhluk buněk", chobotnice s důvodem o "strkání prstů kam nemá", neovládatelnost).',
    '    POZOR: stejné zvíře (typicky chobotnice) může být +0 i -7 podle důvodu.',
    '    POZOR: chytrá AI = pozitivní jen pokud důvod naznačuje partnerství; pokud "zaskočí" nebo "vychytralá", je to negativní.',
    '',
    '  archetype: jeden ze stringů:',
    '    "optimistic_power_user", "realistic_power_user", "pragmatic_user",',
    '    "beginner_enthusiast", "beginner_skeptic", "manager_proxy", "unclear"',
    '',
    '  note: jedna stručná věta v češtině (max 200 znaků), proč jsi modifikátor takhle určil.',
    '    Cituj klíčové slovo z důvodu, ne jen druh zvířete.',
    '',
    'PRAVIDLO ROZPORU: pokud druh zvířete a důvod ukazují jinam, řiď se důvodem.',
    'PRAVIDLO STRUČNOSTI: vrať POUZE JSON, žádný další text před ani po.',
    '',
    'Příklad výstupu:',
    '{"animal_x_mod": 3, "animal_y_mod": -8, "archetype": "realistic_power_user", "note": "Vlk smečky + sedmihlavý drak \\"plyje oheň\\" — vysoká agency, ale výrazný strach z autonomie AI."}',
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
      q7: 'verify',
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
