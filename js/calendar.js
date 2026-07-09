import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import {
  WEEKDAY_LABELS, MONTH_LABELS, dateKey, getEventsForDate, categoryColor, eventColor, categoryLabel, formatTime,
} from './calendarUtils.js';

let state = { view: 'month', selected: new Date() };
state.selected.setHours(0, 0, 0, 0);

function addUnit(date, unit, n) {
  const d = new Date(date);
  if (unit === 'day') d.setDate(d.getDate() + n);
  if (unit === 'week') d.setDate(d.getDate() + 7 * n);
  if (unit === 'month') d.setMonth(d.getMonth() + n);
  if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  return d;
}

function agendaHtml(date) {
  const events = getEventsForDate(date);
  if (!events.length) return `<div class="empty-state">Keine Termine.</div>`;
  return events.map(ev => `
    <div class="event-row" data-ev="${ev.id}" data-virtual="${!!ev.virtual}">
      <div class="bar" style="background:${eventColor(ev)}"></div>
      <div class="time">${formatTime(ev.start)}</div>
      <div class="body">
        <div class="title">${ev.title}</div>
        <div class="cat">${categoryLabel(ev.category)}${ev.recurrence === 'weekly' ? ' · wöchentlich' : ''}</div>
      </div>
      ${!ev.virtual ? `<button class="del" data-del="${ev.id}">×</button>` : ''}
    </div>
  `).join('');
}

