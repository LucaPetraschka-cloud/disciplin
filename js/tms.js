import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import { lineChart, destroyChart, resolveColor } from './charts.js';
import { buildBuckets, RANGE_LABELS } from './timeseries.js';

let chart = null;
let state = { subtestId: 'muster', range: 'month', editBaseline: false };

function accuracy(session) {
  if (!session.bearbeitet) return null;
  return Math.round((session.richtige / session.bearbeitet) * 1000) / 10;
}

function renderChart(el) {
  const canvas = el.querySelector('#tms-chart');
  destroyChart(chart);
  const sessions = Store.tmsSessions(state.subtestId);
  const buckets = buildBuckets(state.range);
  const points = buckets.map(b => {
    const inRange = sessions.filter(s => s.date >= b.from && s.date <= b.to);
    if (!inRange.length) return null;
    const bearb = inRange.reduce((a, s) => a + Number(s.bearbeitet || 0), 0);
    const richt = inRange.reduce((a, s) => a + Number(s.richtige || 0), 0);
    return bearb ? Math.round((richt / bearb) * 1000) / 10 : null;
  });
  const subtest = Store.TMS_SUBTESTS.find(s => s.id === state.subtestId);
  chart = lineChart(canvas.getContext('2d'), {
    labels: buckets.map(b => b.label),
    datasets: [{ label: 'Trefferquote', data: points, color: resolveColor(subtest.color) }],
    yLabel: 'Trefferquote %',
    suggestedMax: 100,
  });
}

