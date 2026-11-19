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
import { computeStatusFromValidity } from '../utils/brigadaLogic';
import { hashPassword, isPasswordHashed } from '../utils/security';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
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
  ACTIVITY_CLEARED: 'senai_db_logs_cleared_v1',
  BRIGADE_USERS_BACKFILL: 'senai_brigade_users_backfill_v1',
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
  return id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

async function replaceFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!db || typeof window === 'undefined') return;
  try {
    const colRef = collection(db, collectionName);
    const existingSnap = await getDocs(colRef);
    const keepIds = new Set(items.map((item) => sanitizeDocId(item.id)));

    const staleRefs = existingSnap.docs
      .filter((d) => !keepIds.has(d.id))
      .map((d) => d.ref);

    for (let i = 0; i < staleRefs.length; i += 400) {
      const delBatch = writeBatch(db);
      staleRefs.slice(i, i + 400).forEach((ref) => delBatch.delete(ref));
      await delBatch.commit();
    }

    for (let i = 0; i < items.length; i += 400) {
      const setBatch = writeBatch(db);
      items.slice(i, i + 400).forEach((item) => {
        setBatch.set(
          doc(db!, collectionName, sanitizeDocId(item.id)),
          cleanForFirestore(item)
        );
      });
      await setBatch.commit();
    }
  } catch (err) {
    console.warn(`Erro ao sincronizar coleção ${collectionName} no Firestore:`, err);
  }
}

function normalizeExtinguisherRecord(ext: Extinguisher): { item: Extinguisher; changed: boolean } {
  let changed = false;
  let nextInspectionDate = ext.nextInspectionDate;
  if (ext.nextInspectionDate === '15/10/2026' && ext.status === 'Em dia') {
    nextInspectionDate = '11/02/2027';
    changed = true;
  } else if (ext.nextInspectionDate === '15/03/2026' && ext.status === 'Atenção') {
    nextInspectionDate = '05/12/2026';
    changed = true;
  }
  const derivedStatus =
    nextInspectionDate || ext.expirationDate
      ? computeStatusFromValidity(ext.expirationDate, nextInspectionDate)
      : ext.status;
  if (derivedStatus !== ext.status) {
    changed = true;
  }
  return {
    item: changed ? { ...ext, nextInspectionDate, status: derivedStatus } : ext,
    changed,
  };
}

