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

/**
 * Filters activity logs by category, user, and search keywords.
 */
export function filterActivityLogs(
  logs: ActivityLogEntry[],
  categoryFilter: string,
  userFilter: string,
  searchTerm: string
): ActivityLogEntry[] {
  return logs.filter((log) => {
    // Category filter
    if (categoryFilter !== 'Todos' && log.category !== categoryFilter) {
      return false;
    }

    // User filter
    if (userFilter !== 'Todos' && log.userName !== userFilter) {
      return false;
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
}
