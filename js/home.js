import { Store } from './store.js';
import { getDailyQuote } from './quotes.js';
import { getEventsForDate, eventColor, formatTime } from './calendarUtils.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';

// --- 2-day timeline widget (Apple calendar widget style) --------------------

function resolveCssColor(value) {
  const m = /var\((--[a-zA-Z0-9-]+)\)/.exec(value || '');
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : value;
}

function timedEventsFor(date) {
  return getEventsForDate(date)
    .filter(e => !e.allDay && e.start && e.start.length > 10)
    .map(ev => {
      const s = new Date(ev.start);
      const e2 = ev.end && ev.end.length > 10 ? new Date(ev.end) : new Date(s.getTime() + 45 * 60000);
      return { ...ev, _s: s, _e: e2 };
    })
    .filter(x => !isNaN(x._s.getTime()))
    .sort((a, b) => a._s - b._s);
}

function allDayEventsFor(date) {
  return getEventsForDate(date).filter(e => e.allDay);
}

// Shared hour range across both day columns so the timelines line up.
function computeRange(evsA, evsB) {
  let startH = 8, endH = 16;
  [...evsA, ...evsB].forEach(ev => {
    startH = Math.min(startH, ev._s.getHours());
    endH = Math.max(endH, ev._e.getHours() + (ev._e.getMinutes() > 0 ? 1 : 0));
  });
  startH = Math.max(0, startH);
  endH = Math.min(24, Math.max(endH, startH + 6));
  return { startH, endH };
}

function pctFor(dt, dayStart, startH, endH) {
  const mins = (dt - dayStart) / 60000 - startH * 60;
  const span = (endH - startH) * 60;
  return Math.max(0, Math.min(100, (mins / span) * 100));
}

function dayColumnHtml(date, label, isToday, range) {
  const evs = timedEventsFor(date);
  const alldays = allDayEventsFor(date);
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const { startH, endH } = range;

  // hour gridlines + labels
  let linesHtml = '';
  for (let h = startH; h <= endH; h++) {
    const top = ((h - startH) / (endH - startH)) * 100;
    linesHtml += `<div class="hour-line" style="top:${top}%"></div><div class="hour-lbl" style="top:${top}%">${h}</div>`;
  }

  // event blocks
  const blocksHtml = evs.map(ev => {
    const top = pctFor(ev._s, dayStart, startH, endH);
    const bottom = pctFor(ev._e, dayStart, startH, endH);
    const height = Math.max(bottom - top, 4.5);
    const color = resolveCssColor(eventColor(ev));
    const showTime = height > 8;
    return `<div class="w-event" style="top:${top}%;height:${height}%;border-left-color:${color};background:${color}26;">
      <div class="t">${ev.title}</div>
      ${showTime ? `<div class="tm">${formatTime(ev.start)}</div>` : ''}
    </div>`;
  }).join('');

  // current-time indicator (only in today's column, only when inside the range)
  let nowHtml = '';
  if (isToday) {
    const now = new Date();
    const nowPct = pctFor(now, dayStart, startH, endH);
    if (nowPct > 0 && nowPct < 100) nowHtml = `<div class="now-line" id="now-line" style="top:${nowPct}%"></div>`;
  }

  const alldayHtml = alldays.length
    ? `<div class="allday-row">${alldays.map(ev => `<span class="allday-chip" style="border-color:${resolveCssColor(eventColor(ev))}">${ev.title}</span>`).join('')}</div>`
    : '';

  return `
    <div class="daycol">
      <div class="daycol-head">
        <span class="lbl ${isToday ? 'today' : ''}">${label}</span>
        <span class="num">${date.getDate()}.</span>
      </div>
      ${alldayHtml}
      <div class="daycol-body">${linesHtml}${blocksHtml}${nowHtml}</div>
    </div>
  `;
}

// --- current / next event line ----------------------------------------------

