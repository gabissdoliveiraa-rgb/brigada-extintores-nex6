/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BrigadeMember,
  Extinguisher,
  ExtinguisherStatus,
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
  if (!floor || floor === 'Todos' || floor === 'Geral - Toda a unidade SENAI') {
    return extinguishers;
  }
  return extinguishers.filter((e) => {
    if (e.floor === floor) return true;
    if (floor === 'Térreo' && e.floor.startsWith('Térreo')) return true;
    if (
      floor === 'Térreo - Recepção e Portaria' &&
      (e.floor === 'Térreo' || e.floor === 'Térreo - Recepção e Portaria')
    ) {
      const loc = (e.location || '').toLowerCase();
      return (
        loc.includes('portaria') ||
        loc.includes('recepção') ||
        loc.includes('saguão') ||
        loc.includes('quadra')
      );
    }
    if (
      floor === 'Térreo - Cantina e Oficinas' &&
      (e.floor === 'Térreo' || e.floor === 'Térreo - Cantina e Oficinas')
    ) {
      const loc = (e.location || '').toLowerCase();
      return !(
        loc.includes('portaria') ||
        loc.includes('recepção') ||
        loc.includes('saguão') ||
        loc.includes('quadra')
      );
    }
    return false;
  });
}

/**
 * Filters inspections by floor.
 */
export function filterInspectionsByFloor(
  inspections: Inspection[],
  floor: string
): Inspection[] {
  if (!floor || floor === 'Todos' || floor === 'Geral - Toda a unidade SENAI') {
    return inspections;
  }
  return inspections.filter((i) => {
    if (i.floor === floor) return true;
    if (floor === 'Térreo' && i.floor.startsWith('Térreo')) return true;
    if (
      floor === 'Térreo - Recepção e Portaria' &&
      (i.floor === 'Térreo' || i.floor === 'Térreo - Recepção e Portaria')
    ) {
      const loc = (i.location || '').toLowerCase();
      return (
        loc.includes('portaria') ||
        loc.includes('recepção') ||
        loc.includes('saguão') ||
        loc.includes('quadra')
      );
    }
    if (
      floor === 'Térreo - Cantina e Oficinas' &&
      (i.floor === 'Térreo' || i.floor === 'Térreo - Cantina e Oficinas')
    ) {
      const loc = (i.location || '').toLowerCase();
      return !(
        loc.includes('portaria') ||
        loc.includes('recepção') ||
        loc.includes('saguão') ||
        loc.includes('quadra')
      );
    }
    return false;
  });
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

/**
 * Parses a Brazilian DD/MM/YYYY or ISO YYYY-MM-DD date string into a local midnight Date.
 */
export function parseBrDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dt;
    }
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dt;
    }
    return null;
  }
  return null;
}

/**
 * Computes signed days from referenceDate (midnight) until target dateStr.
 * Negative = expired, 0 = today, positive = days remaining.
 */
export function getDaysUntilDate(
  dateStr?: string,
  referenceDate: Date = new Date()
): number | null {
  const target = parseBrDate(dateStr);
  if (!target) return null;
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );
  const diffMs = target.getTime() - ref.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Automatically derives extinguisher/inspection status from validityDate and nextInspectionDate.
 * - Vencido: any provided date is < today (days < 0)
 * - Atenção: earliest provided date is between 0 and 30 days from today
 * - Em dia: all provided dates are > 30 days in the future
 */
export function computeStatusFromValidity(
  validityDate?: string,
  nextInspectionDate?: string,
  referenceDate: Date = new Date()
): ExtinguisherStatus {
  const candidates = [
    getDaysUntilDate(validityDate, referenceDate),
    getDaysUntilDate(nextInspectionDate, referenceDate),
  ].filter((d): d is number => d !== null);

  if (candidates.length === 0) return 'Em dia';

  const minDays = Math.min(...candidates);
  if (minDays < 0) return 'Vencido';
  if (minDays <= 30) return 'Atenção';
  return 'Em dia';
}

export interface PeriodReportDataset {
  period: 'Diário' | 'Semanal' | 'Mensal';
  periodRangeLabel: string;
  scopeDescription: string;
  extinguishers: Extinguisher[];
  inspections: Inspection[];
  metrics: {
    regular: number;
    expiring: number;
    critical: number;
    total: number;
    complianceRate: number;
  };
}

/**
 * Filters extinguishers & inspections strictly according to Diário, Semanal or Mensal scope
 * anchored on selectedDateStr (DD/MM/YYYY).
 */
