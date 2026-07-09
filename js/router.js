// Minimal hash router: routes are registered as "/path/:param" -> render(el, params)

const routes = [];
let notFound = null;

function toRegex(path) {
  const keys = [];
  const pattern = path.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

export function registerRoute(path, render) {
  const { regex, keys } = toRegex(path);
  routes.push({ regex, keys, render });
}

export function registerNotFound(render) { notFound = render; }

function currentPath() {
  const hash = location.hash.slice(1) || '/';
  return hash.split('?')[0];
}

let activeCleanup = null;

async function resolve() {
  const path = currentPath();
  const el = document.getElementById('screen');
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      if (typeof activeCleanup === 'function') { try { activeCleanup(); } catch {} }
      el.innerHTML = '';
      el.classList.remove('screen-enter');
      void el.offsetWidth;
      el.classList.add('screen-enter');
      activeCleanup = await r.render(el, params);
      el.scrollTop = 0;
      window.scrollTo(0, 0);
      updateNavHighlight(path);
      return;
    }
  }
  if (notFound) notFound(el);
}

function updateNavHighlight(path) {
  const root = path.split('/')[1] || '';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === root);
  });
}

export function navigate(path) {
  location.hash = path;
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
