/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardStats,
  calculateBrigadeStats,
  filterExtinguishersByFloor,
  filterInspectionsByFloor,
  canPerformAdminAction,
  formatBrDate,
  generateReportMetrics,
} from './brigadaLogic';
import { BrigadeMember, Extinguisher, Inspection } from '../types/brigada';

const mockMembers: BrigadeMember[] = [
  {
    id: '1',
    name: 'Ana Silva',
    role: 'Líder da Brigada',
    isLeader: true,
    jobTitle: 'Técnica de Segurança',
    functionDescription: 'Liderar e coordenar',
    phone: '(11) 97445-9288',
    email: 'anasilva@senaisp.edu.br',
    responsibleFloor: '1º andar',
    trainingStatus: 'Em dia',
  },
  {
    id: '2',
    name: 'João Souza',
    role: 'Brigadista',
    isLeader: false,
    jobTitle: 'Assistente',
    functionDescription: 'Apoiar evacuação',
    phone: '(11) 98662-3177',
    email: 'joaosouza@senaisp.edu.br',
    responsibleFloor: '1º andar',
    trainingStatus: 'Em dia',
  },
  {
    id: '3',
    name: 'Carlos Santos',
    role: 'Brigadista',
    isLeader: false,
    jobTitle: 'Operador',
    functionDescription: 'Combate a princípio de incêndio',
    phone: '(11) 91111-2222',
    email: 'carlos@senaisp.edu.br',
    responsibleFloor: '2º andar',
    trainingStatus: 'Vencido',
  },
];

const mockExtinguishers: Extinguisher[] = [
  {
    id: '1',
    code: 'ABC 01',
    type: 'Pó Químico ABC',
    location: 'Recepção',
    floor: 'Térreo',
    capacity: '6kg',
    status: 'Em dia',
  },
  {
    id: '2',
    code: 'CO2 02',
    type: 'CO2',
    location: 'Máquinas Direito',
    floor: 'Térreo',
    capacity: '6kg',
    status: 'Em dia',
  },
  {
    id: '3',
    code: 'ABC 04',
    type: 'Pó Químico ABC',
    location: 'Corredor 1º andar',
    floor: '1º andar',
    capacity: '6kg',
    status: 'Vencido',
  },
];

test('calculateDashboardStats computes correct totals and status counts', () => {
  const stats = calculateDashboardStats(mockMembers, mockExtinguishers);
  assert.equal(stats.totalBrigade, 3);
  assert.equal(stats.totalExtinguishers, 3);
  assert.equal(stats.inspectionsUpToDate, 2);
  assert.equal(stats.inspectionsExpired, 1);
});

test('calculateBrigadeStats identifies leaders and training compliance', () => {
  const stats = calculateBrigadeStats(mockMembers);
  assert.equal(stats.total, 3);
  assert.equal(stats.leaders, 1);
  assert.equal(stats.brigadistas, 2);
  assert.equal(stats.trainingUpToDate, 2);
  assert.equal(stats.trainingExpired, 1);
});

test('filterExtinguishersByFloor filters correctly by floor', () => {
  const terreo = filterExtinguishersByFloor(mockExtinguishers, 'Térreo');
  assert.equal(terreo.length, 2);
  assert.equal(terreo[0].code, 'ABC 01');

  const andar1 = filterExtinguishersByFloor(mockExtinguishers, '1º andar');
  assert.equal(andar1.length, 1);
  assert.equal(andar1[0].code, 'ABC 04');

  const all = filterExtinguishersByFloor(mockExtinguishers, 'Todos');
  assert.equal(all.length, 3);
});

test('canPerformAdminAction only authorizes Administrador', () => {
  assert.equal(canPerformAdminAction('Administrador'), true);
  assert.equal(canPerformAdminAction('Funcionário'), false);
});

test('formatBrDate formats ISO dates or preserves slash dates', () => {
  assert.equal(formatBrDate('2026-10-12'), '12/10/2026');
  assert.equal(formatBrDate('15/08/2026'), '15/08/2026');
});

test('generateReportMetrics calculates compliance rate correctly', () => {
  const metrics = generateReportMetrics(mockExtinguishers);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.regular, 2);
  assert.equal(metrics.critical, 1);
  assert.equal(metrics.complianceRate, 67); // 2/3 * 100 ~ 67%
});

test('generatePdfReport constructs valid PDF document and filename', async () => {
  const { generatePdfReport } = await import('./pdfGenerator');
  const result = generatePdfReport({
    user: {
      id: 'admin_1',
      name: 'Melissa Jesus',
      role: 'Administrador',
      email: 'melissa@senaisp.edu.br',
      phone: '(11) 97340-9476',
    },
    extinguishers: mockExtinguishers,
    members: mockMembers,
    period: 'Diário',
    selectedDate: '12/10/2026',
  });

  assert.equal(result.success, true);
  assert.equal(result.filename, 'Relatorio_Diário_SENAI_12-10-2026.pdf');
});
