/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearFailedLogin,
  getLoginLockState,
  hashPassword,
  isPasswordHashed,
  recordFailedLogin,
  sanitizeUserForSession,
  stripControlChars,
  validatePasswordStrength,
  verifyPassword,
} from './security';

test('hashPassword creates salted PBKDF2 hash and verifies cleanly', async () => {
  const hash1 = await hashPassword('SenhaForte@2026');
  const hash2 = await hashPassword('SenhaForte@2026');

  assert.ok(isPasswordHashed(hash1));
  assert.notEqual(hash1, hash2, 'Each hash should use a unique random salt');

  const ok = await verifyPassword('SenhaForte@2026', hash1);
  assert.equal(ok.valid, true);
  assert.equal(ok.needsMigration, false);

  const wrong = await verifyPassword('SenhaErrada', hash1);
  assert.equal(wrong.valid, false);
  assert.equal(wrong.needsMigration, false);
});

test('verifyPassword supports legacy plaintext passwords and flags migration', async () => {
  const match = await verifyPassword('senai123', 'senai123');
  assert.equal(match.valid, true);
  assert.equal(match.needsMigration, true);

  const mismatch = await verifyPassword('outra', 'senai123');
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.needsMigration, false);
});

test('sanitizeUserForSession removes password fields', () => {
  const sanitized = sanitizeUserForSession({
    id: 'admin_1',
    name: 'Melissa',
    role: 'Administrador',
    email: 'melissa@senaisp.edu.br',
    phone: '(11) 99999-9999',
    password: 'pbkdf2$100000$abcd$1234',
  });
  assert.equal('password' in sanitized, false);
});

test('login rate limiter locks out after 5 consecutive failures and resets on clear', () => {
  const id = 'teste@senaisp.edu.br';
  clearFailedLogin(id);
  const t0 = 1_000_000;

  for (let i = 1; i <= 4; i++) {
    const res = recordFailedLogin(id, t0 + i * 100);
    assert.equal(res.locked, false);
    assert.equal(res.failedAttempts, i);
  }

  const fifth = recordFailedLogin(id, t0 + 500);
  assert.equal(fifth.locked, true);
  assert.ok(fifth.remainingSeconds >= 29);

  const checkLocked = getLoginLockState(id, t0 + 5_000);
  assert.equal(checkLocked.locked, true);

  clearFailedLogin(id);
  const afterClear = getLoginLockState(id, t0 + 6_000);
  assert.equal(afterClear.locked, false);
  assert.equal(afterClear.failedAttempts, 0);
});

test('stripControlChars neutralizes CRLF SMTP header injection and validatePasswordStrength enforces length', () => {
  const cleaned = stripControlChars('João\r\nBcc: attacker@evil.com');
  assert.equal(cleaned.includes('\r'), false);
  assert.equal(cleaned.includes('\n'), false);

  assert.equal(validatePasswordStrength('12345').valid, false);
  assert.equal(validatePasswordStrength('123456').valid, true);
});
