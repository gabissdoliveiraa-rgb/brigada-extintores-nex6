/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BrigadeMember,
  Extinguisher,
  Inspection,
  Notice,
  UserRole,
} from '../types/brigada';

export interface DashboardStats {
  totalBrigade: number;
  totalExtinguishers: number;
  inspectionsUpToDate: number;
  inspectionsExpired: number;
}

export interface BrigadeStats {
  total: number;
  leaders: number;
  brigadistas: number;
  trainingUpToDate: number;
  trainingExpired: number;
}

/**
 * Calculates high-level dashboard metrics for the SENAI system.
 */
export function calculateDashboardStats(
  members: BrigadeMember[],
  extinguishers: Extinguisher[]
): DashboardStats {
  const totalBrigade = members.length;
  const totalExtinguishers = extinguishers.length;
  const inspectionsUpToDate = extinguishers.filter(
    (e) => e.status === 'Em dia'
  ).length;
  const inspectionsExpired = extinguishers.filter(
    (e) => e.status === 'Vencido' || e.status === 'Atenção'
  ).length;

  return {
    totalBrigade,
    totalExtinguishers,
    inspectionsUpToDate,
    inspectionsExpired,
  };
}

/**
 * Calculates breakdown statistics for the brigade team.
 */
export function calculateBrigadeStats(members: BrigadeMember[]): BrigadeStats {
  const total = members.length;
  const leaders = members.filter((m) => m.isLeader).length;
  const brigadistas = total - leaders;
  const trainingUpToDate = members.filter(
    (m) => m.trainingStatus === 'Em dia'
  ).length;
  const trainingExpired = members.filter(
    (m) => m.trainingStatus === 'Vencido'
  ).length;

  return {
    total,
    leaders,
    brigadistas,
    trainingUpToDate,
    trainingExpired,
  };
}

/**
 * Filters extinguishers by specific floor.
 */
export function filterExtinguishersByFloor(
  extinguishers: Extinguisher[],
  floor: string
): Extinguisher[] {
  if (!floor || floor === 'Todos') return extinguishers;
  return extinguishers.filter((e) => e.floor === floor);
}

/**
 * Filters inspections by floor.
 */
export function filterInspectionsByFloor(
  inspections: Inspection[],
  floor: string
): Inspection[] {
  if (!floor || floor === 'Todos') return inspections;
  return inspections.filter((i) => i.floor === floor);
}

/**
 * Validates whether the logged user has administrative privileges.
 */
export function canPerformAdminAction(role: UserRole): boolean {
  return role === 'Administrador';
}

/**
 * Formats date into standard Brazilian format (DD/MM/YYYY).
 */
export function formatBrDate(dateInput: string): string {
  if (!dateInput) return '';
  if (dateInput.includes('/')) return dateInput;
  const parts = dateInput.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateInput;
}

/**
 * Generates summary metrics for compliance reports based on extinguishers.
 */
export function generateReportMetrics(extinguishers: Extinguisher[]): {
  regular: number;
  expiring: number;
  critical: number;
  total: number;
  complianceRate: number;
} {
  const total = extinguishers.length;
  const regular = extinguishers.filter((e) => e.status === 'Em dia').length;
  const expiring = extinguishers.filter((e) => e.status === 'Atenção').length;
  const critical = extinguishers.filter((e) => e.status === 'Vencido').length;

  const complianceRate = total > 0 ? Math.round((regular / total) * 100) : 0;

  return {
    regular,
    expiring,
    critical,
    total,
    complianceRate,
  };
}
