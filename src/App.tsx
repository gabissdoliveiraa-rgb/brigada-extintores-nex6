/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActivityActionType,
  ActivityCategory,
  ActivityLogEntry,
  BrigadeMember,
  Extinguisher,
  FullDatabaseBackup,
  Inspection,
  RegisteredUser,
  UserProfile,
} from './types/brigada';
import {
  dbUsers,
  dbExtinguishers,
  dbInspections,
  dbBrigade,
  dbNotices,
  dbActivityLogs,
  importFullDatabase,
  resetDatabaseToInitial,
  initFirestoreRealtimeSync,
} from './services/db';
import { buildDynamicNotices } from './utils/brigadaLogic';
import { Sidebar, ViewTab } from './components/Sidebar';
import { HeaderUser } from './components/HeaderUser';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { ExtinguishersView } from './components/ExtinguishersView';
import { InspectionsView } from './components/InspectionsView';
import { BrigadeView } from './components/BrigadeView';
import { ReportsView } from './components/ReportsView';
import { NoticesView } from './components/NoticesView';
import { SettingsView } from './components/SettingsView';
import { DatabaseView } from './components/DatabaseView';
import { ProfileView } from './components/ProfileView';
import { HistoryView } from './components/HistoryView';
import { AttentionEmailConfirmModal } from './components/AttentionEmailConfirmModal';
import {
  ServerAlertStatus,
  clearServerSession,
  establishServerSession,
  extractRegisteredRecipientEmails,
  fetchServerAlertStatus,
  initAuth,
  markAttentionAlertsSent,
  sendAutomaticServerAttentionEmail,
  syncSentAttentionMapWithCurrentExtinguishers,
} from './services/gmailAlert';
import { sanitizeUserForSession } from './utils/security';
import { auth, signOutFirebaseAuth } from './firebase';

