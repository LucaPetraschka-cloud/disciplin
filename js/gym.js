import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import { lineChart, destroyChart, resolveColor, SERIES_COLORS } from './charts.js';
import { buildBuckets, RANGE_LABELS } from './timeseries.js';
import { WEEKDAY_LABELS_LONG } from './calendarUtils.js';

let chart = null;
let state = { dayId: null, exerciseId: null, range: 'month' };

function lastLog(exerciseId, beforeDate) {
  const logs = Store.gymLogs(exerciseId).filter(l => l.date < beforeDate);
  return logs[logs.length - 1] || null;
}

function renderDayCard(el) {
  const days = Store.gymDays();
  if (!state.dayId) {
    const todayWd = new Date().getDay();
    state.dayId = (days.find(d => d.weekday === todayWd) || days[0] || {}).id || null;
  }
  const container = el.querySelector('#gym-day-section');
  if (!days.length) {
    container.innerHTML = `<div class="empty-state"><div class="big">🏋️</div>Noch keine Trainingstage angelegt.<br>Füge sie in den Einstellungen hinzu.</div>`;
    return;
  }
  const day = days.find(d => d.id === state.dayId) || days[0];
  const exercises = Store.gymExercises(day.id);
  const today = Store.todayKey();

  container.innerHTML = `
    <div class="tab-row" id="gym-day-tabs">
      ${days.map(d => `<button class="pill-tab ${d.id===day.id?'active':''}" data-day="${d.id}">${d.label}</button>`).join('')}
    </div>
    <div class="hint" style="margin-bottom:10px;">${day.muscleGroup}</div>
    ${!exercises.length ? `<div class="empty-state">Keine Übungen für diesen Tag. In den Einstellungen hinzufügen.</div>` : `
    <table class="data-table">
      <thead><tr><th>Übung</th><th class="num">Letztes</th><th class="num">Reps</th><th class="num">Kg</th><th></th></tr></thead>
      <tbody>
        ${exercises.map(ex => {
          const last = lastLog(ex.id, today);
          const todayLog = Store.gymLogs(ex.id).find(l => l.date === today);
          return `<tr data-ex="${ex.id}">
            <td>${ex.name}</td>
            <td class="num" style="color:var(--text-muted)">${last ? `${last.reps}×${last.weight}kg` : '—'}</td>
            <td class="num"><input type="number" class="in-reps" style="width:52px;text-align:right;" value="${todayLog ? todayLog.reps : ''}" placeholder="${last ? last.reps : '-'}"></td>
            <td class="num"><input type="number" class="in-weight" style="width:58px;text-align:right;" value="${todayLog ? todayLog.weight : ''}" placeholder="${last ? last.weight : '-'}"></td>
            <td class="del-cell"><button class="save-log" title="Heute speichern">✓</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  `;

  container.querySelector('#gym-day-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    state.dayId = btn.dataset.day;
    renderDayCard(el);
  });

  container.querySelectorAll('.save-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      const exId = row.dataset.ex;
      const reps = Number(row.querySelector('.in-reps').value);
      const weight = Number(row.querySelector('.in-weight').value);
      if (!reps || !weight) return;
      const existing = Store.gymLogs(exId).find(l => l.date === today);
      Store.upsert('gymLogs', { id: existing?.id, exerciseId: exId, date: today, reps, weight });
      renderDayCard(el);
      populateExercisePicker(el);
      renderChart(el);
    });
  });
}

function allExercises() {
  return Store.gymDays().flatMap(d => Store.gymExercises(d.id).map(ex => ({ ...ex, dayLabel: d.label })));
}

function populateExercisePicker(el) {
  const exercises = allExercises();
  if (!exercises.length) { state.exerciseId = null; return; }
  if (!state.exerciseId || !exercises.find(e => e.id === state.exerciseId)) state.exerciseId = exercises[0].id;
  const wrap = el.querySelector('#gym-exercise-picker');
  wrap.innerHTML = exercises.map((ex, i) => `<button class="pill-tab ${ex.id===state.exerciseId?'active':''}" data-ex="${ex.id}" style="${ex.id===state.exerciseId?`background:${SERIES_COLORS[i%8]};color:#000;border-color:${SERIES_COLORS[i%8]}`:''}">${ex.name}</button>`).join('');
  wrap.querySelectorAll('[data-ex]').forEach(btn => {
    btn.addEventListener('click', () => { state.exerciseId = btn.dataset.ex; populateExercisePicker(el); renderChart(el); });
  });
}

function renderChart(el) {
  const canvas = el.querySelector('#gym-chart');
  destroyChart(chart);
  if (!state.exerciseId) return;
  const logs = Store.gymLogs(state.exerciseId);
  const buckets = buildBuckets(state.range);
  const points = buckets.map(b => {
    const inRange = logs.filter(l => l.date >= b.from && l.date <= b.to);
    if (!inRange.length) return null;
    return Math.max(...inRange.map(l => l.weight));
  });
  const idx = allExercises().findIndex(e => e.id === state.exerciseId);
  chart = lineChart(canvas.getContext('2d'), {
    labels: buckets.map(b => b.label),
    datasets: [{ label: 'Gewicht', data: points, color: SERIES_COLORS[Math.max(idx, 0) % 8] }],
    yLabel: 'kg',
  });
}

export function render(el) {
  el.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back">${ICONS.chevronLeft}</button>
      <div><h1>Gym</h1><div class="sub">Training & Progress</div></div>
    </div>

    <div class="wide-2col">
    <div>
    <div class="card" id="gym-day-card">
      <div class="card-title-row"><h2>Heutiges Training</h2></div>
      <div id="gym-day-section"></div>
    </div>
    </div>

    <div>
    <div class="card">
      <div class="card-title-row"><h2>Progress</h2>
        <div class="segmented" id="gym-range" style="width:auto;">
          ${['week','month','halfyear','year'].map(r => `<button data-range="${r}" class="${state.range===r?'active':''}">${RANGE_LABELS[r]}</button>`).join('')}
        </div>
      </div>
      <div class="tab-row" id="gym-exercise-picker"></div>
      <div class="chart-wrap"><canvas id="gym-chart"></canvas></div>
    </div>
    </div>
    </div>
  `;

  el.querySelector('#back').addEventListener('click', () => navigate('/'));
  el.querySelector('#gym-range').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    state.range = btn.dataset.range;
    el.querySelectorAll('#gym-range button').forEach(b => b.classList.toggle('active', b === btn));
    renderChart(el);
  });

  renderDayCard(el);
  populateExercisePicker(el);
  renderChart(el);

  const off = Store.on('mutation', (d) => {
    if (d.fromRemote && ['gymDays','gymExercises','gymLogs'].includes(d.table)) {
      renderDayCard(el); populateExercisePicker(el); renderChart(el);
    }
  });
  return () => { off(); destroyChart(chart); };
}
