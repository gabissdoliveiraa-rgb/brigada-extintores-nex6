/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatActivityTimestamp,
  buildActivityEntry,
  filterActivityLogs,
} from './activityUtils';
import { ActivityLogEntry } from '../types/brigada';

test('formatActivityTimestamp formats date in Brazilian "às HH:MM do dia DD/MM/AAAA" standard', () => {
  // Test with fixed date: 2026-03-12 13:00:00
  const d = new Date(2026, 2, 12, 13, 0, 0); // month is 0-indexed: 2 = March
  const formatted = formatActivityTimestamp(d);
  assert.equal(formatted, 'às 13:00 do dia 12/03/2026');
});

test('buildActivityEntry creates valid log entry with timestamp and details', () => {
  const d = new Date(2026, 2, 12, 13, 0, 0);
  const entry = buildActivityEntry({
    userName: 'Melissa Jesus',
    userRole: 'Administrador',
    category: 'Extintores',
    actionType: 'create',
    description: 'Melissa Jesus adicionou 1 extintor (código 009555 - Térreo Recepção)',
    targetCode: '009555',
    targetFloor: 'Térreo',
    date: d,
  });

  assert.equal(entry.userName, 'Melissa Jesus');
  assert.equal(entry.userRole, 'Administrador');
  assert.equal(entry.category, 'Extintores');
  assert.equal(entry.formattedDateTime, 'às 13:00 do dia 12/03/2026');
  assert.equal(entry.targetCode, '009555');
  assert.ok(entry.id.startsWith('log_'));
});

test('filterActivityLogs filters properly by category, user, and search keywords', () => {
  const sampleLogs: ActivityLogEntry[] = [
    {
      id: '1',
      userName: 'Melissa Jesus',
      userRole: 'Administrador',
      category: 'Extintores',
      actionType: 'create',
      description: 'Melissa Jesus adicionou 1 extintor',
      timestamp: '2026-03-12T13:00:00.000Z',
      formattedDateTime: 'às 13:00 do dia 12/03/2026',
      targetCode: '009555',
    },
    {
      id: '2',
      userName: 'João Souza',
      userRole: 'Funcionário',
      category: 'Inspeções',
      actionType: 'inspect',
      description: 'João Souza realizou a inspeção do extintor 001977',
      timestamp: '2026-03-12T10:30:00.000Z',
      formattedDateTime: 'às 10:30 do dia 12/03/2026',
      targetCode: '001977',
    },
    {
      id: '3',
      userName: 'Ana Silva',
      userRole: 'Administrador',
      category: 'Brigada',
      actionType: 'create',
      description: 'Ana Silva cadastrou o brigadista Carlos Lima',
      timestamp: '2026-03-11T09:15:00.000Z',
      formattedDateTime: 'às 09:15 do dia 11/03/2026',
    },
  ];

  // Category filter
  const extsOnly = filterActivityLogs(sampleLogs, 'Extintores', 'Todos', '');
  assert.equal(extsOnly.length, 1);
  assert.equal(extsOnly[0].targetCode, '009555');

  // User filter
  const joaoOnly = filterActivityLogs(sampleLogs, 'Todos', 'João Souza', '');
  assert.equal(joaoOnly.length, 1);
  assert.equal(joaoOnly[0].category, 'Inspeções');

  // Search keyword
  const searchResult = filterActivityLogs(sampleLogs, 'Todos', 'Todos', '001977');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].userName, 'João Souza');

  // All matches
  const allLogs = filterActivityLogs(sampleLogs, 'Todos', 'Todos', '');
  assert.equal(allLogs.length, 3);
});
