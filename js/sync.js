// Optional cross-device sync. Local storage stays the source of truth for
// instant, offline-capable reads/writes; when a Supabase project is configured
// and the user is signed in, every local mutation is mirrored to a matching
// Postgres table (generic {id, user_id, data jsonb} shape — see supabase/schema.sql)
// and Realtime pushes remote changes straight back through Store.upsert/remove.
import { Store } from './store.js';

const TABLES = ['gymDays', 'gymExercises', 'gymLogs', 'tmsSessions', 'tmsBaseline', 'habits', 'habitLogs', 'todos', 'calendarEvents'];
const TABLE_SQL_NAME = {
  gymDays: 'gym_days', gymExercises: 'gym_exercises', gymLogs: 'gym_logs',
  tmsSessions: 'tms_sessions', tmsBaseline: 'tms_baseline', habits: 'habits', habitLogs: 'habit_logs',
  todos: 'todos', calendarEvents: 'calendar_events',
};

let client = null;
let session = null;
let channels = [];

export function syncStatus() {
  return { connected: !!(client && session), email: session?.user?.email || null };
}

export function configureSupabase(url, anonKey) {
  teardown();
  if (!url || !anonKey || !window.supabase) return;
  client = window.supabase.createClient(url, anonKey);
  client.auth.getSession().then(({ data }) => {
    session = data.session;
    if (session) startLiveSync();
  });
  client.auth.onAuthStateChange((_event, s) => {
    session = s;
    if (s) startLiveSync(); else teardown(false);
  });
}

export async function signInWithEmail(email) {
  if (!client) throw new Error('Bitte zuerst Project URL & Key speichern.');
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  if (error) throw error;
}

export async function signOut() {
  if (client) await client.auth.signOut();
  teardown(false);
}

function teardown(dropClient = true) {
  channels.forEach(ch => client?.removeChannel(ch));
  channels = [];
  if (dropClient) { client = null; session = null; }
}

async function initialPull() {
  for (const table of TABLES) {
    const { data, error } = await client.from(TABLE_SQL_NAME[table]).select('id, data').eq('user_id', session.user.id);
    if (error) { console.warn('sync pull failed', table, error.message); continue; }
    (data || []).forEach(row => Store.upsert(table, { ...row.data, id: row.id }, { fromRemote: true, silent: true }));
  }
  Store.emit('mutation', { table: '*', op: 'refresh', fromRemote: true });
}

function subscribeRealtime() {
  TABLES.forEach(table => {
    const ch = client
      .channel(`${table}-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_SQL_NAME[table], filter: `user_id=eq.${session.user.id}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          Store.remove(table, payload.old.id, { fromRemote: true });
        } else {
          Store.upsert(table, { ...payload.new.data, id: payload.new.id }, { fromRemote: true });
        }
      })
      .subscribe();
    channels.push(ch);
  });
}

let pushUnsub = null;
function wirePush() {
  if (pushUnsub) pushUnsub();
  pushUnsub = Store.on('mutation', async ({ table, op, record, id, fromRemote }) => {
    if (fromRemote || !client || !session || !TABLES.includes(table)) return;
    const sqlTable = TABLE_SQL_NAME[table];
    try {
      if (op === 'delete') {
        await client.from(sqlTable).delete().eq('id', id).eq('user_id', session.user.id);
      } else {
        const { id: recId, ...data } = record;
        await client.from(sqlTable).upsert({ id: recId, user_id: session.user.id, data, updated_at: new Date().toISOString() });
      }
    } catch (err) { console.warn('sync push failed', table, err.message); }
  });
}

async function startLiveSync() {
  await initialPull();
  subscribeRealtime();
  wirePush();
}

export function initSync() {
  const cfg = Store.getConfig();
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) configureSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
}
