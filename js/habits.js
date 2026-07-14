import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import { lineChart, destroyChart, resolveColor } from './charts.js';

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

let habitChart = null;
let chartHabitId = 'all'; // 'all' = Überdiagramm mit allen Habits

// Cumulative "days done this month" for one habit — a rising line per habit.
function cumulativeSeries(habit) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), todayNum = now.getDate();
  const mp = String(m + 1).padStart(2, '0');
  const doneSet = new Set(
    Store.habitLogs(habit.id).filter(l => l.done && l.date.startsWith(`${y}-${mp}`)).map(l => Number(l.date.slice(8, 10)))
  );
  const labels = [], data = [];
  let sum = 0;
  for (let d = 1; d <= todayNum; d++) {
    if (doneSet.has(d)) sum++;
    labels.push(String(d));
    data.push(sum);
  }
  return { labels, data };
}

function renderChartTabs(el) {
  const wrap = el.querySelector('#habit-chart-tabs');
  if (!wrap) return;
  const habits = Store.habits();
  if (chartHabitId !== 'all' && !habits.some(h => h.id === chartHabitId)) chartHabitId = 'all';
  wrap.innerHTML = [{ id: 'all', name: 'Alle', color: null }, ...habits].map(t => {
    const active = chartHabitId === t.id;
    const c = t.color ? resolveColor(t.color) : null;
    return `<button class="pill-tab ${active ? 'active' : ''}" data-ch="${t.id}"
      style="${active && c ? `background:${c};color:#000;border-color:${c}` : ''}">${t.name}</button>`;
  }).join('');
  wrap.querySelectorAll('[data-ch]').forEach(btn => btn.addEventListener('click', () => {
    chartHabitId = btn.dataset.ch;
    renderChartTabs(el);
    renderHabitChart(el);
  }));
}

function renderHabitChart(el) {
  const canvas = el.querySelector('#habit-chart');
  if (!canvas || !window.Chart) return;
  const habits = Store.habits();
  destroyChart(habitChart);
  habitChart = null;
  const legend = el.querySelector('#habit-chart-legend');
  if (!habits.length) { if (legend) legend.innerHTML = ''; return; }

  if (chartHabitId === 'all') {
    const series = habits.map(h => ({ h, s: cumulativeSeries(h) }));
    habitChart = lineChart(canvas.getContext('2d'), {
      labels: series[0].s.labels,
      datasets: series.map(({ h, s }) => ({ data: s.data, color: resolveColor(h.color), label: h.name })),
      yLabel: 'Tage geschafft', yStep: 1,
    });
    if (legend) legend.innerHTML = habits.map(h =>
      `<span class="item"><span class="dot" style="background:${h.color}"></span>${h.name}</span>`).join('');
  } else {
    const habit = habits.find(h => h.id === chartHabitId);
    const s = cumulativeSeries(habit);
    const c = resolveColor(habit.color);
    habitChart = lineChart(canvas.getContext('2d'), {
      labels: s.labels,
      datasets: [{ data: s.data, color: c, fill: true, backgroundColor: c + '22', label: habit.name }],
      yLabel: 'Tage geschafft', yStep: 1,
    });
    if (legend) legend.innerHTML = '';
  }
}

function habitCard(habit) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const total = daysInMonth(y, m);
  const todayNum = now.getDate();
  const logs = Store.habitLogs(habit.id);
  const doneSet = new Set(logs.filter(l => l.done && l.date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).map(l => Number(l.date.slice(8, 10))));
  const doneCount = doneSet.size;
  const rate = Math.round((doneCount / todayNum) * 100);

  const bars = Array.from({ length: total }, (_, i) => {
    const dayNum = i + 1;
    const isFuture = dayNum > todayNum;
    const isToday = dayNum === todayNum;
    const done = doneSet.has(dayNum);
    return `<div class="bar-col ${isFuture ? 'future' : ''} ${isToday ? 'today' : ''}" data-day="${dayNum}" title="${dayNum}.${m+1}.">
      <div class="fill" style="height:${done ? '100' : '0'}%;background:${habit.color}"></div>
    </div>`;
  }).join('');

  return `
    <div class="card habit-card" data-habit="${habit.id}">
      <div class="habit-head">
        <div class="name"><span class="dot" style="background:${habit.color}"></span>${habit.name}</div>
        <div class="rate">${doneCount}/${todayNum} · ${isFinite(rate) ? rate : 0}%</div>
      </div>
      <div class="habit-bars">${bars}</div>
      <div class="habit-meta"><span>1.</span><span>${MONTH_NOW}</span><span>${total}.</span></div>
    </div>
  `;
}

