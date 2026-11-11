/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActivityLogEntry,
  BrigadeMember,
  Extinguisher,
  FullDatabaseBackup,
  Inspection,
  Notice,
  RegisteredUser,
} from '../types/brigada';
import {
  INITIAL_ACTIVITY_LOGS,
  INITIAL_BRIGADE_MEMBERS,
  INITIAL_EXTINGUISHERS,
  INITIAL_INSPECTIONS,
  INITIAL_NOTICES,
  INITIAL_USERS,
} from '../data/initialData';
import { buildActivityEntry } from '../utils/activityUtils';

const KEYS = {
  USERS: 'senai_db_users_v2',
  EXTINGUISHERS: 'senai_db_extinguishers_rh049',
  INSPECTIONS: 'senai_db_inspections_rh049',
  MEMBERS: 'senai_db_members_v2',
  NOTICES: 'senai_db_notices_rh049',
  ACTIVITY_LOGS: 'senai_db_activity_logs_rh049',
};

// --- Storage Helpers ---
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
  } catch (err) {
    console.error(`Erro ao carregar dados da chave ${key}:`, err);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Erro ao salvar dados na chave ${key}:`, err);
  }
}

// --- USERS & EMAILS CRUD ---
export const dbUsers = {
  getAll: (): RegisteredUser[] => {
    const list = loadFromStorage<RegisteredUser[]>(KEYS.USERS, INITIAL_USERS);
    // Ensure legacy extra users (user_3, user_4, user_5) are purged, starting with exactly 1 Admin and 1 Employee
    const hasLegacyExtraUsers = list.some(
      (u) => u.id === 'user_3' || u.id === 'user_4' || u.id === 'user_5'
    );
    if (!list || hasLegacyExtraUsers || list.length === 0) {
      saveToStorage(KEYS.USERS, INITIAL_USERS);
      return INITIAL_USERS;
    }
    return list;
  },
  saveAll: (users: RegisteredUser[]): void => {
    saveToStorage(KEYS.USERS, users);
  },
  create: (user: Omit<RegisteredUser, 'id'>): RegisteredUser => {
    const list = dbUsers.getAll();
    const newUser: RegisteredUser = {
      ...user,
      id: `usr_${Date.now()}`,
      createdAt: user.createdAt || new Date().toLocaleDateString('pt-BR'),
    };
    const updated = [newUser, ...list];
    dbUsers.saveAll(updated);
    return newUser;
  },
  update: (user: RegisteredUser): void => {
    const list = dbUsers.getAll();
    const updated = list.map((u) => (u.id === user.id ? user : u));
    dbUsers.saveAll(updated);
  },
  delete: (id: string): boolean => {
    const list = dbUsers.getAll();
    const target = list.find((u) => u.id === id);
    if (!target) return false;

    // Prevent deleting the last administrator
    const adminCount = list.filter((u) => u.role === 'Administrador').length;
    if (target.role === 'Administrador' && adminCount <= 1) {
      throw new Error('Não é possível excluir o único Administrador do sistema.');
    }

    const filtered = list.filter((u) => u.id !== id);
    dbUsers.saveAll(filtered);
    return true;
  },
  findByEmail: (emailOrUser: string): RegisteredUser | undefined => {
    const list = dbUsers.getAll();
    const clean = emailOrUser.trim().toLowerCase();
    return list.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.email.toLowerCase().startsWith(clean + '@') ||
        u.name.toLowerCase() === clean
    );
  },
};

// --- EXTINGUISHERS CRUD ---
export const dbExtinguishers = {
  getAll: (): Extinguisher[] => {
    const list = loadFromStorage<Extinguisher[]>(KEYS.EXTINGUISHERS, INITIAL_EXTINGUISHERS);
    // Ensure all 123 official extinguishers from RH 049 exist
    if (!list || list.length < INITIAL_EXTINGUISHERS.length) {
      saveToStorage(KEYS.EXTINGUISHERS, INITIAL_EXTINGUISHERS);
      return INITIAL_EXTINGUISHERS;
    }
    return list;
  },
  saveAll: (exts: Extinguisher[]): void => {
    saveToStorage(KEYS.EXTINGUISHERS, exts);
  },
  create: (ext: Extinguisher): Extinguisher => {
    const extWithQr: Extinguisher = {
      ...ext,
      qrCode: ext.qrCode || `SENAI-EXT-${ext.code}`,
    };
    const list = dbExtinguishers.getAll();
    const updated = [extWithQr, ...list];
    dbExtinguishers.saveAll(updated);
    return extWithQr;
  },
  createBatch: (newExts: Extinguisher[]): void => {
    const list = dbExtinguishers.getAll();
    const updated = [...newExts, ...list];
    dbExtinguishers.saveAll(updated);
  },
  update: (ext: Extinguisher): void => {
    const list = dbExtinguishers.getAll();
    const updated = list.map((e) => (e.id === ext.id ? ext : e));
    dbExtinguishers.saveAll(updated);
  },
  delete: (id: string): void => {
    const list = dbExtinguishers.getAll();
    const filtered = list.filter((e) => e.id !== id);
    dbExtinguishers.saveAll(filtered);
  },
};

// --- INSPECTIONS CRUD ---
export const dbInspections = {
  getAll: (): Inspection[] => {
    return loadFromStorage<Inspection[]>(KEYS.INSPECTIONS, INITIAL_INSPECTIONS);
  },
  saveAll: (inspections: Inspection[]): void => {
    saveToStorage(KEYS.INSPECTIONS, inspections);
  },
  update: (insp: Inspection): void => {
    const list = dbInspections.getAll();
    const updated = list.map((i) => (i.id === insp.id ? insp : i));
    dbInspections.saveAll(updated);
  },
};

// --- BRIGADE MEMBERS CRUD ---
export const dbBrigade = {
  getAll: (): BrigadeMember[] => {
    const list = loadFromStorage<BrigadeMember[]>(KEYS.MEMBERS, INITIAL_BRIGADE_MEMBERS);
    // Self-healing: Ensure all 12 official brigade members exist in the database (resolves the 5 vs 12 issue)
    if (!list || list.length < INITIAL_BRIGADE_MEMBERS.length) {
      saveToStorage(KEYS.MEMBERS, INITIAL_BRIGADE_MEMBERS);
      return INITIAL_BRIGADE_MEMBERS;
    }
    return list;
  },
  saveAll: (members: BrigadeMember[]): void => {
    saveToStorage(KEYS.MEMBERS, members);
  },
  create: (member: BrigadeMember): BrigadeMember => {
    const list = dbBrigade.getAll();
    const updated = [member, ...list];
    dbBrigade.saveAll(updated);
    return member;
  },
  update: (member: BrigadeMember): void => {
    const list = dbBrigade.getAll();
    const updated = list.map((m) => (m.id === member.id ? member : m));
    dbBrigade.saveAll(updated);
  },
  delete: (id: string): void => {
    const list = dbBrigade.getAll();
    const filtered = list.filter((m) => m.id !== id);
    dbBrigade.saveAll(filtered);
  },
};

// --- NOTICES CRUD ---
export const dbNotices = {
  getAll: (): Notice[] => {
    return loadFromStorage<Notice[]>(KEYS.NOTICES, INITIAL_NOTICES);
  },
  saveAll: (notices: Notice[]): void => {
    saveToStorage(KEYS.NOTICES, notices);
  },
};

// --- ACTIVITY LOGS CRUD ---
export const dbActivityLogs = {
  getAll: (): ActivityLogEntry[] => {
    return loadFromStorage<ActivityLogEntry[]>(KEYS.ACTIVITY_LOGS, INITIAL_ACTIVITY_LOGS);
  },
  saveAll: (logs: ActivityLogEntry[]): void => {
    saveToStorage(KEYS.ACTIVITY_LOGS, logs);
  },
  add: (
    entry: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'formattedDateTime'> & {
      timestamp?: string;
      formattedDateTime?: string;
    }
  ): ActivityLogEntry => {
    const list = dbActivityLogs.getAll();
    const newEntry = buildActivityEntry({
      userName: entry.userName,
      userRole: entry.userRole,
      userEmail: entry.userEmail,
      category: entry.category,
      actionType: entry.actionType,
      description: entry.description,
      targetCode: entry.targetCode,
      targetFloor: entry.targetFloor,
      details: entry.details,
      date: entry.timestamp,
    });
    const updated = [newEntry, ...list.slice(0, 199)];
    dbActivityLogs.saveAll(updated);
    return newEntry;
  },
  clear: (): void => {
    dbActivityLogs.saveAll([]);
  },
};

// --- DATABASE STATS & BACKUP ---
export interface DatabaseOverviewStats {
  totalUsers: number;
  adminUsers: number;
  employeeUsers: number;
  totalExtinguishers: number;
  totalBrigadeMembers: number;
  totalInspections: number;
  totalActivityLogs: number;
  storageSizeBytes: number;
  lastUpdated: string;
}

export function getDatabaseStats(): DatabaseOverviewStats {
  const users = dbUsers.getAll();
  const extinguishers = dbExtinguishers.getAll();
  const members = dbBrigade.getAll();
  const inspections = dbInspections.getAll();
  const logs = dbActivityLogs.getAll();

  let totalSize = 0;
  for (const k of Object.values(KEYS)) {
    const val = localStorage.getItem(k);
    if (val) totalSize += val.length * 2; // rough UTF-16 bytes
  }

  return {
    totalUsers: users.length,
    adminUsers: users.filter((u) => u.role === 'Administrador').length,
    employeeUsers: users.filter((u) => u.role === 'Funcionário').length,
    totalExtinguishers: extinguishers.length,
    totalBrigadeMembers: members.length,
    totalInspections: inspections.length,
    totalActivityLogs: logs.length,
    storageSizeBytes: totalSize,
    lastUpdated: new Date().toLocaleTimeString('pt-BR'),
  };
}

export function exportFullDatabase(): FullDatabaseBackup {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    users: dbUsers.getAll(),
    extinguishers: dbExtinguishers.getAll(),
    inspections: dbInspections.getAll(),
    brigadeMembers: dbBrigade.getAll(),
    notices: dbNotices.getAll(),
    activityLogs: dbActivityLogs.getAll(),
  };
}

export function importFullDatabase(backup: FullDatabaseBackup): boolean {
  if (!backup || typeof backup !== 'object') return false;

  if (Array.isArray(backup.users)) {
    dbUsers.saveAll(backup.users);
  }
  if (Array.isArray(backup.extinguishers)) {
    dbExtinguishers.saveAll(backup.extinguishers);
  }
  if (Array.isArray(backup.inspections)) {
    dbInspections.saveAll(backup.inspections);
  }
  if (Array.isArray(backup.brigadeMembers)) {
    dbBrigade.saveAll(backup.brigadeMembers);
  }
  if (Array.isArray(backup.notices)) {
    dbNotices.saveAll(backup.notices);
  }
  if (Array.isArray(backup.activityLogs)) {
    dbActivityLogs.saveAll(backup.activityLogs);
  }

  return true;
}

export function resetDatabaseToInitial(): void {
  dbUsers.saveAll(INITIAL_USERS);
  dbExtinguishers.saveAll(INITIAL_EXTINGUISHERS);
  dbInspections.saveAll(INITIAL_INSPECTIONS);
  dbBrigade.saveAll(INITIAL_BRIGADE_MEMBERS);
  dbNotices.saveAll(INITIAL_NOTICES);
  dbActivityLogs.saveAll(INITIAL_ACTIVITY_LOGS);
}
