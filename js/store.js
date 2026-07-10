// Local-first data layer. localStorage is the source of truth; sync.js (optional)
// mirrors mutations to Supabase and pulls remote changes back in through the same
// setters, so every screen just reads/writes Store and re-renders on 'mutation'.

const LS_PREFIX = 'disciplin.';
const listeners = {}; // event -> Set<fn>

function emit(event, detail) {
  (listeners[event] || new Set()).forEach(fn => fn(detail));
  (listeners['*'] || new Set()).forEach(fn => fn({ event, detail }));
}

function on(event, fn) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(fn);
  return () => listeners[event].delete(fn);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function read(table) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + table);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function write(table, arr) {
  localStorage.setItem(LS_PREFIX + table, JSON.stringify(arr));
}

// ---------------------------------------------------------------------------
// Generic table helpers (list / upsert / remove) shared by every entity below.
// ---------------------------------------------------------------------------
function list(table) { return read(table); }

function upsert(table, record, { silent = false, fromRemote = false } = {}) {
  const rows = read(table);
  const now = new Date().toISOString();
  // Only match an existing row when the caller really passed an id. Callers may
  // pass { id: undefined } for new records — matching on undefined would grab an
  // unrelated row and merge into it (the bug that made habit ticks overwrite
  // each other). The id is also set AFTER spreading the record, so a passed
  // undefined id can never clobber the generated one.
  const idx = record.id != null ? rows.findIndex(r => r.id === record.id) : -1;
  let full;
  if (idx >= 0) {
    full = { ...rows[idx], ...record, updatedAt: now };
    rows[idx] = full;
  } else {
    full = { createdAt: now, ...record, id: record.id ?? uid(), updatedAt: now };
    rows.push(full);
  }
  write(table, rows);
  if (!silent) emit('mutation', { table, op: 'upsert', record: full, fromRemote });
  return full;
}

function remove(table, id, { silent = false, fromRemote = false } = {}) {
  const rows = read(table);
  const next = rows.filter(r => r.id !== id);
  write(table, next);
  if (!silent) emit('mutation', { table, op: 'delete', id, fromRemote });
}

// ---------------------------------------------------------------------------
// TMS subtests (structure only — personal baseline values are entered by the
// user on first use and stored in the synced 'tmsBaseline' table).
// ---------------------------------------------------------------------------
const TMS_SUBTESTS = [
  { id: 'muster',      name: 'Muster zuordnen',                   short: 'Muster',      color: 'var(--series-1)' },
  { id: 'grund',       name: 'Med.-naturwiss. Grundverständnis',  short: 'Grundverst.', color: 'var(--series-2)' },
  { id: 'schlauch',    name: 'Schlauchfiguren',                   short: 'Schlauch',    color: 'var(--series-3)' },
  { id: 'quantitativ', name: 'Quantitative und formale Probleme', short: 'Quantitativ', color: 'var(--series-4)' },
  { id: 'text',        name: 'Textverständnis',                  short: 'Text',        color: 'var(--series-5)' },
  { id: 'figuren',     name: 'Gedächtnistest: Figuren lernen',    short: 'Figuren',     color: 'var(--series-6)' },
  { id: 'fakten',      name: 'Gedächtnistest: Fakten lernen',     short: 'Fakten',      color: 'var(--series-7)' },
  { id: 'diagramme',   name: 'Diagramme und Tabellen',            short: 'Diagramme',   color: 'var(--series-8)' },
];
const TMS_ZIEL = 93;

// Supabase project is baked in so every device only needs email + password.
// The anon key is a public, RLS-guarded client key (safe to ship in the app);
// it grants nothing without a signed-in user. Not the secret/service_role key.
const CONFIG_DEFAULTS = {
  supabaseUrl: 'https://qmghvejxutovagbdajva.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZ2h2ZWp4dXRvdmFnYmRhanZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1ODMwODIsImV4cCI6MjA5OTE1OTA4Mn0.rKfC0w5VgRo0rMdaNOk1fRZKebOne0bwSfDxO3ffvUU',
  // Google OAuth Client-ID is a public identifier (not a secret), baked in so
  // every device can connect Google Calendar with one tap. Read-only scope.
  googleClientId: '917209640166-vh2to8cq6l5hm6qnulk9cvta7guldcga.apps.googleusercontent.com',
  googleApiKey: '', googleCalendarId: 'primary',
  tmsPlanDays: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
  tmsPerDay: 1,
  gymTime: '18:00',
  tmsTime: '16:00',
};

