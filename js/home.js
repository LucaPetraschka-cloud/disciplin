import { Store } from './store.js';
import { getDailyQuote } from './quotes.js';
import { getUpcomingEvents, formatWhen, categoryColor } from './calendarUtils.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';

export function render(el) {
  const quote = getDailyQuote();
  const now = new Date();
  const next = getUpcomingEvents(now, 1)[0];

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:-30px;position:relative;z-index:1;">
      <button class="topbar .back-btn" id="settings-btn" style="background:var(--surface-1);border:1px solid var(--border-hairline);color:var(--text-muted);width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${ICONS.gear.replace('<svg', '<svg style="width:18px;height:18px;fill:currentColor"')}</button>
    </div>
    <div class="home-title">DISCIPLIN</div>

    <div class="goal-strip">${ICONS.target.replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;stroke-width:2"')} Ziel TMS-Testwert: <span style="color:var(--text-primary)">93</span></div>
    <div style="height:12px"></div>

    <div class="quote-card">
      <div class="quote-text">„${quote.text}“</div>
      <div class="quote-author">— ${quote.author}</div>
    </div>

    <div class="mini-cal" id="mini-cal">
      <div class="date-block">
        <div class="dow">${now.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
        <div class="dom">${now.getDate()}</div>
      </div>
      <div class="info">
        <div class="today-label">Heute</div>
        ${next ? `
          <div class="next-event">${next.title}</div>
          <div class="next-when">${formatWhen(next, now)}</div>
        ` : `<div class="next-event">Keine anstehenden Termine</div>`}
      </div>
      <div class="chev">${ICONS.chevron}</div>
    </div>

    <div class="tile-grid">
      <div class="tile tms" data-nav="/tms">${ICONS.target}<span>TMS</span></div>
      <div class="tile gym" data-nav="/gym">${ICONS.dumbbell}<span>GYM</span></div>
      <div class="tile todos" data-nav="/habits">${ICONS.checklist}<span>TO-DOS</span></div>
    </div>
  `;

  el.querySelector('#mini-cal').addEventListener('click', () => navigate('/calendar'));
  el.querySelector('#settings-btn').addEventListener('click', () => navigate('/settings'));
  el.querySelectorAll('[data-nav]').forEach(t => t.addEventListener('click', () => navigate(t.dataset.nav)));

  const off = Store.on('mutation', () => render(el));
  return off;
}
