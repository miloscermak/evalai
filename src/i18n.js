/* EvalAI — i18n
 *
 * Plochá mapa stringů { cs: {...}, en: {...} } + helper t(key, lang, vars).
 * Klíče sdílí frontend (app.js, dashboard.js) i texty otázek/options.
 * Default lang = 'cs'. Override jen přes ?lang=en v URL (whitelist cs|en).
 *
 * Když chybí překlad: vrátí EN (nebo klíč, pokud chybí i EN) — bezpečný fallback.
 */

(function () {
  'use strict';

  const I18N = {
    // ──────── CZ ────────
    cs: {
      // meta
      'meta.title': 'EvalAI — kde jsi na mapě AI?',
      'meta.description': 'Krátký dotazník pro workshopy Inspiruj.se. Tři minuty, deset otázek, mapa tvého vztahu k AI.',
      'footer.preparedBy': 'Připravil',
      'footer.suffix': '· anonymní · ~3 minuty',
      'footer.langToggle': 'English version',

      // welcome
      'welcome.h1': 'Kde jsi na mapě AI?',
      'welcome.intro1': 'Inspiruj.se od dubna 2023 pořádá workshopy pro zájemce o generativní AI. Za ten čas jsme vyvinuli metodiku, jak na mapu umístit účastníky workshopů — i obecně uživatele AI nástrojů. Zajímá tě, jakým typem uživatele jsi? Dej nám tři minuty. Deset otázek, a víš to.',
      'welcome.intro2': 'Anonymní — stačí křestní jméno, e-mail nepotřebujeme.',
      'welcome.nameLabel': 'Tvé křestní jméno',
      'welcome.namePlaceholder': 'např. Pavla',
      'welcome.workshopMeta': 'Workshop:',
      'welcome.workshopLabel': 'Kód workshopu',
      'welcome.workshopHelp': 'Vyplňuješ na webu? Nech <code>online</code>. Jsi na workshopu? Přepiš na kód, který ti dal lektor.',
      'welcome.workshopPlaceholder': 'online',
      'welcome.errorName': 'Napiš prosím své křestní jméno.',
      'welcome.start': 'Začít',

      // form / nav
      'form.sectionDemoSuffix': 'nepovinné',
      'form.sectionQNofTotal': 'otázka {n} z 10',
      'form.continue': 'Pokračovat',
      'form.continueResult': 'Pokračovat k výsledku',
      'form.submitting': 'Odesílám…',
      'form.back': 'Zpět',
      'form.skip': 'Přeskočit a rovnou na výsledek',
      'form.errorRequired': 'Vyplň prosím odpověď, ať tě algoritmus zařadí přesně.',
      'form.errorMaxSelections': 'Vyber maximálně {n} možnosti.',

      // animal
      'animal.selfTitle': 'Já',
      'animal.aiTitle': 'AI',

      // thanks
      'thanks.computing.h1': 'Děkujeme za vyplnění.',
      'thanks.computing.body': 'Teď se počítá tvůj výsledek…',
      'thanks.fallback.h1': 'Hotovo, díky.',
      'thanks.fallback.body': 'Tvé odpovědi jsou v systému. Podívej se, kde jsi na mapě:',
      'thanks.fallback.cta': 'Ukaž mi mapu →',
      'thanks.devNote': 'DEV mód: payload je v console (DevTools).',

      // result
      'result.h1': 'Tady jsi na mapě AI',
      'result.cta': 'Podívej se, kde jsou ostatní →',
      'result.selfPrefix': 'Já:',
      'result.aiPrefix': 'AI:',
      'result.youLabel': 'ty',

      // archetypes (display labels)
      'archetype.optimistic_power_user': 'Optimistický power user',
      'archetype.realistic_power_user':  'Realistický power user',
      'archetype.casual_enthusiast':     'Běžný uživatel-nadšenec',
      'archetype.casual_skeptic':        'Běžný uživatel-skeptik',
      'archetype.pragmatic_user':        'Pragmatický uživatel',
      'archetype.beginner_enthusiast':   'Běžný uživatel-nadšenec',
      'archetype.beginner_skeptic':      'Běžný uživatel-skeptik',
      'archetype.manager_proxy':         'Manažer (proxy uživatel)',
      'archetype.unclear':               'Smíšený typ',

      // mini-map (result) — krátké popisky kvadrantů
      'minimap.tl': 'začátečník-nadšenec',
      'minimap.tr': 'optim. power user',
      'minimap.bl': 'začátečník-skeptik',
      'minimap.br': 'real. power user',

      // dashboard
      'dashboard.title': 'EvalAI — mapa účastníků',
      'dashboard.brand': 'EvalAI · mapa účastníků',
      'dashboard.all': '· všichni',
      'dashboard.count.zero': '0 účastníků',
      'dashboard.count.one': 'účastník',
      'dashboard.count.few': 'účastníci',
      'dashboard.count.many': 'účastníků',
      'dashboard.exportJsonTitle': 'Stáhnout všechna data jako JSON',
      'dashboard.exportMdTitle': 'Stáhnout přehled jako Markdown',
      'dashboard.refreshTitle': 'Obnovit',
      'dashboard.loading': 'Načítám…',
      'dashboard.errorPrefix': 'Chyba načtení:',
      'dashboard.legend.tl': 'Začátečník-nadšenec',
      'dashboard.legend.tl.note': '(nezkušený, pozitivní)',
      'dashboard.legend.tr': 'Optimistický power user',
      'dashboard.legend.tr.note': '(zkušený, pozitivní)',
      'dashboard.legend.bl': 'Začátečník-skeptik',
      'dashboard.legend.bl.note': '(nezkušený, opatrný)',
      'dashboard.legend.br': 'Realistický power user',
      'dashboard.legend.br.note': '(zkušený, opatrný)',
      'dashboard.flagNote': 'Vlaječka ⚑ = animal přirovnání ukazuje na výrazně jiný postoj než ostatní odpovědi (zajímavý případ).',
      'dashboard.axis.right': 'zkušenost →',
      'dashboard.axis.up': '↑ optimismus',
      'dashboard.axis.left': '← zkušenost',
      'dashboard.axis.down': 'pesimismus ↓',
      'dashboard.q.tl': 'Začátečník-nadšenec',
      'dashboard.q.tr': 'Optimistický power user',
      'dashboard.q.bl': 'Začátečník-skeptik',
      'dashboard.q.br': 'Realistický power user',
      'dashboard.outlierTooltip': '⚑ zajímavý případ — animal posun',
      'dashboard.locale': 'cs-CZ',

      // export
      'export.titlePrefix': '# EvalAI —',
      'export.allWorkshops': 'všechny workshopy',
      'export.exportedAt': 'Exportováno:',
      'export.participantsCount': 'Účastníků:',
      'export.archetypesH2': '## Archetypy',
      'export.quadrantsH2': '## Kvadranty',
      'export.outliersH2': '## ⚑ Outlieři (animal posun ≥ 8)',
      'export.participantsH2': '## Účastníci',
      'export.noName': '(beze jména)',
      'export.noArchetype': '(bez archetypu)',
      'export.animalNoteLabel': 'Animal note:',

      // sections
      'sections.experience': 'Zkušenost',
      'sections.attitude':   'Postoj',
      'sections.metaphor':   'Přirovnání',
      'sections.about':      'O tobě',

      // questions
      'q1.title': 'Jak dlouho aktivně používáš AI nástroje?',
      'q1.opt.never': 'Vůbec / jen jsem to párkrát zkusil/a',
      'q1.opt.lt6m':  'Méně než 6 měsíců',
      'q1.opt.6m_2y': '6 měsíců až 2 roky',
      'q1.opt.gt2y':  'Více než 2 roky',

      'q2.title': 'Jak často AI typicky používáš?',
      'q2.opt.never':   'Vůbec / sporadicky',
      'q2.opt.monthly': 'Občas (párkrát měsíčně)',
      'q2.opt.weekly':  'Pravidelně (alespoň týdně)',
      'q2.opt.daily':   'Denně',
      'q2.opt.always':  'Mnohokrát denně, je součástí mé práce',

      'q3.title': 'Které AI nástroje jsi za poslední měsíc reálně použil/a?',
      'q3.subtitle': 'Můžeš zaškrtnout více možností.',
      'q3.opt.chatgpt':    'ChatGPT',
      'q3.opt.claude':     'Claude',
      'q3.opt.gemini':     'Gemini',
      'q3.opt.copilot':    'Microsoft Copilot',
      'q3.opt.other':      'Jiný AI nástroj',
      'q3.opt.perplexity': 'Perplexity',
      'q3.opt.notebooklm': 'NotebookLM',
      'q3.opt.image':      'MidJourney / DALL-E / Sora / Veo',
      'q3.opt.audio':      'ElevenLabs / Suno',
      'q3.opt.video':      'HeyGen / Synthesia',
      'q3.opt.none':       'Žádný',

      'q4.title': 'Platíš za některou AI službu?',
      'q4.opt.no':    'Ne',
      'q4.opt.one':   'Ano, jeden placený nástroj',
      'q4.opt.multi': 'Ano, dva a více',

      'q5.title': 'Co z následujícího jsi v posledních 6 měsících dělal/a?',
      'q5.subtitle': 'Můžeš zaškrtnout více možností.',
      'q5.opt.long_prompt': 'Píšu prompty, často komplexní a promyšlené',
      'q5.opt.chatbot_max': 'Používám chatbot na maximum (projekty, deep research, plánované úkoly)',
      'q5.opt.vibecoding':  'Píšu vlastní aplikace (vibecoding)',
      'q5.opt.automation':  'Vytvářím automatizace s využitím různých nástrojů',
      'q5.opt.agent':       'Buduju asistenta nebo agenta, na kterého deleguju úkoly',
      'q5.opt.none':        'Nic z toho',

      'q6.title': 'AI bude do pěti let ve většině sofistikovaných dovedností stejně dobrá jako lidi.',
      'q7.title': 'AI během příštích pěti let změní svět i můj život k lepšímu.',
      'scale.left':  'Zcela nesouhlasím',
      'scale.right': 'Zcela souhlasím',

      'q8.title': 'Co tě na AI nejvíc znervózňuje?',
      'q8.subtitle': 'Vyber max. 3 možnosti — nebo „Nic z toho".',
      'q8.opt.hallucinations': 'Halucinace / nepravdivé odpovědi',
      'q8.opt.jobs':           'Ztráta pracovních míst',
      'q8.opt.authenticity':   'Ztráta autenticity a vlastního myšlení',
      'q8.opt.dependency':     'Závislost na AI',
      'q8.opt.ethics':         'Etika a soukromí dat',
      'q8.opt.safety':         'Bezpečnost a zneužití',
      'q8.opt.unknown':        'Strach z neznámého — „nevím, co to je"',
      'q8.opt.ecology':        'Ekologická zátěž',
      'q8.opt.none':           'Nic z toho — nemám výrazné obavy',

      'q9.title': 'Vývoj a používání AI bude třeba tvrdě regulovat a omezovat.',

      'q10.title': 'Krátké přirovnání',
      'q10.subtitle': 'Tahle otázka je pro nás nejcennější. Napiš první, co tě napadne — důvod je nepovinný.',
      'q10.animalSelf.label': 'K jakému zvířeti přirovnáš sebe?',
      'q10.animalAi.label':   'A k jakému zvířeti přirovnáš AI?',
      'q10.reason.label':     'Proč? (volitelné)',
      'q10.reason.placeholder': 'Klidně přeskoč.',

      'q11.title': 'Ještě pár nepovinných otázek pro statistiku',
      'q11.subtitle': 'Pomáhají nám porovnat skupiny. Tvoje odpovědi zůstávají anonymní — jméno + tyhle čtyři kategorie nikoho nedeanonymizují. Pokud nechceš, klidně přeskoč celou obrazovku.',
      'q11.age.label': 'Věk',
      'q11.age.opt.under_25': 'do 25 let',
      'q11.age.opt.26_35':    '26–35',
      'q11.age.opt.36_45':    '36–45',
      'q11.age.opt.46_55':    '46–55',
      'q11.age.opt.56_65':    '56–65',
      'q11.age.opt.over_65':  'nad 65',
      'q11.age.opt.na':       'Nechci uvést',
      'q11.education.label': 'Nejvyšší dokončené vzdělání',
      'q11.education.opt.zs':          'Základní',
      'q11.education.opt.ss_no_matur': 'Střední bez maturity',
      'q11.education.opt.ss_matur':    'Střední s maturitou',
      'q11.education.opt.vs':          'Vysokoškolské',
      'q11.education.opt.na':          'Nechci uvést',
      'q11.field.label': 'Obor, ve kterém pracuješ',
      'q11.field.opt.it':        'IT / technologie',
      'q11.field.opt.marketing': 'Marketing / PR / komunikace',
      'q11.field.opt.finance':   'Finance / právo / audit',
      'q11.field.opt.science':   'Věda / vzdělávání',
      'q11.field.opt.health':    'Zdravotnictví',
      'q11.field.opt.creative':  'Kreativní obory / média',
      'q11.field.opt.industry':  'Výroba / inženýrství',
      'q11.field.opt.public':    'Státní správa / neziskovka',
      'q11.field.opt.business':  'Podnikání / management',
      'q11.field.opt.student':   'Studuji',
      'q11.field.opt.retired':   'V důchodu',
      'q11.field.opt.other':     'Jiné',
      'q11.field.opt.na':        'Nechci uvést',
      'q11.gender.label': 'Pohlaví',
      'q11.gender.opt.female': 'Žena',
      'q11.gender.opt.male':   'Muž',
      'q11.gender.opt.other':  'Jiné',
      'q11.gender.opt.na':     'Nechci uvést',
    },

    // ──────── EN ────────
    en: {
      'meta.title': 'EvalAI — where are you on the AI map?',
      'meta.description': 'A short quiz for Inspiruj.se workshops. Three minutes, ten questions, a map of your relationship with AI.',
      'footer.preparedBy': 'Built by',
      'footer.suffix': '· anonymous · ~3 minutes',
      'footer.langToggle': 'Česká verze',

      'welcome.h1': 'Where are you on the AI map?',
      'welcome.intro1': 'Since April 2023, Inspiruj.se has been running workshops on generative AI. Over that time, we developed a method for placing workshop participants — and AI users in general — on a map. Curious what kind of user you are? Give us three minutes. Ten questions and you\'ll know.',
      'welcome.intro2': 'Anonymous — first name is enough, we don\'t need your email.',
      'welcome.nameLabel': 'Your first name',
      'welcome.namePlaceholder': 'e.g. Alex',
      'welcome.workshopMeta': 'Workshop:',
      'welcome.workshopLabel': 'Workshop code',
      'welcome.workshopHelp': 'Filling this in online? Leave it as <code>online</code>. At a workshop? Enter the code your instructor gave you.',
      'welcome.workshopPlaceholder': 'online',
      'welcome.errorName': 'Please enter your first name.',
      'welcome.start': 'Start',

      'form.sectionDemoSuffix': 'optional',
      'form.sectionQNofTotal': 'question {n} of 10',
      'form.continue': 'Continue',
      'form.continueResult': 'See my result',
      'form.submitting': 'Submitting…',
      'form.back': 'Back',
      'form.skip': 'Skip and see my result',
      'form.errorRequired': 'Please answer so the algorithm can place you precisely.',
      'form.errorMaxSelections': 'Select up to {n} options.',

      'animal.selfTitle': 'Me',
      'animal.aiTitle': 'AI',

      'thanks.computing.h1': 'Thanks for filling this in.',
      'thanks.computing.body': 'Calculating your result…',
      'thanks.fallback.h1': 'All done, thanks.',
      'thanks.fallback.body': 'Your answers are in the system. Take a look at the map:',
      'thanks.fallback.cta': 'Show me the map →',
      'thanks.devNote': 'DEV mode: payload is in the console (DevTools).',

      'result.h1': 'Here you are on the AI map',
      'result.cta': 'See where everyone else is →',
      'result.selfPrefix': 'Me:',
      'result.aiPrefix': 'AI:',
      'result.youLabel': 'you',

      'archetype.optimistic_power_user': 'Optimistic power user',
      'archetype.realistic_power_user':  'Realistic power user',
      'archetype.casual_enthusiast':     'Casual enthusiast',
      'archetype.casual_skeptic':        'Casual skeptic',
      'archetype.pragmatic_user':        'Pragmatic user',
      'archetype.beginner_enthusiast':   'Casual enthusiast',
      'archetype.beginner_skeptic':      'Casual skeptic',
      'archetype.manager_proxy':         'Manager (proxy user)',
      'archetype.unclear':               'Mixed type',

      'minimap.tl': 'casual enthusiast',
      'minimap.tr': 'optim. power user',
      'minimap.bl': 'casual skeptic',
      'minimap.br': 'real. power user',

      'dashboard.title': 'EvalAI — participant map',
      'dashboard.brand': 'EvalAI · participant map',
      'dashboard.all': '· everyone',
      'dashboard.count.zero': '0 participants',
      'dashboard.count.one': 'participant',
      'dashboard.count.few': 'participants',
      'dashboard.count.many': 'participants',
      'dashboard.exportJsonTitle': 'Download all data as JSON',
      'dashboard.exportMdTitle': 'Download summary as Markdown',
      'dashboard.refreshTitle': 'Refresh',
      'dashboard.loading': 'Loading…',
      'dashboard.errorPrefix': 'Load error:',
      'dashboard.legend.tl': 'Casual enthusiast',
      'dashboard.legend.tl.note': '(inexperienced, positive)',
      'dashboard.legend.tr': 'Optimistic power user',
      'dashboard.legend.tr.note': '(experienced, positive)',
      'dashboard.legend.bl': 'Casual skeptic',
      'dashboard.legend.bl.note': '(inexperienced, cautious)',
      'dashboard.legend.br': 'Realistic power user',
      'dashboard.legend.br.note': '(experienced, cautious)',
      'dashboard.flagNote': 'Flag ⚑ = animal metaphor points to an attitude markedly different from the other answers (interesting case).',
      'dashboard.axis.right': 'experience →',
      'dashboard.axis.up': '↑ optimism',
      'dashboard.axis.left': '← experience',
      'dashboard.axis.down': 'pessimism ↓',
      'dashboard.q.tl': 'Casual enthusiast',
      'dashboard.q.tr': 'Optimistic power user',
      'dashboard.q.bl': 'Casual skeptic',
      'dashboard.q.br': 'Realistic power user',
      'dashboard.outlierTooltip': '⚑ interesting case — animal shift',
      'dashboard.locale': 'en-US',

      'export.titlePrefix': '# EvalAI —',
      'export.allWorkshops': 'all workshops',
      'export.exportedAt': 'Exported:',
      'export.participantsCount': 'Participants:',
      'export.archetypesH2': '## Archetypes',
      'export.quadrantsH2': '## Quadrants',
      'export.outliersH2': '## ⚑ Outliers (animal shift ≥ 8)',
      'export.participantsH2': '## Participants',
      'export.noName': '(no name)',
      'export.noArchetype': '(no archetype)',
      'export.animalNoteLabel': 'Animal note:',

      'sections.experience': 'Experience',
      'sections.attitude':   'Attitude',
      'sections.metaphor':   'Metaphor',
      'sections.about':      'About you',

      'q1.title': 'How long have you been actively using AI tools?',
      'q1.opt.never': 'Not at all / I\'ve only tried it a few times',
      'q1.opt.lt6m':  'Less than 6 months',
      'q1.opt.6m_2y': '6 months to 2 years',
      'q1.opt.gt2y':  'More than 2 years',

      'q2.title': 'How often do you typically use AI?',
      'q2.opt.never':   'Not at all / sporadically',
      'q2.opt.monthly': 'Occasionally (a few times a month)',
      'q2.opt.weekly':  'Regularly (at least weekly)',
      'q2.opt.daily':   'Daily',
      'q2.opt.always':  'Many times a day, it\'s part of my work',

      'q3.title': 'Which AI tools have you actually used in the past month?',
      'q3.subtitle': 'Select all that apply.',
      'q3.opt.chatgpt':    'ChatGPT',
      'q3.opt.claude':     'Claude',
      'q3.opt.gemini':     'Gemini',
      'q3.opt.copilot':    'Microsoft Copilot',
      'q3.opt.other':      'Another AI tool',
      'q3.opt.perplexity': 'Perplexity',
      'q3.opt.notebooklm': 'NotebookLM',
      'q3.opt.image':      'MidJourney / DALL-E / Sora / Veo',
      'q3.opt.audio':      'ElevenLabs / Suno',
      'q3.opt.video':      'HeyGen / Synthesia',
      'q3.opt.none':       'None',

      'q4.title': 'Do you pay for any AI service?',
      'q4.opt.no':    'No',
      'q4.opt.one':   'Yes, one paid tool',
      'q4.opt.multi': 'Yes, two or more',

      'q5.title': 'Which of the following have you done in the past 6 months?',
      'q5.subtitle': 'Select all that apply.',
      'q5.opt.long_prompt': 'I write prompts — often complex and deliberate',
      'q5.opt.chatbot_max': 'I push chatbots to the max (projects, deep research, scheduled tasks)',
      'q5.opt.vibecoding':  'I build my own apps (vibecoding)',
      'q5.opt.automation':  'I build automations across multiple tools',
      'q5.opt.agent':       'I build an assistant or agent I can delegate tasks to',
      'q5.opt.none':        'None of the above',

      'q6.title': 'Within five years, AI will match humans in most sophisticated skills.',
      'q7.title': 'Over the next five years, AI will change the world — and my life — for the better.',
      'scale.left':  'Strongly disagree',
      'scale.right': 'Strongly agree',

      'q8.title': 'What makes you most uneasy about AI?',
      'q8.subtitle': 'Pick up to 3 — or "None of the above".',
      'q8.opt.hallucinations': 'Hallucinations / false answers',
      'q8.opt.jobs':           'Job loss',
      'q8.opt.authenticity':   'Loss of authenticity and original thinking',
      'q8.opt.dependency':     'Dependence on AI',
      'q8.opt.ethics':         'Ethics and data privacy',
      'q8.opt.safety':         'Safety and misuse',
      'q8.opt.unknown':        'Fear of the unknown — "I don\'t know what it is"',
      'q8.opt.ecology':        'Environmental footprint',
      'q8.opt.none':           'None of the above — no major concerns',

      'q9.title': 'AI development and use will need to be strictly regulated and restricted.',

      'q10.title': 'A quick metaphor',
      'q10.subtitle': 'This question is the most valuable to us. Write the first thing that comes to mind — the reason is optional.',
      'q10.animalSelf.label': 'Which animal would you compare yourself to?',
      'q10.animalAi.label':   'And which animal would you compare AI to?',
      'q10.reason.label':     'Why? (optional)',
      'q10.reason.placeholder': 'Feel free to skip.',

      'q11.title': 'A few more optional questions for our stats',
      'q11.subtitle': 'These help us compare groups. Your answers stay anonymous — your first name plus these four categories don\'t identify anyone. Feel free to skip the whole screen.',
      'q11.age.label': 'Age',
      'q11.age.opt.under_25': 'under 25',
      'q11.age.opt.26_35':    '26–35',
      'q11.age.opt.36_45':    '36–45',
      'q11.age.opt.46_55':    '46–55',
      'q11.age.opt.56_65':    '56–65',
      'q11.age.opt.over_65':  'over 65',
      'q11.age.opt.na':       'Prefer not to say',
      'q11.education.label': 'Highest completed education',
      'q11.education.opt.zs':          'Primary',
      'q11.education.opt.ss_no_matur': 'Secondary (no diploma)',
      'q11.education.opt.ss_matur':    'Secondary (with diploma)',
      'q11.education.opt.vs':          'University',
      'q11.education.opt.na':          'Prefer not to say',
      'q11.field.label': 'Your field of work',
      'q11.field.opt.it':        'IT / technology',
      'q11.field.opt.marketing': 'Marketing / PR / communications',
      'q11.field.opt.finance':   'Finance / law / audit',
      'q11.field.opt.science':   'Science / education',
      'q11.field.opt.health':    'Healthcare',
      'q11.field.opt.creative':  'Creative fields / media',
      'q11.field.opt.industry':  'Manufacturing / engineering',
      'q11.field.opt.public':    'Public sector / non-profit',
      'q11.field.opt.business':  'Entrepreneurship / management',
      'q11.field.opt.student':   'Student',
      'q11.field.opt.retired':   'Retired',
      'q11.field.opt.other':     'Other',
      'q11.field.opt.na':        'Prefer not to say',
      'q11.gender.label': 'Gender',
      'q11.gender.opt.female': 'Female',
      'q11.gender.opt.male':   'Male',
      'q11.gender.opt.other':  'Other',
      'q11.gender.opt.na':     'Prefer not to say',
    },
  };

  function getLang() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('lang') || '').toLowerCase();
    return raw === 'en' ? 'en' : 'cs';
  }

  function t(key, lang, vars) {
    const l = lang || getLang();
    const dict = I18N[l] || I18N.cs;
    let s = dict[key];
    if (s === undefined) s = I18N.en[key];   // fallback: EN
    if (s === undefined) s = key;            // poslední fallback: klíč
    if (vars) {
      Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  window.EVALAI_I18N = I18N;
  window.evalaiGetLang = getLang;
  window.t = t;
})();