function normalizeInspectionRecord(insp: Inspection): { item: Inspection; changed: boolean } {
  let changed = false;
  let validityDate = insp.validityDate;
  let nextInspectionDate = insp.nextInspectionDate;

  if (insp.status === 'Vencido' && validityDate === '11/02/2027') {
    validityDate = '10/01/2026';
    nextInspectionDate = '10/01/2026';
    changed = true;
  } else if (nextInspectionDate === '15/03/2026' && insp.status === 'Atenção') {
    validityDate = '05/12/2026';
    nextInspectionDate = '05/12/2026';
    changed = true;
  } else if (nextInspectionDate === '15/10/2026' && insp.status === 'Em dia') {
    validityDate = '11/02/2027';
    nextInspectionDate = '11/02/2027';
    changed = true;
  }

  const derivedStatus = computeStatusFromValidity(validityDate, nextInspectionDate);
  if (derivedStatus !== insp.status) {
    changed = true;
  }

  return {
    item: changed
      ? { ...insp, validityDate, nextInspectionDate, status: derivedStatus }
      : insp,
    changed,
  };
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
    return data
      .filter((item) => item !== undefined && item !== null)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined && value !== null) {
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
    void replaceFirestoreCollection('users', users);
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
  update: (user: RegisteredUser, onFirestoreError?: (err: unknown) => void): void => {
    const list = dbUsers.getAll();
    const exists = list.some((u) => u.id === user.id);
    const updated = exists
      ? list.map((u) => (u.id === user.id ? user : u))
      : [user, ...list];
    saveToStorage(KEYS.USERS, updated);
    notify(listeners.users, updated);

    if (db && typeof window !== 'undefined') {
      try {
        const payload = cleanForFirestore(user);
        setDoc(doc(db, 'users', sanitizeDocId(user.id)), payload).catch((err) => {
          console.warn('Erro ao atualizar usuário no Firestore:', err);
          onFirestoreError?.(err);
        });
      } catch (err) {
        console.warn('Erro no update do usuário:', err);
        onFirestoreError?.(err);
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
  syncFromBrigadeMembers: (members: BrigadeMember[]): RegisteredUser[] => {
    const currentUsers = dbUsers.getAll();
    const existingEmails = new Set(
      currentUsers.map((u) => (u.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const existingIds = new Set(currentUsers.map((u) => sanitizeDocId(u.id)));
    const added: RegisteredUser[] = [];
    const today = new Date().toLocaleDateString('pt-BR');

    members.forEach((member, idx) => {
      const cleanEmail = (member.email || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) return;
      const lowerEmail = cleanEmail.toLowerCase();
      if (existingEmails.has(lowerEmail)) return;

      let candidateId = sanitizeDocId(`usr_${member.id || `brig_${Date.now()}_${idx}`}`);
      if (existingIds.has(candidateId)) {
        candidateId = sanitizeDocId(`usr_brig_${Date.now()}_${idx}`);
      }

      const newUser: RegisteredUser = {
        id: candidateId,
        name: member.name,
        role: 'Funcionário',
        email: cleanEmail,
        phone: member.phone || '',
        responsibleSector: member.responsibleFloor || '1º andar',
        isLeader: member.isLeader,
        trainingStatus: member.trainingStatus,
        password: 'senai123',
        createdAt: today,
      };

      added.push(newUser);
      existingEmails.add(lowerEmail);
      existingIds.add(candidateId);
    });

    if (added.length === 0) return [];

    const updated = [...currentUsers, ...added];
    saveToStorage(KEYS.USERS, updated);
    notify(listeners.users, updated);

    if (db && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < added.length; i += 400) {
          const batch = writeBatch(db);
          added.slice(i, i + 400).forEach((newUser) => {
            batch.set(
              doc(db!, 'users', sanitizeDocId(newUser.id)),
              cleanForFirestore(newUser)
            );
          });
          batch.commit().catch((err) =>
            console.warn('Erro ao sincronizar brigadistas para usuários no Firestore:', err)
          );
        }
      } catch (err) {
        console.warn('Erro no batch de sincronização de brigadistas:', err);
      }
    }

    return added;
  },
  migrateLegacyPasswords: async (): Promise<number> => {
    const list = dbUsers.getAll();
    const toUpgrade = list.filter((u) => !isPasswordHashed(u.password));
    if (toUpgrade.length === 0) return 0;

    const upgradedMap = new Map<string, string>();
    for (const u of toUpgrade) {
      const plain = u.password || 'senai123';
      upgradedMap.set(u.id, await hashPassword(plain));
    }

    const updated = list.map((u) => {
      const hashed = upgradedMap.get(u.id);
      return hashed ? { ...u, password: hashed } : u;
    });

    saveToStorage(KEYS.USERS, updated);
    notify(listeners.users, updated);

    if (db && typeof window !== 'undefined') {
      try {
        for (let i = 0; i < toUpgrade.length; i += 400) {
          const batch = writeBatch(db);
          toUpgrade.slice(i, i + 400).forEach((u) => {
            const hashed = upgradedMap.get(u.id);
            if (hashed) {
              batch.set(
                doc(db!, 'users', sanitizeDocId(u.id)),
                cleanForFirestore({ ...u, password: hashed })
              );
            }
          });
          batch.commit().catch((err) =>
            console.warn('Erro ao migrar hashes de senha no Firestore:', err)
          );
        }
      } catch (err) {
        console.warn('Erro no batch de migração de senhas:', err);
      }
    }

    return toUpgrade.length;
  },
};

export function hasDoneBrigadeUsersBackfill(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(KEYS.BRIGADE_USERS_BACKFILL) === '1';
}

export function markBrigadeUsersBackfillDone(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEYS.BRIGADE_USERS_BACKFILL, '1');
}

// --- EXTINGUISHERS CRUD ---
export const dbExtinguishers = {
  getAll: (): Extinguisher[] => {
    const list = loadFromStorage<Extinguisher[]>(KEYS.EXTINGUISHERS, INITIAL_EXTINGUISHERS);
    if (!list) {
      saveToStorage(KEYS.EXTINGUISHERS, INITIAL_EXTINGUISHERS);
      return INITIAL_EXTINGUISHERS;
    }
    let anyChanged = false;
    const normalized = list.map((ext) => {
      const res = normalizeExtinguisherRecord(ext);
      if (res.changed) anyChanged = true;
      return res.item;
    });
    if (anyChanged) {
      saveToStorage(KEYS.EXTINGUISHERS, normalized);
    }
    return normalized;
  },
  subscribe: (cb: Listener<Extinguisher[]>): (() => void) => {
    listeners.extinguishers.add(cb);
    return () => listeners.extinguishers.delete(cb);
  },
  saveAll: (exts: Extinguisher[]): void => {
    saveToStorage(KEYS.EXTINGUISHERS, exts);
    notify(listeners.extinguishers, exts);
    void replaceFirestoreCollection('extinguishers', exts);
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
    const list = loadFromStorage<Inspection[]>(KEYS.INSPECTIONS, INITIAL_INSPECTIONS);
    let anyChanged = false;
    const normalized = list.map((insp) => {
      const res = normalizeInspectionRecord(insp);
      if (res.changed) anyChanged = true;
      return res.item;
    });
    if (anyChanged) {
      saveToStorage(KEYS.INSPECTIONS, normalized);
    }
    return normalized;
  },
  subscribe: (cb: Listener<Inspection[]>): (() => void) => {
    listeners.inspections.add(cb);
    return () => listeners.inspections.delete(cb);
  },
  saveAll: (inspections: Inspection[]): void => {
    saveToStorage(KEYS.INSPECTIONS, inspections);
    notify(listeners.inspections, inspections);
    void replaceFirestoreCollection('inspections', inspections);
  },
  create: (insp: Inspection): Inspection => {
    const list = dbInspections.getAll();
    const updated = [insp, ...list];
    saveToStorage(KEYS.INSPECTIONS, updated);
    notify(listeners.inspections, updated);

    if (db && typeof window !== 'undefined') {
      try {
        setDoc(doc(db, 'inspections', sanitizeDocId(insp.id)), cleanForFirestore(insp)).catch((err) =>
          console.warn('Erro ao criar inspeção no Firestore:', err)
        );
      } catch (err) {
        console.warn('Erro no create de inspeção:', err);
      }
    }

    return insp;
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
  deleteByExtinguisherCode: (code: string): void => {
    const list = dbInspections.getAll();
    const removed = list.filter((i) => i.extinguisherCode === code);
    if (removed.length === 0) return;
    const filtered = list.filter((i) => i.extinguisherCode !== code);
    saveToStorage(KEYS.INSPECTIONS, filtered);
    notify(listeners.inspections, filtered);

    if (db && typeof window !== 'undefined') {
      removed.forEach((insp) => {
        deleteDoc(doc(db!, 'inspections', sanitizeDocId(insp.id))).catch((err) =>
          console.warn('Erro ao excluir inspeção associada no Firestore:', err)
        );
      });
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
    void replaceFirestoreCollection('brigade_members', members);
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
    void replaceFirestoreCollection('notices', notices);
  },
};

// --- ACTIVITY LOGS CRUD ---
export const dbActivityLogs = {
  getAll: (): ActivityLogEntry[] => {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(KEYS.ACTIVITY_CLEARED) === '1'
    ) {
      return loadFromStorage<ActivityLogEntry[]>(KEYS.ACTIVITY_LOGS, []);
    }
    return loadFromStorage<ActivityLogEntry[]>(KEYS.ACTIVITY_LOGS, INITIAL_ACTIVITY_LOGS);
  },
  subscribe: (cb: Listener<ActivityLogEntry[]>): (() => void) => {
    listeners.activityLogs.add(cb);
    return () => listeners.activityLogs.delete(cb);
  },
  saveAll: (logs: ActivityLogEntry[]): void => {
    if (typeof localStorage !== 'undefined') {
      if (logs.length === 0) localStorage.setItem(KEYS.ACTIVITY_CLEARED, '1');
      else localStorage.removeItem(KEYS.ACTIVITY_CLEARED);
    }
    saveToStorage(KEYS.ACTIVITY_LOGS, logs);
    notify(listeners.activityLogs, logs);
    void replaceFirestoreCollection('activity_logs', logs.slice(0, 100));
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEYS.ACTIVITY_CLEARED);
    }
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.ACTIVITY_CLEARED, '1');
    }
    saveToStorage(KEYS.ACTIVITY_LOGS, []);
    notify(listeners.activityLogs, []);
    void replaceFirestoreCollection('activity_logs', []);
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
  markBrigadeUsersBackfillDone();
  dbExtinguishers.saveAll(INITIAL_EXTINGUISHERS);
  dbInspections.saveAll(INITIAL_INSPECTIONS);
  dbBrigade.saveAll(INITIAL_BRIGADE_MEMBERS);
  dbNotices.saveAll(INITIAL_NOTICES);
  // Keep remote activity_logs immutable/append-only; only reset local fallback if cleared
  saveToStorage(KEYS.ACTIVITY_LOGS, INITIAL_ACTIVITY_LOGS);
  notify(listeners.activityLogs, INITIAL_ACTIVITY_LOGS);
}

// --- REAL-TIME FIRESTORE SYNC INITIALIZER ---
let hasInitializedFirestore = false;

export function initFirestoreRealtimeSync(): () => void {
  if (!db && typeof window !== 'undefined' && !hasDoneBrigadeUsersBackfill()) {
    dbUsers.syncFromBrigadeMembers(dbBrigade.getAll());
    markBrigadeUsersBackfillDone();
  }
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
          const toFix: Extinguisher[] = [];
          snapshot.forEach((d) => {
            const res = normalizeExtinguisherRecord(d.data() as Extinguisher);
            remoteList.push(res.item);
            if (res.changed) toFix.push(res.item);
          });
          if (toFix.length > 0 && db) {
            for (let i = 0; i < toFix.length; i += 400) {
              const batch = writeBatch(db);
              toFix.slice(i, i + 400).forEach((ext) => {
                batch.set(doc(db!, 'extinguishers', sanitizeDocId(ext.id)), cleanForFirestore(ext));
              });
              batch.commit().catch((err) => console.warn('Erro ao normalizar extintores no Firestore:', err));
            }
          }
          saveToStorage(KEYS.EXTINGUISHERS, remoteList);
          notify(listeners.extinguishers, remoteList);
        }
      },
      (err) => console.warn('Aviso no listener do Firestore (extinguishers):', err)
    );
    unsubscribes.push(unsubExt);

    let membersReady = false;
    let usersReady = false;
    let latestMembers: BrigadeMember[] = [];

    const runOneTimeBrigadeUsersBackfill = () => {
      if (!membersReady || !usersReady) return;
      if (hasDoneBrigadeUsersBackfill()) return;
      dbUsers.syncFromBrigadeMembers(latestMembers);
      markBrigadeUsersBackfillDone();
    };

    // 2. Sync Brigade Members
    const membersCol = collection(db, 'brigade_members');
    const unsubMembers = onSnapshot(
      membersCol,
      (snapshot) => {
        if (snapshot.empty) {
          console.info('Firestore vazio: populando 12 membros oficiais da brigada...');
          latestMembers = INITIAL_BRIGADE_MEMBERS;
          dbBrigade.saveAll(INITIAL_BRIGADE_MEMBERS);
        } else {
          const remoteList: BrigadeMember[] = [];
          snapshot.forEach((d) => remoteList.push(d.data() as BrigadeMember));
          latestMembers = remoteList;
          saveToStorage(KEYS.MEMBERS, remoteList);
          notify(listeners.members, remoteList);
        }
        membersReady = true;
        runOneTimeBrigadeUsersBackfill();
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
          console.info('Firestore vazio: populando usuários oficiais e membros da brigada...');
          dbUsers.saveAll(INITIAL_USERS);
          markBrigadeUsersBackfillDone();
        } else {
          const remoteList: RegisteredUser[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as RegisteredUser;
            remoteList.push({ ...data, id: data.id || d.id });
          });
          saveToStorage(KEYS.USERS, remoteList);
          notify(listeners.users, remoteList);
          if (remoteList.some((u) => !isPasswordHashed(u.password))) {
            void dbUsers.migrateLegacyPasswords();
          }
        }
        usersReady = true;
        runOneTimeBrigadeUsersBackfill();
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
          const toFix: Inspection[] = [];
          snapshot.forEach((d) => {
            const res = normalizeInspectionRecord(d.data() as Inspection);
            remoteList.push(res.item);
            if (res.changed) toFix.push(res.item);
          });
          if (toFix.length > 0 && db) {
            for (let i = 0; i < toFix.length; i += 400) {
              const batch = writeBatch(db);
              toFix.slice(i, i + 400).forEach((insp) => {
                batch.set(doc(db!, 'inspections', sanitizeDocId(insp.id)), cleanForFirestore(insp));
              });
              batch.commit().catch((err) => console.warn('Erro ao normalizar inspeções no Firestore:', err));
            }
          }
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
          saveToStorage(KEYS.ACTIVITY_LOGS, []);
          notify(listeners.activityLogs, []);
        } else {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(KEYS.ACTIVITY_CLEARED);
          }
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
