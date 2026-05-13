// Lokální test scoring funkcí — ověření proti validační tabulce v docs/design.md sekce 5.
// Spustit: node scoring-test.mjs (z root projektu).
// Tento soubor není v gitu — slouží jen pro ad-hoc kontrolu.
//
// Verze 2026-05-13: dvousložkový X (Core 0.7 / Bonus 0.3). Viz scoreX dole
// a komentář ve webhook.gs. Y se nemění.

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function capSum(items, weights, cap) {
  const sum = items.reduce((acc, it) => acc + (weights[it] || 0), 0);
  return Math.min(sum, cap);
}

function scoreX(a) {
  const Q1 = { never: 0, lt6m: 10, '6m_2y': 25, gt2y: 40 };
  const Q2 = { never: 0, monthly: 10, weekly: 20, daily: 35, always: 50 };
  const Q3_TOOLS = {
    chatgpt: 5, claude: 5, gemini: 5, copilot: 5, perplexity: 5,
    notebooklm: 10, image: 10, audio: 10, video: 10,
    other: 8, internal: 8, // legacy alias
    none: 0,
  };
  const Q4 = { no: 0, one: 20, multi: 40 };
  const Q5_ACTS = {
    long_prompt: 10, chatbot_max: 15, vibecoding: 20, automation: 20, agent: 25,
    custom_gpt: 15, own_data: 15, api: 20, // legacy aliases
    none: 0,
  };
  const q1 = Q1[a.q1] || 0;
  const q2 = Q2[a.q2] || 0;
  const q3 = capSum(asArray(a.q3), Q3_TOOLS, 60);
  const q4 = Q4[a.q4] || 0;
  const q5 = capSum(asArray(a.q5), Q5_ACTS, 90);
  const corePct  = (q1 + q2 + q4) / 130 * 100;
  const bonusPct = (q3 + q5)      / 150 * 100;
  return Math.round(0.7 * corePct + 0.3 * bonusPct);
}

function scoreY(a) {
  // Q6 — "AI bude do 5 let stejně dobrá jako lidi" — slabě pozitivní (±10)
  const q6 = a.q6 ? (a.q6 - 3) * 5 : 0;
  // Q7 — "AI změní svět k lepšímu" — silně pozitivní (±20)
  const q7 = a.q7 ? (a.q7 - 3) * 10 : 0;
  // Q8 — concerns
  const concerns = asArray(a.q8);
  let q8;
  if (concerns.length === 1 && concerns[0] === 'none') q8 = 5;
  else q8 = -3 * concerns.filter(c => c !== 'none').length;
  // Q9 — "AI bude regulována jako drogy" — OBRÁCENÝ směr (±10)
  const q9 = a.q9 ? (3 - a.q9) * 5 : 0;
  return clamp(q6 + q7 + q8 + q9, -50, 50);
}

// Test cases podle design.md sekce 5 — odpovědi přepočítané na novou
// sémantiku Q6/Q7/Q9. Konkrétní hodnoty Q6/Q7/Q9 jsou odhad, jak by daný
// člověk reálně odpověděl, ne mechanický překlad ze starého scoringu.

const TESTS = [
  {
    name: 'Senta (optimistic power user)',
    expected: { x: '~85', y: '~+35' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini', 'notebooklm', 'image', 'audio'],
      q4: 'multi',
      q5: ['long_prompt', 'chatbot_max', 'automation'],
      q6: 4,                        // AI = lidi: spíš souhlasí
      q7: 5,                        // změní svět k lepšímu: zcela souhlasí
      q8: ['hallucinations'],
      q9: 2,                        // regulace: spíš nesouhlasí (= optimismus)
    },
  },
  {
    name: 'Tomáš IT',
    expected: { x: '~95', y: '~+30' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'notebooklm', 'image', 'audio', 'other'],
      q4: 'multi',
      q5: ['long_prompt', 'chatbot_max', 'vibecoding', 'automation', 'agent'],
      q6: 4, q7: 4, q8: ['hallucinations', 'safety'], q9: 3,
    },
  },
  {
    name: 'Pavel Innovation (realistic power user, AI zima)',
    expected: { x: '~85', y: '~-5' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini'],
      q4: 'multi',
      q5: ['long_prompt', 'chatbot_max', 'automation'],
      q6: 4,                        // AI silná — souhlasí
      q7: 2,                        // ale změní svět k lepšímu? spíš ne
      q8: ['hallucinations', 'safety', 'authenticity'],
      q9: 4,                        // regulace přijde — souhlasí (= pesimismus)
    },
  },
  {
    name: 'Lukáš stavař (beginner enthusiast)',
    expected: { x: '~25', y: '~+20' },
    answers: {
      q1: 'lt6m', q2: 'weekly',
      q3: ['chatgpt'],
      q4: 'no',
      q5: ['long_prompt'],
      q6: 4, q7: 4, q8: ['none'], q9: 3,
    },
  },
  {
    name: 'Saša (beginner skeptic)',
    expected: { x: '~5', y: '~-25' },
    answers: {
      q1: 'never', q2: 'never',
      q3: ['none'],
      q4: 'no',
      q5: ['none'],
      q6: 2, q7: 1, q8: ['unknown', 'authenticity'], q9: 5,
    },
  },
  {
    name: 'Andrea ČSOB (beginner skeptic + ekologie)',
    expected: { x: '~5', y: '~-30' },
    answers: {
      q1: 'never', q2: 'never',
      q3: ['none'],
      q4: 'no',
      q5: ['none'],
      q6: 2, q7: 1, q8: ['ecology', 'authenticity', 'dependency'], q9: 5,
    },
  },
];

console.log('Scoring validation (data tečka × očekávání z design.md):');
console.log('─'.repeat(78));
for (const t of TESTS) {
  const x = scoreX(t.answers);
  const y = scoreY(t.answers);
  const yNorm = clamp(y + 50, 0, 100);
  console.log(t.name);
  console.log(`  očekávané:  X=${t.expected.x}  Y=${t.expected.y}`);
  console.log(`  spočtené:   X=${x}  Y_raw=${y}  Y_norm(0-100)=${yNorm}`);
  console.log('');
}
