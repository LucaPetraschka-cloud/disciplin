import { Store } from './store.js';

export const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAY_LABELS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTH_LABELS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function dateKey(d) { return Store.todayKey(d); }

export function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function categoryColor(cat) {
  return { tms: 'var(--section-tms)', gym: 'var(--section-gym)', stundenplan: 'var(--series-5)', google: 'var(--series-4)', other: 'var(--text-muted)' }[cat] || 'var(--text-muted)';
}
export function categoryLabel(cat) {
  return { tms: 'TMS', gym: 'Gym', stundenplan: 'Stundenplan', google: 'Google Kalender', other: 'Sonstiges' }[cat] || 'Sonstiges';
}

// Colour each school subject to match its Google Calendar colour (same hues as the
// Google palette). "Ethik = schwarz" uses graphite grey instead — pure black is
// invisible on the app's dark background and Google has no true-black option.
export function subjectColor(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes('mathe')) return '#039be5';                             // blau
  if (t.includes('deutsch')) return '#d50000';                           // rot
  if (t.includes('pug') || t.includes('kunst')) return '#f6bf26';        // gelb
  if (t.includes('biologie') || t.includes('englisch')) return '#0b8043';// grün
  if (t.includes('chemie') || t.includes('seminar')) return '#8e24aa';   // lila
  if (t.includes('geschichte') || t.includes('geografie') || t.includes('geographie')) return '#f4511e'; // orange
  if (t.includes('sport')) return '#e67c73';                             // pink
  if (t.includes('ethik')) return '#9aa0a6';                             // graphit (statt schwarz)
  return null;
}
export function eventColor(ev) {
  return subjectColor(ev.title) || categoryColor(ev.category);
}

// --- Virtual (auto-generated) entries -------------------------------------

export function tmsPlanForDate(date) {
  const cfg = Store.getConfig();
  const wd = date.getDay();
  if (!cfg.tmsPlanDays[wd]) return [];
  const subtests = Store.TMS_SUBTESTS;
  const rotationIndex = isoWeekNumber(date) * 7 + wd;
  const count = Math.max(1, Math.min(2, cfg.tmsPerDay || 1));
  const picks = [];
  for (let i = 0; i < count; i++) picks.push(subtests[(rotationIndex + i) % subtests.length]);
  return picks;
}

export function gymSessionForDate(date) {
  return Store.gymDays().find(d => d.weekday === date.getDay()) || null;
}

// TMS- und Gym-Termine kommen aus dem echten Google Kalender — die App erzeugt
// dafür keine eigenen (doppelten) Einträge mehr. (tmsPlanForDate/gymSessionForDate
// bleiben für andere Screens erhalten.)
function virtualEventsForDate(date) {
  return [];
}

// --- Local (user-created / google-synced) events, with weekly expansion ----

function localEventsOnDate(date) {
  const dk = dateKey(date);
  const wd = date.getDay();
  return Store.calendarEvents().filter(ev => {
    const evDate = ev.start.slice(0, 10);
    if (ev.recurrence === 'weekly') {
      const evWd = new Date(ev.start).getDay();
      return evWd === wd && dk >= evDate;
    }
    return evDate === dk;
  });
}

export function getEventsForDate(date) {
  const all = [...virtualEventsForDate(date), ...localEventsOnDate(date)];
  return all.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}

export function getUpcomingEvents(fromDate = new Date(), limit = 1, horizonDays = 90) {
  const results = [];
  const nowIso = fromDate.toISOString();
  for (let i = 0; i < horizonDays && results.length < limit; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dayEvents = getEventsForDate(d).filter(ev => {
      if (i > 0) return true;
      const startIso = ev.start.length === 10 ? ev.start + 'T23:59' : ev.start;
      return startIso >= nowIso.slice(0, 16) || startIso.slice(0, 10) === nowIso.slice(0, 10);
    });
    for (const ev of dayEvents) {
      if (results.length >= limit) break;
      results.push({ ...ev, dateObj: new Date(d) });
    }
  }
  return results;
}

export function formatTime(iso) {
  if (!iso || iso.length <= 10) return 'Ganztägig';
  const [, hm] = iso.split('T');
  return hm ? hm.slice(0, 5) : '';
}

export function formatWhen(ev, refDate = new Date()) {
  const evDate = new Date(ev.start.slice(0, 10) + 'T00:00');
  const diffDays = Math.round((evDate - new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())) / 86400000);
  const time = formatTime(ev.start);
  let dayLabel;
  if (diffDays === 0) dayLabel = 'Heute';
  else if (diffDays === 1) dayLabel = 'Morgen';
  else dayLabel = `${WEEKDAY_LABELS[evDate.getDay()]}, ${evDate.getDate()}.${evDate.getMonth() + 1}.`;
  return `${dayLabel} · ${time}`;
}