const MONTH_NOW_DATE = new Date();
const MONTH_NOW = MONTH_NOW_DATE.toLocaleDateString('de-DE', { month: 'long' });

function renderHabits(el) {
  const habits = Store.habits();
  const wrap = el.querySelector('#habits-list');
  if (!habits.length) {
    wrap.innerHTML = `<div class="empty-state">Keine Habits angelegt. Füge sie in den Einstellungen hinzu.</div>`;
    return;
  }
  wrap.innerHTML = habits.map(habitCard).join('');
  // Only today is tappable — past days are read-only history (no cheating),
  // future days are locked anyway.
  wrap.querySelectorAll('.habit-card').forEach(card => {
    const habitId = card.dataset.habit;
    card.querySelector('.bar-col.today')?.addEventListener('click', () => {
      const date = Store.todayKey();
      const existing = Store.list('habitLogs').find(l => l.habitId === habitId && l.date === date);
      Store.upsert('habitLogs', { id: existing?.id, habitId, date, done: !(existing && existing.done) });
      renderHabits(el);
      renderHabitChart(el);
    });
  });
}

function renderTodos(el) {
  const mKey = Store.monthKey();
  const todos = Store.todos(mKey);
  const wrap = el.querySelector('#todo-list');
  if (!todos.length) {
    wrap.innerHTML = `<div class="empty-state">Keine To-Dos diesen Monat. Füge welche hinzu.</div>`;
  } else {
    wrap.innerHTML = todos.map(t => `
      <div class="todo-row ${t.done ? 'done' : ''}" data-todo="${t.id}">
        <div class="check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div>
        <div class="text">${t.text}</div>
        <button class="del">×</button>
      </div>
    `).join('');
  }
  wrap.querySelectorAll('.todo-row').forEach(row => {
    const id = row.dataset.todo;
    row.querySelector('.check').addEventListener('click', () => {
      const t = Store.list('todos').find(x => x.id === id);
      Store.upsert('todos', { id, done: !t.done });
      renderTodos(el);
    });
    row.querySelector('.del').addEventListener('click', () => { Store.remove('todos', id); renderTodos(el); });
  });
}

export function render(el) {
  const mKey = Store.monthKey();
  el.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back">${ICONS.chevronLeft}</button>
      <div><h1>To-Dos & Habits</h1><div class="sub">Setzt sich jeden Kalendermonat zurück</div></div>
    </div>

    <div class="wide-2col">
    <div>
    <div class="card">
      <div class="card-title-row"><h2>Habits — ${MONTH_NOW}</h2></div>
      <div class="tab-row" id="habit-chart-tabs" style="margin-bottom:8px;"></div>
      <div style="height:170px;position:relative;"><canvas id="habit-chart"></canvas></div>
      <div class="chart-legend" id="habit-chart-legend"></div>
    </div>
    <div id="habits-list"></div>
    </div>

    <div>
    <div class="card">
      <div class="card-title-row"><h2>To-Dos</h2></div>
      <div id="todo-list"></div>
      <div class="field-row" style="margin-top:12px;">
        <input type="text" id="new-todo" placeholder="Neues To-Do…">
        <button class="btn primary" id="add-todo" style="flex:0 0 auto;">${ICONS.plus.replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;stroke-width:2"')}</button>
      </div>
    </div>
    </div>
    </div>
  `;

  el.querySelector('#back').addEventListener('click', () => navigate('/'));

  function addTodo() {
    const input = el.querySelector('#new-todo');
    const text = input.value.trim();
    if (!text) return;
    const count = Store.todos(mKey).length;
    Store.upsert('todos', { text, done: false, monthKey: mKey, order: count });
    input.value = '';
    renderTodos(el);
  }
  el.querySelector('#add-todo').addEventListener('click', addTodo);
  el.querySelector('#new-todo').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

  renderHabits(el);
  renderChartTabs(el);
  renderHabitChart(el);
  renderTodos(el);

  const off = Store.on('mutation', (d) => {
    if (d.fromRemote && ['habits','habitLogs','*'].includes(d.table)) { renderHabits(el); renderChartTabs(el); renderHabitChart(el); }
    if (d.fromRemote && ['todos','*'].includes(d.table)) renderTodos(el);
  });
  return () => { off(); destroyChart(habitChart); };
}
