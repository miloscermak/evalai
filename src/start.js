/* EvalAI — start (admin) page
 *
 * Workflow:
 *   1. Milos zadá ID workshopu → klikne Spustit
 *   2. Vygeneruje se QR + URL pro účastníky a odkaz na dashboard
 *   3. Counter polluje GET endpoint Apps Scriptu, ukazuje počet odpovědí
 *   4. Poslední aktivní workshop se ukládá do localStorage,
 *      takže refresh stránky ho neztratí.
 */

(function () {
  'use strict';

  const config = window.EVALAI_CONFIG || {};
  const STORAGE_KEY = 'evalai.lastWorkshop';
  const VERSION_KEY = 'evalai.lastVersion';
  const POLL_MS = 5000;

  // '2' = nový firemní dotazník (index.html), '1' = zmrazená jarní verze (/v1)
  let formVersion = '2';

  // DOM
  const setupView    = document.getElementById('setup-view');
  const sessionView  = document.getElementById('session-view');
  const widInput     = document.getElementById('wid-input');
  const startBtn     = document.getElementById('start-btn');
  const widDisplay   = document.getElementById('wid-display');
  const qrWrap       = document.getElementById('qr-wrap');
  const formUrl      = document.getElementById('form-url');
  const copyBtn      = document.getElementById('copy-btn');
  const dashboardLink = document.getElementById('dashboard-link');
  const counterValue = document.getElementById('counter-value');
  const counterMeta  = document.getElementById('counter-meta');
  const resetBtn     = document.getElementById('reset-btn');
  const errorBanner  = document.getElementById('error-banner');

  let pollTimer = null;

  // ──────── helpers ────────

  // Zadání jako "ČEZ — duben 2026" → "cez-duben-2026"
  function normalizeId(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.hidden = false;
    setTimeout(() => { errorBanner.hidden = true; }, 4000);
  }

  // ──────── lifecycle ────────

  function start(workshopId) {
    workshopId = normalizeId(workshopId);
    if (!workshopId) {
      showError('ID workshopu nemůže být prázdné.');
      widInput.focus();
      return;
    }

    const checked = document.querySelector('input[name="form-version"]:checked');
    if (checked) formVersion = checked.value;

    localStorage.setItem(STORAGE_KEY, workshopId);
    localStorage.setItem(VERSION_KEY, formVersion);

    const formLink = formVersion === '1'
      ? `${location.origin}/v1?w=${encodeURIComponent(workshopId)}`
      : `${location.origin}/?w=${encodeURIComponent(workshopId)}`;
    const dashLink = formVersion === '1'
      ? `${location.origin}/dashboard?v=1&w=${encodeURIComponent(workshopId)}`
      : `${location.origin}/dashboard?w=${encodeURIComponent(workshopId)}`;

    widDisplay.textContent = workshopId + (formVersion === '1' ? ' · v1' : '');
    formUrl.value = formLink;
    dashboardLink.href = dashLink;

    renderQr(formLink);

    setupView.hidden = true;
    sessionView.hidden = false;

    startPolling(workshopId);
  }

  function reset() {
    sessionView.hidden = true;
    setupView.hidden = false;
    stopPolling();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSION_KEY);
    widInput.value = '';
    widInput.focus();
  }

  // ──────── QR ────────

  function renderQr(text) {
    if (typeof qrcode !== 'function') {
      qrWrap.innerHTML = '<div class="qr-fallback">QR knihovna se nenačetla. Použij URL pod kódem.</div>';
      return;
    }
    // typeNumber 0 = auto, 'M' = ~15% chyb tolerance (good for projection)
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    // cellSize 8, margin 1 → výsledný SVG potom CSS-zvětšíme na 100%
    qrWrap.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 1, scalable: true });
  }

  // ──────── polling counter ────────

  function startPolling(workshopId) {
    stopPolling();
    pollCount(workshopId);
    pollTimer = setInterval(() => pollCount(workshopId), POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollCount(workshopId) {
    if (!config.dashboardJsonUrl) {
      counterValue.textContent = '—';
      counterMeta.textContent = 'config bez dashboardJsonUrl';
      return;
    }
    try {
      const url = new URL(config.dashboardJsonUrl);
      url.searchParams.set('w', workshopId);
      if (formVersion === '2') url.searchParams.set('v', '2');
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'unknown');

      const n = data.count || 0;
      counterValue.textContent = String(n);
      counterMeta.textContent = n === 0
        ? 'čekám na první odpověď…'
        : `${plural(n, 'odpověď', 'odpovědi', 'odpovědí')} · auto-refresh 5 s`;
    } catch (err) {
      counterValue.textContent = '—';
      counterMeta.textContent = 'načtení selhalo: ' + (err.message || err);
    }
  }

  // ──────── handlers ────────

  startBtn.addEventListener('click', () => start(widInput.value));
  widInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(widInput.value); });
  resetBtn.addEventListener('click', reset);

  copyBtn.addEventListener('click', () => {
    formUrl.select();
    navigator.clipboard.writeText(formUrl.value).then(() => {
      const original = copyBtn.textContent;
      copyBtn.textContent = '✓ Zkopírováno';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    }).catch(() => {
      // fallback: pole už je vybrané, user může Cmd+C
      showError('Kopírování selhalo. Použij Cmd+C.');
    });
  });

  // ──────── boot ────────

  // Pokud je v localStorage poslední workshop, rovnou pokračujeme
  const last = localStorage.getItem(STORAGE_KEY);
  if (last) {
    const lastVersion = localStorage.getItem(VERSION_KEY);
    if (lastVersion === '1') {
      const radio = document.querySelector('input[name="form-version"][value="1"]');
      if (radio) radio.checked = true;
    }
    start(last);
  } else {
    // přednabídnout dnešní datum
    const today = new Date().toISOString().slice(0, 10);
    widInput.value = '';
    widInput.placeholder = 'např. workshop-' + today;
    widInput.focus();
  }
})();