export default function App() {
  // Support ?autostart=1 query param from Ultra Mode
  const isAutostart =
    typeof window !== 'undefined' &&
    window.location.search.includes('autostart=1');

  // Database-backed state
  const [users, setUsers] = useState<RegisteredUser[]>(() => dbUsers.getAll());
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>(() =>
    dbExtinguishers.getAll()
  );
  const [inspections, setInspections] = useState<Inspection[]>(() =>
    dbInspections.getAll()
  );
  const [members, setMembers] = useState<BrigadeMember[]>(() =>
    dbBrigade.getAll()
  );
  const [notices, setNotices] = useState(() => dbNotices.getAll());
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() =>
    dbActivityLogs.getAll()
  );

  // Active session: restore only if user still exists in the database
  const [user, setUser] = useState<UserProfile | null>(() => {
    const currentDbUsers = dbUsers.getAll();
    if (isAutostart) {
      const admin =
        currentDbUsers.find((u) => u.role === 'Administrador') ||
        currentDbUsers[0];
      return admin ? sanitizeUserForSession(admin) : null;
    }
    const saved = localStorage.getItem('senai_brigada_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<UserProfile>;
        if (parsed && parsed.id && parsed.email && parsed.role) {
          const dbMatch = currentDbUsers.find(
            (u) =>
              u.id === parsed.id ||
              u.email.toLowerCase() === parsed.email!.toLowerCase()
          );
          if (dbMatch) {
            return sanitizeUserForSession({ ...parsed, ...dbMatch });
          }
          localStorage.removeItem('senai_brigada_user');
        }
        return null;
      } catch {
        localStorage.removeItem('senai_brigada_user');
        return null;
      }
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<ViewTab>('inicio');
  const [profileEditing, setProfileEditing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [attentionEmailTargets, setAttentionEmailTargets] = useState<
    Extinguisher[]
  >([]);
  const [serverAlertStatus, setServerAlertStatus] = useState<ServerAlertStatus>({
    autoEmailConfigured: false,
    provider: null,
    senderEmail: null,
  });
  const isAutoSendingRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleOpenProfile = () => {
    setCurrentTab('perfil');
  };

  // Keep session user synchronized in localStorage (without credentials) and server token in memory
  useEffect(() => {
    if (user) {
      localStorage.setItem(
        'senai_brigada_user',
        JSON.stringify(sanitizeUserForSession(user))
      );
      void establishServerSession(user);
    } else {
      localStorage.removeItem('senai_brigada_user');
      clearServerSession();
    }
  }, [user]);

  // Automatic inactivity logout after 30 minutes for terminal security
  useEffect(() => {
    if (!user) return;
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastReset = 0;

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < 1000 && timer) return;
      lastReset = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setUser(null);
        localStorage.removeItem('senai_brigada_user');
        clearServerSession();
        void signOutFirebaseAuth();
        setCurrentTab('inicio');
        showToast('Sessão encerrada por inatividade para sua segurança.');
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [user?.id]);

  // Real-time synchronization across devices via Firestore
  useEffect(() => {
    const cleanupFirestore = initFirestoreRealtimeSync();
    void dbUsers.migrateLegacyPasswords();

    const unsubExt = dbExtinguishers.subscribe((data) => setExtinguishers(data));
    const unsubMembers = dbBrigade.subscribe((data) => setMembers(data));
    const unsubUsers = dbUsers.subscribe((data) => {
      setUsers(data);
      // Synchronize active session user and log out if account was removed from database
      setUser((current) => {
        if (!current) return null;
        const remoteUser = data.find(
          (u) =>
            u.id === current.id ||
            u.email.toLowerCase() === current.email.toLowerCase()
        );
        if (remoteUser) {
          const merged = sanitizeUserForSession({ ...current, ...remoteUser });
          localStorage.setItem('senai_brigada_user', JSON.stringify(merged));
          return merged;
        }
        const isActiveFirebaseGoogleUser = Boolean(
          auth?.currentUser?.emailVerified &&
            auth.currentUser.email?.toLowerCase() === current.email.toLowerCase()
        );
        if (data.length > 0 && !isActiveFirebaseGoogleUser) {
          localStorage.removeItem('senai_brigada_user');
          return null;
        }
        return current;
      });
    });
    const unsubInsp = dbInspections.subscribe((data) => setInspections(data));
    const unsubNotices = dbNotices.subscribe((data) => setNotices(data));
    const unsubLogs = dbActivityLogs.subscribe((data) => setActivityLogs(data));
    const unsubGoogleAuth = initAuth();
    fetchServerAlertStatus().then(setServerAlertStatus);

    return () => {
      cleanupFirestore();
      unsubExt();
      unsubMembers();
      unsubUsers();
      unsubInsp();
      unsubNotices();
      unsubLogs();
      unsubGoogleAuth();
    };
  }, []);

  // Activity Logger Helper
  const logActivity = (
    category: ActivityCategory,
    actionType: ActivityActionType,
    description: string,
    targetCode?: string,
    targetFloor?: string,
    customUser?: UserProfile
  ) => {
    const actingUser = customUser || user;
    if (!actingUser) return;
    dbActivityLogs.add({
      userName: actingUser.name,
      userRole: actingUser.role,
      userEmail: actingUser.email,
      category,
      actionType,
      description,
      targetCode,
      targetFloor,
    });
    setActivityLogs(dbActivityLogs.getAll());
  };

  // --- Auth Handlers ---
  const handleLoginSuccess = (loggedUser: UserProfile) => {
    const safeUser = sanitizeUserForSession(loggedUser);
    setUser(safeUser);
    setCurrentTab('inicio');
    void establishServerSession(safeUser);
    fetchServerAlertStatus().then(setServerAlertStatus);
    showToast(`Bem-vindo(a), ${safeUser.name}!`);
    logActivity('Sistema', 'login', `${safeUser.name} realizou login no sistema`, undefined, undefined, safeUser);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('senai_brigada_user');
    clearServerSession();
    void signOutFirebaseAuth();
    setCurrentTab('inicio');
    showToast('Sessão encerrada com sucesso.');
  };

  // --- User / E-mail Database Handlers ---
  const handleAddUser = (
    newUser: Omit<RegisteredUser, 'id'>
  ): RegisteredUser => {
    const created = dbUsers.create(newUser);
    setUsers(dbUsers.getAll());
    showToast(`E-mail ${created.email} cadastrado com sucesso!`);
    if (user) {
      logActivity('Usuários', 'create', `${user.name} cadastrou novo e-mail (${created.email}) no banco`);
    }
    return created;
  };

  const handleUpdateUser = (updatedUser: RegisteredUser) => {
    const existingDbUser =
      dbUsers.getAll().find((u) => u.id === updatedUser.id) ||
      users.find((u) => u.id === updatedUser.id);
    const userToSave: RegisteredUser = {
      ...updatedUser,
      password: updatedUser.password || existingDbUser?.password,
    };
    dbUsers.update(userToSave, () => {
      showToast('Salvo localmente, mas houve falha ao sincronizar com a nuvem.');
    });
    setUsers(dbUsers.getAll());
    if (user && user.id === updatedUser.id) {
      const merged = sanitizeUserForSession({ ...user, ...userToSave });
      setUser(merged);
      localStorage.setItem('senai_brigada_user', JSON.stringify(merged));
    }
    showToast(`Usuário ${updatedUser.name} atualizado no banco.`);
    if (user) {
      logActivity('Usuários', 'update', `${user.name} atualizou as informações de ${updatedUser.name}`);
    }
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    dbUsers.delete(id);
    setUsers(dbUsers.getAll());
    showToast('Usuário removido do banco.');
    if (user) {
      logActivity('Usuários', 'delete', `${user.name} removeu o usuário ${target ? target.name : id} do banco`);
    }
  };

  const triggerAttentionAlert = useCallback(
    async (targets: Extinguisher[], forceManualFallback = true) => {
      if (!targets || targets.length === 0) return;
      const recipients = extractRegisteredRecipientEmails(users);

      if (serverAlertStatus.autoEmailConfigured && recipients.length > 0) {
        if (isAutoSendingRef.current) return;
        isAutoSendingRef.current = true;
        try {
          const result = await sendAutomaticServerAttentionEmail(
            targets,
            recipients,
            user?.name
          );
          if (result.success) {
            markAttentionAlertsSent(targets);
            const sentTo = result.recipients || recipients;
            const codes = targets.map((e) => e.code);
            showToast(
              `Alerta automático enviado para ${sentTo.length} e-mail(s) do banco!`
            );
            logActivity(
              'Sistema',
              'system',
              `Sistema enviou alerta automático para ${sentTo.join(', ')} referente a ${targets.length} extintor(es) em Atenção (${codes.join(', ')})`
            );
            return;
          }
          if (forceManualFallback) {
            showToast(result.error || 'Falha no envio automático. Abrindo envio via Gmail...');
            setAttentionEmailTargets(targets);
          }
        } finally {
          isAutoSendingRef.current = false;
        }
        return;
      }

      if (forceManualFallback) {
        setAttentionEmailTargets(targets);
      }
    },
    [users, serverAlertStatus.autoEmailConfigured, user]
  );

  // Keep sent-alert map aligned when extinguishers leave Atenção (never auto-send on login/mount)
  useEffect(() => {
    syncSentAttentionMapWithCurrentExtinguishers(extinguishers);
  }, [extinguishers]);

  // --- Extinguisher Database Handlers ---
  const handleAddExtinguisher = (newExt: Extinguisher) => {
    dbExtinguishers.create(newExt);
    setExtinguishers(dbExtinguishers.getAll());

    const existingForCode = dbInspections
      .getAll()
      .some((i) => i.extinguisherCode === newExt.code);
    if (!existingForCode) {
      const nextNum = String(dbInspections.getAll().length + 1).padStart(3, '0');
      const createdInsp: Inspection = {
        id: `insp_${Date.now()}`,
        code: nextNum,
        extinguisherCode: newExt.code,
        extinguisherType: newExt.type,
        date: newExt.purchaseDate || new Date().toLocaleDateString('pt-BR'),
        responsible: user?.name || 'Brigada SENAI',
        status: newExt.status,
        floor: newExt.floor,
        location: newExt.location,
        capacity: newExt.capacity,
        validityDate: newExt.expirationDate || newExt.nextInspectionDate || '',
        nextInspectionDate: newExt.nextInspectionDate || newExt.expirationDate || '',
        notes: newExt.notes || 'Inspeção inicial criada automaticamente no cadastro.',
      };
      dbInspections.create(createdInsp);
      setInspections(dbInspections.getAll());
    }

    showToast(`Extintor ${newExt.code} cadastrado no banco de dados!`);
    if (user) {
      logActivity(
        'Extintores',
        'create',
        `${user.name} adicionou 1 extintor (código ${newExt.code} - ${newExt.floor} ${newExt.location})`,
        newExt.code,
        newExt.floor
      );
    }
    if (newExt.status === 'Atenção') {
      void triggerAttentionAlert([newExt], true);
    }
  };

  const handleUpdateExtinguisher = (updated: Extinguisher) => {
    const previousExt = extinguishers.find((e) => e.id === updated.id);
    dbExtinguishers.update(updated);
    setExtinguishers(dbExtinguishers.getAll());

    // Sync matching inspection(s) status and dates
    const currentInspections = dbInspections.getAll();
    const matchingInspections = currentInspections.filter(
      (i) => i.extinguisherCode === updated.code
    );
    matchingInspections.forEach((insp) => {
      dbInspections.update({
        ...insp,
        status: updated.status,
        location: updated.location,
        capacity: updated.capacity,
        nextInspectionDate: updated.nextInspectionDate || insp.nextInspectionDate,
        validityDate: updated.nextInspectionDate || updated.expirationDate || insp.validityDate,
      });
    });
    if (matchingInspections.length > 0) {
      setInspections(dbInspections.getAll());
    }

    showToast(`Extintor ${updated.code} atualizado no banco!`);
    if (user) {
      logActivity(
        'Extintores',
        'update',
        `${user.name} atualizou os dados do extintor ${updated.code} (${updated.floor})`,
        updated.code,
        updated.floor
      );
    }
    if (updated.status === 'Atenção' && previousExt?.status !== 'Atenção') {
      void triggerAttentionAlert([updated], true);
    }
  };

  const handleDeleteExtinguisher = (id: string) => {
    const target = extinguishers.find((e) => e.id === id);
    dbExtinguishers.delete(id);
    setExtinguishers(dbExtinguishers.getAll());
    if (target) {
      dbInspections.deleteByExtinguisherCode(target.code);
      setInspections(dbInspections.getAll());
    }
    showToast(`Extintor ${target ? target.code : ''} excluído do banco.`);
    if (user) {
      logActivity(
        'Extintores',
        'delete',
        `${user.name} excluiu o extintor ${target ? target.code : id} (${target?.floor || ''})`,
        target?.code,
        target?.floor
      );
    }
  };

  // --- Inspection Database Handlers ---
  const handleUpdateInspection = (updated: Inspection) => {
    const matchingExt = dbExtinguishers
      .getAll()
      .find((e) => e.code === updated.extinguisherCode);
    const previousStatus =
      matchingExt?.status ??
      inspections.find((i) => i.id === updated.id)?.status;

    dbInspections.update(updated);
    setInspections(dbInspections.getAll());

    // Sync status and next inspection date back to matching extinguisher
    let syncedExt: Extinguisher | null = null;
    if (matchingExt) {
      syncedExt = {
        ...matchingExt,
        status: updated.status,
        location: updated.location || matchingExt.location,
        capacity: updated.capacity || matchingExt.capacity,
        nextInspectionDate: updated.nextInspectionDate || updated.validityDate || matchingExt.nextInspectionDate,
      };
      dbExtinguishers.update(syncedExt);
      setExtinguishers(dbExtinguishers.getAll());
    }

    showToast(`Vistoria ${updated.code} salva com sucesso!`);
    if (user) {
      logActivity(
        'Inspeções',
        'inspect',
        `${user.name} registrou a inspeção do extintor ${updated.extinguisherCode} (${updated.floor})`,
        updated.extinguisherCode,
        updated.floor
      );
    }
    if (updated.status === 'Atenção' && previousStatus !== 'Atenção') {
      const targetForEmail: Extinguisher = syncedExt || {
        id: updated.id,
        code: updated.extinguisherCode,
        type: updated.extinguisherType,
        location: updated.location,
        floor: updated.floor,
        capacity: updated.capacity,
        status: 'Atenção',
        expirationDate: updated.validityDate,
        nextInspectionDate: updated.nextInspectionDate,
      };
      void triggerAttentionAlert([targetForEmail], true);
    }
  };

  // --- Brigade Member Database Handlers ---
  const handleAddMember = (newMember: BrigadeMember) => {
    dbBrigade.create(newMember);
    setMembers(dbBrigade.getAll());
    const syncedUsers = dbUsers.syncFromBrigadeMembers([newMember]);
    if (syncedUsers.length > 0) {
      setUsers(dbUsers.getAll());
    }
    showToast(`Membro ${newMember.name} cadastrado na brigada!`);
    if (user) {
      logActivity(
        'Brigada',
        'create',
        `${user.name} cadastrou o membro ${newMember.name} (${newMember.role}) na equipe da brigada`,
        undefined,
        newMember.responsibleFloor
      );
    }
  };

  const handleUpdateMember = (updated: BrigadeMember) => {
    dbBrigade.update(updated);
    setMembers(dbBrigade.getAll());
    showToast(`Dados de ${updated.name} atualizados.`);
    if (user) {
      logActivity(
        'Brigada',
        'update',
        `${user.name} atualizou os dados do membro ${updated.name}`,
        undefined,
        updated.responsibleFloor
      );
    }
  };

  const handleDeleteMember = (id: string) => {
    const target = members.find((m) => m.id === id);
    dbBrigade.delete(id);
    setMembers(dbBrigade.getAll());
    showToast(`Membro ${target ? target.name : ''} removido da brigada.`);
    if (user) {
      logActivity(
        'Brigada',
        'delete',
        `${user.name} removeu o membro ${target ? target.name : id} da brigada`,
        undefined,
        target?.responsibleFloor
      );
    }
  };

  // --- Global Database Handlers ---
  const handleImportBackup = (backup: FullDatabaseBackup) => {
    importFullDatabase(backup);
    setUsers(dbUsers.getAll());
    setExtinguishers(dbExtinguishers.getAll());
    setInspections(dbInspections.getAll());
    setMembers(dbBrigade.getAll());
    setNotices(dbNotices.getAll());
    setActivityLogs(dbActivityLogs.getAll());
    showToast('Banco de dados restaurado com sucesso!');
    if (user) {
      logActivity('Sistema', 'system', `${user.name} restaurou backup completo do banco de dados`);
    }
  };

  const handleResetDatabase = () => {
    resetDatabaseToInitial();
    setUsers(dbUsers.getAll());
    setExtinguishers(dbExtinguishers.getAll());
    setInspections(dbInspections.getAll());
    setMembers(dbBrigade.getAll());
    setNotices(dbNotices.getAll());
    setActivityLogs(dbActivityLogs.getAll());
    showToast('Banco de dados redefinido.');
    if (user) {
      logActivity('Sistema', 'system', `${user.name} redefiniu os dados do sistema para os padrões`);
    }
  };

  const handleSyncBrigadeMembersToDb = () => {
    const added = dbUsers.syncFromBrigadeMembers(members);
    if (added.length > 0) {
      setUsers(dbUsers.getAll());
      showToast(
        `${added.length} membro(s) da brigada adicionado(s) ao banco de e-mails!`
      );
      if (user) {
        logActivity(
          'Usuários',
          'create',
          `${user.name} sincronizou ${added.length} membro(s) da brigada para o banco de usuários`
        );
      }
    } else {
      showToast('Todos os membros da brigada já estão cadastrados no banco.');
    }
  };

  const registeredRecipientEmails = extractRegisteredRecipientEmails(users);

  const dynamicNotices = useMemo(
    () => buildDynamicNotices(extinguishers, inspections),
    [extinguishers, inspections]
  );

  // If not logged in, render the Auth screen
  if (!user) {
    return (
      <AuthScreen
        registeredUsers={users}
        onLoginSuccess={handleLoginSuccess}
        onMigrateUserPassword={(targetUser, hashedPassword) => {
          dbUsers.update({ ...targetUser, password: hashedPassword });
          setUsers(dbUsers.getAll());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-red-600 focus:text-white focus:font-bold focus:text-xs focus:rounded-xl focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-5 right-5 z-[60] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg animate-fadeIn flex items-center gap-2"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        isAdmin={user.role === 'Administrador'}
        pendingAlertsCount={dynamicNotices.length}
        onSelectTab={(tab) => {
          if (tab === 'configuracoes') {
            setProfileEditing(false);
          }
          setCurrentTab(tab);
        }}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto focus:outline-none">
          {/* Top User Bar */}
          <HeaderUser
            user={user}
            onOpenProfile={handleOpenProfile}
            onToggleMobileMenu={() => setMobileOpen((prev) => !prev)}
          />

          {/* Active Tab View */}
          {currentTab === 'inicio' && (
            <DashboardView
              user={user}
              members={members}
              extinguishers={extinguishers}
              inspections={inspections}
              notices={dynamicNotices}
              activityLogs={activityLogs}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'extintores' && (
            <ExtinguishersView
              user={user}
              extinguishers={extinguishers}
              onAddExtinguisher={handleAddExtinguisher}
              onUpdateExtinguisher={handleUpdateExtinguisher}
              onDeleteExtinguisher={handleDeleteExtinguisher}
              onRequestSendAttentionEmail={(items) =>
                void triggerAttentionAlert(items, true)
              }
            />
          )}

          {currentTab === 'inspecoes' && (
            <InspectionsView
              user={user}
              inspections={inspections}
              onUpdateInspection={handleUpdateInspection}
            />
          )}

          {currentTab === 'equipe' && (
            <BrigadeView
              user={user}
              members={members}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {currentTab === 'historico' && (
            <HistoryView
              user={user}
              activityLogs={activityLogs}
            />
          )}

          {currentTab === 'banco_dados' && (
            user.role === 'Administrador' ? (
              <DatabaseView
                currentUser={user}
                users={users}
                extinguishers={extinguishers}
                members={members}
                inspections={inspections}
                notices={notices}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onNavigateToExtinguishers={() => setCurrentTab('extintores')}
                onNavigateToBrigade={() => setCurrentTab('equipe')}
                onImportBackup={handleImportBackup}
                onResetDatabase={handleResetDatabase}
                onSyncBrigadeMembers={handleSyncBrigadeMembersToDb}
                onShowToast={showToast}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-800">Acesso Restrito</h3>
                <p className="text-xs text-slate-500 mt-2">
                  Funcionários não têm permissão para acessar o banco de dados.
                </p>
                <button
                  onClick={() => setCurrentTab('inicio')}
                  className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                >
                  Voltar ao Início
                </button>
              </div>
            )
          )}

          {currentTab === 'relatorios' && (
            <ReportsView
              user={user}
              extinguishers={extinguishers}
              inspections={inspections}
              members={members}
              onReportGenerated={(filename, period) => {
                logActivity(
                  'Relatórios',
                  'report',
                  `${user.name} gerou e baixou o relatório em PDF (${period})`
                );
              }}
            />
          )}

          {currentTab === 'avisos' && (
            <NoticesView
              notices={dynamicNotices}
              extinguishers={extinguishers}
              recipientEmails={registeredRecipientEmails}
              serverAlertStatus={serverAlertStatus}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenAttentionEmailModal={(items) =>
                void triggerAttentionAlert(items, true)
              }
            />
          )}

          {currentTab === 'configuracoes' && (
            <SettingsView
              key={`settings_${profileEditing ? 'edit' : 'view'}`}
              user={user}
              storedPasswordHash={users.find((u) => u.id === user.id)?.password}
              onUpdateUser={handleUpdateUser}
              onLogout={handleLogout}
              onShowToast={showToast}
              initialEditing={profileEditing}
            />
          )}

          {currentTab === 'perfil' && (
            <ProfileView
              user={user}
              onOpenEdit={() => {
                setProfileEditing(true);
                setCurrentTab('configuracoes');
              }}
              onLogout={handleLogout}
              onUpdateUser={handleUpdateUser}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Gmail Confirmation Modal for Extinguishers in Atenção */}
      <AttentionEmailConfirmModal
        isOpen={attentionEmailTargets.length > 0}
        extinguishers={attentionEmailTargets}
        recipientEmails={registeredRecipientEmails}
        user={user}
        onClose={() => setAttentionEmailTargets([])}
        onEmailSent={(count, codes, recipients) => {
          showToast(
            `E-mail de alerta enviado para ${recipients.length} destinatário(s) do banco!`
          );
          logActivity(
            'Sistema',
            'system',
            `${user.name} enviou alerta por e-mail para ${recipients.join(', ')} referente a ${count} extintor(es) em Atenção (${codes.join(', ')})`
          );
        }}
      />
    </div>
  );
}
