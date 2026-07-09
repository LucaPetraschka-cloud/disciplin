import { WEEKDAY_LABELS, MONTH_LABELS } from './calendarUtils.js';

function ymd(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// range: 'week' | 'month' | 'halfyear' | 'year'
// Returns buckets [{ key, label, from(ymd), to(ymd) }] oldest -> newest
export function buildBuckets(range) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = [];

  if (range === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      buckets.push({ key: ymd(d), label: WEEKDAY_LABELS[d.getDay()], from: ymd(d), to: ymd(d) });
    }
  } else if (range === 'month') {
    for (let i = 4; i >= 0; i--) {
      const to = addDays(today, -7 * i);
      const from = addDays(to, -6);
      buckets.push({ key: `w${isoWeek(to)}`, label: `KW${isoWeek(to)}`, from: ymd(from), to: ymd(to) });
    }
  } else if (range === 'halfyear') {
    for (let i = 25; i >= 0; i--) {
      const to = addDays(today, -7 * i);
      const from = addDays(to, -6);
      buckets.push({ key: `w${isoWeek(to)}-${to.getFullYear()}`, label: `KW${isoWeek(to)}`, from: ymd(from), to: ymd(to) });
    }
  } else if (range === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const from = new Date(d.getFullYear(), d.getMonth(), 1);
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()].slice(0, 3), from: ymd(from), to: ymd(to) });
    }
  }
  return buckets;
}

// items: [{date: 'YYYY-MM-DD', ...}]; reducer(itemsInBucket) -> number|null
export function aggregate(items, range, reducer) {
  const buckets = buildBuckets(range);
  return buckets.map(b => {
    const inBucket = items.filter(it => it.date >= b.from && it.date <= b.to);
    return { label: b.label, value: reducer(inBucket) };
  });
}

export const RANGE_LABELS = { week: 'Woche', month: 'Monat', halfyear: 'Halbjahr', year: 'Jahr' };
