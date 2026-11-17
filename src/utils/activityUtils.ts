/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityCategory, ActivityLogEntry, ActivityActionType, UserRole } from '../types/brigada';

/**
 * Formats a Date object or ISO string to the user requested Brazilian standard:
 * "às HH:MM do dia DD/MM/AAAA" (e.g. "às 13:00 do dia 12/03/2026")
 */
export function formatActivityTimestamp(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return 'às 12:00 do dia 10/11/2026';
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `às ${hours}:${minutes} do dia ${day}/${month}/${year}`;
}

/**
 * Creates an activity log entry with automatic id, ISO timestamp, and formatted date string.
 */
export function buildActivityEntry(params: {
  userName: string;
  userRole: UserRole;
  userEmail?: string;
  category: ActivityCategory;
  actionType: ActivityActionType;
  description: string;
  targetCode?: string;
  targetFloor?: string;
  details?: string;
  date?: Date | string;
}): ActivityLogEntry {
  const now = params.date ? (typeof params.date === 'string' ? new Date(params.date) : params.date) : new Date();
  const timestamp = now.toISOString();
  const formattedDateTime = formatActivityTimestamp(now);

  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userName: params.userName,
    userRole: params.userRole,
    userEmail: params.userEmail,
    category: params.category,
    actionType: params.actionType,
    description: params.description,
    timestamp,
    formattedDateTime,
    targetCode: params.targetCode,
    targetFloor: params.targetFloor,
    details: params.details,
  };
}

export type ActivitySortOrder = 'recent' | 'oldest';

export function getActivityLogLocalDateKey(
  log: Pick<ActivityLogEntry, 'timestamp' | 'formattedDateTime'>
): string {
  if (log.timestamp) {
    const d = new Date(log.timestamp);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  const brMatch = log.formattedDateTime?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  return '';
}

/**
 * Filters activity logs by category, user, search keywords, and optional date,
 * then sorts by most recent or oldest first.
 */
export function filterActivityLogs(
  logs: ActivityLogEntry[],
  categoryFilter: string,
  userFilter: string,
  searchTerm: string,
  dateFilter = '',
  sortOrder: ActivitySortOrder = 'recent'
): ActivityLogEntry[] {
  const filtered = logs.filter((log) => {
    // Category filter
    if (categoryFilter !== 'Todos' && log.category !== categoryFilter) {
      return false;
    }

    // User filter
    if (userFilter !== 'Todos' && log.userName !== userFilter) {
      return false;
    }

    // Specific date filter (YYYY-MM-DD)
    if (dateFilter.trim() !== '') {
      const logDate = getActivityLogLocalDateKey(log);
      if (logDate !== dateFilter.trim()) {
        return false;
      }
    }

    // Search term
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchDesc = log.description.toLowerCase().includes(q);
      const matchUser = log.userName.toLowerCase().includes(q);
      const matchCode = log.targetCode ? log.targetCode.toLowerCase().includes(q) : false;
      const matchFloor = log.targetFloor ? log.targetFloor.toLowerCase().includes(q) : false;
      const matchTime = log.formattedDateTime.toLowerCase().includes(q);

      if (!matchDesc && !matchUser && !matchCode && !matchFloor && !matchTime) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    const safeTa = Number.isNaN(ta) ? 0 : ta;
    const safeTb = Number.isNaN(tb) ? 0 : tb;
    return sortOrder === 'oldest' ? safeTa - safeTb : safeTb - safeTa;
  });
}
