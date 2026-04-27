// Lokální test scoring funkcí — ověření proti validační tabulce v docs/design.md sekce 5.
// Spustit: node scoring-test.mjs (z root projektu).
// Tento soubor není v gitu — slouží jen pro ad-hoc kontrolu.

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
    internal: 8, none: 0,
  };
  const Q4 = { no: 0, one: 20, multi: 40 };
  const Q5_ACTS = {
    long_prompt: 10, custom_gpt: 15, own_data: 15,
    automation: 20, api: 15, none: 0,
  };
  const q1 = Q1[a.q1] || 0;
  const q2 = Q2[a.q2] || 0;
  const q3 = capSum(asArray(a.q3), Q3_TOOLS, 60);
  const q4 = Q4[a.q4] || 0;
  const q5 = capSum(asArray(a.q5), Q5_ACTS, 75);
  return Math.round(((q1 + q2 + q3 + q4 + q5) / 265) * 100);
}

function scoreY(a) {
  const q6 = a.q6 ? (a.q6 - 3) * 10 : 0;
  // Q7 — vnímaná kvalita AI v oboru, scale 1..5 → −14..+14
  const q7 = a.q7 ? (a.q7 - 3) * 7 : 0;
  const concerns = asArray(a.q8);
  let q8;
  if (concerns.length === 1 && concerns[0] === 'none') q8 = 5;
  else q8 = -3 * concerns.filter(c => c !== 'none').length;
  const q9 = a.q9 ? (a.q9 - 3) * 5 : 0;
  return clamp(q6 + q7 + q8 + q9, -50, 50);
}

const TESTS = [
  {
    name: 'Senta (optimistic power user)',
    expected: { x: '~85', y: '~+35' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini', 'notebooklm', 'image', 'audio'],
      q4: 'multi',
      q5: ['long_prompt', 'custom_gpt', 'own_data', 'automation'],
      q6: 5, q7: 4, q8: ['hallucinations'], q9: 5,
    },
  },
  {
    name: 'Tomáš IT',
    expected: { x: '~95', y: '~+30' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'notebooklm', 'image', 'audio', 'internal'],
      q4: 'multi',
      q5: ['long_prompt', 'custom_gpt', 'own_data', 'automation', 'api'],
      q6: 5, q7: 4, q8: ['hallucinations', 'safety'], q9: 5,
    },
  },
  {
    name: 'Pavel Innovation (realistic power user, AI zima)',
    expected: { x: '~85', y: '~-5' },
    answers: {
      q1: 'gt2y', q2: 'always',
      q3: ['chatgpt', 'claude', 'gemini'],
      q4: 'multi',
      q5: ['long_prompt', 'custom_gpt', 'own_data'],
      q6: 3, q7: 2, q8: ['hallucinations', 'safety', 'authenticity'], q9: 4,
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
      q6: 4, q7: 4, q8: ['none'], q9: 4,
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
      q6: 2, q7: 1, q8: ['unknown', 'authenticity'], q9: 2,
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
      q6: 2, q7: 1, q8: ['ecology', 'authenticity', 'dependency'], q9: 2,
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
