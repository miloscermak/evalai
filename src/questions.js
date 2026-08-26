/* EvalAI — struktura otázek VERZE 2 (podzim 2026, firemní)
 *
 * Textové labely jsou v src/i18n.js. Render v app.js skládá klíče podle
 * id otázky a value odpovědi, např. t('a1.opt.daily'). Pro likertová
 * tvrzení se používá sdílený prefix (optKeyPrefix: 'likert').
 *
 * Nové vlastnosti oproti v1 (podporuje je app.js):
 *   - showIf:    { q: 'c0', notIn: ['none'] } — otázka se přeskočí,
 *                pokud odpověď na c0 je v seznamu notIn (nebo není v "in")
 *   - variantOn: { q: 'c0', value: 'freelance', suffix: 'Freelance' } —
 *                titulek se vezme z klíče '<id>.title<suffix>'
 *   - optKeyPrefix: sdílené labely možností (likertova škála)
 *   - chips na q10: rychlé štítky "proč" k oběma zvířatům
 *
 * Stará verze dotazníku je zmrazená v src/questions-v1.js (stránka /v1).
 * Změna struktury MUSÍ jít ruku v ruce s úpravou:
 *   - i18n.js (CZ + EN texty)
 *   - apps-script/webhook.gs (scoring v2 + LLM label slovníky)
 */

window.EVALAI_FORM_VERSION = '2';

