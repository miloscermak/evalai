/* EvalAI dashboard — SVG scatter plot s živými daty z Apps Scriptu
 *
 * Coordinate system:
 *   X = experience 0..100  (0 = nezkušený, 100 = zkušený)
 *   Y = attitude 0..100    (0 = pesimismus, 100 = optimismus)
 *
 * SVG viewBox je 0..1000 v obou osách. Točíme Y, protože v SVG roste
 * dolů (data Y=100 → svg y=margin, data Y=0 → svg y=1000-margin).
 *
 * Lang: ?lang=en přepne UI do angličtiny. Filtr workshopu (?w=…) je nezávislý.
 */

(function () {
  'use strict';

  const config = window.EVALAI_CONFIG || {};
  const lang = window.evalaiGetLang ? window.evalaiGetLang() : 'cs';
  const tl = (key, vars) => window.t(key, lang, vars);

  document.documentElement.lang = lang;
  document.title = tl('dashboard.title');

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

  workshopLabel.textContent = workshop ? '· ' + workshop : tl('dashboard.all');

  // Lokalizace statických HTML prvků (legend, hlavička, tlačítka).
  function localizeChrome() {
    document.getElementById('dash-brand').textContent = tl('dashboard.brand');
    document.getElementById('export-json-btn').title = tl('dashboard.exportJsonTitle');
    document.getElementById('export-md-btn').title   = tl('dashboard.exportMdTitle');
    document.getElementById('refresh-btn').title     = tl('dashboard.refreshTitle');
    loadingEl.textContent = tl('dashboard.loading');

    const legend = document.getElementById('quadrant-legend');
    legend.innerHTML = `
      <div class="ql-row"><span class="ql-q tl"></span> ${escapeHtml(tl('dashboard.legend.tl'))} <small>${escapeHtml(tl('dashboard.legend.tl.note'))}</small></div>
      <div class="ql-row"><span class="ql-q tr"></span> ${escapeHtml(tl('dashboard.legend.tr'))} <small>${escapeHtml(tl('dashboard.legend.tr.note'))}</small></div>
      <div class="ql-row"><span class="ql-q bl"></span> ${escapeHtml(tl('dashboard.legend.bl'))} <small>${escapeHtml(tl('dashboard.legend.bl.note'))}</small></div>
      <div class="ql-row"><span class="ql-q br"></span> ${escapeHtml(tl('dashboard.legend.br'))} <small>${escapeHtml(tl('dashboard.legend.br.note'))}</small></div>
    `;
    document.getElementById('flag-note').textContent = tl('dashboard.flagNote');

    // Lang toggle vpravo nahoře — zachová ?w= parametr, jen přepne lang.
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      const otherLang = lang === 'en' ? 'cs' : 'en';
      const otherUrl = new URL(window.location.href);
      if (otherLang === 'en') otherUrl.searchParams.set('lang', 'en');
      else                    otherUrl.searchParams.delete('lang');
      langBtn.textContent = tl('lang.toggle');
      langBtn.href = otherUrl.pathname + (otherUrl.search || '');
    }
  }

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
      { id: '4', name: 'Lukáš',   x: 25, y: 72, archetype: 'casual_enthusiast', animal_self: 'bobr', animal_ai: 'mraveniště', outlier: false },
      { id: '5', name: 'Saša',    x: 8,  y: 22, archetype: 'casual_skeptic', animal_self: 'žirafa', animal_ai: 'tajemné cizí', outlier: false },
      { id: '6', name: 'Andrea',  x: 5,  y: 18, archetype: 'casual_skeptic', animal_self: 'jorkšír', animal_ai: 'chobotnice', outlier: true },
      { id: '7', name: 'Pepa',    x: 35, y: 60, archetype: 'pragmatic_user', animal_self: 'tygr (z Pú)', animal_ai: 'staletá želva', outlier: false },
      { id: '8', name: 'Honza',   x: 28, y: 30, archetype: 'casual_skeptic', animal_self: 'služební pes', animal_ai: 'HAL 9000', outlier: true },
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
    html += `<text class="axis-label" x="${right - 8}" y="${cy - 14}" text-anchor="end">${escapeHtml(tl('dashboard.axis.right'))}</text>`;
    html += `<text class="axis-label" x="${cx + 14}" y="${top + 18}" text-anchor="start">${escapeHtml(tl('dashboard.axis.up'))}</text>`;
    html += `<text class="axis-label" x="${left + 8}" y="${cy - 14}" text-anchor="start">${escapeHtml(tl('dashboard.axis.left'))}</text>`;
    html += `<text class="axis-label" x="${cx + 14}" y="${bottom - 8}" text-anchor="start">${escapeHtml(tl('dashboard.axis.down'))}</text>`;

    // labely kvadrantů (rohové, decentní)
    const labelOffset = 30;
    html += `<text class="q-label" x="${left + labelOffset}" y="${top + labelOffset}">${escapeHtml(tl('dashboard.q.tl'))}</text>`;
    html += `<text class="q-label" x="${right - labelOffset}" y="${top + labelOffset}" text-anchor="end">${escapeHtml(tl('dashboard.q.tr'))}</text>`;
    html += `<text class="q-label" x="${left + labelOffset}" y="${bottom - labelOffset}">${escapeHtml(tl('dashboard.q.bl'))}</text>`;
    html += `<text class="q-label" x="${right - labelOffset}" y="${bottom - labelOffset}" text-anchor="end">${escapeHtml(tl('dashboard.q.br'))}</text>`;

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

      // Archetype label: lokalizovaný; fallback na raw kód, kdyby přišla neznámá hodnota.
      const archCode = point.archetype || '';
      const archLabel = archCode ? (tl('archetype.' + archCode) || archCode.replace(/_/g, ' ')) : '';
      tooltip.innerHTML = `
        <strong>${escapeHtml(point.name || '')}</strong>
        ${archLabel ? `<div class="arch">${escapeHtml(archLabel)}</div>` : ''}
        <div>X: ${Math.round(point.x)} · Y: ${Math.round(point.y)}</div>
        ${point.animal_self ? `<div class="animal-line">${escapeHtml(tl('result.selfPrefix'))} ${escapeHtml(point.animal_self)}</div>` : ''}
        ${point.animal_ai   ? `<div class="animal-line">${escapeHtml(tl('result.aiPrefix'))} ${escapeHtml(point.animal_ai)}</div>` : ''}
        ${point.outlier ? `<div style="margin-top:6px;color:#d97706;">${escapeHtml(tl('dashboard.outlierTooltip'))}</div>` : ''}
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
      countEl.textContent = points.length + ' ' + plural(points.length);
      renderPoints(points);
    } catch (err) {
      console.error('[EvalAI dashboard] refresh error:', err);
      errorEl.textContent = tl('dashboard.errorPrefix') + ' ' + (err.message || err);
      errorEl.hidden = false;
    } finally {
      isLoading = false;
      loadingEl.hidden = true;
    }
  }

  // Plurál účastníků. CZ má tři formy (1 / 2-4 / 5+), EN dvě (1 / ostatní).
  function plural(n) {
    if (lang === 'cs') {
      if (n === 1) return tl('dashboard.count.one');
      if (n >= 2 && n <= 4) return tl('dashboard.count.few');
      return tl('dashboard.count.many');
    }
    return n === 1 ? tl('dashboard.count.one') : tl('dashboard.count.many');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ──────── export (JSON / Markdown) ────────

  function archetypeLabel(code) {
    if (!code) return '';
    return tl('archetype.' + code) || code;
  }

  function quadrantOf(p) {
    if (p.x >= 50 && p.y >= 50) return tl('dashboard.q.tr');
    if (p.x >= 50 && p.y <  50) return tl('dashboard.q.br');
    if (p.x <  50 && p.y >= 50) return tl('dashboard.q.tl');
    return tl('dashboard.q.bl');
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    if (!lastData.length) return;
    const payload = {
      workshop_id: workshop || null,
      exported_at: new Date().toISOString(),
      count: lastData.length,
      points: lastData,
    };
    const slug = workshop || 'all';
    downloadFile(`evalai-${slug}-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportMd() {
    if (!lastData.length) return;
    const lines = [];
    const slug = workshop || tl('export.allWorkshops');
    const locale = tl('dashboard.locale');
    lines.push(`${tl('export.titlePrefix')} ${slug}`);
    lines.push('');
    lines.push(`${tl('export.exportedAt')} ${new Date().toLocaleString(locale)}`);
    lines.push(`${tl('export.participantsCount')} **${lastData.length}**`);
    lines.push('');

    // rozložení podle archetypu (z odpovědí Claude)
    const byArch = {};
    lastData.forEach(p => {
      const k = archetypeLabel(p.archetype) || tl('export.noArchetype');
      byArch[k] = (byArch[k] || 0) + 1;
    });
    lines.push(tl('export.archetypesH2'));
    lines.push('');
    Object.keys(byArch).sort((a, b) => byArch[b] - byArch[a]).forEach(k => {
      lines.push(`- ${k}: **${byArch[k]}**`);
    });
    lines.push('');

    // rozložení podle kvadrantu (z X/Y)
    const byQ = {};
    lastData.forEach(p => {
      const k = quadrantOf(p);
      byQ[k] = (byQ[k] || 0) + 1;
    });
    lines.push(tl('export.quadrantsH2'));
    lines.push('');
    Object.keys(byQ).forEach(k => lines.push(`- ${k}: **${byQ[k]}**`));
    lines.push('');

    // outliers
    const outliers = lastData.filter(p => p.outlier);
    if (outliers.length) {
      lines.push(tl('export.outliersH2'));
      lines.push('');
      outliers.forEach(p => {
        lines.push(`- **${p.name || '?'}** — ${p.animal_self || '?'} × ${p.animal_ai || '?'}`);
      });
      lines.push('');
    }

    lines.push(tl('export.participantsH2'));
    lines.push('');
    lastData
      .slice()
      .sort((a, b) => (b.x + b.y) - (a.x + a.y))
      .forEach(p => {
        const arch = archetypeLabel(p.archetype);
        lines.push(`### ${p.name || tl('export.noName')}${p.outlier ? ' ⚑' : ''}`);
        lines.push('');
        if (arch) lines.push(`**${arch}** · X = ${Math.round(p.x)} · Y = ${Math.round(p.y)}`);
        else      lines.push(`X = ${Math.round(p.x)} · Y = ${Math.round(p.y)}`);
        lines.push('');
        if (p.animal_self || p.animal_ai) {
          lines.push(`${tl('result.selfPrefix')} *${p.animal_self || '?'}* × ${tl('result.aiPrefix')} *${p.animal_ai || '?'}*`);
          lines.push('');
        }
        if (p.interpretation) {
          lines.push(`> ${p.interpretation}`);
          lines.push('');
        }
        if (p.animal_note) {
          lines.push(`_${tl('export.animalNoteLabel')}_ ${p.animal_note}`);
          lines.push('');
        }
      });

    downloadFile(`evalai-${(workshop || 'all')}-${stamp()}.md`, lines.join('\n'), 'text/markdown');
  }

  function stamp() {
    const d = new Date();
    return d.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  }

  // ──────── boot ────────

  localizeChrome();

  refreshBtn.addEventListener('click', refresh);
  document.getElementById('export-json-btn').addEventListener('click', exportJson);
  document.getElementById('export-md-btn').addEventListener('click', exportMd);
  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') refresh();
  });

  renderBackground();
  refresh();
  setInterval(refresh, 10000);
})();
