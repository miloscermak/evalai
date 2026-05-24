/* EvalAI dotazník — frontend logika
 *
 * State machine:
 *   welcome → q1 → q2 → … → q10 → q11 (demografie, volitelné) → thanks
 *
 * Skóre se NEPOČÍTÁ na frontendu — všechny syrové odpovědi jdou na webhook
 * a Apps Script provede scoring + animal modifikátor přes Claude API.
 * Tím je single source of truth pro scoring v Apps Scriptu.
 *
 * Lang: čte se z ?lang= (whitelist cs|en, default cs) přes window.evalaiGetLang().
 * Lokalizace přes window.t(key) — viz src/i18n.js.
 */

(function () {
  'use strict';

  const config    = window.EVALAI_CONFIG    || {};
  const questions = window.EVALAI_QUESTIONS || [];

  const container = document.getElementById('screen-container');
  const progressBar = document.getElementById('progress-bar');

  // ──────── state ────────

  const state = {
    lang: (window.evalaiGetLang ? window.evalaiGetLang() : 'cs'),
    workshop: getWorkshopFromUrl() || 'online',
    workshopFromUrl: !!getWorkshopFromUrl(),
    name: '',
    answers: {},                    // keyed by qN
    currentIndex: 0,                // 0=welcome, 1..N=qN, N+1=thanks
    startedAt: null,
    submitted: false,
    submitting: false,
    computing: false,               // submit běží, server počítá výsledek
    submitError: null,
    result: null,                   // odpověď z webhooku po submitu (score, archetype, interpretation…)
  };

  // shorthand: lokalizovaný překlad ve state.lang
  function tl(key, vars) { return window.t(key, state.lang, vars); }

  // Nastav <html lang> a <title> podle aktuálního jazyka (a11y + SEO).
  document.documentElement.lang = state.lang;
  document.title = tl('meta.title');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', tl('meta.description'));

  function getWorkshopFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('w') || params.get('workshop') || '').trim();
  }

  // ──────── navigation ────────

  const totalScreens = questions.length + 2; // welcome + N questions + thanks

  function next() {
    if (state.currentIndex < totalScreens - 1) {
      state.currentIndex++;
      render();
    }
  }

  function back() {
    if (state.currentIndex > 0 && !state.submitted) {
      state.currentIndex--;
      render();
    }
  }

  function updateProgress() {
    // 0% on welcome, 100% on thanks
    const pct = Math.round((state.currentIndex / (totalScreens - 1)) * 100);
    progressBar.style.width = pct + '%';
  }

  // ──────── render ────────

  function render() {
    updateProgress();
    container.innerHTML = '';

    if (state.currentIndex === 0) {
      container.appendChild(renderWelcome());
    } else if (state.currentIndex === totalScreens - 1) {
      container.appendChild(renderThanks());
    } else {
      const q = questions[state.currentIndex - 1];
      container.appendChild(renderQuestion(q));
    }

    // scroll to top of screen on transition
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ──────── welcome screen ────────

  function renderWelcome() {
    const el = document.createElement('div');
    el.className = 'screen welcome';

    el.innerHTML = `
      <h1>${escapeHtml(tl('welcome.h1'))}</h1>
      <p>${escapeHtml(tl('welcome.intro1'))}</p>
      <p>${escapeHtml(tl('welcome.intro2'))}</p>

      <div class="field" style="margin-top: 24px;">
        <label class="field-label" for="name-input">${escapeHtml(tl('welcome.nameLabel'))}</label>
        <input type="text" id="name-input" maxlength="40" autocomplete="given-name"
               value="${escapeAttr(state.name)}"
               placeholder="${escapeAttr(tl('welcome.namePlaceholder'))}">
      </div>

      ${state.workshopFromUrl
        ? `<div class="welcome-meta"><span>${escapeHtml(tl('welcome.workshopMeta'))} <strong>${escapeHtml(state.workshop)}</strong></span></div>`
        : `<div class="field">
             <label class="field-label" for="workshop-input">${escapeHtml(tl('welcome.workshopLabel'))}</label>
             <input type="text" id="workshop-input" maxlength="40"
                    value="${escapeAttr(state.workshop)}"
                    placeholder="${escapeAttr(tl('welcome.workshopPlaceholder'))}">
             <small class="field-help">${tl('welcome.workshopHelp')}</small>
           </div>`}

      <div class="error-msg" id="error-msg"></div>

      <div class="nav">
        <button class="btn btn-primary" id="start-btn">${escapeHtml(tl('welcome.start'))}</button>
      </div>
    `;

    const nameInput = el.querySelector('#name-input');
    const workshopInput = el.querySelector('#workshop-input');
    const startBtn = el.querySelector('#start-btn');
    const errorMsg = el.querySelector('#error-msg');

    nameInput.addEventListener('input', e => { state.name = e.target.value.trim(); });
    if (workshopInput) {
      workshopInput.addEventListener('input', e => { state.workshop = e.target.value.trim(); });
      workshopInput.addEventListener('blur', e => {
        // Když uživatel pole vymaže, vrátíme default "online" — žádné prázdné kódy.
        if (!e.target.value.trim()) {
          state.workshop = 'online';
          e.target.value = 'online';
        }
      });
    }

    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') startBtn.click();
    });

    startBtn.addEventListener('click', () => {
      if (!state.name || state.name.length < 2) {
        errorMsg.textContent = tl('welcome.errorName');
        nameInput.focus();
        return;
      }
      state.startedAt = Date.now();
      next();
    });

    // autofocus only on desktop (mobile browsers tend to fight it)
    if (window.matchMedia('(min-width: 640px)').matches) {
      setTimeout(() => nameInput.focus(), 100);
    }

    return el;
  }

  // ──────── question screen ────────

  function renderQuestion(q) {
    const el = document.createElement('div');
    el.className = 'screen';

    let body = '';

    if (q.type === 'single' || q.type === 'multi') {
      body = renderOptions(q);
    } else if (q.type === 'scale') {
      body = renderScale(q);
    } else if (q.type === 'animal') {
      body = renderAnimal(q);
    } else if (q.type === 'demographics') {
      body = renderDemographics(q);
    }

    const isLast = q.id === 'q11';
    const isDemographics = q.type === 'demographics';
    const section = tl(q.sectionKey);
    const sectionLabel = isDemographics
      ? `${section} · ${tl('form.sectionDemoSuffix')}`
      : `${section} · ${tl('form.sectionQNofTotal', { n: q.n })}`;
    const primaryLabel = isLast
      ? (state.submitting ? tl('form.submitting') : tl('form.continueResult'))
      : tl('form.continue');

    const title    = tl(q.id + '.title');
    const subtitle = tl(q.id + '.subtitle');
    const hasSubtitle = subtitle !== (q.id + '.subtitle'); // klíč existuje, není to fallback na klíč

    el.innerHTML = `
      <div class="section-tag">${escapeHtml(sectionLabel)}</div>
      <h2 class="q-title">${escapeHtml(title)}</h2>
      ${hasSubtitle ? `<p class="q-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${body}
      <div class="error-msg" id="error-msg"></div>
      <div class="nav">
        <button class="btn btn-secondary" id="back-btn" type="button" aria-label="${escapeAttr(tl('form.back'))}">←</button>
        <button class="btn btn-primary" id="next-btn" type="button">${escapeHtml(primaryLabel)}</button>
      </div>
      ${isDemographics ? `
        <div class="demographics-skip">
          <button class="link-btn" id="skip-btn" type="button">${escapeHtml(tl('form.skip'))}</button>
        </div>
      ` : ''}
    `;

    el.querySelector('#back-btn').addEventListener('click', back);
    el.querySelector('#next-btn').addEventListener('click', () => handleNext(q, el));
    const skipBtn = el.querySelector('#skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        // Přeskočit = vůbec demografická data nevyplnit (q11 zůstane undefined).
        // Apps Script tomu rozumí — uloží prázdné kategorie.
        delete state.answers[q.id];
        submit();
      });
    }

    attachQuestionHandlers(q, el);

    return el;
  }

  // ──────── options renderer (single + multi) ────────

  function renderOptions(q) {
    const current = state.answers[q.id];
    const isMulti = q.type === 'multi';
    const selectedSet = isMulti ? new Set(current || []) : null;

    const opts = q.options.map(opt => {
      const selected = isMulti
        ? selectedSet.has(opt.value)
        : current === opt.value;
      const label = tl(q.id + '.opt.' + opt.value);
      return `
        <button class="option ${selected ? 'selected' : ''}"
                data-type="${q.type}"
                data-value="${escapeAttr(opt.value)}"
                ${opt.exclusive ? 'data-exclusive="1"' : ''}
                type="button">
          <span class="indicator"></span>
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }).join('');

    return `<div class="options">${opts}</div>`;
  }

  // ──────── scale renderer ────────

  function renderScale(q) {
    const current = state.answers[q.id];
    const buttons = [];
    for (let i = q.min; i <= q.max; i++) {
      buttons.push(`
        <button class="scale-btn ${current === i ? 'selected' : ''}"
                data-value="${i}" type="button">${i}</button>
      `);
    }
    return `
      <div class="scale">
        <div class="scale-buttons">${buttons.join('')}</div>
        <div class="scale-labels">
          <span>${escapeHtml(tl('scale.left'))}</span>
          <span>${escapeHtml(tl('scale.right'))}</span>
        </div>
      </div>
    `;
  }

  // ──────── animal renderer ────────

  function renderAnimal(q) {
    const current = state.answers[q.id] || {};

    const renderField = f => {
      const val = current[f.key] || '';
      const label = tl(f.labelKey);
      const placeholder = f.placeholderKey ? tl(f.placeholderKey) : '';
      if (f.multiline) {
        return `
          <div class="field">
            <label class="field-label">${escapeHtml(label)}</label>
            <textarea data-key="${f.key}" maxlength="${f.maxLength}"
                      placeholder="${escapeAttr(placeholder)}">${escapeHtml(val)}</textarea>
          </div>
        `;
      }
      return `
        <div class="field">
          <label class="field-label">${escapeHtml(label)}</label>
          <input type="text" data-key="${f.key}" maxlength="${f.maxLength}"
                 value="${escapeAttr(val)}"
                 placeholder="${escapeAttr(placeholder)}">
        </div>
      `;
    };

    return `
      <div class="animal-pair">
        <div class="animal-pair-title">${escapeHtml(tl('animal.selfTitle'))}</div>
        ${renderField(q.fields[0])}
        ${renderField(q.fields[1])}
      </div>
      <div class="animal-pair">
        <div class="animal-pair-title">${escapeHtml(tl('animal.aiTitle'))}</div>
        ${renderField(q.fields[2])}
        ${renderField(q.fields[3])}
      </div>
    `;
  }

  // ──────── demographics renderer ────────

  function renderDemographics(q) {
    const current = state.answers[q.id] || {};
    return q.fields.map(f => {
      const selectedValue = current[f.key] || '';
      const label = tl(f.labelKey);
      const opts = f.options.map(opt => {
        const isSelected = selectedValue === opt.value;
        const optLabel = tl('q11.' + f.key + '.opt.' + opt.value);
        return `
          <button class="option demographic-option ${isSelected ? 'selected' : ''}"
                  data-field="${f.key}" data-value="${opt.value}" type="button">
            ${escapeHtml(optLabel)}
          </button>
        `;
      }).join('');
      return `
        <div class="demographic-group">
          <div class="demographic-label">${escapeHtml(label)}</div>
          <div class="demographic-options">${opts}</div>
        </div>
      `;
    }).join('');
  }

  // ──────── handlers per question type ────────

  function attachQuestionHandlers(q, el) {
    if (q.type === 'single') {
      el.querySelectorAll('.option').forEach(btn => {
        btn.addEventListener('click', () => {
          state.answers[q.id] = btn.dataset.value;
          render();
          autoAdvance(q);
        });
      });
    } else if (q.type === 'multi') {
      el.querySelectorAll('.option').forEach(btn => {
        btn.addEventListener('click', () => toggleMulti(q, btn));
      });
    } else if (q.type === 'scale') {
      el.querySelectorAll('.scale-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.answers[q.id] = parseInt(btn.dataset.value, 10);
          render();
          autoAdvance(q);
        });
      });
    } else if (q.type === 'animal') {
      const obj = state.answers[q.id] || {};
      state.answers[q.id] = obj;
      el.querySelectorAll('[data-key]').forEach(input => {
        input.addEventListener('input', e => {
          obj[input.dataset.key] = e.target.value;
        });
      });
    } else if (q.type === 'demographics') {
      const obj = state.answers[q.id] || {};
      state.answers[q.id] = obj;
      el.querySelectorAll('.demographic-option').forEach(btn => {
        btn.addEventListener('click', () => {
          obj[btn.dataset.field] = btn.dataset.value;
          render();
        });
      });
    }
  }

  // Po výběru u single/scale chvilku počkáme (vidíš svůj klik), pak posuneme.
  // Guardujeme proti situaci, kdy uživatel během prodlevy klikl Zpět.
  function autoAdvance(q) {
    const idxBefore = state.currentIndex;
    setTimeout(() => {
      if (state.currentIndex === idxBefore && validate(q)) {
        const isLast = q.id === 'q11';
        if (isLast) submit(); else next();
      }
    }, 320);
  }

  function toggleMulti(q, btn) {
    const value = btn.dataset.value;
    const isExclusive = btn.dataset.exclusive === '1';
    const current = new Set(state.answers[q.id] || []);

    if (isExclusive) {
      // klik na "Nic z toho" / "Žádný" → vyčistí ostatní a nechá jen tuhle
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.clear();
        current.add(value);
      }
    } else {
      // klik na běžnou možnost → odebere případnou exclusive volbu
      const exclusiveValues = q.options.filter(o => o.exclusive).map(o => o.value);
      exclusiveValues.forEach(v => current.delete(v));

      if (current.has(value)) {
        current.delete(value);
      } else {
        // limit kontroly (Q8)
        if (q.maxSelections && current.size >= q.maxSelections) {
          showError(tl('form.errorMaxSelections', { n: q.maxSelections }));
          return;
        }
        current.add(value);
      }
    }

    state.answers[q.id] = Array.from(current);
    render();
  }

  // ──────── validation + next ────────

  function validate(q) {
    const v = state.answers[q.id];
    if (q.type === 'single') {
      return typeof v === 'string' && v.length > 0;
    }
    if (q.type === 'multi') {
      return Array.isArray(v) && v.length > 0;
    }
    if (q.type === 'scale') {
      return typeof v === 'number' && v >= q.min && v <= q.max;
    }
    if (q.type === 'animal') {
      const obj = v || {};
      // důvody jsou volitelné, jen samotná zvířata jsou povinná
      return obj.animalSelf && obj.animalSelf.trim().length > 0
          && obj.animalAi   && obj.animalAi.trim().length > 0;
    }
    if (q.type === 'demographics') {
      // Celá obrazovka je volitelná — průchod vždy povolen, ať uživatel
      // vyplnil cokoli (i nic). Skip button má vlastní cestu.
      return true;
    }
    return false;
  }

  function handleNext(q, el) {
    if (!validate(q)) {
      showError(tl('form.errorRequired'));
      return;
    }
    clearError();

    const isLast = q.id === 'q11';
    if (isLast) {
      submit();
    } else {
      next();
    }
  }

  function showError(msg) {
    const el = document.getElementById('error-msg');
    if (el) el.textContent = msg;
  }

  function clearError() {
    const el = document.getElementById('error-msg');
    if (el) el.textContent = '';
  }

  // ──────── submit ────────

  async function submit() {
    if (state.submitting) return;
    state.submitting = true;
    state.computing = true;
    state.submitError = null;

    const payload = {
      version: config.version || '0.1.0',
      lang: state.lang,
      workshopId: state.workshop || 'unknown',
      name: state.name,
      timestamp: new Date().toISOString(),
      durationSec: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : null,
      answers: state.answers,
      userAgent: navigator.userAgent,
    };

    // OKAMŽITĚ skok na thanks/computing screen — dotazník zmizí, aby
    // uživatel nemohl odeslat znovu nebo upravovat odpovědi během fetch.
    state.currentIndex = totalScreens - 1;
    render();

    if (!config.webhookUrl) {
      console.log('[EvalAI DEV MODE] payload:', payload);
      await sleep(800);
      finishSubmit();
      return;
    }

    try {
      // Apps Script web app: text/plain → simple CORS request, žádný preflight.
      // mode: 'cors' nám dovolí přečíst odpověď (score, archetype, interpretace).
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) state.result = data;
      }
      finishSubmit();
    } catch (err) {
      // Pokud CORS / network selhal, server pravděpodobně přesto zapsal —
      // jen nedostaneme zpět data pro result screen. Ukážeme fallback thanks.
      console.warn('[EvalAI] response read failed (server may have written anyway):', err);
      finishSubmit();
    }
  }

  function finishSubmit() {
    state.submitting = false;
    state.computing = false;
    state.submitted = true;
    state.currentIndex = totalScreens - 1;
    render();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ──────── thanks screen ────────

  function renderThanks() {
    // 1) Computing — server právě zpracovává submission. Dotazník je pryč,
    //    uživatel vidí jen "počítá se".
    if (state.computing) {
      const el = document.createElement('div');
      el.className = 'screen thanks computing';
      el.innerHTML = `
        <div class="computing-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <h1>${escapeHtml(tl('thanks.computing.h1'))}</h1>
        <p>${escapeHtml(tl('thanks.computing.body'))}</p>
      `;
      return el;
    }

    // 2) Result screen — máme kompletní data (score + archetype).
    if (state.result && typeof state.result.score_x === 'number' && typeof state.result.score_y === 'number') {
      return renderResult(state.result);
    }

    // 3) Fallback — server zapsal, ale odpověď se nepřečetla (CORS/network)
    const el = document.createElement('div');
    el.className = 'screen thanks';
    const dashUrl = dashboardUrl();
    el.innerHTML = `
      <div class="thanks-icon">✓</div>
      <h1>${escapeHtml(tl('thanks.fallback.h1'))}</h1>
      <p>${escapeHtml(tl('thanks.fallback.body'))}</p>
      <a class="btn btn-primary thanks-cta" href="${dashUrl}">${escapeHtml(tl('thanks.fallback.cta'))}</a>
      ${config.webhookUrl ? '' : `<p style="color:var(--text-subtle);font-size:14px;margin-top:24px;">${escapeHtml(tl('thanks.devNote'))}</p>`}
    `;
    return el;
  }

  // Stejný workshop + lang carrier do dashboard URL.
  function dashboardUrl() {
    const params = new URLSearchParams();
    if (state.workshop) params.set('w', state.workshop);
    if (state.lang === 'en') params.set('lang', 'en');
    const qs = params.toString();
    return 'dashboard.html' + (qs ? '?' + qs : '');
  }

  // ──────── result screen (po úspěšném submitu, když máme odpověď) ────────

  function archetypeLabel(code) {
    return tl('archetype.' + code);
  }

  function renderResult(r) {
    const el = document.createElement('div');
    el.className = 'screen result';
    const dashUrl = dashboardUrl();
    const x = Number(r.score_x) || 0;
    const y = Number(r.score_y) || 0;
    // Archetype pro nadpis odvozujeme z finálního kvadrantu (X/Y), ne z LLM
    // animal scoringu — ten dělá výrok jen z Q10 a nemusí sedět s reálnou pozicí.
    const quadrantArchetype =
      x >= 50 && y >= 50 ? 'optimistic_power_user' :
      x >= 50 && y <  50 ? 'realistic_power_user'  :
      x <  50 && y >= 50 ? 'casual_enthusiast'     :
                           'casual_skeptic';
    const archLabel = archetypeLabel(quadrantArchetype);

    el.innerHTML = `
      <div class="thanks-icon">✓</div>
      <h1>${escapeHtml(tl('result.h1'))}</h1>
      <div class="result-map">${miniMapSvg(x, y, state.name)}</div>
      ${archLabel ? `<div class="result-archetype">${escapeHtml(archLabel)}</div>` : ''}
      ${r.interpretation ? `<p class="result-interpretation">${escapeHtml(r.interpretation)}</p>` : ''}
      ${(r.animal_self || r.animal_ai) ? `
        <div class="result-animal">
          <div class="result-animal-pair">
            <span><strong>${escapeHtml(tl('result.selfPrefix'))}</strong> ${escapeHtml(r.animal_self || '')}</span>
            <span class="sep">×</span>
            <span><strong>${escapeHtml(tl('result.aiPrefix'))}</strong> ${escapeHtml(r.animal_ai || '')}</span>
          </div>
          ${r.animal_note ? `<div class="result-animal-note">${escapeHtml(r.animal_note)}</div>` : ''}
        </div>
      ` : ''}
      <a class="btn btn-secondary result-cta" href="${dashUrl}">${escapeHtml(tl('result.cta'))}</a>
    `;
    return el;
  }

  function miniMapSvg(x, y, name) {
    const SIZE = 440, MARGIN = 40, PLOT = SIZE - 2 * MARGIN;
    const cx = MARGIN + (x / 100) * PLOT;
    const cy = MARGIN + (1 - y / 100) * PLOT;
    const mid = MARGIN + PLOT / 2;
    const labelY = cy > SIZE - 70 ? cy - 18 : cy + 28;
    const youLabel = name || tl('result.youLabel');
    return `
      <svg viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet">
        <rect x="${MARGIN}" y="${MARGIN}" width="${PLOT/2}" height="${PLOT/2}" fill="#e0e7ff" opacity="0.45"/>
        <rect x="${mid}" y="${MARGIN}" width="${PLOT/2}" height="${PLOT/2}" fill="#d1fae5" opacity="0.45"/>
        <rect x="${MARGIN}" y="${mid}" width="${PLOT/2}" height="${PLOT/2}" fill="#fee2e2" opacity="0.45"/>
        <rect x="${mid}" y="${mid}" width="${PLOT/2}" height="${PLOT/2}" fill="#fef3c7" opacity="0.45"/>
        <line x1="${mid}" y1="${MARGIN}" x2="${mid}" y2="${SIZE - MARGIN}" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="3 3"/>
        <line x1="${MARGIN}" y1="${mid}" x2="${SIZE - MARGIN}" y2="${mid}" stroke="#a3a3a3" stroke-width="1" stroke-dasharray="3 3"/>
        <text x="${MARGIN + 6}" y="${MARGIN + 16}" font-size="11" fill="#525252">${escapeHtml(tl('minimap.tl'))}</text>
        <text x="${SIZE - MARGIN - 6}" y="${MARGIN + 16}" font-size="11" fill="#525252" text-anchor="end">${escapeHtml(tl('minimap.tr'))}</text>
        <text x="${MARGIN + 6}" y="${SIZE - MARGIN - 8}" font-size="11" fill="#525252">${escapeHtml(tl('minimap.bl'))}</text>
        <text x="${SIZE - MARGIN - 6}" y="${SIZE - MARGIN - 8}" font-size="11" fill="#525252" text-anchor="end">${escapeHtml(tl('minimap.br'))}</text>
        <circle cx="${cx}" cy="${cy}" r="10" fill="#0d9488" stroke="white" stroke-width="2"/>
        <text x="${cx}" y="${labelY}" font-size="14" font-weight="600" fill="#171717" text-anchor="middle">${escapeHtml(youLabel)}</text>
      </svg>
    `;
  }

  // ──────── footer + lang toggle ────────

  function setupFooter() {
    const footer = document.querySelector('.footer small');
    if (footer) {
      footer.innerHTML = `${escapeHtml(tl('footer.preparedBy'))} <a href="https://inspiruj.se" target="_blank" rel="noopener">Inspiruj.se</a> ${escapeHtml(tl('footer.suffix'))}`;
    }
    setupLangToggle();
  }

  // Tlačítko CZ/EN vpravo nahoře. Klik přepne jazyk přes ?lang= a zachová
  // ostatní parametry (workshop_id atp.).
  function setupLangToggle() {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    const otherLang = state.lang === 'en' ? 'cs' : 'en';
    const otherUrl = new URL(window.location.href);
    if (otherLang === 'en') otherUrl.searchParams.set('lang', 'en');
    else                    otherUrl.searchParams.delete('lang');
    btn.textContent = tl('lang.toggle');
    btn.href = otherUrl.pathname + (otherUrl.search || '');
  }

  // ──────── helpers ────────

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // ──────── boot ────────

  document.addEventListener('DOMContentLoaded', () => { setupFooter(); render(); });
  if (document.readyState !== 'loading') { setupFooter(); render(); }
})();
