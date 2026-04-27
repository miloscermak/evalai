/* EvalAI dashboard — SVG scatter plot s živými daty z Apps Scriptu
 *
 * Coordinate system:
 *   X = experience 0..100  (0 = nezkušený, 100 = zkušený)
 *   Y = attitude 0..100    (0 = pesimismus, 100 = optimismus)
 *
 * SVG viewBox je 0..1000 v obou osách. Točíme Y, protože v SVG roste
 * dolů (data Y=100 → svg y=margin, data Y=0 → svg y=1000-margin).
 */

(function () {
  'use strict';

  const config = window.EVALAI_CONFIG || {};

  const PLOT_SIZE = 1000;
  const MARGIN = 80;

  const svg = document.getElementById('plot');
  const tooltip = document.getElementById('tooltip');
  const countEl = document.getElementById('count');
  const workshopLabel = document.getElementById('workshop-label');
  const refreshBtn = document.getElementById('refresh-btn');
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');

  const params = new URLSearchParams(window.location.search);
  const workshop = (params.get('w') || params.get('workshop') || '').trim();

  workshopLabel.textContent = workshop ? '· ' + workshop : '· všichni';

  let lastData = [];
  let isLoading = false;

  // ──────── data fetch ────────

  async function fetchData() {
    if (!config.dashboardJsonUrl) {
      console.warn('[EvalAI dashboard] dashboardJsonUrl není v config.js — používám demo data.');
      return demoData();
    }

    const url = new URL(config.dashboardJsonUrl);
    if (workshop) url.searchParams.set('w', workshop);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'unknown error');
    return json.points || [];
  }

  function demoData() {
    return [
      { id: '1', name: 'Senta',   x: 92, y: 88, archetype: 'optimistic_power_user', animal_self: 'delfín', animal_ai: 'chobotnice', outlier: false },
      { id: '2', name: 'Tomáš',   x: 95, y: 80, archetype: 'optimistic_power_user', animal_self: 'vlk', animal_ai: 'krkavec', outlier: false },
      { id: '3', name: 'Pavel',   x: 88, y: 35, archetype: 'realistic_power_user', animal_self: 'vlk smečky', animal_ai: 'sedmihlavý drak', outlier: true },
      { id: '4', name: 'Lukáš',   x: 25, y: 72, archetype: 'beginner_enthusiast', animal_self: 'bobr', animal_ai: 'mraveniště', outlier: false },
      { id: '5', name: 'Saša',    x: 8,  y: 22, archetype: 'beginner_skeptic', animal_self: 'žirafa', animal_ai: 'tajemné cizí', outlier: false },
      { id: '6', name: 'Andrea',  x: 5,  y: 18, archetype: 'beginner_skeptic', animal_self: 'jorkšír', animal_ai: 'chobotnice', outlier: true },
      { id: '7', name: 'Pepa',    x: 35, y: 60, archetype: 'pragmatic_user', animal_self: 'tygr (z Pú)', animal_ai: 'staletá želva', outlier: false },
      { id: '8', name: 'Honza',   x: 28, y: 30, archetype: 'beginner_skeptic', animal_self: 'služební pes', animal_ai: 'HAL 9000', outlier: true },
    ];
  }

  // ──────── SVG render ────────

  function dataToSvgX(x) {
    return MARGIN + (x / 100) * (PLOT_SIZE - 2 * MARGIN);
  }

  function dataToSvgY(y) {
    return PLOT_SIZE - MARGIN - (y / 100) * (PLOT_SIZE - 2 * MARGIN);
  }

  function renderBackground() {
    const cx = dataToSvgX(50);
    const cy = dataToSvgY(50);
    const left   = dataToSvgX(0);
    const right  = dataToSvgX(100);
    const top    = dataToSvgY(100);
    const bottom = dataToSvgY(0);

    // čtyři barevné kvadranty
    const quadrants = [
      { cls: 'q-bg-tl', x: left, y: top,    w: cx - left, h: cy - top    }, // top-left
      { cls: 'q-bg-tr', x: cx,   y: top,    w: right - cx, h: cy - top   }, // top-right
      { cls: 'q-bg-bl', x: left, y: cy,     w: cx - left, h: bottom - cy }, // bottom-left
      { cls: 'q-bg-br', x: cx,   y: cy,     w: right - cx, h: bottom - cy }, // bottom-right
    ];

    let html = '';

    quadrants.forEach(q => {
      html += `<rect class="${q.cls}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/>`;
    });

    // střídové čáry
    html += `<line class="axis-line" x1="${cx}" y1="${top}" x2="${cx}" y2="${bottom}"/>`;
    html += `<line class="axis-line" x1="${left}" y1="${cy}" x2="${right}" y2="${cy}"/>`;

    // osy popisky
    html += `<text class="axis-label" x="${right - 8}" y="${cy - 14}" text-anchor="end">zkušenost →</text>`;
    html += `<text class="axis-label" x="${cx + 14}" y="${top + 18}" text-anchor="start">↑ optimismus</text>`;
    html += `<text class="axis-label" x="${left + 8}" y="${cy - 14}" text-anchor="start">← zkušenost</text>`;
    html += `<text class="axis-label" x="${cx + 14}" y="${bottom - 8}" text-anchor="start">pesimismus ↓</text>`;

    // labely kvadrantů (rohové, decentní)
    const labelOffset = 30;
    html += `<text class="q-label" x="${left + labelOffset}" y="${top + labelOffset}">Realistický power user</text>`;
    html += `<text class="q-label" x="${right - labelOffset}" y="${top + labelOffset}" text-anchor="end">Optimistický power user</text>`;
    html += `<text class="q-label" x="${left + labelOffset}" y="${bottom - labelOffset}">Začátečník-skeptik</text>`;
    html += `<text class="q-label" x="${right - labelOffset}" y="${bottom - labelOffset}" text-anchor="end">Začátečník-nadšenec</text>`;

    svg.innerHTML = html;
  }

  function renderPoints(points) {
    // smaž staré body
    svg.querySelectorAll('.point, .point-label, .point-flag').forEach(el => el.remove());

    points.forEach(p => {
      const cx = dataToSvgX(p.x || 0);
      const cy = dataToSvgY(p.y || 0);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'point' + (p.outlier ? ' outlier' : ''));
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', 12);
      circle.dataset.id = p.id;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', 'point-label');
      label.setAttribute('x', cx);
      label.setAttribute('y', cy + 28);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = p.name || '';

      bindTooltip(circle, p);

      svg.appendChild(circle);
      svg.appendChild(label);
    });
  }

  function bindTooltip(node, point) {
    function show(evt) {
      const rect = svg.getBoundingClientRect();
      const cx = parseFloat(node.getAttribute('cx'));
      const cy = parseFloat(node.getAttribute('cy'));

      const screenX = rect.left + (cx / PLOT_SIZE) * rect.width;
      const screenY = rect.top  + (cy / PLOT_SIZE) * rect.height;

      tooltip.style.left = (screenX - svg.getBoundingClientRect().left) + 'px';
      tooltip.style.top  = (screenY - svg.getBoundingClientRect().top - 10) + 'px';

      const arch = (point.archetype || '').replace(/_/g, ' ');
      tooltip.innerHTML = `
        <strong>${escapeHtml(point.name || '')}</strong>
        ${arch ? `<div class="arch">${escapeHtml(arch)}</div>` : ''}
        <div>X: ${Math.round(point.x)} · Y: ${Math.round(point.y)}</div>
        ${point.animal_self ? `<div class="animal-line">já: ${escapeHtml(point.animal_self)}</div>` : ''}
        ${point.animal_ai   ? `<div class="animal-line">AI: ${escapeHtml(point.animal_ai)}</div>` : ''}
        ${point.outlier ? `<div style="margin-top:6px;color:#d97706;">⚑ zajímavý případ — animal posun</div>` : ''}
      `;
      tooltip.hidden = false;
    }

    function hide() { tooltip.hidden = true; }

    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);
    node.addEventListener('click', show);
  }

  // ──────── refresh cycle ────────

  async function refresh() {
    if (isLoading) return;
    isLoading = true;
    loadingEl.hidden = false;
    errorEl.hidden = true;

    try {
      const points = await fetchData();
      lastData = points;
      countEl.textContent = points.length + ' ' + plural(points.length, 'účastník', 'účastníci', 'účastníků');
      renderPoints(points);
    } catch (err) {
      console.error('[EvalAI dashboard] refresh error:', err);
      errorEl.textContent = 'Chyba načtení: ' + (err.message || err);
      errorEl.hidden = false;
    } finally {
      isLoading = false;
      loadingEl.hidden = true;
    }
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ──────── boot ────────

  refreshBtn.addEventListener('click', refresh);
  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') refresh();
  });

  renderBackground();
  refresh();
  setInterval(refresh, 10000);
})();
