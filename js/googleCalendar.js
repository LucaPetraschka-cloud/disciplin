// Client-side Google Calendar read-sync via Google Identity Services (GIS) token
// client. No backend needed — the browser talks to the Calendar API directly.
// Scope is read-only: the app only needs "an entry in Google Calendar shows up
// here too", not write-back.
import { Store } from './store.js';
import { bulkPush, bulkRemove } from './sync.js';

const TOKEN_KEY = 'disciplin.googleToken';
const WAS_CONNECTED_KEY = 'disciplin.googleWasConnected';

// True when Google was connected on this device before but the (1h) token has
// expired — the calendar shows a one-tap reconnect hint in that case.
export function needsReconnect() {
  return !isGoogleConnected() && localStorage.getItem(WAS_CONNECTED_KEY) === '1';
}
let accessToken = null;
let tokenExpiry = 0;

(function restore() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const { accessToken: t, tokenExpiry: e } = JSON.parse(raw);
      if (Date.now() < e) { accessToken = t; tokenExpiry = e; }
    }
  } catch {}
})();

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google-Skript konnte nicht geladen werden (offline?)'));
    document.head.appendChild(s);
  });
}

export function isGoogleConnected() {
  return !!accessToken && Date.now() < tokenExpiry;
}

export async function connectGoogle() {
  const cfg = Store.getConfig();
  if (!cfg.googleClientId) throw new Error('Bitte zuerst eine OAuth Client-ID eintragen.');
  await loadGis();
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg.googleClientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, tokenExpiry }));
        localStorage.setItem(WAS_CONNECTED_KEY, '1');
        fetchGoogleEvents().then(resolve).catch(reject);
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function disconnectGoogle() {
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WAS_CONNECTED_KEY);
}

// Google returns RFC3339 timestamps (often UTC, e.g. "...T04:00:00Z"). The rest
// of the app treats event.start as local wall-clock ("YYYY-MM-DDTHH:mm"), so we
// convert here into the device's local time — otherwise times/days are shifted.
function toLocalWallClock(dateTime, date) {
  if (!dateTime) return date; // all-day event: keep the plain "YYYY-MM-DD"
  const d = new Date(dateTime);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function fetchGoogleEvents() {
  if (!isGoogleConnected()) return;
  const cfg = Store.getConfig();
  const timeMin = new Date(); timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + 60);
  const calId = encodeURIComponent(cfg.googleCalendarId || 'primary');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) {
    // Token no longer valid — drop it (but remember the connection, so the
    // calendar can offer a one-tap reconnect) and keep the stored events.
    accessToken = null; tokenExpiry = 0; localStorage.removeItem(TOKEN_KEY);
    throw new Error('Google-Verbindung abgelaufen — bitte neu verbinden.');
  }
  if (!res.ok) throw new Error('Google Kalender Abruf fehlgeschlagen (' + res.status + ')');
  const data = await res.json();
  const existingGoogle = Store.list('calendarEvents').filter(e => e.source === 'google');
  const seenIds = new Set();
  (data.items || []).forEach(item => {
    if (item.status === 'cancelled') return;
    seenIds.add(item.id);
    Store.upsert('calendarEvents', {
      id: `google-${item.id}`,
      googleEventId: item.id,
      title: item.summary || '(ohne Titel)',
      category: 'google', source: 'google', recurrence: 'none',
      start: toLocalWallClock(item.start.dateTime, item.start.date),
      end: toLocalWallClock(item.end?.dateTime, item.end?.date),
      allDay: !item.start.dateTime,
    }, { silent: true });
  });
  const removedIds = existingGoogle.filter(e => !seenIds.has(e.googleEventId)).map(e => e.id);
  removedIds.forEach(id => Store.remove('calendarEvents', id, { silent: true }));
  Store.emit('mutation', { table: 'calendarEvents', op: 'refresh' });

  // Mirror the Google events to Supabase in bulk so every signed-in device
  // shows them — even devices that never connected Google themselves.
  bulkPush('calendarEvents', Store.list('calendarEvents').filter(e => e.source === 'google')).catch(() => {});
  bulkRemove('calendarEvents', removedIds).catch(() => {});
}

export function initGoogleAutoRefresh() {
  if (isGoogleConnected()) fetchGoogleEvents().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isGoogleConnected()) fetchGoogleEvents().catch(() => {});
  });
}
