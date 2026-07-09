import { Store } from './store.js';
import { navigate } from './router.js';
import { ICONS } from './icons.js';
import { WEEKDAY_LABELS_LONG } from './calendarUtils.js';
import { connectGoogle, disconnectGoogle, isGoogleConnected } from './googleCalendar.js';
import { configureSupabase, signInOrSignUp, signOut, syncStatus } from './sync.js';

const SERIES_SWATCHES = ['--series-1','--series-2','--series-3','--series-4','--series-5','--series-6','--series-7','--series-8'];

function topbar(title, sub, backPath = '/settings') {
  return `<div class="topbar">
    <button class="back-btn" id="back">${ICONS.chevronLeft}</button>
    <div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
  </div>`;
}
function wireBack(el, path) { el.querySelector('#back').addEventListener('click', () => navigate(path)); }

// ---------------------------------------------------------------------------
function renderMenu(el) {
  el.innerHTML = `
    ${topbar('Einstellungen', null, '/')}
    <div class="card" style="padding:4px 16px;">
      ${[
        ['gym', 'Gym — Übungen & Wochentage'],
        ['calendar', 'Kalender — Google-Sync & Lernplan'],
        ['habits', 'Habits verwalten'],
        ['sync', 'Geräte-Synchronisierung'],
      ].map(([k, label]) => `<div class="settings-link-row" data-section="${k}"><div class="main">${label}</div><div class="chev">${ICONS.chevron}</div></div>`).join('')}
    </div>
    <div class="hint" style="padding:0 4px;">To-Dos fügst du direkt auf der To-Dos-Seite hinzu — das ist dort schneller als über die Einstellungen.</div>
  `;
  wireBack(el, '/');
  el.querySelectorAll('[data-section]').forEach(row => row.addEventListener('click', () => navigate(`/settings/${row.dataset.section}`)));
}

// ---------------------------------------------------------------------------
function renderGym(el) {
  el.innerHTML = `${topbar('Gym', 'Wochentage & Übungen')}<div id="gym-settings-body"></div>
    <button class="btn primary" id="add-day" style="width:100%;margin-top:4px;">+ Trainingstag hinzufügen</button>`;
  wireBack(el, '/settings');

  function draw() {
    const body = el.querySelector('#gym-settings-body');
    const days = Store.gymDays();
    body.innerHTML = days.map(day => `
      <div class="card" data-day="${day.id}">
        <div class="field-row">
          <div class="field-group">
            <label class="field">Wochentag</label>
            <select class="d-weekday">${WEEKDAY_LABELS_LONG.map((l, i) => `<option value="${i}" ${i===day.weekday?'selected':''}>${l}</option>`).join('')}</select>
          </div>
          <div class="field-group"><label class="field">Muskelgruppe</label><input type="text" class="d-muscle" value="${day.muscleGroup}"></div>
        </div>
        <div class="list-row" style="padding:2px 0 8px;">
          <div class="main" style="font-weight:700;">Übungen</div>
          <button class="btn ghost add-ex">+ Übung</button>
        </div>
        <div class="ex-list">
          ${Store.gymExercises(day.id).map(ex => `
            <div class="list-row" data-ex="${ex.id}">
              <input type="text" class="ex-name main" value="${ex.name}" style="background:none;border:none;padding:4px 0;">
              <button class="del btn ghost">×</button>
            </div>
          `).join('')}
        </div>
        <div class="btn-row"><button class="btn danger del-day">Trainingstag löschen</button></div>
      </div>
    `).join('');

    body.querySelectorAll('[data-day]').forEach(card => {
      const dayId = card.dataset.day;
      card.querySelector('.d-weekday').addEventListener('change', (e) => Store.upsert('gymDays', { id: dayId, weekday: Number(e.target.value) }));
      card.querySelector('.d-muscle').addEventListener('change', (e) => Store.upsert('gymDays', { id: dayId, muscleGroup: e.target.value }));
      card.querySelector('.del-day').addEventListener('click', () => {
        Store.gymExercises(dayId).forEach(ex => Store.remove('gymExercises', ex.id, { silent: true }));
        Store.remove('gymDays', dayId);
        draw();
      });
      card.querySelector('.add-ex').addEventListener('click', () => {
        Store.upsert('gymExercises', { dayId, name: 'Neue Übung', order: Store.gymExercises(dayId).length });
        draw();
      });
      card.querySelectorAll('[data-ex]').forEach(row => {
        const exId = row.dataset.ex;
        row.querySelector('.ex-name').addEventListener('change', (e) => Store.upsert('gymExercises', { id: exId, name: e.target.value }));
        row.querySelector('.del').addEventListener('click', () => { Store.remove('gymExercises', exId); draw(); });
      });
    });
  }
  draw();

  el.querySelector('#add-day').addEventListener('click', () => {
    Store.upsert('gymDays', { weekday: 1, label: 'Neuer Tag', muscleGroup: 'Muskelgruppe', order: Store.gymDays().length });
    draw();
  });
}