export function filterDataByReportPeriod(
  extinguishers: Extinguisher[],
  inspections: Inspection[],
  period: 'Diário' | 'Semanal' | 'Mensal',
  selectedDateStr: string
): PeriodReportDataset {
  const anchor = parseBrDate(selectedDateStr) || new Date();
  const anchorDay = String(anchor.getDate()).padStart(2, '0');
  const anchorMonth = String(anchor.getMonth() + 1).padStart(2, '0');
  const anchorYear = anchor.getFullYear();
  const formattedAnchor = `${anchorDay}/${anchorMonth}/${anchorYear}`;

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  if (period === 'Diário') {
    const dailyInspections = inspections.filter(
      (i) =>
        i.date === formattedAnchor ||
        i.nextInspectionDate === formattedAnchor ||
        i.validityDate === formattedAnchor ||
        i.status !== 'Em dia'
    );

    const matchedExtCodes = new Set(dailyInspections.map((i) => i.extinguisherCode));
    const priorityExts = extinguishers.filter(
      (e) =>
        e.status !== 'Em dia' ||
        e.nextInspectionDate === formattedAnchor ||
        e.expirationDate === formattedAnchor ||
        matchedExtCodes.has(e.code)
    );
    const routineSample = extinguishers
      .filter((e) => e.status === 'Em dia' && !priorityExts.some((p) => p.id === e.id))
      .slice(0, Math.max(0, 15 - priorityExts.length));

    const periodExts = [...priorityExts, ...routineSample];
    return {
      period,
      periodRangeLabel: `Dia ${formattedAnchor}`,
      scopeDescription: `Vistorias do dia ${formattedAnchor}, vencimentos imediatos e pendências diárias.`,
      extinguishers: periodExts,
      inspections: dailyInspections,
      metrics: generateReportMetrics(periodExts),
    };
  }

  if (period === 'Semanal') {
    // 7-day window starting from Monday of anchor's week to Sunday
    const dayOfWeek = anchor.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diffToMonday);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);

    const inWeek = (dateStr?: string) => {
      const d = parseBrDate(dateStr);
      if (!d) return false;
      return d.getTime() >= weekStart.getTime() && d.getTime() <= weekEnd.getTime();
    };

    const weeklyInspections = inspections.filter(
      (i) =>
        inWeek(i.date) ||
        inWeek(i.nextInspectionDate) ||
        inWeek(i.validityDate) ||
        i.status !== 'Em dia'
    );
    const matchedCodes = new Set(weeklyInspections.map((i) => i.extinguisherCode));

    const priorityExts = extinguishers.filter(
      (e) =>
        e.status !== 'Em dia' ||
        inWeek(e.nextInspectionDate) ||
        inWeek(e.expirationDate) ||
        matchedCodes.has(e.code)
    );
    const weeklyRoutine = extinguishers
      .filter((e) => e.status === 'Em dia' && !priorityExts.some((p) => p.id === e.id))
      .slice(0, Math.max(0, 40 - priorityExts.length));

    const periodExts = [...priorityExts, ...weeklyRoutine];
    return {
      period,
      periodRangeLabel: `Semana ${fmt(weekStart)} a ${fmt(weekEnd)}`,
      scopeDescription: `Acompanhamento semanal (${fmt(weekStart)} a ${fmt(weekEnd)}) por pavimento e validades próximas.`,
      extinguishers: periodExts,
      inspections: weeklyInspections,
      metrics: generateReportMetrics(periodExts),
    };
  }

  // Mensal: full month audit (all extinguishers + all inspections of the month or active alerts)
  const inMonth = (dateStr?: string) => {
    const d = parseBrDate(dateStr);
    if (!d) return false;
    return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
  };

  const monthlyInspections = inspections.filter(
    (i) => inMonth(i.date) || inMonth(i.nextInspectionDate) || inMonth(i.validityDate)
  );
  const finalInspections = monthlyInspections.length > 0 ? monthlyInspections : inspections;

  return {
    period: 'Mensal',
    periodRangeLabel: `Mês ${anchorMonth}/${anchorYear}`,
    scopeDescription: `Auditoria mensal integral (NBR 12962) de todos os ${extinguishers.length} extintores da unidade SENAI.`,
    extinguishers,
    inspections: finalInspections,
    metrics: generateReportMetrics(extinguishers),
  };
}

/**
 * Generates real-time notices from current extinguishers and inspections
 * so NoticesView and Dashboard always reflect live database statuses.
 */
export function buildDynamicNotices(
  extinguishers: Extinguisher[],
  inspections: Inspection[] = []
): Notice[] {
  const notices: Notice[] = [];
  const seenCodes = new Set<string>();

  const urgentExts = extinguishers
    .filter((e) => e.status === 'Vencido' || e.status === 'Atenção')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Vencido' ? -1 : 1;
      const daysA = getDaysUntilDate(a.nextInspectionDate || a.expirationDate) ?? 9999;
      const daysB = getDaysUntilDate(b.nextInspectionDate || b.expirationDate) ?? 9999;
      return daysA - daysB;
    });

  for (const ext of urgentExts) {
    seenCodes.add(ext.code);
    const dueStr = ext.nextInspectionDate || ext.expirationDate || '-';
    notices.push({
      id: `notice_ext_${ext.id}`,
      type: ext.status === 'Vencido' ? 'Recarga / Validade Vencida' : 'Recarga / Inspeção Próxima',
      description: `Extintor #${ext.code} (${ext.type} - ${ext.floor}, ${ext.location})`,
      date: dueStr,
      status: ext.status === 'Vencido' ? 'Vencido' : 'A vencer',
    });
  }

  for (const insp of inspections) {
    if ((insp.status === 'Vencido' || insp.status === 'Atenção') && !seenCodes.has(insp.extinguisherCode)) {
      notices.push({
        id: `notice_insp_${insp.id}`,
        type: insp.status === 'Vencido' ? 'Inspeção Vencida' : 'Inspeção Próxima',
        description: `Inspeção ${insp.code} • Extintor #${insp.extinguisherCode} (${insp.floor}, ${insp.location})`,
        date: insp.nextInspectionDate || insp.validityDate || insp.date,
        status: insp.status === 'Vencido' ? 'Vencido' : 'A vencer',
      });
    }
  }

  return notices;
}

