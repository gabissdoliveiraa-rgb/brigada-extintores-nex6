/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhone,
  formatDate,
  validatePhone,
  validateEmail,
  validateDate,
  validateName,
} from './maskUtils';

test('formatPhone applies Brazilian mask dynamically while typing', () => {
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone('1'), '(1');
  assert.equal(formatPhone('11'), '(11');
  assert.equal(formatPhone('119'), '(11) 9');
  assert.equal(formatPhone('1197340'), '(11) 97340-');
  assert.equal(formatPhone('11973409476'), '(11) 97340-9476');
  // Landline 10 digits
  assert.equal(formatPhone('1134567890'), '(11) 3456-7890');
  // Filters out letters
  assert.equal(formatPhone('11abc97340xyz9476'), '(11) 97340-9476');
});

test('formatDate applies DD/MM/AAAA mask dynamically while typing', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('27'), '27');
  assert.equal(formatDate('2707'), '27/07');
  assert.equal(formatDate('27072000'), '27/07/2000');
  // Strips letters
  assert.equal(formatDate('27a07b2000'), '27/07/2000');
});

test('validatePhone detects invalid phone input', () => {
  assert.equal(validatePhone('').valid, false);
  assert.equal(validatePhone('12345').valid, false);
  assert.equal(validatePhone('(11) 97340-9476').valid, true);
  assert.equal(validatePhone('(11) 3456-7890').valid, true);
  // Invalid DDD
  assert.equal(validatePhone('(05) 97340-9476').valid, false);
});

test('validateEmail validates format', () => {
  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('invalid-email').valid, false);
  assert.equal(validateEmail('melissa@senaisp.edu.br').valid, true);
});

test('validateDate validates realistic days and months', () => {
  assert.equal(validateDate('').valid, false);
  assert.equal(validateDate('32/01/2000').valid, false);
  assert.equal(validateDate('15/13/2000').valid, false);
  assert.equal(validateDate('27/07/2000').valid, true);
});

test('validateName rejects numbers or short names', () => {
  assert.equal(validateName('').valid, false);
  assert.equal(validateName('Al').valid, false);
  assert.equal(validateName('Melissa 123').valid, false);
  assert.equal(validateName('Melissa Jesus').valid, true);
});