// ---------------------------------------------------------------------------
function renderCalendarSettings(el) {
  const cfg = Store.getConfig();
  el.innerHTML = `${topbar('Kalender', 'Lernplan & Google-Sync')}
    <div class="card">
      <div class="card-title-row"><h2>TMS-Lernplan</h2></div>
      <div class="hint" style="margin-bottom:10px;">An welchen Tagen soll der Kalender einen TMS-Übungsblock vorschlagen? Die Untertests rotieren automatisch.</div>
      <div class="tab-row">
        ${WEEKDAY_LABELS_LONG.map((l, i) => `<button class="pill-tab ${cfg.tmsPlanDays[i]?'active':''}" data-wd="${i}">${l.slice(0,2)}</button>`).join('')}
      </div>
      <div class="field-group"><label class="field">Untertests pro Tag</label>
        <select id="tms-per-day"><option value="1" ${cfg.tmsPerDay===1?'selected':''}>1</option><option value="2" ${cfg.tmsPerDay===2?'selected':''}>2</option></select>
      </div>
      <div class="field-row">
        <div class="field-group"><label class="field">TMS-Übungszeit</label><input type="time" id="tms-time" value="${cfg.tmsTime}"></div>
        <div class="field-group"><label class="field">Gym-Zeit</label><input type="time" id="gym-time" value="${cfg.gymTime}"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title-row"><h2>Google Kalender</h2><span class="status-dot ${isGoogleConnected()?'on':'off'}"></span></div>
      <div class="hint" style="margin-bottom:10px;">
        Liest deinen Google Kalender live in die App ein (nur lesend, direkt aus dem Browser — kein eigener Server nötig).
        Einrichtung: <b>console.cloud.google.com</b> → Projekt anlegen → „APIs &amp; Dienste“ → OAuth-Client-ID (Typ „Webanwendung“) erstellen,
        als autorisierten JavaScript-Origin die URL dieser App eintragen, dann die Client-ID hier einfügen.
      </div>
      <div class="field-group"><label class="field">OAuth Client-ID</label><input type="text" id="g-client-id" value="${cfg.googleClientId}" placeholder="xxxx.apps.googleusercontent.com"></div>
      <div class="field-group"><label class="field">Kalender-ID</label><input type="text" id="g-cal-id" value="${cfg.googleCalendarId}" placeholder="primary"></div>
      <div class="btn-row">
        <button class="btn primary" id="g-connect">${isGoogleConnected() ? 'Neu verbinden' : 'Verbinden'}</button>
        ${isGoogleConnected() ? `<button class="btn danger" id="g-disconnect">Trennen</button>` : ''}
      </div>
      <div class="hint" style="margin-top:10px;">Hinweis: Die App aktualisiert Google-Termine, sobald du sie öffnest (kein Server, daher kein Push in Echtzeit).</div>
    </div>
  `;
  wireBack(el, '/settings');

  el.querySelectorAll('[data-wd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wd = Number(btn.dataset.wd);
      const days = { ...Store.getConfig().tmsPlanDays, [wd]: !Store.getConfig().tmsPlanDays[wd] };
      Store.setConfig({ tmsPlanDays: days });
      btn.classList.toggle('active');
    });
  });
  el.querySelector('#tms-per-day').addEventListener('change', (e) => Store.setConfig({ tmsPerDay: Number(e.target.value) }));
  el.querySelector('#tms-time').addEventListener('change', (e) => Store.setConfig({ tmsTime: e.target.value }));
  el.querySelector('#gym-time').addEventListener('change', (e) => Store.setConfig({ gymTime: e.target.value }));
  el.querySelector('#g-client-id').addEventListener('change', (e) => Store.setConfig({ googleClientId: e.target.value.trim() }));
  el.querySelector('#g-cal-id').addEventListener('change', (e) => Store.setConfig({ googleCalendarId: e.target.value.trim() || 'primary' }));
  el.querySelector('#g-connect').addEventListener('click', async () => {
    try { await connectGoogle(); renderCalendarSettings(el); }
    catch (err) { alert('Verbindung fehlgeschlagen: ' + err.message); }
  });
  el.querySelector('#g-disconnect')?.addEventListener('click', () => { disconnectGoogle(); renderCalendarSettings(el); });
}