// ---------------------------------------------------------------------------
// Defaults seeded on first launch
// ---------------------------------------------------------------------------
function seedDefaults() {
  if (!localStorage.getItem(LS_PREFIX + 'seeded')) {
    write('gymDays', [
      { id: 'd-mo', weekday: 1, label: 'Montag',     muscleGroup: 'Arme / Schultern', order: 0 },
      { id: 'd-do', weekday: 4, label: 'Donnerstag', muscleGroup: 'Rücken / Bizeps',  order: 1 },
      { id: 'd-fr', weekday: 5, label: 'Freitag',    muscleGroup: 'Brust / Trizeps',  order: 2 },
      { id: 'd-so', weekday: 0, label: 'Sonntag',    muscleGroup: 'Beine / Core',     order: 3 },
    ]);
    write('gymExercises', [
      { id: uid(), dayId: 'd-mo', name: 'Seitheben', order: 0 },
      { id: uid(), dayId: 'd-mo', name: 'Bizeps Maschine', order: 1 },
      { id: uid(), dayId: 'd-do', name: 'Latzug', order: 0 },
      { id: uid(), dayId: 'd-fr', name: 'Bankdrücken', order: 0 },
      { id: uid(), dayId: 'd-so', name: 'Beinpresse', order: 0 },
    ]);
    write('gymLogs', []);
    write('tmsSessions', []);
    write('habits', [
      { id: uid(), name: 'TMS lernen', color: 'var(--series-1)', order: 0, active: true },
      { id: uid(), name: 'Gym', color: 'var(--series-8)', order: 1, active: true },
    ]);
    write('habitLogs', []);
    write('todos', [
      { id: uid(), text: 'TMS Übungsheft Kapitel 1', done: false, monthKey: monthKey(), order: 0 },
      { id: uid(), text: 'Gym-Plan Woche fixieren', done: false, monthKey: monthKey(), order: 1 },
    ]);
    write('calendarEvents', []);
    write('config', { ...CONFIG_DEFAULTS });
    localStorage.setItem(LS_PREFIX + 'seeded', '1');
  }
}
seedDefaults();

// One-time repair: an earlier upsert bug could store rows without an id (habit
// ticks then overwrote each other). Give such rows a proper id so they behave
// like normal records again.
(function repairMissingIds() {
  ['gymDays', 'gymExercises', 'gymLogs', 'tmsSessions', 'tmsBaseline', 'habits', 'habitLogs', 'todos', 'calendarEvents'].forEach(t => {
    const rows = read(t);
    let changed = false;
    rows.forEach(r => { if (r.id == null) { r.id = uid(); changed = true; } });
    if (changed) write(t, rows);
  });
})();

// ---------------------------------------------------------------------------
// Config (settings that aren't a list table)
// ---------------------------------------------------------------------------
function getConfig() {
  let cfg;
  try { cfg = { ...CONFIG_DEFAULTS, ...JSON.parse(localStorage.getItem(LS_PREFIX + 'config') || '{}') }; }
  catch { cfg = { ...CONFIG_DEFAULTS }; }
  // Fall back to the baked-in project when a stored value is blank, so the
  // Supabase connection is always available even on configs seeded earlier.
  if (!cfg.supabaseUrl) cfg.supabaseUrl = CONFIG_DEFAULTS.supabaseUrl;
  if (!cfg.supabaseAnonKey) cfg.supabaseAnonKey = CONFIG_DEFAULTS.supabaseAnonKey;
  if (!cfg.googleClientId) cfg.googleClientId = CONFIG_DEFAULTS.googleClientId;
  return cfg;
}
function setConfig(patch) {
  const next = { ...getConfig(), ...patch };
  localStorage.setItem(LS_PREFIX + 'config', JSON.stringify(next));
  emit('config', next);
  return next;
}

export const Store = {
  on, emit, uid, todayKey, monthKey,
  list, upsert, remove,
  TMS_SUBTESTS, TMS_ZIEL,
  tmsBaseline: () => list('tmsBaseline')[0] || null,
  getConfig, setConfig,
  // convenience typed accessors
  gymDays: () => list('gymDays').sort((a,b)=>a.order-b.order),
  gymExercises: (dayId) => list('gymExercises').filter(e=>e.dayId===dayId).sort((a,b)=>a.order-b.order),
  gymLogs: (exerciseId) => list('gymLogs').filter(l=>l.exerciseId===exerciseId).sort((a,b)=>a.date.localeCompare(b.date)),
  tmsSessions: (subtestId) => list('tmsSessions').filter(s => !subtestId || s.subtestId===subtestId).sort((a,b)=>a.date.localeCompare(b.date)),
  habits: () => list('habits').filter(h=>h.active!==false).sort((a,b)=>(a.order??0)-(b.order??0)),
  habitLogs: (habitId) => list('habitLogs').filter(l=>l.habitId===habitId),
  todos: (mKey = monthKey()) => list('todos').filter(t=>t.monthKey===mKey).sort((a,b)=>a.order-b.order),
  calendarEvents: () => list('calendarEvents'),
};
