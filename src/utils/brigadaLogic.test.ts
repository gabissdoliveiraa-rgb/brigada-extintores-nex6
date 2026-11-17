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
  computeStatusFromValidity,
  filterDataByReportPeriod,
  buildDynamicNotices,
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
    expirationDate: '11/02/2029',
    nextInspectionDate: '11/02/2027',
  },
  {
    id: '2',
    code: 'CO2 02',
    type: 'CO2',
    location: 'Máquinas Direito',
    floor: 'Térreo',
    capacity: '6kg',
    status: 'Atenção',
    expirationDate: '11/02/2029',
    nextInspectionDate: '05/12/2026',
  },
  {
    id: '3',
    code: 'ABC 04',
    type: 'Pó Químico ABC',
    location: 'Corredor 1º andar',
    floor: '1º andar',
    capacity: '6kg',
    status: 'Vencido',
    expirationDate: '11/02/2029',
    nextInspectionDate: '10/01/2026',
  },
];

const mockInspections: Inspection[] = [
  {
    id: 'i1',
    code: '001',
    extinguisherCode: 'ABC 01',
    extinguisherType: 'Pó Químico ABC',
    date: '15/11/2026',
    responsible: 'Ana Silva',
    status: 'Em dia',
    floor: 'Térreo',
    location: 'Recepção',
    capacity: '6kg',
    validityDate: '11/02/2027',
    nextInspectionDate: '11/02/2027',
  },
  {
    id: 'i2',
    code: '002',
    extinguisherCode: 'CO2 02',
    extinguisherType: 'CO2',
    date: '12/11/2026',
    responsible: 'João Souza',
    status: 'Atenção',
    floor: 'Térreo',
    location: 'Máquinas Direito',
    capacity: '6kg',
    validityDate: '05/12/2026',
    nextInspectionDate: '05/12/2026',
  },
  {
    id: 'i3',
    code: '003',
    extinguisherCode: 'ABC 04',
    extinguisherType: 'Pó Químico ABC',
    date: '05/10/2026',
    responsible: 'Carlos Santos',
    status: 'Vencido',
    floor: '1º andar',
    location: 'Corredor 1º andar',
    capacity: '6kg',
    validityDate: '10/01/2026',
    nextInspectionDate: '10/01/2026',
  },
];

test('calculateDashboardStats computes correct totals and status counts', () => {
  const stats = calculateDashboardStats(mockMembers, mockExtinguishers);
  assert.equal(stats.totalBrigade, 3);
  assert.equal(stats.totalExtinguishers, 3);
  assert.equal(stats.inspectionsUpToDate, 1);
  assert.equal(stats.inspectionsExpired, 2);
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
  assert.equal(metrics.regular, 1);
  assert.equal(metrics.expiring, 1);
  assert.equal(metrics.critical, 1);
  assert.equal(metrics.complianceRate, 33);
});

test('computeStatusFromValidity classifies Vencido, Atenção, and Em dia accurately', () => {
  const ref = new Date(2026, 10, 15); // 15/11/2026
  assert.equal(computeStatusFromValidity('10/01/2026', '10/01/2026', ref), 'Vencido');
  assert.equal(computeStatusFromValidity('11/02/2029', '05/12/2026', ref), 'Atenção');
  assert.equal(computeStatusFromValidity('11/02/2029', '11/02/2027', ref), 'Em dia');
});

test('filterDataByReportPeriod generates distinct Diário, Semanal, and Mensal scopes', () => {
  const daily = filterDataByReportPeriod(mockExtinguishers, mockInspections, 'Diário', '15/11/2026');
  assert.equal(daily.period, 'Diário');
  assert.equal(daily.periodRangeLabel, 'Dia 15/11/2026');
  assert.equal(daily.inspections.length, 3);

  const weekly = filterDataByReportPeriod(mockExtinguishers, mockInspections, 'Semanal', '15/11/2026');
  assert.equal(weekly.period, 'Semanal');
  assert.match(weekly.periodRangeLabel, /^Semana 09\/11\/2026 a 15\/11\/2026$/);

  const monthly = filterDataByReportPeriod(mockExtinguishers, mockInspections, 'Mensal', '15/11/2026');
  assert.equal(monthly.period, 'Mensal');
  assert.equal(monthly.periodRangeLabel, 'Mês 11/2026');
  assert.equal(monthly.extinguishers.length, mockExtinguishers.length);
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
    inspections: mockInspections,
    members: mockMembers,
    period: 'Semanal',
    selectedDate: '15/11/2026',
  });

  assert.equal(result.success, true);
  assert.equal(result.filename, 'Relatorio_Semanal_SENAI_15-11-2026.pdf');
});

test('filterExtinguishersByFloor handles Geral - Toda a unidade SENAI and Recepção subfloor', () => {
  const geral = filterExtinguishersByFloor(
    mockExtinguishers,
    'Geral - Toda a unidade SENAI'
  );
  assert.equal(geral.length, 3);

  const recepcao = filterExtinguishersByFloor(
    mockExtinguishers,
    'Térreo - Recepção e Portaria'
  );
  assert.equal(recepcao.length, 1);
  assert.equal(recepcao[0].code, 'ABC 01');
});

test('buildDynamicNotices prioritizes Vencido before Atenção and excludes Em dia', () => {
  const dynamic = buildDynamicNotices(mockExtinguishers, mockInspections);
  assert.equal(dynamic.length, 2);
  assert.equal(dynamic[0].status, 'Vencido');
  assert.match(dynamic[0].description, /ABC 04/);
  assert.equal(dynamic[1].status, 'A vencer');
  assert.match(dynamic[1].description, /CO2 02/);
});
