// Passwortgeschützter Datentresor im localStorage.
// PBKDF2-SHA-256 -> AES-GCM-256. Der Schlüssel lebt nur im Speicher.

const VAULT_PREFIX = 'finanzsankey.vault.';
const ITERATIONS = 250000;
const HASH = 'SHA-256';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const FORMAT = 1;

export class WrongPasswordError extends Error {
  constructor() {
    super('Passwort falsch oder Datensatz beschädigt.');
    this.name = 'WrongPasswordError';
  }
}

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function storageKey(userId) {
  return VAULT_PREFIX + userId;
}

export function normalizeUserId(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function listProfiles() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(VAULT_PREFIX)) out.push(k.slice(VAULT_PREFIX.length));
  }
  return out.sort();
}

export function profileExists(userId) {
  return localStorage.getItem(storageKey(userId)) !== null;
}

function readRecord(userId) {
  const raw = localStorage.getItem(storageKey(userId));
  if (raw === null) return null;
  let rec;
  try {
    rec = JSON.parse(raw);
  } catch {
    throw new Error('Der gespeicherte Datensatz ist unlesbar.');
  }
  if (!rec || rec.format !== FORMAT || !rec.salt || !rec.iv || !rec.ciphertext) {
    throw new Error('Der gespeicherte Datensatz hat ein unbekanntes Format.');
  }
  return rec;
}

async function deriveKey(password, salt, iterations, hash) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Jeder Schreibvorgang bekommt einen frischen IV. Ein IV darf mit demselben
// Schlüssel nie zweimal verwendet werden, sonst ist AES-GCM gebrochen.
async function sealInto(rec, session, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.key, plain);
  rec.iv = toB64(iv);
  rec.ciphertext = toB64(new Uint8Array(cipher));
  rec.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey(session.userId), JSON.stringify(rec));
}

export async function createProfile(userId, password, data) {
  if (profileExists(userId)) throw new Error('Dieses Profil gibt es in diesem Browser schon.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt, ITERATIONS, HASH);
  const session = { userId, key };
  const rec = {
    format: FORMAT,
    userId,
    kdf: { name: 'PBKDF2', hash: HASH, iterations: ITERATIONS },
    salt: toB64(salt),
    iv: null,
    ciphertext: null,
    createdAt: new Date().toISOString(),
  };
  await sealInto(rec, session, data);
  return session;
}

export async function unlock(userId, password) {
  const rec = readRecord(userId);
  if (!rec) throw new Error('Für diese Benutzer-ID gibt es in diesem Browser kein Profil.');
  const iterations = rec.kdf?.iterations ?? ITERATIONS;
  const hash = rec.kdf?.hash ?? HASH;
  const key = await deriveKey(password, fromB64(rec.salt), iterations, hash);
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(rec.iv) }, key, fromB64(rec.ciphertext),
    );
  } catch {
    // AES-GCM unterscheidet nicht zwischen falschem Passwort und manipulierten Daten.
    throw new WrongPasswordError();
  }
  return { session: { userId, key }, data: JSON.parse(new TextDecoder().decode(plain)) };
}

export async function save(session, data) {
  const rec = readRecord(session.userId);
  if (!rec) throw new Error('Das Profil wurde zwischenzeitlich entfernt.');
  await sealInto(rec, session, data);
}

export function removeProfile(userId) {
  localStorage.removeItem(storageKey(userId));
}

// Export/Import des verschlüsselten Datensatzes - der Weg auf ein anderes Gerät.
export function exportRecord(userId) {
  const rec = readRecord(userId);
  if (!rec) throw new Error('Kein Profil zum Exportieren gefunden.');
  return rec;
}

export function importRecord(rec, { overwrite = false } = {}) {
  if (!rec || rec.format !== FORMAT || !rec.userId || !rec.salt || !rec.ciphertext) {
    throw new Error('Das ist keine gültige Tresor-Datei.');
  }
  const userId = normalizeUserId(rec.userId);
  if (!overwrite && profileExists(userId)) {
    throw new Error(`Das Profil „${userId}" gibt es hier schon. Erst abmelden und das alte Profil zurücksetzen, oder die Datei umbenennen.`);
  }
  localStorage.setItem(storageKey(userId), JSON.stringify({ ...rec, userId }));
  return userId;
}
