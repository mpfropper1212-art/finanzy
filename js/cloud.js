// Anmeldung und Datenablage über Supabase, direkt per fetch.
// Bewusst ohne SDK, damit die App weiterhin ohne Build-Schritt auskommt.

const BASE = 'https://vgzztystyczebvoytdqf.supabase.co';
// Publishable Key: gehört in den Client und darf öffentlich sein. Den Schutz
// leisten die Row-Level-Security-Regeln der Tabelle, nicht dieser Schlüssel.
const KEY = 'sb_publishable_PjU5xYAL6ux764K8tGJ53A_rRtXR63C';
const TABLE = 'finanzen';
const SESSION_KEY = 'finanzsankey.session';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export class OfflineError extends Error {
  constructor() {
    super('Keine Verbindung zum Server.');
    this.name = 'OfflineError';
  }
}

let session = null;

export function restoreSession() {
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    session = null;
  }
  return session;
}

function keepSession(next) {
  session = next;
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
}

export function currentUser() {
  return session?.user ?? null;
}

function toSession(json) {
  if (!json?.access_token) return null;
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    user: { id: json.user?.id, email: json.user?.email },
  };
}

// Supabase meldet Fehler englisch und teils kryptisch - hier das, was wirklich
// vorkommt, auf verständliche Sätze abbilden.
function authMessage(json, status) {
  const code = json?.error_code ?? json?.code ?? '';
  const raw = String(json?.msg ?? json?.error_description ?? json?.message ?? '');
  const map = {
    invalid_credentials: 'E-Mail oder Passwort stimmt nicht.',
    user_already_exists: 'Für diese E-Mail gibt es schon ein Konto. Wechsle zu „Anmelden“.',
    email_exists: 'Für diese E-Mail gibt es schon ein Konto. Wechsle zu „Anmelden“.',
    weak_password: 'Das Passwort ist zu kurz – mindestens 6 Zeichen.',
    email_address_invalid: 'Diese E-Mail-Adresse sieht nicht gültig aus.',
    validation_failed: 'Bitte E-Mail und Passwort ausfüllen.',
    over_request_rate_limit: 'Zu viele Versuche. Bitte eine Minute warten.',
    over_email_send_rate_limit: 'Zu viele E-Mails angefordert. Bitte später erneut versuchen.',
    email_not_confirmed: 'Die E-Mail-Adresse ist noch nicht bestätigt.',
  };
  if (map[code]) return map[code];
  if (/invalid login credentials/i.test(raw)) return map.invalid_credentials;
  if (/already registered/i.test(raw)) return map.user_already_exists;
  if (/password should be at least/i.test(raw)) return map.weak_password;
  if (status === 404) return 'Die Datentabelle fehlt im Supabase-Projekt. Das SQL aus der Einrichtung wurde noch nicht ausgeführt.';
  return raw || `Unerwarteter Fehler (${status}).`;
}

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${BASE}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(authMessage(json, res.status));
  return json;
}

export async function signUp(email, password) {
  const json = await post('signup', { email, password });
  const next = toSession(json);
  if (!next) {
    throw new AuthError(
      'Das Konto wurde angelegt, muss aber erst per E-Mail bestätigt werden. '
      + 'Schau in dein Postfach – oder schalte in Supabase unter Authentication → Email die Bestätigung ab.');
  }
  keepSession(next);
  return next;
}

export async function signIn(email, password) {
  const json = await post('token?grant_type=password', { email, password });
  const next = toSession(json);
  if (!next) throw new AuthError('Anmeldung fehlgeschlagen.');
  keepSession(next);
  return next;
}

export async function requestPasswordReset(email) {
  await post('recover', { email });
}

export function signOut() {
  const token = session?.access_token;
  keepSession(null);
  if (token) {
    fetch(`${BASE}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

// Zugriffstoken laufen nach einer Stunde ab; rechtzeitig erneuern, sonst
// scheitert mitten im Tippen der nächste Speichervorgang.
async function freshToken() {
  if (!session) throw new AuthError('Nicht angemeldet.');
  if (Math.floor(Date.now() / 1000) < session.expires_at - 60) return session.access_token;

  let json;
  try {
    json = await post('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  } catch (err) {
    if (err instanceof OfflineError) throw err;
    keepSession(null);
    throw new AuthError('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  }
  const next = toSession(json);
  if (!next) {
    keepSession(null);
    throw new AuthError('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  }
  keepSession(next);
  return next.access_token;
}

async function rest(path, { method = 'GET', body, headers } = {}) {
  const token = await freshToken();
  let res;
  try {
    res = await fetch(`${BASE}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }
  if (res.status === 401) {
    keepSession(null);
    throw new AuthError('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(authMessage(json, res.status));
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export async function loadData() {
  const rows = await rest(`${TABLE}?select=data`);
  return rows?.[0]?.data ?? null;
}

export async function saveData(data) {
  await rest(TABLE, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: session.user.id, data, updated_at: new Date().toISOString() },
  });
}

// Letzter Stand lokal, damit ein Serverausfall mitten im Tippen keine
// Eingaben kostet. Wird beim nächsten erfolgreichen Speichern überflüssig.
const backupKey = () => `finanzsankey.backup.${session?.user?.id}`;

export function writeBackup(data) {
  try {
    localStorage.setItem(backupKey(), JSON.stringify({ data, at: Date.now() }));
  } catch { /* Speicher voll oder gesperrt - kein Grund abzubrechen */ }
}

export function readBackup() {
  try {
    return JSON.parse(localStorage.getItem(backupKey()))?.data ?? null;
  } catch {
    return null;
  }
}

export function clearBackup() {
  try {
    localStorage.removeItem(backupKey());
  } catch { /* egal */ }
}