function renderLog(el) {
  const rows = Store.list('tmsSessions').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  const tbody = el.querySelector('#tms-log-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Noch keine Übungssessions erfasst.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const st = Store.TMS_SUBTESTS.find(s => s.id === r.subtestId);
    const acc = accuracy(r);
    return `<tr>
      <td>${r.date.slice(8, 10)}.${r.date.slice(5, 7)}.</td>
      <td>${st ? st.short : '—'}</td>
      <td class="num">${r.bearbeitet}</td>
      <td class="num">${r.richtige}</td>
      <td class="num">${r.zeit ?? '—'}${r.zeit ? "'" : ''}</td>
      <td class="num" style="color:${acc >= 70 ? 'var(--status-good)' : 'var(--text-secondary)'}">${acc ?? '—'}%</td>
      <td class="del-cell"><button data-del="${r.id}">×</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => { Store.remove('tmsSessions', btn.dataset.del); });
  });
}

function renderBaselineCard(el) {
  const wrap = el.querySelector('#baseline-card');
  const baseline = Store.tmsBaseline();

  if (baseline && !state.editBaseline) {
    wrap.innerHTML = `
      <div class="card-title-row"><h2>Baseline je Aufgabengruppe</h2><button class="btn ghost" id="bl-edit">Bearbeiten</button></div>
      <table class="data-table">
        <thead><tr><th>Untertest</th><th class="num">Testwert</th><th class="num">Prozentrang</th></tr></thead>
        <tbody>
          ${Store.TMS_SUBTESTS.map(s => {
            const v = (baseline.subtests || {})[s.id] || {};
            return `<tr>
              <td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${s.color};margin-right:7px;"></span>${s.short}</td>
              <td class="num">${v.tw ?? '—'}</td>
              <td class="num">${v.pr ?? '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    wrap.querySelector('#bl-edit').addEventListener('click', () => { state.editBaseline = true; renderBaselineCard(el); });
  } else {
    const b = baseline || { datum: '', testwert: '', prozentrang: '', subtests: {} };
    wrap.innerHTML = `
      <div class="card-title-row"><h2>${baseline ? 'Baseline bearbeiten' : 'Baseline eintragen'}</h2></div>
      <div class="hint" style="margin-bottom:12px;">Trag hier die Werte aus deinem TMS-Testbericht ein — sie bleiben auf deinen Geräten (bzw. in deinem privaten Sync) und dienen als Ausgangspunkt für dein Ziel von ${Store.TMS_ZIEL}.</div>
      <div class="field-row">
        <div class="field-group"><label class="field">Testdatum</label><input type="date" id="bl-datum" value="${b.datum || ''}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label class="field">Gesamtwert</label><input type="number" id="bl-tw" value="${b.testwert ?? ''}" placeholder="z.B. 100"></div>
        <div class="field-group"><label class="field">Prozentrang</label><input type="number" id="bl-pr" value="${b.prozentrang ?? ''}" placeholder="z.B. 50"></div>
      </div>
      <table class="data-table" style="margin-bottom:12px;">
        <thead><tr><th>Untertest</th><th class="num">Testwert</th><th class="num">PR</th></tr></thead>
        <tbody>
          ${Store.TMS_SUBTESTS.map(s => {
            const v = (b.subtests || {})[s.id] || {};
            return `<tr data-st="${s.id}">
              <td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${s.color};margin-right:7px;"></span>${s.short}</td>
              <td class="num"><input type="number" class="st-tw" style="width:64px;text-align:right;" value="${v.tw ?? ''}"></td>
              <td class="num"><input type="number" class="st-pr" style="width:56px;text-align:right;" value="${v.pr ?? ''}"></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="btn-row">
        <button class="btn primary" id="bl-save" style="flex:1;">Speichern</button>
        ${baseline ? `<button class="btn" id="bl-cancel">Abbrechen</button>` : ''}
      </div>
    `;
    wrap.querySelector('#bl-save').addEventListener('click', () => {
      const subtests = {};
      wrap.querySelectorAll('[data-st]').forEach(row => {
        const tw = row.querySelector('.st-tw').value, pr = row.querySelector('.st-pr').value;
        subtests[row.dataset.st] = { tw: tw ? Number(tw) : null, pr: pr ? Number(pr) : null };
      });
      Store.upsert('tmsBaseline', {
        id: 'baseline',
        datum: wrap.querySelector('#bl-datum').value || null,
        testwert: wrap.querySelector('#bl-tw').value ? Number(wrap.querySelector('#bl-tw').value) : null,
        prozentrang: wrap.querySelector('#bl-pr').value ? Number(wrap.querySelector('#bl-pr').value) : null,
        subtests,
      });
      state.editBaseline = false;
      renderHeader(el);
      renderBaselineCard(el);
    });
    wrap.querySelector('#bl-cancel')?.addEventListener('click', () => { state.editBaseline = false; renderBaselineCard(el); });
  }
}

function renderHeader(el) {
  const baseline = Store.tmsBaseline();
  el.querySelector('#tms-sub').textContent = baseline?.datum
    ? `Letzter Test: ${baseline.datum.split('-').reverse().join('.')}`
    : 'Noch keine Baseline eingetragen';
  el.querySelector('#tile-tw').textContent = baseline?.testwert ?? '—';
  el.querySelector('#tile-pr').textContent = baseline?.prozentrang ?? '—';
}

export function render(el) {
  el.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back">${ICONS.chevronLeft}</button>
      <div>
        <h1>TMS</h1>
        <div class="sub" id="tms-sub"></div>
      </div>
    </div>

    <div class="wide-2col">
    <div>
    <div class="stat-grid" style="margin-bottom:16px;">
      <div class="stat-tile"><div class="v" id="tile-tw">—</div><div class="l">Gesamtwert</div></div>
      <div class="stat-tile"><div class="v" id="tile-pr">—</div><div class="l">Prozentrang</div></div>
      <div class="stat-tile accent"><div class="v">${Store.TMS_ZIEL}</div><div class="l">Zielwert</div></div>
    </div>

    <div class="card" id="baseline-card"></div>
    </div>

    <div>
    <div class="card">
      <div class="card-title-row"><h2>Trefferquote-Verlauf</h2>
        <div class="segmented" id="tms-range" style="width:auto;">
          ${['week','month','year'].map(r => `<button data-range="${r}" class="${state.range===r?'active':''}">${RANGE_LABELS[r]}</button>`).join('')}
        </div>
      </div>
      <div class="tab-row" id="tms-subtests">
        ${Store.TMS_SUBTESTS.map(s => `<button class="pill-tab ${state.subtestId===s.id?'active':''}" data-subtest="${s.id}">${s.short}</button>`).join('')}
      </div>
      <div class="chart-wrap"><canvas id="tms-chart"></canvas></div>
    </div>

    <div class="card">
      <div class="card-title-row"><h2>Session erfassen</h2></div>
      <div class="field-group">
        <label class="field">Untertest</label>
        <select id="f-subtest">${Store.TMS_SUBTESTS.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
      </div>
      <div class="field-row">
        <div class="field-group"><label class="field">Datum</label><input type="date" id="f-date" value="${Store.todayKey()}"></div>
        <div class="field-group"><label class="field">Zeit (Min.)</label><input type="number" id="f-zeit" min="0" placeholder="z.B. 25"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label class="field">Bearbeitete Aufgaben</label><input type="number" id="f-bearbeitet" min="0" placeholder="z.B. 20"></div>
        <div class="field-group"><label class="field">Richtige</label><input type="number" id="f-richtige" min="0" placeholder="z.B. 14"></div>
      </div>
      <button class="btn primary" id="f-add" style="width:100%">Session hinzufügen</button>
    </div>

    <div class="card">
      <div class="card-title-row"><h2>Letzte Sessions</h2></div>
      <table class="data-table">
        <thead><tr><th>Datum</th><th>Untertest</th><th class="num">Aufg.</th><th class="num">Richtig</th><th class="num">Zeit</th><th class="num">Quote</th><th></th></tr></thead>
        <tbody id="tms-log-body"></tbody>
      </table>
    </div>
    </div>
    </div>
  `;

  el.querySelector('#back').addEventListener('click', () => navigate('/'));

  el.querySelector('#tms-subtests').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-subtest]');
    if (!btn) return;
    state.subtestId = btn.dataset.subtest;
    el.querySelectorAll('#tms-subtests .pill-tab').forEach(b => b.classList.toggle('active', b === btn));
    renderChart(el);
  });
  el.querySelector('#tms-range').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    state.range = btn.dataset.range;
    el.querySelectorAll('#tms-range button').forEach(b => b.classList.toggle('active', b === btn));
    renderChart(el);
  });

  el.querySelector('#f-add').addEventListener('click', () => {
    const bearbeitet = Number(el.querySelector('#f-bearbeitet').value);
    const richtige = Number(el.querySelector('#f-richtige').value);
    if (!bearbeitet) return;
    Store.upsert('tmsSessions', {
      subtestId: el.querySelector('#f-subtest').value,
      date: el.querySelector('#f-date').value || Store.todayKey(),
      bearbeitet, richtige,
      zeit: el.querySelector('#f-zeit').value ? Number(el.querySelector('#f-zeit').value) : null,
    });
    el.querySelector('#f-bearbeitet').value = '';
    el.querySelector('#f-richtige').value = '';
    el.querySelector('#f-zeit').value = '';
    renderChart(el);
    renderLog(el);
  });

  renderHeader(el);
  renderBaselineCard(el);
  renderChart(el);
  renderLog(el);

  const off = Store.on('mutation', (d) => {
    if (!d.fromRemote) return;
    if (['tmsSessions','*'].includes(d.table)) { renderChart(el); renderLog(el); }
    if (['tmsBaseline','*'].includes(d.table)) { renderHeader(el); if (!state.editBaseline) renderBaselineCard(el); }
  });
  return () => { off(); destroyChart(chart); };
}
