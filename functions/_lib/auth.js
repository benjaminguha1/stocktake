export const SESSION_COOKIE = 'stocktake_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 100_000;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;
let schemaReady = null;

function normalise(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return new Uint8Array();
  return Uint8Array.from(hex.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: PASSWORD_ITERATIONS }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export function getDatabase(env) {
  if (!env.DB) throw new Error('Stocktake online storage is unavailable.');
  return env.DB;
}

export async function ensureSchema(env) {
  if (!schemaReady) {
    const db = getDatabase(env);
    schemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS stocktake_states (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS staff_users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        username_normalized TEXT NOT NULL,
        email TEXT,
        email_normalized TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT DEFAULT 'staff' NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS staff_users_username_normalized_unique ON staff_users (username_normalized)'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_normalized_unique ON staff_users (email_normalized)'),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS staff_users_single_admin_unique ON staff_users (role) WHERE role = 'admin'"),
      db.prepare(`CREATE TABLE IF NOT EXISTS staff_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
        key_hash TEXT PRIMARY KEY NOT NULL,
        failures INTEGER DEFAULT 0 NOT NULL,
        blocked_until INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
    ]).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

function validateUsername(username) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(username);
}

function validateEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 10 && password.length <= 128;
}

export async function hasUsers(env) {
  await ensureSchema(env);
  const row = await getDatabase(env).prepare('SELECT COUNT(*) AS count FROM staff_users').first();
  return Number(row?.count || 0) > 0;
}

export async function createInitialAdmin(env, input) {
  if (await hasUsers(env)) throw new Error('Stocktake has already been set up.');
  const username = String(input.username || '').trim();
  const email = String(input.email || '').trim();
  const password = String(input.password || '');
  if (!validateUsername(username)) throw new Error('Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores.');
  if (!validateEmail(email)) throw new Error('Enter a valid email address.');
  if (!validatePassword(password)) throw new Error('Password must be between 10 and 128 characters.');
  const id = crypto.randomUUID();
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await derivePassword(password, salt);
  await getDatabase(env).prepare(`INSERT INTO staff_users
    (id, username, username_normalized, email, email_normalized, password_hash, password_salt, role, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 1)`)
    .bind(id, username, normalise(username), email || null, email ? normalise(email) : null, passwordHash, salt).run();
  return id;
}

export async function createSession(env, userId) {
  await ensureSchema(env);
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await getDatabase(env).prepare('INSERT INTO staff_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Math.floor(Date.now() / 1000) + SESSION_MAX_AGE).run();
  return token;
}

export function sessionCookie(token, requestUrl) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export function clearSessionCookie(requestUrl) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function readSessionToken(request) {
  for (const item of (request.headers.get('cookie') || '').split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=');
  }
  return null;
}

export async function getUserForRequest(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  await ensureSchema(env);
  const user = await getDatabase(env).prepare(`SELECT u.id, u.username, u.email, u.role, u.active
    FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`)
    .bind(await sha256(token), Math.floor(Date.now() / 1000)).first();
  return user || null;
}

async function attemptKey(request, identifier) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return sha256(`${normalise(identifier)}|${ip}`);
}

async function recordFailure(env, keyHash) {
  const now = Math.floor(Date.now() / 1000);
  await getDatabase(env).prepare(`INSERT INTO login_attempts (key_hash, failures, blocked_until, updated_at)
    VALUES (?, 1, 0, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      failures = CASE WHEN updated_at < ? THEN 1 ELSE failures + 1 END,
      blocked_until = CASE WHEN (CASE WHEN updated_at < ? THEN 1 ELSE failures + 1 END) >= ? THEN ? ELSE 0 END,
      updated_at = ?`)
    .bind(keyHash, now, now - LOCK_SECONDS, now - LOCK_SECONDS, MAX_FAILURES, now + LOCK_SECONDS, now).run();
}

export async function authenticate(request, env, identifier, password) {
  await ensureSchema(env);
  const keyHash = await attemptKey(request, identifier);
  const now = Math.floor(Date.now() / 1000);
  const attempt = await getDatabase(env).prepare('SELECT blocked_until FROM login_attempts WHERE key_hash = ?').bind(keyHash).first();
  if (Number(attempt?.blocked_until || 0) > now) return null;
  const lookup = normalise(identifier);
  const user = await getDatabase(env).prepare(`SELECT id, username, email, role, active, password_hash, password_salt
    FROM staff_users WHERE username_normalized = ? OR email_normalized = ? LIMIT 1`).bind(lookup, lookup).first();
  const derived = user ? await derivePassword(password, user.password_salt) : await derivePassword(password, '00000000000000000000000000000000');
  if (!user || !user.active || !safeEqual(derived, user.password_hash)) {
    await recordFailure(env, keyHash);
    return null;
  }
  await getDatabase(env).prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(keyHash).run();
  return user;
}

export async function deleteSession(request, env) {
  const token = readSessionToken(request);
  if (!token) return;
  await ensureSchema(env);
  await getDatabase(env).prepare('DELETE FROM staff_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}
