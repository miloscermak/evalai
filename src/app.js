/* EvalAI dotazník — frontend logika
 *
 * State machine:
 *   welcome → q1 → q2 → … → q10 → thanks
 *
 * Skóre se NEPOČÍTÁ na frontendu — všechny syrové odpovědi jdou na webhook
 * a Apps Script provede scoring + animal modifikátor přes Claude API.
 * Tím je single source of truth pro scoring v Apps Scriptu.
 */

(function () {
  'use strict';

  const config    = window.EVALAI_CONFIG    || {};
  const questions = window.EVALAI_QUESTIONS || [];

  const container = document.getElementById('screen-container');
  const progressBar = document.getElementById('progress-bar');

  // ──────── state ────────

  const state = {
    workshop: getWorkshopFromUrl(),
    name: '',
    answers: {},                    // keyed by qN
    currentIndex: 0,                // 0=welcome, 1..N=qN, N+1=thanks
    startedAt: null,
    submitted: false,
    submitting: false,
    submitError: null,
  };

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
      <h1>Kde jsi na mapě AI?</h1>
      <p>Krátký dotazník (10 otázek, ~3 minuty). Cílem je tě umístit na mapu, kterou si sám/sama uvidíš na konci workshopu.</p>
      <p>Anonymní — stačí křestní jméno, e-mail nepotřebujeme.</p>

      <div class="field" style="margin-top: 24px;">
        <label class="field-label" for="name-input">Tvé křestní jméno</label>
        <input type="text" id="name-input" maxlength="40" autocomplete="given-name"
               value="${escapeAttr(state.name)}"
               placeholder="např. Pavla">
      </div>

      ${state.workshop
        ? `<div class="welcome-meta"><span>Workshop: <strong>${escapeHtml(state.workshop)}</strong></span></div>`
        : `<div class="field">
             <label class="field-label" for="workshop-input">Kód workshopu (volitelné)</label>
             <input type="text" id="workshop-input" maxlength="40"
                    value="${escapeAttr(state.workshop)}"
                    placeholder="např. cez-2026-04-27">
           </div>`}

      <div class="error-msg" id="error-msg"></div>

      <div class="nav">
        <button class="btn btn-primary" id="start-btn">Začít</button>
      </div>
    `;

    const nameInput = el.querySelector('#name-input');
    const workshopInput = el.querySelector('#workshop-input');
    const startBtn = el.querySelector('#start-btn');
    const errorMsg = el.querySelector('#error-msg');

    nameInput.addEventListener('input', e => { state.name = e.target.value.trim(); });
    if (workshopInput) {
      workshopInput.addEventListener('input', e => { state.workshop = e.target.value.trim(); });
    }

    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') startBtn.click();
    });

    startBtn.addEventListener('click', () => {
      if (!state.name || state.name.length < 2) {
        errorMsg.textContent = 'Napiš prosím své křestní jméno.';
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
    }

    const isLast = q.id === 'q10';

    el.innerHTML = `
      <div class="section-tag">${escapeHtml(q.section)} · otázka ${q.n} z 10</div>
      <h2 class="q-title">${escapeHtml(q.title)}</h2>
      ${q.subtitle ? `<p class="q-subtitle">${escapeHtml(q.subtitle)}</p>` : ''}
      ${body}
      <div class="error-msg" id="error-msg"></div>
      <div class="nav">
        <button class="btn btn-secondary" id="back-btn" type="button" aria-label="Zpět">←</button>
        <button class="btn btn-primary" id="next-btn" type="button">
          ${isLast ? (state.submitting ? 'Odesílám…' : 'Odeslat') : 'Pokračovat'}
        </button>
      </div>
    `;

    el.querySelector('#back-btn').addEventListener('click', back);
    el.querySelector('#next-btn').addEventListener('click', () => handleNext(q, el));

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
      return `
        <button class="option ${selected ? 'selected' : ''}"
                data-type="${q.type}"
                data-value="${escapeAttr(opt.value)}"
                ${opt.exclusive ? 'data-exclusive="1"' : ''}
                type="button">
          <span class="indicator"></span>
          <span>${escapeHtml(opt.label)}</span>
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
          <span>${escapeHtml(q.leftLabel)}</span>
          <span>${escapeHtml(q.rightLabel)}</span>
        </div>
      </div>
    `;
  }

  // ──────── animal renderer ────────

  function renderAnimal(q) {
    const current = state.answers[q.id] || {};

    const renderField = f => {
      const val = current[f.key] || '';
      if (f.multiline) {
        return `
          <div class="field">
            <label class="field-label">${escapeHtml(f.label)}</label>
            <textarea data-key="${f.key}" maxlength="${f.maxLength}"
                      placeholder="${escapeAttr(f.placeholder)}">${escapeHtml(val)}</textarea>
          </div>
        `;
      }
      return `
        <div class="field">
          <label class="field-label">${escapeHtml(f.label)}</label>
          <input type="text" data-key="${f.key}" maxlength="${f.maxLength}"
                 value="${escapeAttr(val)}"
                 placeholder="${escapeAttr(f.placeholder)}">
        </div>
      `;
    };

    return `
      <div class="animal-pair">
        <div class="animal-pair-title">Já</div>
        ${renderField(q.fields[0])}
        ${renderField(q.fields[1])}
      </div>
      <div class="animal-pair">
        <div class="animal-pair-title">AI</div>
        ${renderField(q.fields[2])}
        ${renderField(q.fields[3])}
      </div>
    `;
  }

  // ──────── handlers per question type ────────

  function attachQuestionHandlers(q, el) {
    if (q.type === 'single') {
      el.querySelectorAll('.option').forEach(btn => {
        btn.addEventListener('click', () => {
          state.answers[q.id] = btn.dataset.value;
          render();
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
    }
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
          showError(`Vyber maximálně ${q.maxSelections} možnosti.`);
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
      return obj.animalSelf && obj.animalSelf.trim().length > 0
          && obj.reasonSelf && obj.reasonSelf.trim().length > 0
          && obj.animalAi   && obj.animalAi.trim().length > 0
          && obj.reasonAi   && obj.reasonAi.trim().length > 0;
    }
    return false;
  }

  function handleNext(q, el) {
    if (!validate(q)) {
      showError('Vyplň prosím odpověď, ať tě algoritmus zařadí přesně.');
      return;
    }
    clearError();

    const isLast = q.id === 'q10';
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
    state.submitError = null;

    const payload = {
      version: config.version || '0.1.0',
      workshopId: state.workshop || 'unknown',
      name: state.name,
      timestamp: new Date().toISOString(),
      durationSec: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : null,
      answers: state.answers,
      userAgent: navigator.userAgent,
    };

    // re-render to show "Odesílám…"
    render();

    if (!config.webhookUrl) {
      console.log('[EvalAI DEV MODE] payload:', payload);
      await sleep(500);
      finishSubmit();
      return;
    }

    try {
      // Apps Script web app — no-cors, fire-and-forget
      await fetch(config.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      finishSubmit();
    } catch (err) {
      console.error('[EvalAI] submit error:', err);
      state.submitError = err.message || String(err);
      state.submitting = false;
      render();
      showError('Něco se zaseklo při odesílání. Zkus to za chvilku znovu.');
    }
  }

  function finishSubmit() {
    state.submitting = false;
    state.submitted = true;
    state.currentIndex = totalScreens - 1;
    render();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ──────── thanks screen ────────

  function renderThanks() {
    const el = document.createElement('div');
    el.className = 'screen thanks';
    el.innerHTML = `
      <div class="thanks-icon">✓</div>
      <h1>Hotovo, díky.</h1>
      <p>Tvé odpovědi jsou v systému. Pokud jsi v sále, brzy uvidíš svou tečku na grafu.</p>
      ${config.webhookUrl ? '' : '<p style="color:var(--text-subtle);font-size:14px;margin-top:24px;">DEV mód: payload je v console (DevTools).</p>'}
    `;
    return el;
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

  document.addEventListener('DOMContentLoaded', render);
  if (document.readyState !== 'loading') render();
})();
