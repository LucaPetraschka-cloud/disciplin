import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import { lineChart, destroyChart, resolveColor } from './charts.js';

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

let habitChart = null;

// Daily completion rate this month: share of active habits ticked off each day.
function habitCompletionSeries() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), todayNum = now.getDate();
  const mp = String(m + 1).padStart(2, '0');
  const habits = Store.habits();
  const total = habits.length || 1;
  const logsByHabit = habits.map(h => Store.habitLogs(h.id));
  const labels = [], data = [];
  for (let d = 1; d <= todayNum; d++) {
    const dk = `${y}-${mp}-${String(d).padStart(2, '0')}`;
    let done = 0;
    logsByHabit.forEach(logs => { if (logs.some(l => l.date === dk && l.done)) done++; });
    labels.push(String(d));
    data.push(Math.round((done / total) * 100));
  }
  return { labels, data };
}

function renderHabitChart(el) {
  const canvas = el.querySelector('#habit-chart');
  if (!canvas || !window.Chart) return;
  const { labels, data } = habitCompletionSeries();
  destroyChart(habitChart);
  const green = resolveColor('var(--section-habits)');
  habitChart = lineChart(canvas.getContext('2d'), {
    labels,
    datasets: [{ data, color: green, fill: true, backgroundColor: green + '22' }],
    yLabel: '% erledigt', suggestedMax: 100,
  });
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
  wrap.querySelectorAll('.habit-card').forEach(card => {
    const habitId = card.dataset.habit;
    card.querySelectorAll('.bar-col:not(.future)').forEach(bar => {
      bar.addEventListener('click', () => {
        const now = new Date();
        const dayNum = Number(bar.dataset.day);
        const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const logs = Store.list('habitLogs');
        const existing = logs.find(l => l.habitId === habitId && l.date === date);
        Store.upsert('habitLogs', { id: existing?.id, habitId, date, done: !(existing && existing.done) });
        renderHabits(el);
        renderHabitChart(el);
      });
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

    <div class="card">
      <div class="card-title-row"><h2>Habits — ${MONTH_NOW}</h2></div>
      <div class="hint" style="margin-bottom:8px;">Anteil erledigter Habits pro Tag</div>
      <div style="height:150px;position:relative;"><canvas id="habit-chart"></canvas></div>
    </div>
    <div id="habits-list"></div>

    <div class="card">
      <div class="card-title-row"><h2>To-Dos</h2></div>
      <div id="todo-list"></div>
      <div class="field-row" style="margin-top:12px;">
        <input type="text" id="new-todo" placeholder="Neues To-Do…">
        <button class="btn primary" id="add-todo" style="flex:0 0 auto;">${ICONS.plus.replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;stroke-width:2"')}</button>
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
  renderHabitChart(el);
  renderTodos(el);

  const off = Store.on('mutation', (d) => {
    if (d.fromRemote && ['habits','habitLogs'].includes(d.table)) { renderHabits(el); renderHabitChart(el); }
    if (d.fromRemote && d.table === 'todos') renderTodos(el);
  });
  return () => { off(); destroyChart(habitChart); };
}