window.EVALAI_QUESTIONS = [
  // ──────── A — praxe s AI (osa X) ────────
  {
    id: 'a1',
    sectionKey: 'sections.experience',
    n: 1,
    type: 'single',
    options: [
      { value: 'never' },
      { value: 'monthly' },
      { value: 'weekly' },
      { value: 'daily' },
      { value: 'always' },
    ],
  },
  {
    id: 'a2',
    sectionKey: 'sections.experience',
    n: 2,
    type: 'multi',
    options: [
      { value: 'writing' },
      { value: 'summary' },
      { value: 'research' },
      { value: 'translate' },
      { value: 'data' },
      { value: 'coding' },
      { value: 'media' },
      { value: 'brainstorm' },
      { value: 'none', exclusive: true },
    ],
  },
  {
    id: 'a3',
    sectionKey: 'sections.experience',
    n: 3,
    type: 'multi',
    options: [
      { value: 'long_prompt' },
      { value: 'chatbot_max' },
      { value: 'custom_assistant' },
      { value: 'vibecoding' },
      { value: 'automation' },
      { value: 'agent' },
      { value: 'none', exclusive: true },
    ],
  },
  {
    // míra delegace — nejsilnější diskriminátor 2026: ne "kolik nástrojů znáš",
    // ale "kolik práce si troufneš pustit z ruky". Id je a6, protože a4/a5
    // existují ve starých datech; pořadí v poli určuje pořadí na obrazovce.
    id: 'a6',
    sectionKey: 'sections.experience',
    n: 4,
    type: 'single',
    options: [
      { value: 'never' },
      { value: 'small' },
      { value: 'verify' },
      { value: 'long' },
    ],
  },
  {
    id: 'a4',
    sectionKey: 'sections.experience',
    n: 5,
    type: 'single',
    options: [
      { value: 'no' },
      { value: 'employer' },
      { value: 'one' },
      { value: 'multi' },
    ],
  },
  {
    id: 'a5',
    sectionKey: 'sections.experience',
    n: 6,
    type: 'multi',
    options: [
      { value: 'chatgpt' },
      { value: 'claude' },
      { value: 'gemini' },
      { value: 'copilot' },
      { value: 'perplexity' },
      { value: 'notebooklm' },
      { value: 'coding_agent' },
      { value: 'image' },
      { value: 'audio' },
      { value: 'other' },
      { value: 'none', exclusive: true },
    ],
  },

  // ──────── B — postoj (osa Y) ────────
  {
    id: 'b1',
    sectionKey: 'sections.attitude',
    n: 7,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'b2',
    sectionKey: 'sections.attitude',
    n: 8,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'b3',
    sectionKey: 'sections.attitude',
    n: 9,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'b4',
    sectionKey: 'sections.attitude',
    n: 10,
    type: 'multi',
    maxSelections: 3,
    options: [
      { value: 'hallucinations' },
      { value: 'jobs' },
      { value: 'authenticity' },
      { value: 'dependency' },
      { value: 'ethics' },
      { value: 'safety' },
      { value: 'unknown' },
      { value: 'ecology' },
      { value: 'none', exclusive: true },
    ],
  },

  // ──────── C — organizace (5E-lite, firemní index) ────────
  {
    id: 'c0',
    sectionKey: 'sections.org',
    n: 11,
    type: 'single',
    options: [
      { value: 'employee' },
      { value: 'freelance' },
      { value: 'none' },
    ],
  },
  {
    id: 'c1',
    sectionKey: 'sections.org',
    n: 12,
    type: 'single',
    showIf: { q: 'c0', notIn: ['none'] },
    variantOn: { q: 'c0', value: 'freelance', suffix: 'Freelance' },
    options: [
      { value: 'provided_paid' },
      { value: 'provided_basic' },
      { value: 'own_tools' },
      { value: 'no_ai' },
    ],
  },
  {
    id: 'c2',
    sectionKey: 'sections.org',
    n: 13,
    type: 'single',
    showIf: { q: 'c0', notIn: ['none'] },
    options: [
      { value: 'regularly' },
      { value: 'sometimes' },
      { value: 'no' },
    ],
  },
  {
    id: 'c3',
    sectionKey: 'sections.org',
    n: 14,
    type: 'single',
    optKeyPrefix: 'likert',
    showIf: { q: 'c0', notIn: ['none'] },
    options: [
      { value: 'agree' },
      { value: 'rather_agree' },
      { value: 'dk' },
      { value: 'rather_disagree' },
      { value: 'disagree' },
      { value: 'na' },
    ],
  },
  {
    id: 'c4',
    sectionKey: 'sections.org',
    n: 15,
    type: 'single',
    optKeyPrefix: 'likert',
    showIf: { q: 'c0', notIn: ['none'] },
    variantOn: { q: 'c0', value: 'freelance', suffix: 'Freelance' },
    options: [
      { value: 'agree' },
      { value: 'rather_agree' },
      { value: 'dk' },
      { value: 'rather_disagree' },
      { value: 'disagree' },
      { value: 'na' },
    ],
  },
  {
    id: 'c5',
    sectionKey: 'sections.org',
    n: 16,
    type: 'single',
    optKeyPrefix: 'likert',
    showIf: { q: 'c0', notIn: ['none'] },
    variantOn: { q: 'c0', value: 'freelance', suffix: 'Freelance' },
    options: [
      { value: 'agree' },
      { value: 'rather_agree' },
      { value: 'dk' },
      { value: 'rather_disagree' },
      { value: 'disagree' },
      { value: 'na' },
    ],
  },

  // ──────── D — zvířata (měkká vrstva) ────────
  {
    id: 'q10',
    sectionKey: 'sections.metaphor',
    n: 17,
    type: 'animal',
    fields: [
      { key: 'animalSelf', labelKey: 'q10.animalSelf.label',                                        maxLength: 30 },
      { key: 'reasonSelf', labelKey: 'q10.reason.label', placeholderKey: 'q10.reason.placeholder', maxLength: 200, multiline: true, optional: true },
      { key: 'animalAi',   labelKey: 'q10.animalAi.label',                                          maxLength: 30 },
      { key: 'reasonAi',   labelKey: 'q10.reason.label', placeholderKey: 'q10.reason.placeholder', maxLength: 200, multiline: true, optional: true },
    ],
    // rychlé štítky "proč" — max 3, nepovinné, jen měkká vrstva (do skóre nevstupují)
    chips: {
      self: ['curious', 'cautious', 'playful', 'persistent', 'fast', 'loyal', 'independent', 'predator'],
      ai:   ['smart', 'fast', 'useful', 'unpredictable', 'everywhere', 'alien', 'dangerous', 'friendly'],
    },
    maxChips: 3,
  },

  // ──────── demografie (nepovinná) ────────
  {
    id: 'q11',
    sectionKey: 'sections.about',
    n: 18,
    type: 'demographics',
    fields: [
      {
        key: 'age',
        labelKey: 'q11.age.label',
        options: [
          { value: 'under_25' },
          { value: '26_35' },
          { value: '36_45' },
          { value: '46_55' },
          { value: '56_65' },
          { value: 'over_65' },
          { value: 'na' },
        ],
      },
      {
        key: 'education',
        labelKey: 'q11.education.label',
        options: [
          { value: 'zs' },
          { value: 'ss_no_matur' },
          { value: 'ss_matur' },
          { value: 'vs' },
          { value: 'na' },
        ],
      },
      {
        key: 'field',
        labelKey: 'q11.field.label',
        options: [
          { value: 'it' },
          { value: 'marketing' },
          { value: 'finance' },
          { value: 'science' },
          { value: 'health' },
          { value: 'creative' },
          { value: 'industry' },
          { value: 'public' },
          { value: 'business' },
          { value: 'student' },
          { value: 'retired' },
          { value: 'other' },
          { value: 'na' },
        ],
      },
      {
        // role ve firmě — nová ve v2, klíčová pro firemní report
        // (srovnání vedení × specialisté)
        key: 'role',
        labelKey: 'q11.role.label',
        options: [
          { value: 'lead' },
          { value: 'manager' },
          { value: 'specialist' },
          { value: 'other' },
          { value: 'na' },
        ],
      },
      {
        key: 'gender',
        labelKey: 'q11.gender.label',
        options: [
          { value: 'female' },
          { value: 'male' },
          { value: 'other' },
          { value: 'na' },
        ],
      },
    ],
  },
];
