// Lesezugriff auf den alten, lokal verschlüsselten Tresor.
// Die App speichert inzwischen in der Cloud; das hier dient nur noch dazu,
// Daten aus der früheren Version einmalig zu übernehmen.

const VAULT_PREFIX = 'finanzsankey.vault.';
const ITERATIONS = 250000;
const HASH = 'SHA-256';
const FORMAT = 1;

export class WrongPasswordError extends Error {
  constructor() {
    super('Passwort falsch oder Datensatz beschädigt.');
    this.name = 'WrongPasswordError';
  }
}

function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const storageKey = userId => VAULT_PREFIX + userId;

export function listProfiles() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(VAULT_PREFIX)) out.push(k.slice(VAULT_PREFIX.length));
  }
  return out.sort();
}

export function removeProfile(userId) {
  localStorage.removeItem(storageKey(userId));
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
    ['decrypt'],
  );
}

export async function unlock(userId, password) {
  const rec = readRecord(userId);
  if (!rec) throw new Error('Für diese Benutzer-ID gibt es in diesem Browser kein Profil.');
  const key = await deriveKey(
    password, fromB64(rec.salt), rec.kdf?.iterations ?? ITERATIONS, rec.kdf?.hash ?? HASH,
  );
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(rec.iv) }, key, fromB64(rec.ciphertext),
    );
  } catch {
    // AES-GCM unterscheidet nicht zwischen falschem Passwort und manipulierten Daten.
    throw new WrongPasswordError();
  }
  return { data: JSON.parse(new TextDecoder().decode(plain)) };
}