// ---------------------------------------------------------------------------
function renderHabits(el) {
  el.innerHTML = `${topbar('Habits', 'Verwalten')}<div id="habit-settings-body"></div>
    <button class="btn primary" id="add-habit" style="width:100%;">+ Habit hinzufügen</button>`;
  wireBack(el, '/settings');

  function draw() {
    const body = el.querySelector('#habit-settings-body');
    const habits = Store.list('habits');
    body.innerHTML = `<div class="card">${habits.map(h => `
      <div data-habit="${h.id}" style="padding:10px 0;border-bottom:1px solid var(--gridline);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div class="swatch" style="background:${h.color}"></div>
          <input type="text" class="main h-name" value="${h.name}" style="background:none;border:none;flex:1;min-width:0;padding:4px 0;">
          <button class="del btn ghost">×</button>
        </div>
        <div class="swatch-picker" style="display:flex;gap:6px;flex-wrap:wrap;">
          ${SERIES_SWATCHES.map(v => `<button class="pick" data-color="var(${v})" style="width:20px;height:20px;border-radius:6px;background:var(${v});border:1.5px solid ${h.color===`var(${v})`?'#fff':'transparent'}"></button>`).join('')}
        </div>
      </div>
    `).join('') || '<div class="empty-state">Keine Habits.</div>'}</div>`;

    body.querySelectorAll('[data-habit]').forEach(row => {
      const id = row.dataset.habit;
      row.querySelector('.h-name').addEventListener('change', (e) => Store.upsert('habits', { id, name: e.target.value }));
      row.querySelectorAll('.pick').forEach(btn => btn.addEventListener('click', () => { Store.upsert('habits', { id, color: btn.dataset.color }); draw(); }));
      row.querySelector('.del').addEventListener('click', () => { Store.upsert('habits', { id, active: false }); draw(); });
    });
  }
  draw();
  el.querySelector('#add-habit').addEventListener('click', () => {
    Store.upsert('habits', { name: 'Neuer Habit', color: `var(${SERIES_SWATCHES[Store.list('habits').length % 8]})`, order: Store.habits().length, active: true });
    draw();
  });
}

// ---------------------------------------------------------------------------
function renderSync(el) {
  const cfg = Store.getConfig();
  const status = syncStatus();
  el.innerHTML = `${topbar('Geräte-Synchronisierung', 'Optional — via Supabase')}
    <div class="card">
      <div class="card-title-row"><h2>Status</h2><span class="status-dot ${status.connected?'on':'off'}"></span></div>
      <div class="hint">${status.connected ? `Verbunden${status.email ? ' als ' + status.email : ''}. Änderungen synchronisieren automatisch auf alle Geräte.` : 'Noch nicht verbunden — die App läuft komplett offline auf diesem Gerät.'}</div>
    </div>
    <div class="card">
      <div class="card-title-row"><h2>Einrichtung</h2></div>
      <div class="hint" style="margin-bottom:10px;">1. Kostenlosen Account auf <b>supabase.com</b> anlegen → neues Projekt.<br>
      2. Unter „SQL Editor“ das mitgelieferte <b>supabase/schema.sql</b> ausführen.<br>
      3. Project URL &amp; anon public Key unter „Project Settings → API“ kopieren und hier einfügen.</div>
      <div class="field-group"><label class="field">Project URL</label><input type="text" id="s-url" value="${cfg.supabaseUrl}" placeholder="https://xxxx.supabase.co"></div>
      <div class="field-group"><label class="field">Anon Public Key</label><input type="text" id="s-key" value="${cfg.supabaseAnonKey}" placeholder="eyJ..."></div>
      <button class="btn primary" id="s-save" style="width:100%;">Speichern & verbinden</button>
    </div>
    ${cfg.supabaseUrl ? `
    <div class="card">
      <div class="card-title-row"><h2>Anmelden</h2></div>
      <div class="hint" style="margin-bottom:10px;">Nutze auf <b>jedem</b> Gerät dieselbe E-Mail und dasselbe Passwort — dann laufen alle Einträge zusammen. Beim ersten Mal wird das Konto automatisch angelegt.</div>
      ${status.connected ? `<button class="btn danger" id="s-logout" style="width:100%;">Abmelden</button>` : `
      <div class="field-group"><label class="field">E-Mail</label><input type="email" id="s-email" placeholder="du@beispiel.de"></div>
      <div class="field-group"><label class="field">Passwort</label><input type="password" id="s-pass" placeholder="mind. 6 Zeichen" autocomplete="new-password"></div>
      <button class="btn primary" id="s-login" style="width:100%;">Anmelden / Konto erstellen</button>
      `}
    </div>` : ''}
  `;
  wireBack(el, '/settings');

  el.querySelector('#s-save').addEventListener('click', () => {
    const supabaseUrl = el.querySelector('#s-url').value.trim();
    const supabaseAnonKey = el.querySelector('#s-key').value.trim();
    Store.setConfig({ supabaseUrl, supabaseAnonKey });
    configureSupabase(supabaseUrl, supabaseAnonKey);
    renderSync(el);
  });
  el.querySelector('#s-login')?.addEventListener('click', async (e) => {
    const email = el.querySelector('#s-email').value.trim();
    const password = el.querySelector('#s-pass').value;
    if (!email || !password) { alert('Bitte E-Mail und Passwort eingeben.'); return; }
    if (password.length < 6) { alert('Das Passwort muss mindestens 6 Zeichen haben.'); return; }
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Verbinde…';
    try {
      await signInOrSignUp(email, password);
      renderSync(el);
    } catch (err) {
      alert('Fehler: ' + err.message);
      btn.disabled = false; btn.textContent = 'Anmelden / Konto erstellen';
    }
  });
  el.querySelector('#s-logout')?.addEventListener('click', async () => { await signOut(); renderSync(el); });
}

// ---------------------------------------------------------------------------
export function render(el, params = {}) {
  const section = params.section;
  if (section === 'gym') return renderGym(el);
  if (section === 'calendar') return renderCalendarSettings(el);
  if (section === 'habits') return renderHabits(el);
  if (section === 'sync') return renderSync(el);
  return renderMenu(el);
}
