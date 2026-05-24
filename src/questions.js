/* EvalAI — struktura otázek (bez textů)
 *
 * Textové labely (title, subtitle, options.label, leftLabel/rightLabel,
 * field labels demografie) jsou v src/i18n.js. Render v app.js skládá
 * klíče podle id otázky a value odpovědi, např. t('q1.opt.gt2y').
 *
 * Tento soubor je language-agnostic. Změna struktury (přidání otázky,
 * value kódů, vah) MUSÍ jít ruku v ruce s úpravou:
 *   - i18n.js (přidat CZ + EN texty)
 *   - apps-script/webhook.gs (scoring váhy + LLM label slovníky)
 */

window.EVALAI_QUESTIONS = [
  {
    id: 'q1',
    sectionKey: 'sections.experience',
    n: 1,
    type: 'single',
    options: [
      { value: 'never' },
      { value: 'lt6m' },
      { value: '6m_2y' },
      { value: 'gt2y' },
    ],
  },
  {
    id: 'q2',
    sectionKey: 'sections.experience',
    n: 2,
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
    id: 'q3',
    sectionKey: 'sections.experience',
    n: 3,
    type: 'multi',
    options: [
      { value: 'chatgpt' },
      { value: 'claude' },
      { value: 'gemini' },
      { value: 'copilot' },
      { value: 'other' },
      { value: 'perplexity' },
      { value: 'notebooklm' },
      { value: 'image' },
      { value: 'audio' },
      { value: 'video' },
      { value: 'none', exclusive: true },
    ],
  },
  {
    id: 'q4',
    sectionKey: 'sections.experience',
    n: 4,
    type: 'single',
    options: [
      { value: 'no' },
      { value: 'one' },
      { value: 'multi' },
    ],
  },
  {
    id: 'q5',
    sectionKey: 'sections.experience',
    n: 5,
    type: 'multi',
    options: [
      { value: 'long_prompt' },
      { value: 'chatbot_max' },
      { value: 'vibecoding' },
      { value: 'automation' },
      { value: 'agent' },
      { value: 'none', exclusive: true },
    ],
  },
  {
    id: 'q6',
    sectionKey: 'sections.attitude',
    n: 6,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'q7',
    sectionKey: 'sections.attitude',
    n: 7,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'q8',
    sectionKey: 'sections.attitude',
    n: 8,
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
  {
    id: 'q9',
    sectionKey: 'sections.attitude',
    n: 9,
    type: 'scale',
    min: 1,
    max: 5,
  },
  {
    id: 'q10',
    sectionKey: 'sections.metaphor',
    n: 10,
    type: 'animal',
    fields: [
      { key: 'animalSelf', labelKey: 'q10.animalSelf.label',                                        maxLength: 30 },
      { key: 'reasonSelf', labelKey: 'q10.reason.label', placeholderKey: 'q10.reason.placeholder', maxLength: 200, multiline: true, optional: true },
      { key: 'animalAi',   labelKey: 'q10.animalAi.label',                                          maxLength: 30 },
      { key: 'reasonAi',   labelKey: 'q10.reason.label', placeholderKey: 'q10.reason.placeholder', maxLength: 200, multiline: true, optional: true },
    ],
  },
  {
    id: 'q11',
    sectionKey: 'sections.about',
    n: 11,
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