function nowNextHtml() {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const todays = timedEventsFor(now);
  const current = todays.find(ev => ev._s <= now && now < ev._e);
  let next = todays.find(ev => ev._s > now);
  let nextIsTomorrow = false;
  if (!next) { next = timedEventsFor(tomorrow)[0]; nextIsTomorrow = !!next; }

  const parts = [];
  if (current) {
    parts.push(`<div class="nn-row"><span class="nn-dot pulse" style="background:${resolveCssColor(eventColor(current))}"></span><span class="nn-lbl">Jetzt</span><span class="nn-title">${current.title}</span><span class="nn-time">bis ${formatTime(current.end || '')}</span></div>`);
  }
  if (next) {
    parts.push(`<div class="nn-row"><span class="nn-dot" style="background:${resolveCssColor(eventColor(next))}"></span><span class="nn-lbl">Danach</span><span class="nn-title">${next.title}</span><span class="nn-time">${formatTime(next.start)}${nextIsTomorrow ? ' · morgen' : ''}</span></div>`);
  }
  if (!parts.length) return `<div class="nn-row"><span class="nn-lbl">Keine weiteren Termine</span></div>`;
  return parts.join('');
}

// --- screen -------------------------------------------------------------------

export function render(el) {
  // One store listener + one clock for the whole screen lifetime. draw() only
  // rebuilds the DOM — it must never register anything persistent, otherwise
  // every sync event would stack another listener (exponential re-renders that
  // froze the UI: clicks dead, scrolling still alive).
  let disposed = false;
  let redrawTimer = null;
  let range = { startH: 8, endH: 16 };

  const draw = () => {
  const quote = getDailyQuote();
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  const evsToday = timedEventsFor(now);
  const evsTomorrow = timedEventsFor(tomorrow);
  range = computeRange(evsToday, evsTomorrow);

  const weekdayLong = now.toLocaleDateString('de-DE', { weekday: 'long' });

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:-30px;position:relative;z-index:1;">
      <button class="topbar .back-btn" id="settings-btn" style="background:var(--surface-1);border:1px solid var(--border-hairline);color:var(--text-primary);width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${ICONS.gear.replace('<svg', '<svg style="width:18px;height:18px;fill:currentColor"')}</button>
    </div>
    <div class="home-title">DISCIPLIN</div>
    <div class="home-quote">„${quote.text}"</div>

    <div class="goal-strip">${ICONS.flag.replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;stroke-width:1.9"')} Ziel Prozentrang: <span class="goal-value">93</span></div>
    <div style="height:12px"></div>

    <div class="home-grid">
      <div class="day-widget" id="day-widget">
        ${dayColumnHtml(now, weekdayLong, true, range)}
        ${dayColumnHtml(tomorrow, 'Morgen', false, range)}
      </div>

      <div class="home-rest">
        <div class="now-next" id="now-next">${nowNextHtml()}</div>

        <div class="tile-grid">
          <div class="tile" data-nav="/tms">${ICONS.cap}<span>TMS</span></div>
          <div class="tile" data-nav="/gym">${ICONS.dumbbell}<span>GYM</span></div>
          <div class="tile" data-nav="/habits">${ICONS.checklist}<span>TO-DOS</span></div>
        </div>
      </div>
    </div>
  `;

  el.querySelector('#day-widget').addEventListener('click', () => navigate('/calendar'));
  el.querySelector('#settings-btn').addEventListener('click', () => navigate('/settings'));
  el.querySelectorAll('[data-nav]').forEach(t => t.addEventListener('click', () => navigate(t.dataset.nav)));
  }; // end draw()

  draw();

  // keep the now-line + now/next row current without re-rendering everything
  const tick = setInterval(() => {
    if (disposed) return;
    const nowLine = el.querySelector('#now-line');
    if (nowLine) {
      const d = new Date(); const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const pct = pctFor(d, dayStart, range.startH, range.endH);
      if (pct > 0 && pct < 100) nowLine.style.top = pct + '%'; else nowLine.remove();
    }
    const nn = el.querySelector('#now-next');
    if (nn) nn.innerHTML = nowNextHtml();
  }, 60000);

  // Coalesce bursts of sync events (initial pull, realtime echoes) into one redraw.
  const off = Store.on('mutation', () => {
    if (disposed) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(() => { if (!disposed) draw(); }, 100);
  });

  return () => { disposed = true; off(); clearInterval(tick); clearTimeout(redrawTimer); };
}
