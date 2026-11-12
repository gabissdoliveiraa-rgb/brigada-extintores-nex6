/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ActivityActionType,
  ActivityCategory,
  ActivityLogEntry,
  BrigadeMember,
  Extinguisher,
  FullDatabaseBackup,
  Inspection,
  Notice,
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
import { ADMIN_USER, EMPLOYEE_USER } from './data/initialData';
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
  const [notices, setNotices] = useState<Notice[]>(() => dbNotices.getAll());
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() =>
    dbActivityLogs.getAll()
  );

  // Active session
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (isAutostart) return ADMIN_USER;
    const saved = localStorage.getItem('senai_brigada_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id === 'admin_1' || parsed.id === 'employee_1')) {
          return parsed;
        }
        if (parsed && parsed.role === 'Administrador') return ADMIN_USER;
        if (parsed && parsed.role === 'Funcionário') return EMPLOYEE_USER;
        return null;
      } catch {
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleOpenProfile = () => {
    setCurrentTab('perfil');
  };

  // Keep session user synchronized in localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('senai_brigada_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('senai_brigada_user');
    }
  }, [user]);

  // Real-time synchronization across devices via Firestore
  useEffect(() => {
    const cleanupFirestore = initFirestoreRealtimeSync();

    const unsubExt = dbExtinguishers.subscribe((data) => setExtinguishers(data));
    const unsubMembers = dbBrigade.subscribe((data) => setMembers(data));
    const unsubUsers = dbUsers.subscribe((data) => setUsers(data));
    const unsubInsp = dbInspections.subscribe((data) => setInspections(data));
    const unsubNotices = dbNotices.subscribe((data) => setNotices(data));
    const unsubLogs = dbActivityLogs.subscribe((data) => setActivityLogs(data));

    return () => {
      cleanupFirestore();
      unsubExt();
      unsubMembers();
      unsubUsers();
      unsubInsp();
      unsubNotices();
      unsubLogs();
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
    setUser(loggedUser);
    setCurrentTab('inicio');
    showToast(`Bem-vindo(a), ${loggedUser.name}!`);
    logActivity('Sistema', 'login', `${loggedUser.name} realizou login no sistema`, undefined, undefined, loggedUser);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('senai_brigada_user');
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
    dbUsers.update(updatedUser);
    setUsers(dbUsers.getAll());
    if (user && user.id === updatedUser.id) {
      setUser(updatedUser);
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

  // --- Extinguisher Database Handlers ---
  const handleAddExtinguisher = (newExt: Extinguisher) => {
    dbExtinguishers.create(newExt);
    setExtinguishers(dbExtinguishers.getAll());
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
  };

  const handleUpdateExtinguisher = (updated: Extinguisher) => {
    dbExtinguishers.update(updated);
    setExtinguishers(dbExtinguishers.getAll());
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
  };

  const handleDeleteExtinguisher = (id: string) => {
    const target = extinguishers.find((e) => e.id === id);
    dbExtinguishers.delete(id);
    setExtinguishers(dbExtinguishers.getAll());
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
    dbInspections.update(updated);
    setInspections(dbInspections.getAll());
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
  };

  // --- Brigade Member Database Handlers ---
  const handleAddMember = (newMember: BrigadeMember) => {
    dbBrigade.create(newMember);
    setMembers(dbBrigade.getAll());
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

  const handleClearHistory = () => {
    dbActivityLogs.clear();
    setActivityLogs([]);
    showToast('Histórico de atividades limpo com sucesso.');
  };

  // If not logged in, render the Auth screen
  if (!user) {
    return (
      <AuthScreen
        registeredUsers={users}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg animate-fadeIn flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        isAdmin={user.role === 'Administrador'}
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
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
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
              notices={notices}
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
              onClearHistory={handleClearHistory}
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
              notices={notices}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'configuracoes' && (
            <SettingsView
              key={`settings_${profileEditing ? 'edit' : 'view'}`}
              user={user}
              onUpdateUser={handleUpdateUser}
              onLogout={handleLogout}
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
            />
          )}
        </main>
      </div>
    </div>
  );
}
