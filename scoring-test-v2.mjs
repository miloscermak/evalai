// Lokální test v2 scoringu — kalibrační kotvy z docs/design-v2.md.
// Spustit: node scoring-test-v2.mjs (z root projektu).
//
// Funkce MUSÍ být identické kopie scoreX2 / scoreY2 / orgIndexV2
// z apps-script/webhook.gs. Když se mění váhy, měnit obojí.

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function capSum(items, weights, cap) {
  const sum = items.reduce((acc, it) => acc + (weights[it] || 0), 0);
  return Math.min(sum, cap);
}

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
  const toolCnt = asArray(a.a5).filter(v => v !== 'none').length;
  const tools   = Math.min(toolCnt, 6) / 6;

  return Math.round(30 * breadth + 25 * depth + 20 * deleg + 12 * freq + 8 * paid + 5 * tools);
}

function scoreY2(a) {
  const W = 50 / 6;
  const b1 = a.b1 ? (a.b1 - 3) * W : 0;
  const b2 = a.b2 ? (a.b2 - 3) * W : 0;
  const b3 = a.b3 ? (a.b3 - 3) * W : 0;
  return clamp(Math.round(b1 + b2 + b3), -50, 50);
}

function orgIndexV2(a) {
  const parts = [];
  const C1 = { provided_paid: 1, provided_basic: 0.5, own_tools: 0.25, no_ai: 0 };
  const C2 = { no: 1, sometimes: 0.5, regularly: 0 };
  const LIK = { agree: 1, rather_agree: 0.75, dk: 0.5, rather_disagree: 0.25, disagree: 0 };
  if (C1[a.c1] !== undefined) parts.push(C1[a.c1]);
  if (C2[a.c2] !== undefined) parts.push(C2[a.c2]);
  [a.c3, a.c4, a.c5].forEach(v => { if (LIK[v] !== undefined) parts.push(LIK[v]); });
  if (!parts.length) return '';
  return Math.round(100 * parts.reduce((s, x) => s + x, 0) / parts.length);
}

// ──────── kalibrační persony ────────

const PERSONAS = [
  {
    name: 'Netečný (nikdy AI)',
    expect: { x: [0, 8] },
    a: { a1: 'never', a2: ['none'], a3: ['none'], a6: 'never', a4: 'no', a5: ['none'] },
  },
  {
    name: 'Občasný zkoušeč (měsíčně, 1-2 use-casy)',
    expect: { x: [12, 25] },
    a: { a1: 'monthly', a2: ['writing', 'research'], a3: ['none'], a6: 'small', a4: 'no', a5: ['chatgpt'] },
  },
  {
    name: 'KOTVA X≈50: denní uživatel, 3-4 use-casy, bez pokročilých technik',
    expect: { x: [44, 56] },
    a: { a1: 'daily', a2: ['writing', 'summary', 'research', 'brainstorm'], a3: ['long_prompt'], a6: 'verify', a4: 'one', a5: ['chatgpt', 'gemini', 'copilot'] },
  },
  {
    name: 'KOTVA X≥75: power user (agenti, automatizace, multi paid)',
    expect: { x: [75, 100] },
    a: { a1: 'always', a2: ['writing', 'summary', 'research', 'data', 'coding', 'brainstorm'], a3: ['long_prompt', 'chatbot_max', 'automation', 'agent'], a6: 'long', a4: 'multi', a5: ['chatgpt', 'claude', 'gemini', 'notebooklm', 'perplexity'] },
  },
  {
    name: 'Úzký ale hluboký (vibecoder, málo use-casů)',
    expect: { x: [50, 70] },
    a: { a1: 'daily', a2: ['coding', 'brainstorm'], a3: ['long_prompt', 'vibecoding', 'agent'], a6: 'long', a4: 'multi', a5: ['claude', 'chatgpt'] },
  },
  {
    // firemní Copilot rozdaný plošně: licenci má, ale sám si ji nevybral
    // a nic si netroufne delegovat — musí zůstat pod kotvou X≈50
    name: 'Firemní Copilot uživatel (licence od zaměstnavatele, nedeleguje)',
    expect: { x: [20, 40] },
    a: { a1: 'weekly', a2: ['writing', 'summary', 'translate'], a3: ['none'], a6: 'small', a4: 'employer', a5: ['copilot'] },
  },
  {
    // delegace jako samostatný signál: málo nástrojů, ale pouští práci z ruky
    name: 'Tichý delegátor (jeden nástroj, ale deleguje velké úkoly)',
    expect: { x: [45, 65] },
    a: { a1: 'daily', a2: ['writing', 'summary', 'research', 'data'], a3: ['long_prompt', 'chatbot_max'], a6: 'long', a4: 'one', a5: ['chatgpt'] },
  },
  {
    name: 'Optimista bez obav',
    expect: { y: [85, 100] },
    a: { b1: 5, b2: 5, b3: 5, b4: ['none'] },
  },
  {
    // b4 do Y nevstupuje → neutrál je přesně 50 bez ohledu na počet obav
    name: 'Neutrál se 2 obavami',
    expect: { y: [50, 50] },
    a: { b1: 3, b2: 3, b3: 3, b4: ['hallucinations', 'dependency'] },
  },
  {
    name: 'Pesimista se 3 obavami',
    expect: { y: [0, 20] },
    a: { b1: 1, b2: 1, b3: 2, b4: ['jobs', 'safety', 'authenticity'] },
  },
  {
    name: 'Realista: osobně pro, společensky skeptik',
    expect: { y: [40, 60] },
    a: { b1: 4, b2: 3, b3: 2, b4: ['authenticity', 'dependency'] },
  },
  {
    name: 'Org: ideální firma',
    expect: { org: [95, 100] },
    a: { c0: 'employee', c1: 'provided_paid', c2: 'no', c3: 'agree', c4: 'agree', c5: 'agree' },
  },
  {
    name: 'Org: typická nepřipravená firma (shadow AI, nejasná pravidla)',
    expect: { org: [15, 35] },
    a: { c0: 'employee', c1: 'own_tools', c2: 'regularly', c3: 'rather_disagree', c4: 'disagree', c5: 'rather_disagree' },
  },
  {
    name: 'Org: sekce přeskočena',
    expect: { org: [null, null] },
    a: { c0: 'none' },
  },
];

let failures = 0;
for (const p of PERSONAS) {
  const x = scoreX2(p.a);
  const yRaw = scoreY2(p.a);
  const y = clamp(yRaw + 50, 0, 100);
  const org = orgIndexV2(p.a);

  const checks = [];
  if (p.expect.x)   checks.push(['X', x, p.expect.x]);
  if (p.expect.y)   checks.push(['Y', y, p.expect.y]);
  if (p.expect.org) checks.push(['Org', org, p.expect.org]);

  let ok = true;
  const notes = [];
  for (const [label, val, [lo, hi]] of checks) {
    if (lo === null) {
      if (val !== '') { ok = false; notes.push(`${label}=${val}, čekáno prázdné`); }
      else notes.push(`${label}=∅ ✓`);
    } else if (val < lo || val > hi) {
      ok = false;
      notes.push(`${label}=${val} MIMO [${lo}-${hi}]`);
    } else {
      notes.push(`${label}=${val} ✓ [${lo}-${hi}]`);
    }
  }
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${p.name}: ${notes.join(', ')}`);
}

console.log(failures === 0 ? '\nVšechny kotvy sedí.' : `\n${failures} kotev MIMO rozsah — přepočítat váhy!`);
process.exit(failures === 0 ? 0 : 1);
