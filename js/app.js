import { registerRoute, startRouter, navigate } from './router.js';
import { ICONS } from './icons.js';
import * as Home from './home.js';
import * as Tms from './tms.js';
import * as Gym from './gym.js';
import * as Habits from './habits.js';
import * as CalendarScreen from './calendar.js';
import * as Settings from './settings.js';
import { initSync } from './sync.js';
import { initGoogleAutoRefresh } from './googleCalendar.js';

const NAV_ITEMS = [
  { route: '', path: '/', icon: 'home', label: 'Home' },
  { route: 'calendar', path: '/calendar', icon: 'calendar', label: 'Kalender' },
  { route: 'tms', path: '/tms', icon: 'target', label: 'TMS' },
  { route: 'gym', path: '/gym', icon: 'dumbbell', label: 'Gym' },
  { route: 'habits', path: '/habits', icon: 'checklist', label: 'To-Dos' },
];

function buildShell() {
  document.getElementById('app').innerHTML = `
    <main id="screen"></main>
    <nav id="bottom-nav">
      ${NAV_ITEMS.map(i => `
        <button class="nav-btn" data-route="${i.route}" data-path="${i.path}">
          ${ICONS[i.icon]}
          <span>${i.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  });
}

function registerRoutes() {
  registerRoute('/', Home.render);
  registerRoute('/calendar', CalendarScreen.render);
  registerRoute('/tms', Tms.render);
  registerRoute('/gym', Gym.render);
  registerRoute('/habits', Habits.render);
  registerRoute('/settings', Settings.render);
  registerRoute('/settings/:section', Settings.render);
}

buildShell();
registerRoutes();
startRouter();
initSync();
initGoogleAutoRefresh();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
