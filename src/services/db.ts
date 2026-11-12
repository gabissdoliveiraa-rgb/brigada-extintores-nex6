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
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';

const KEYS = {
  USERS: 'senai_db_users_v2',
  EXTINGUISHERS: 'senai_db_extinguishers_rh049',
  INSPECTIONS: 'senai_db_inspections_rh049',
  MEMBERS: 'senai_db_members_v2',
  NOTICES: 'senai_db_notices_rh049',
  ACTIVITY_LOGS: 'senai_db_activity_logs_rh049',
};

// Subscriber listeners for real-time reactivity across devices
type Listener<T> = (data: T) => void;
const listeners = {
  users: new Set<Listener<RegisteredUser[]>>(),
  extinguishers: new Set<Listener<Extinguisher[]>>(),
  members: new Set<Listener<BrigadeMember[]>>(),
  inspections: new Set<Listener<Inspection[]>>(),
  notices: new Set<Listener<Notice[]>>(),
  activityLogs: new Set<Listener<ActivityLogEntry[]>>(),
};

function notify<T>(set: Set<Listener<T>>, data: T) {
  set.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn('Erro ao notificar subscriber:', e);
    }
  });
}

// --- Storage Helpers ---
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
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
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Erro ao salvar dados na chave ${key}:`, err);
  }
}

// Sanitize Firestore Doc IDs (must match firestore.rules regex ^[a-zA-Z0-9_\-]+$)
function sanitizeDocId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

/**
 * Recursively cleans an object so that no property has the value `undefined`.
 * Firestore throws a runtime error if any property value is `undefined`.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = cleanForFirestore(value);
      }
    }
    return clean as T;
  }
  return data;
}

// --- USERS & EMAILS CRUD ---
export const dbUsers = {
  getAll: (): RegisteredUser[] => {
    const list = loadFromStorage<RegisteredUser[]>(KEYS.USERS, INITIAL_USERS);
    const hasLegacyExtraUsers = list.some(
      (u) => u.id === 'user_3' || u.id === 'user_4' || u.id === 'user_5'
    );
    if (!list || hasLegacyExtraUsers || list.length === 0) {
      saveToStorage(KEYS.USERS, INITIAL_USERS);
      return INITIAL_USERS;
    }
    return list;
  },
  subscribe: (cb: Listener<RegisteredUser[]>): (() => void) => {
    listeners.users.add(cb);
    return () => listeners.users.delete(cb);
  },
  saveAll: (users: RegisteredUser[]): void => {
    saveToStorage(KEYS.USERS, users);
    notify(listeners.users, users);
    // Sync batch to Firestore
    if (db && typeof window !== 'undefined') {
      try {
        const batch = writeBatch(db);
        users.forEach((u) => {
          const ref = doc(db, 'users', sanitizeDocId(u.id));
          batch.set(ref, cleanForFirestore(u));
        });
        batch.commit().catch((err) => console.warn('Erro ao salvar usuários no Firestore:', err));
      } catch (err) {
        console.warn('Erro ao preparar batch de usuários:', err);
      }
    }
  },
  create: (user: Omit<RegisteredUser, 'id'>): RegisteredUser => {
    const list = dbUsers.getAll();
    const newUser: RegisteredUser = {
      ...user,
      id: `usr_${Date.now()}`,
      createdAt: user.createdAt || new Date().toLocaleDateString('pt-BR'),
    };
    const updated = [newUser, ...list];
    saveToStorage(KEYS.USERS, updated);
    notify(listeners.users, updated);

    // Sync to Firestore
    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'users', sanitizeDocId(newUser.id)), cleanForFirestore(newUser)).catch((err) =>
          console.warn('Erro ao gravar usuário no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no setDoc de usuário:', err);
      }
    }

    return newUser;
  },
  update: (user: RegisteredUser): void => {
    const list = dbUsers.getAll();
    const updated = list.map((u) => (u.id === user.id ? user : u));
    saveToStorage(KEYS.USERS, updated);
    notify(listeners.users, updated);

    if (db && typeof window !== 'undefined') {
      try {
        const payload = cleanForFirestore(user);
        setDoc(doc(db, 'users', sanitizeDocId(user.id)), payload).catch((err) =>
          console.warn('Erro ao atualizar usuário no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no update do usuário:', err);
      }
    }
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
    saveToStorage(KEYS.USERS, filtered);
    notify(listeners.users, filtered);

    if (db && typeof window !== 'undefined') {
      try {
        deleteDoc(doc(db, 'users', sanitizeDocId(id))).catch((err) =>
          console.warn('Erro ao excluir usuário no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no delete do usuário:', err);
      }
    }

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
    if (!list) {
      saveToStorage(KEYS.EXTINGUISHERS, INITIAL_EXTINGUISHERS);
      return INITIAL_EXTINGUISHERS;
    }
    return list;
  },
  subscribe: (cb: Listener<Extinguisher[]>): (() => void) => {
    listeners.extinguishers.add(cb);
    return () => listeners.extinguishers.delete(cb);
  },
  saveAll: (exts: Extinguisher[]): void => {
    saveToStorage(KEYS.EXTINGUISHERS, exts);
    notify(listeners.extinguishers, exts);

    if (db && typeof window !== 'undefined') {
      try {
        // Chunk into batches of 400 (Firestore limit is 500)
        for (let i = 0; i < exts.length; i += 400) {
          const chunk = exts.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((ext) => {
            batch.set(doc(db, 'extinguishers', sanitizeDocId(ext.id)), cleanForFirestore(ext));
          });
          batch.commit().catch((err) => console.warn('Erro ao sincronizar extintores no Firestore:', err));
        }
      } catch (err) {
        console.warn('Erro ao preparar lote de extintores:', err);
      }
    }
  },
  create: (ext: Extinguisher): Extinguisher => {
    const extWithQr: Extinguisher = {
      ...ext,
      qrCode: ext.qrCode || `SENAI-EXT-${ext.code}`,
    };
    const list = dbExtinguishers.getAll();
    const updated = [extWithQr, ...list];
    saveToStorage(KEYS.EXTINGUISHERS, updated);
    notify(listeners.extinguishers, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'extinguishers', sanitizeDocId(extWithQr.id)), cleanForFirestore(extWithQr)).catch((err) =>
          console.warn('Erro ao criar extintor no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no setDoc de extintor:', err);
      }
    }

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
    saveToStorage(KEYS.EXTINGUISHERS, updated);
    notify(listeners.extinguishers, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'extinguishers', sanitizeDocId(ext.id)), cleanForFirestore(ext)).catch((err) =>
          console.warn('Erro ao atualizar extintor no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no update de extintor:', err);
      }
    }
  },
  delete: (id: string): void => {
    const list = dbExtinguishers.getAll();
    const filtered = list.filter((e) => e.id !== id);
    saveToStorage(KEYS.EXTINGUISHERS, filtered);
    notify(listeners.extinguishers, filtered);

    if (db && typeof window !== 'undefined') {
      try {
        deleteDoc(doc(db, 'extinguishers', sanitizeDocId(id))).catch((err) =>
          console.warn('Erro ao excluir extintor no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no delete de extintor:', err);
      }
    }
  },
};

// --- INSPECTIONS CRUD ---
export const dbInspections = {
  getAll: (): Inspection[] => {
    return loadFromStorage<Inspection[]>(KEYS.INSPECTIONS, INITIAL_INSPECTIONS);
  },
  subscribe: (cb: Listener<Inspection[]>): (() => void) => {
    listeners.inspections.add(cb);
    return () => listeners.inspections.delete(cb);
  },
  saveAll: (inspections: Inspection[]): void => {
    saveToStorage(KEYS.INSPECTIONS, inspections);
    notify(listeners.inspections, inspections);

    if (db && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < inspections.length; i += 400) {
          const chunk = inspections.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((insp) => {
            batch.set(doc(db, 'inspections', sanitizeDocId(insp.id)), cleanForFirestore(insp));
          });
          batch.commit().catch((err) => console.warn('Erro ao sincronizar inspeções:', err));
        }
      } catch (err) {
        console.warn('Erro no batch de inspeções:', err);
      }
    }
  },
  update: (insp: Inspection): void => {
    const list = dbInspections.getAll();
    const updated = list.map((i) => (i.id === insp.id ? insp : i));
    saveToStorage(KEYS.INSPECTIONS, updated);
    notify(listeners.inspections, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'inspections', sanitizeDocId(insp.id)), cleanForFirestore(insp)).catch((err) =>
          console.warn('Erro ao atualizar inspeção no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no update de inspeção:', err);
      }
    }
  },
};

// --- BRIGADE MEMBERS CRUD ---
export const dbBrigade = {
  getAll: (): BrigadeMember[] => {
    const list = loadFromStorage<BrigadeMember[]>(KEYS.MEMBERS, INITIAL_BRIGADE_MEMBERS);
    if (!list) {
      saveToStorage(KEYS.MEMBERS, INITIAL_BRIGADE_MEMBERS);
      return INITIAL_BRIGADE_MEMBERS;
    }
    return list;
  },
  subscribe: (cb: Listener<BrigadeMember[]>): (() => void) => {
    listeners.members.add(cb);
    return () => listeners.members.delete(cb);
  },
  saveAll: (members: BrigadeMember[]): void => {
    saveToStorage(KEYS.MEMBERS, members);
    notify(listeners.members, members);

    if (db && typeof window !== 'undefined') {
      try {
        const batch = writeBatch(db);
        members.forEach((m) => {
          batch.set(doc(db, 'brigade_members', sanitizeDocId(m.id)), cleanForFirestore(m));
        });
        batch.commit().catch((err) => console.warn('Erro ao sincronizar brigadistas:', err));
      } catch (err) {
        console.warn('Erro no batch de brigadistas:', err);
      }
    }
  },
  create: (member: BrigadeMember): BrigadeMember => {
    const list = dbBrigade.getAll();
    const updated = [member, ...list];
    saveToStorage(KEYS.MEMBERS, updated);
    notify(listeners.members, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'brigade_members', sanitizeDocId(member.id)), cleanForFirestore(member)).catch((err) =>
          console.warn('Erro ao criar brigadista no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no setDoc de brigadista:', err);
      }
    }

    return member;
  },
  update: (member: BrigadeMember): void => {
    const list = dbBrigade.getAll();
    const updated = list.map((m) => (m.id === member.id ? member : m));
    saveToStorage(KEYS.MEMBERS, updated);
    notify(listeners.members, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'brigade_members', sanitizeDocId(member.id)), cleanForFirestore(member)).catch((err) =>
          console.warn('Erro ao atualizar brigadista no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no update de brigadista:', err);
      }
    }
  },
  delete: (id: string): void => {
    const list = dbBrigade.getAll();
    const filtered = list.filter((m) => m.id !== id);
    saveToStorage(KEYS.MEMBERS, filtered);
    notify(listeners.members, filtered);

    if (db && typeof window !== 'undefined') {
      try {
        deleteDoc(doc(db, 'brigade_members', sanitizeDocId(id))).catch((err) =>
          console.warn('Erro ao excluir brigadista no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no delete de brigadista:', err);
      }
    }
  },
};

// --- NOTICES CRUD ---
export const dbNotices = {
  getAll: (): Notice[] => {
    return loadFromStorage<Notice[]>(KEYS.NOTICES, INITIAL_NOTICES);
  },
  subscribe: (cb: Listener<Notice[]>): (() => void) => {
    listeners.notices.add(cb);
    return () => listeners.notices.delete(cb);
  },
  saveAll: (notices: Notice[]): void => {
    saveToStorage(KEYS.NOTICES, notices);
    notify(listeners.notices, notices);

    if (db && typeof window !== 'undefined') {
      try {
        const batch = writeBatch(db);
        notices.forEach((n) => {
          batch.set(doc(db, 'notices', sanitizeDocId(n.id)), cleanForFirestore(n));
        });
        batch.commit().catch((err) => console.warn('Erro ao sincronizar avisos:', err));
      } catch (err) {
        console.warn('Erro no batch de avisos:', err);
      }
    }
  },
};

// --- ACTIVITY LOGS CRUD ---
export const dbActivityLogs = {
  getAll: (): ActivityLogEntry[] => {
    return loadFromStorage<ActivityLogEntry[]>(KEYS.ACTIVITY_LOGS, INITIAL_ACTIVITY_LOGS);
  },
  subscribe: (cb: Listener<ActivityLogEntry[]>): (() => void) => {
    listeners.activityLogs.add(cb);
    return () => listeners.activityLogs.delete(cb);
  },
  saveAll: (logs: ActivityLogEntry[]): void => {
    saveToStorage(KEYS.ACTIVITY_LOGS, logs);
    notify(listeners.activityLogs, logs);

    if (db && typeof window !== 'undefined') {
      try {
        const batch = writeBatch(db);
        logs.slice(0, 100).forEach((l) => {
          batch.set(doc(db, 'activity_logs', sanitizeDocId(l.id)), cleanForFirestore(l));
        });
        batch.commit().catch((err) => console.warn('Erro ao sincronizar logs:', err));
      } catch (err) {
        console.warn('Erro no batch de logs:', err);
      }
    }
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
    saveToStorage(KEYS.ACTIVITY_LOGS, updated);
    notify(listeners.activityLogs, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'activity_logs', sanitizeDocId(newEntry.id)), cleanForFirestore(newEntry)).catch((err) =>
          console.warn('Erro ao gravar log no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no setDoc de log:', err);
      }
    }

    return newEntry;
  },
  clear: (): void => {
    saveToStorage(KEYS.ACTIVITY_LOGS, []);
    notify(listeners.activityLogs, []);
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
  if (typeof localStorage !== 'undefined') {
    for (const k of Object.values(KEYS)) {
      const val = localStorage.getItem(k);
      if (val) totalSize += val.length * 2;
    }
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

// --- REAL-TIME FIRESTORE SYNC INITIALIZER ---
let hasInitializedFirestore = false;

export function initFirestoreRealtimeSync(): () => void {
  if (hasInitializedFirestore || !db || typeof window === 'undefined') {
    return () => {};
  }
  hasInitializedFirestore = true;

  const unsubscribes: Unsubscribe[] = [];

  try {
    // 1. Sync Extinguishers
    const extCol = collection(db, 'extinguishers');
    const unsubExt = onSnapshot(
      extCol,
      (snapshot) => {
        if (snapshot.empty) {
          console.info('Firestore vazio: populando 123 extintores oficiais do SENAI...');
          dbExtinguishers.saveAll(INITIAL_EXTINGUISHERS);
        } else {
          const remoteList: Extinguisher[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as Extinguisher));
          saveToStorage(KEYS.EXTINGUISHERS, remoteList);
          notify(listeners.extinguishers, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (extinguishers):', err)
    );
    unsubscribes.push(unsubExt);

    // 2. Sync Brigade Members
    const membersCol = collection(db, 'brigade_members');
    const unsubMembers = onSnapshot(
      membersCol,
      (snapshot) => {
        if (snapshot.empty) {
          console.info('Firestore vazio: populando 12 membros oficiais da brigada...');
          dbBrigade.saveAll(INITIAL_BRIGADE_MEMBERS);
        } else {
          const remoteList: BrigadeMember[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as BrigadeMember));
          saveToStorage(KEYS.MEMBERS, remoteList);
          notify(listeners.members, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (brigade_members):', err)
    );
    unsubscribes.push(unsubMembers);

    // 3. Sync Users
    const usersCol = collection(db, 'users');
    const unsubUsers = onSnapshot(
      usersCol,
      (snapshot) => {
        if (snapshot.empty) {
          console.info('Firestore vazio: populando usuários oficiais (Melissa e João)...');
          dbUsers.saveAll(INITIAL_USERS);
        } else {
          const remoteList: RegisteredUser[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as RegisteredUser));
          saveToStorage(KEYS.USERS, remoteList);
          notify(listeners.users, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (users):', err)
    );
    unsubscribes.push(unsubUsers);

    // 4. Sync Inspections
    const inspCol = collection(db, 'inspections');
    const unsubInsp = onSnapshot(
      inspCol,
      (snapshot) => {
        if (snapshot.empty) {
          dbInspections.saveAll(INITIAL_INSPECTIONS);
        } else {
          const remoteList: Inspection[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as Inspection));
          saveToStorage(KEYS.INSPECTIONS, remoteList);
          notify(listeners.inspections, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (inspections):', err)
    );
    unsubscribes.push(unsubInsp);

    // 5. Sync Notices
    const noticesCol = collection(db, 'notices');
    const unsubNotices = onSnapshot(
      noticesCol,
      (snapshot) => {
        if (snapshot.empty) {
          dbNotices.saveAll(INITIAL_NOTICES);
        } else {
          const remoteList: Notice[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as Notice));
          saveToStorage(KEYS.NOTICES, remoteList);
          notify(listeners.notices, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (notices):', err)
    );
    unsubscribes.push(unsubNotices);

    // 6. Sync Activity Logs
    const logsCol = collection(db, 'activity_logs');
    const unsubLogs = onSnapshot(
      logsCol,
      (snapshot) => {
        if (snapshot.empty) {
          // Auto-seed initial activity logs if collection is empty
          dbActivityLogs.saveAll(INITIAL_ACTIVITY_LOGS);
        } else {
          const remoteList: ActivityLogEntry[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as ActivityLogEntry));
          // Sort newest first
          remoteList.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          saveToStorage(KEYS.ACTIVITY_LOGS, remoteList);
          notify(listeners.activityLogs, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (activity_logs):', err)
    );
    unsubscribes.push(unsubLogs);
  } catch (err) {
    console.warn('Não foi possível iniciar sincronização remota do Firestore:', err);
  }

  return () => {
    unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    });
    hasInitializedFirestore = false;
  };
}
