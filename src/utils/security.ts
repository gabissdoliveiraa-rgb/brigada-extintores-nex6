/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from '../types/brigada';

const PBKDF2_PREFIX = 'pbkdf2';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTE_LENGTH = 16;
const DERIVED_BIT_LENGTH = 256;

const LOGIN_ATTEMPTS_STORAGE_KEY = 'senai_login_attempts_v1';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30_000;

function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API indisponível neste ambiente.');
  }
  return cryptoObj.subtle;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function isPasswordHashed(value?: string): boolean {
  if (!value) return false;
  const parts = value.split('$');
  return (
    parts.length === 4 &&
    parts[0] === PBKDF2_PREFIX &&
    Number(parts[1]) > 0 &&
    parts[2].length >= 16 &&
    parts[3].length >= 32
  );
}

async function derivePbkdf2Hex(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const subtle = getSubtleCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    DERIVED_BIT_LENGTH
  );
  return bytesToHex(new Uint8Array(bits));
}

/**
 * Hashes a plaintext password using PBKDF2-HMAC-SHA256 with a random 128-bit salt.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (isPasswordHashed(plainPassword)) {
    return plainPassword;
  }
  const salt = new Uint8Array(SALT_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(salt);
  const derivedHex = await derivePbkdf2Hex(plainPassword, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${derivedHex}`;
}

/**
 * Verifies a plaintext password against either a PBKDF2 hash or a legacy plaintext value.
 * Signals `needsMigration: true` when a legacy plaintext password matched and should be upgraded.
 */
export async function verifyPassword(
  plainPassword: string,
  storedPassword?: string
): Promise<{ valid: boolean; needsMigration: boolean }> {
  const expected = storedPassword || 'senai123';

  if (isPasswordHashed(expected)) {
    const [, iterStr, saltHex, expectedHex] = expected.split('$');
    const iterations = Number(iterStr);
    const salt = hexToBytes(saltHex);
    if (!salt || !Number.isFinite(iterations) || iterations < 1000) {
      return { valid: false, needsMigration: false };
    }
    const candidateHex = await derivePbkdf2Hex(plainPassword, salt, iterations);
    return {
      valid: timingSafeEqualStrings(candidateHex, expectedHex),
      needsMigration: false,
    };
  }

  const valid = timingSafeEqualStrings(plainPassword, expected);
  return {
    valid,
    needsMigration: valid,
  };
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = password.trim();
  if (!trimmed) {
    return { valid: false, error: 'A senha é obrigatória.' };
  }
  if (trimmed.length < 6) {
    return {
      valid: false,
      error: 'A senha deve ter pelo menos 6 caracteres.',
    };
  }
  if (trimmed.length > 128) {
    return {
      valid: false,
      error: 'A senha não pode ultrapassar 128 caracteres.',
    };
  }
  return { valid: true };
}

/**
 * Removes sensitive credential fields before persisting session profile in browser storage.
 */
export function sanitizeUserForSession<T extends UserProfile>(user: T): T {
  const clean = { ...user };
  delete clean.password;
  return clean;
}

/**
 * Strips CR/LF and ASCII control characters to prevent SMTP header or log injection.
 */
export function stripControlChars(value: string, maxLen = 200): string {
  return String(value || '')
    .replace(/[\r\n\x00-\x1F\x7F]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// --- Client-side Login Rate Limiting (Brute-Force Protection) ---
interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const memoryAttemptMap: Record<string, AttemptRecord> = {};

function readAttemptMap(): Record<string, AttemptRecord> {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, AttemptRecord>) : {};
    }
  } catch {
    // fallback to in-memory map
  }
  return memoryAttemptMap;
}

function writeAttemptMap(map: Record<string, AttemptRecord>): void {
  Object.assign(memoryAttemptMap, map);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore storage failures
  }
}

export function getLoginLockState(
  identifier = '__global__',
  now = Date.now()
): { locked: boolean; remainingSeconds: number; failedAttempts: number } {
  const key = (identifier || '__global__').trim().toLowerCase() || '__global__';
  const map = readAttemptMap();
  const record = map[key];
  if (!record) {
    return { locked: false, remainingSeconds: 0, failedAttempts: 0 };
  }
  if (record.lockedUntil > now) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
      failedAttempts: record.count,
    };
  }
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    delete map[key];
    writeAttemptMap(map);
    return { locked: false, remainingSeconds: 0, failedAttempts: 0 };
  }
  return { locked: false, remainingSeconds: 0, failedAttempts: record.count };
}

export function recordFailedLogin(
  identifier = '__global__',
  now = Date.now()
): { locked: boolean; remainingSeconds: number; failedAttempts: number } {
  const key = (identifier || '__global__').trim().toLowerCase() || '__global__';
  const map = readAttemptMap();
  const prev = map[key];
  const activeCount = prev && prev.lockedUntil <= now ? prev.count : prev?.count || 0;
  const nextCount = activeCount + 1;
  const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;

  map[key] = {
    count: nextCount,
    lockedUntil,
  };
  writeAttemptMap(map);

  return {
    locked: lockedUntil > now,
    remainingSeconds: lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0,
    failedAttempts: nextCount,
  };
}

export function clearFailedLogin(identifier = '__global__'): void {
  const key = (identifier || '__global__').trim().toLowerCase() || '__global__';
  const map = readAttemptMap();
  if (map[key]) {
    delete map[key];
    writeAttemptMap(map);
  }
}
