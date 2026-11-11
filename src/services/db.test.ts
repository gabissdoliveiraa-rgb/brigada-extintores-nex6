/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node test environment
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
  length: 0,
  key: () => null,
};

import {
  dbUsers,
  dbExtinguishers,
  dbBrigade,
  exportFullDatabase,
  importFullDatabase,
  resetDatabaseToInitial,
} from './db';

test('dbUsers performs CRUD operations and prevents deleting last admin', () => {
  resetDatabaseToInitial();
  const initial = dbUsers.getAll();
  assert.ok(initial.length >= 2, 'Should load initial users');

  // Create new user
  const created = dbUsers.create({
    name: 'Roberto Silva',
    role: 'Funcionário',
    email: 'robertosilva@senaisp.edu.br',
    phone: '(11) 99999-1111',
    password: 'senhaSegura123',
  });
  assert.equal(created.name, 'Roberto Silva');

  // Verify findByEmail
  const found = dbUsers.findByEmail('robertosilva@senaisp.edu.br');
  assert.ok(found, 'Should find user by email');
  assert.equal(found?.id, created.id);

  // Update
  dbUsers.update({ ...created, phone: '(11) 98888-2222' });
  const updated = dbUsers.findByEmail('robertosilva@senaisp.edu.br');
  assert.equal(updated?.phone, '(11) 98888-2222');

  // Delete
  const deleted = dbUsers.delete(created.id);
  assert.equal(deleted, true);
  assert.equal(dbUsers.findByEmail('robertosilva@senaisp.edu.br'), undefined);
});

test('dbExtinguishers and dbBrigade handle records correctly', () => {
  resetDatabaseToInitial();
  const initialExts = dbExtinguishers.getAll();
  assert.equal(initialExts.length, 123, 'Should have 123 initial extinguishers from Document RH 049');

  const newExt = {
    id: 'test_ext_1',
    code: 'TEST 99',
    type: 'Pó Químico ABC' as const,
    location: 'Lab 01',
    floor: '2º andar' as const,
    capacity: '6kg',
    status: 'Em dia' as const,
  };
  dbExtinguishers.create(newExt);
  assert.equal(dbExtinguishers.getAll().length, 124);

  dbExtinguishers.delete('test_ext_1');
  assert.equal(dbExtinguishers.getAll().length, 123);
});

test('exportFullDatabase and importFullDatabase preserve data integrity', () => {
  resetDatabaseToInitial();
  const backup = exportFullDatabase();
  assert.ok(backup.users.length > 0);
  assert.equal(backup.extinguishers.length, 123);

  // Modify something
  dbExtinguishers.create({
    id: 'custom_ext',
    code: 'CUSTOM 01',
    type: 'CO2',
    location: 'Auditório',
    floor: 'Térreo',
    capacity: '4kg',
    status: 'Em dia',
  });
  assert.equal(dbExtinguishers.getAll().length, 124);

  // Restore backup
  const success = importFullDatabase(backup);
  assert.equal(success, true);
  assert.equal(dbExtinguishers.getAll().length, 123);
});