function renderAgenda(el, date) {
  el.querySelector('#agenda-title').textContent = `${WEEKDAY_LABELS[date.getDay()]}, ${date.getDate()}. ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
  const wrap = el.querySelector('#agenda-list');
  wrap.innerHTML = agendaHtml(date);
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); Store.remove('calendarEvents', btn.dataset.del); renderAll(el); });
  });
}

function dayEventDots(date) {
  const colors = [...new Set(getEventsForDate(date).map(e => eventColor(e)))].slice(0, 3);
  return colors.map(c => `<span style="background:${c}"></span>`).join('');
}

function renderMonthGrid(el) {
  const cur = state.selected;
  const y = cur.getFullYear(), m = cur.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ d: prevDays - i, other: true, date: new Date(y, m - 1, prevDays - i) });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, other: false, date: new Date(y, m, d) });
  while (cells.length % 7 !== 0) { const n = cells.length - (startOffset + daysInMonth) + 1; cells.push({ d: n, other: true, date: new Date(y, m + 1, n) }); }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return `
    <div class="cal-grid">
      ${WEEKDAY_LABELS.map((_, i) => `<div class="cal-dow">${WEEKDAY_LABELS[(i)%7]}</div>`).join('')}
      ${cells.map(c => {
        const isToday = dateKey(c.date) === dateKey(today);
        const isSelected = dateKey(c.date) === dateKey(state.selected);
        return `<div class="cal-day ${c.other ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateKey(c.date)}">
          <span>${c.d}</span>
          <div class="dots">${dayEventDots(c.date)}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderWeekStrip(el) {
  const cur = state.selected;
  const dow = cur.getDay();
  const monday = addUnit(cur, 'day', -((dow + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addUnit(monday, 'day', i));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return `<div class="week-strip">
    ${days.map(d => `<div class="wday ${dateKey(d)===dateKey(today)?'today':''} ${dateKey(d)===dateKey(state.selected)?'selected':''}" data-date="${dateKey(d)}">
      <div class="l1">${WEEKDAY_LABELS[d.getDay()]}</div><div class="l2">${d.getDate()}</div>
    </div>`).join('')}
  </div>`;
}

function renderYearGrid(el) {
  const y = state.selected.getFullYear();
  const today = new Date();
  return `<div class="year-grid">
    ${MONTH_LABELS.map((label, m) => {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startOffset = new Date(y, m, 1).getDay();
      let cells = '';
      for (let i = 0; i < startOffset; i++) cells += `<span></span>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const hasEvent = getEventsForDate(date).length > 0;
        const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
        cells += `<span class="${hasEvent ? 'has-event' : ''} ${isToday ? 'is-today' : ''}">${d}</span>`;
      }
      return `<div class="year-month" data-month="${m}"><div class="mlabel">${label.slice(0,3)}</div><div class="mgrid">${cells}</div></div>`;
    }).join('')}
  </div>`;
}

function renderNavHeader(el) {
  const cur = state.selected;
  let label;
  if (state.view === 'day') label = `${cur.getDate()}. ${MONTH_LABELS[cur.getMonth()]} ${cur.getFullYear()}`;
  else if (state.view === 'week') label = `KW im ${MONTH_LABELS[cur.getMonth()]} ${cur.getFullYear()}`;
  else if (state.view === 'month') label = `${MONTH_LABELS[cur.getMonth()]} ${cur.getFullYear()}`;
  else label = `${cur.getFullYear()}`;
  el.querySelector('#nav-label').textContent = label;
}

function renderView(el) {
  const body = el.querySelector('#cal-body');
  if (state.view === 'day') {
    body.innerHTML = '';
  } else if (state.view === 'week') {
    body.innerHTML = renderWeekStrip(el);
  } else if (state.view === 'month') {
    body.innerHTML = renderMonthGrid(el);
  } else if (state.view === 'year') {
    body.innerHTML = renderYearGrid(el);
  }
  renderNavHeader(el);
  wireBody(el);
  if (state.view !== 'year') {
    el.querySelector('#agenda-section').style.display = '';
    renderAgenda(el, state.selected);
  } else {
    el.querySelector('#agenda-section').style.display = 'none';
  }
}

function wireBody(el) {
  el.querySelectorAll('[data-date]').forEach(node => {
    node.addEventListener('click', () => {
      const [y, m, d] = node.dataset.date.split('-').map(Number);
      state.selected = new Date(y, m - 1, d);
      renderView(el);
    });
  });
  el.querySelectorAll('[data-month]').forEach(node => {
    node.addEventListener('click', () => {
      state.selected = new Date(state.selected.getFullYear(), Number(node.dataset.month), 1);
      state.view = 'month';
      el.querySelectorAll('#cal-view-switch button').forEach(b => b.classList.toggle('active', b.dataset.view === 'month'));
      renderView(el);
    });
  });
}

function renderAll(el) { renderView(el); }

function openAddEventForm(el) {
  const modal = el.querySelector('#event-form');
  modal.style.display = 'block';
  el.querySelector('#f-ev-date').value = dateKey(state.selected);
}

export function render(el) {
  el.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="back">${ICONS.chevronLeft}</button>
      <div style="flex:1"><h1>Kalender</h1></div>
      <button class="back-btn" id="add-event-btn">${ICONS.plus.replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;stroke-width:2"')}</button>
    </div>

    <div class="segmented" style="margin-bottom:14px;" id="cal-view-switch">
      ${['day','week','month','year'].map(v => `<button data-view="${v}" class="${state.view===v?'active':''}">${{day:'Tag',week:'Woche',month:'Monat',year:'Jahr'}[v]}</button>`).join('')}
    </div>

    <div class="card" id="event-form" style="display:none;">
      <div class="card-title-row"><h2>Neuer Termin</h2><button class="btn ghost" id="close-form">Schließen</button></div>
      <div class="field-group"><label class="field">Titel</label><input type="text" id="f-ev-title" placeholder="z.B. Anatomie Vorlesung"></div>
      <div class="field-row">
        <div class="field-group"><label class="field">Kategorie</label>
          <select id="f-ev-cat"><option value="stundenplan">Stundenplan</option><option value="other">Sonstiges</option></select>
        </div>
        <div class="field-group"><label class="field">Wiederholung</label>
          <select id="f-ev-rec"><option value="none">Keine</option><option value="weekly">Wöchentlich</option></select>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group"><label class="field">Datum</label><input type="date" id="f-ev-date"></div>
        <div class="field-group"><label class="field">Uhrzeit</label><input type="time" id="f-ev-time" value="09:00"></div>
      </div>
      <button class="btn primary" id="f-ev-add" style="width:100%">Termin speichern</button>
    </div>

    <div class="card" style="text-align:center;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <button class="btn ghost" id="nav-prev">${ICONS.chevronLeft.replace('<svg', '<svg style="width:18px;height:18px;stroke:var(--text-primary);stroke-width:2.4"')}</button>
        <div id="nav-label" style="font-weight:700;font-size:14px;"></div>
        <button class="btn ghost" id="nav-next" style="transform:rotate(180deg);">${ICONS.chevronLeft.replace('<svg', '<svg style="width:18px;height:18px;stroke:var(--text-primary);stroke-width:2.4"')}</button>
      </div>
      <div id="cal-body"></div>
    </div>

    <div class="card" id="agenda-section">
      <div class="card-title-row"><h2 id="agenda-title"></h2></div>
      <div id="agenda-list"></div>
    </div>
  `;

  el.querySelector('#back').addEventListener('click', () => navigate('/'));
  el.querySelector('#add-event-btn').addEventListener('click', () => openAddEventForm(el));
  el.querySelector('#close-form').addEventListener('click', () => { el.querySelector('#event-form').style.display = 'none'; });

  el.querySelector('#cal-view-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view;
    el.querySelectorAll('#cal-view-switch button').forEach(b => b.classList.toggle('active', b === btn));
    renderView(el);
  });

  const unit = () => ({ day: 'day', week: 'week', month: 'month', year: 'year' }[state.view]);
  el.querySelector('#nav-prev').addEventListener('click', () => { state.selected = addUnit(state.selected, unit(), -1); renderView(el); });
  el.querySelector('#nav-next').addEventListener('click', () => { state.selected = addUnit(state.selected, unit(), 1); renderView(el); });

  el.querySelector('#f-ev-add').addEventListener('click', () => {
    const title = el.querySelector('#f-ev-title').value.trim();
    if (!title) return;
    Store.upsert('calendarEvents', {
      title,
      category: el.querySelector('#f-ev-cat').value,
      recurrence: el.querySelector('#f-ev-rec').value,
      start: `${el.querySelector('#f-ev-date').value}T${el.querySelector('#f-ev-time').value}`,
      end: null, allDay: false, source: 'local',
    });
    el.querySelector('#f-ev-title').value = '';
    el.querySelector('#event-form').style.display = 'none';
    renderAll(el);
  });

  renderView(el);

  const off = Store.on('mutation', (d) => { if (d.fromRemote && ['calendarEvents','gymDays'].includes(d.table)) renderAll(el); });
  return off;
}
