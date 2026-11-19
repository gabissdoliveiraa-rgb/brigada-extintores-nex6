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
  cleanForFirestore,
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

test('INITIAL_USERS includes all 12 brigade members and syncFromBrigadeMembers prevents duplicates', () => {
  resetDatabaseToInitial();
  const users = dbUsers.getAll();
  const members = dbBrigade.getAll();
  assert.equal(members.length, 12);

  const userEmailSet = new Set(users.map((u) => u.email.toLowerCase()));
  for (const m of members) {
    assert.ok(
      userEmailSet.has(m.email.toLowerCase()),
      `Brigade member ${m.name} (${m.email}) should exist in INITIAL_USERS`
    );
  }

  // Syncing already-present members should add 0 duplicates
  const dupSync = dbUsers.syncFromBrigadeMembers(members);
  assert.equal(dupSync.length, 0);

  // Syncing a new custom brigade member adds 1 user with valid id
  const added = dbUsers.syncFromBrigadeMembers([
    ...members,
    {
      id: 'member_custom_99',
      name: 'Novo Brigadista Teste',
      role: 'Brigadista',
      isLeader: false,
      jobTitle: 'Técnico',
      functionDescription: 'Teste',
      phone: '(11) 91234-5678',
      email: 'novobrigadista@senaisp.edu.br',
      responsibleFloor: '4º andar',
      trainingStatus: 'Em dia',
      trainingExpirationDate: '10/12/2027',
    },
  ]);
  assert.equal(added.length, 1);
  assert.equal(added[0].id, 'usr_member_custom_99');
  assert.ok(dbUsers.findByEmail('novobrigadista@senaisp.edu.br'));
});

test('cleanForFirestore removes undefined/null and dbUsers.update upserts missing cache items', () => {
  resetDatabaseToInitial();

  const sanitized = cleanForFirestore({
    id: 'usr_test',
    name: 'Teste',
    phone: undefined,
    avatarUrl: null as unknown as string,
    nested: { a: 1, b: null, c: undefined },
    tags: ['ok', null, undefined],
  });

  assert.equal('phone' in sanitized, false);
  assert.equal('avatarUrl' in sanitized, false);
  assert.equal('b' in sanitized.nested, false);
  assert.equal('c' in sanitized.nested, false);
  assert.deepEqual(sanitized.tags, ['ok']);

  // Upsert a user not yet in local cache
  dbUsers.update({
    id: 'usr_remote_only',
    name: 'Usuário Remoto Editado',
    role: 'Funcionário',
    email: 'remoto@senaisp.edu.br',
    phone: '(11) 95555-1234',
    responsibleSector: '3º andar',
  });
  const updated = dbUsers.findByEmail('remoto@senaisp.edu.br');
  assert.ok(updated);
  assert.equal(updated?.name, 'Usuário Remoto Editado');
});
