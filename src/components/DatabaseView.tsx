/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  BrigadeMember,
  Extinguisher,
  FullDatabaseBackup,
  Inspection,
  Notice,
  RegisteredUser,
  UserProfile,
  UserRole,
} from '../types/brigada';
import {
  Database,
  Users,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import {
  formatPhone,
  validatePhone,
  validateEmail,
  SENAI_SECTOR_OPTIONS,
} from '../utils/maskUtils';
import { ExtinguisherIcon } from './ExtinguisherIcon';

interface DatabaseViewProps {
  currentUser: UserProfile;
  users: RegisteredUser[];
  extinguishers: Extinguisher[];
  members: BrigadeMember[];
  inspections: Inspection[];
  notices: Notice[];
  onAddUser: (user: Omit<RegisteredUser, 'id'>) => void;
  onUpdateUser: (user: RegisteredUser) => void;
  onDeleteUser: (id: string) => void;
  onNavigateToExtinguishers: () => void;
  onNavigateToBrigade: () => void;
  onImportBackup: (backup: FullDatabaseBackup) => void;
  onResetDatabase: () => void;
  onShowToast: (message: string) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  currentUser,
  users,
  extinguishers,
  members,
  inspections,
  notices,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onNavigateToExtinguishers,
  onNavigateToBrigade,
  onImportBackup,
  onResetDatabase,
  onShowToast,
}) => {
  const isAdmin = currentUser.role === 'Administrador';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<
    'users' | 'extinguishers' | 'brigade' | 'backup'
  >('users');

  // Search and filter for users
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | 'Administrador' | 'Funcionário'>('Todos');

  // Modal states for user creation/editing
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Funcionário');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('senai123');
  const [formSector, setFormSector] = useState('1º andar');
  const [showPassword, setShowPassword] = useState(false);

  // User deletion confirm modal
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Reset database confirm modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Raw JSON copy state
  const [copiedJson, setCopiedJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'Todos' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setFormName('');
    setFormRole('Funcionário');
    setFormEmail('');
    setFormPhone('(11) 9');
    setFormPassword('senai123');
    setFormSector('1º andar');
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: RegisteredUser) => {
    setEditingUserId(user.id);
    setFormName(user.name);
    setFormRole(user.role);
    setFormEmail(user.email);
    setFormPhone(user.phone);
    setFormPassword(user.password || 'senai123');
    setFormSector(user.responsibleSector || '1º andar');
    setUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      onShowToast('Nome e e-mail são obrigatórios.');
      return;
    }

    if (editingUserId) {
      const existing = users.find((u) => u.id === editingUserId);
      if (existing) {
        onUpdateUser({
          ...existing,
          name: formName.trim(),
          role: formRole,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          password: formPassword.trim() || 'senai123',
          responsibleSector: formSector.trim(),
        });
        onShowToast(`Usuário ${formName} atualizado com sucesso!`);
      }
    } else {
      onAddUser({
        name: formName.trim(),
        role: formRole,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        password: formPassword.trim() || 'senai123',
        responsibleSector: formSector.trim(),
      });
      onShowToast(`Usuário ${formName} cadastrado no banco de dados!`);
    }

    setUserModalOpen(false);
  };

  const handleConfirmDeleteUser = () => {
    if (!deleteUserId) return;
    try {
      onDeleteUser(deleteUserId);
      onShowToast('Usuário removido do banco de dados.');
      setDeleteUserId(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        onShowToast(err.message);
      } else {
        onShowToast('Erro ao remover usuário.');
      }
    }
  };

  const handleExportBackup = () => {
    const backup: FullDatabaseBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      users,
      extinguishers,
      inspections,
      brigadeMembers: members,
      notices,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senai_brigada_banco_dados_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Backup do banco de dados baixado com sucesso!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as FullDatabaseBackup;
        if (!parsed || (!parsed.extinguishers && !parsed.users)) {
          throw new Error('Arquivo JSON inválido.');
        }
        onImportBackup(parsed);
        onShowToast('Banco de dados restaurado com sucesso a partir do arquivo JSON!');
      } catch (err) {
        console.error(err);
        onShowToast('Erro ao importar arquivo: JSON inválido.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportRawJson = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput) as FullDatabaseBackup;
      onImportBackup(parsed);
      onShowToast('Banco de dados importado do JSON com sucesso!');
      setJsonInput('');
    } catch {
      onShowToast('JSON inválido. Verifique a formatação.');
    }
  };

  const handleCopyRawJson = () => {
    const backup: FullDatabaseBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      users,
      extinguishers,
      inspections,
      brigadeMembers: members,
      notices,
    };
    navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
    onShowToast('JSON do banco de dados copiado para a área de transferência!');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Title & Top Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
              Banco de Dados & E-mails
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Persistência Ativa</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Gerencie centralmente todos os extintores, membros da brigada e e-mails autorizados para acesso.
          </p>
        </div>

        {/* Global DB Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            title="Baixar cópia de segurança em JSON"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar Backup (JSON)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Importar Backup</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </label>

          {isAdmin && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
              title="Restaurar dados padrão do SENAI"
            >
              <RotateCcw className="w-4 h-4 text-red-500" />
              <span>Restaurar Padrão</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users Metric */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              E-mails & Contas
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">
              {users.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {users.filter((u) => u.role === 'Administrador').length} Admins •{' '}
              {users.filter((u) => u.role === 'Funcionário').length} Funcs
            </span>
          </div>
        </div>

        {/* Extinguishers Metric */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Extintores no Banco
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <ExtinguisherIcon size={20} />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">
              {extinguishers.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              {extinguishers.filter((e) => e.status === 'Em dia').length} em dia
            </span>
          </div>
        </div>

        {/* Brigade Metric */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Membros da Brigada
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">
              {members.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {members.filter((m) => m.isLeader).length} Líderes
            </span>
          </div>
        </div>

        {/* Inspections Metric */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Vistorias Registradas
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Database className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">
              {inspections.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Histórico ativo
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          E-mails e Usuários Autorizados ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('extinguishers')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'extinguishers'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Extintores Cadastrados ({extinguishers.length})
        </button>
        <button
          onClick={() => setActiveTab('brigade')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'brigade'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Membros da Brigada ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'backup'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Backup & JSON Bruto
        </button>
      </div>

      {/* TAB 1: USERS & EMAILS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
              />
            </div>

            {/* Filter buttons & Add User button */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                {(['Todos', 'Administrador', 'Funcionário'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      roleFilter === r
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {isAdmin && (
                <button
                  onClick={handleOpenAddUser}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo E-mail / Usuário</span>
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-bold tracking-wider">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail Institucional</th>
                    <th className="py-3 px-4">Cargo / Acesso</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Setor</th>
                    <th className="py-3 px-4">Senha</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum usuário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {u.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {u.email}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              u.role === 'Administrador'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{u.phone}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {u.responsibleSector || 'Geral'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          ••••••••
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                title="Editar dados"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteUserId(u.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXTINGUISHERS MANAGEMENT */}
      {activeTab === 'extinguishers' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Extintores Cadastrados no Banco ({extinguishers.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Você pode adicionar novos extintores na área de Extintores ou através de importação de arquivo.
              </p>
            </div>
            <button
              onClick={onNavigateToExtinguishers}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              Ir para Tela de Extintores
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {extinguishers.slice(0, 12).map((ext) => (
              <div
                key={ext.id}
                className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{ext.code}</p>
                  <p className="text-slate-500">{ext.type} • {ext.floor}</p>
                  <p className="text-[11px] text-slate-400">{ext.location}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    ext.status === 'Em dia'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {ext.status}
                </span>
              </div>
            ))}
          </div>

          {extinguishers.length > 12 && (
            <p className="text-xs text-center text-slate-400 pt-2">
              Mostrando 12 de {extinguishers.length} extintores. Acesse a tela de Extintores para filtrar por andar e editar.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: BRIGADE MANAGEMENT */}
      {activeTab === 'brigade' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Membros da Brigada no Banco ({members.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mantenha a lista de brigadistas atualizada com seus cargos e treinamentos.
              </p>
            </div>
            <button
              onClick={onNavigateToBrigade}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              Ir para Equipe da Brigada
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{m.name}</p>
                  <p className="text-slate-500">{m.role} • {m.responsibleFloor}</p>
                  <p className="text-[11px] text-slate-400">{m.email}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    m.trainingStatus === 'Em dia'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {m.trainingStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RAW JSON & BACKUP */}
      {activeTab === 'backup' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Visualizador de Dados Brutos (JSON)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Você pode copiar todo o banco de dados em formato JSON ou colar um JSON para restaurar ou adicionar dados em massa.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleCopyRawJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar JSON Completo</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Arquivo .json</span>
            </button>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-slate-700">
              Importar / Colar JSON para o Banco:
            </label>
            <textarea
              rows={6}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Cole aqui o conteúdo de um backup em formato JSON..."
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            {jsonInput.trim() && (
              <button
                onClick={handleImportRawJson}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
              >
                Aplicar e Atualizar Banco de Dados
              </button>
            )}
          </div>
        </div>
      )}

      {/* USER CREATE / EDIT MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-red-600">
                {editingUserId ? 'Editar Usuário / E-mail' : 'Cadastrar Novo Usuário / E-mail'}
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                />
                {!formName.trim() && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">
                    Nome completo é obrigatório
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo / Nível de Acesso *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    <option value="Administrador">Administrador (Total)</option>
                    <option value="Funcionário">Funcionário (Consulta)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Setor / Pavimento
                  </label>
                  <select
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    {SENAI_SECTOR_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail Institucional *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="usuario@senaisp.edu.br"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                />
                {formEmail && !validateEmail(formEmail) && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">
                    E-mail inválido (ex: nome@senaisp.edu.br)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                  />
                  {formPhone && !validatePhone(formPhone) && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      Telefone inválido (use DDD + número)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Senha do usuário"
                      className="w-full px-3 py-2 pr-8 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Salvar no Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {deleteUserId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 text-center animate-scaleUp">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Confirmar Exclusão
            </h3>
            <p className="text-xs text-slate-600">
              Tem certeza que deseja remover este e-mail do banco de dados? O usuário não poderá mais acessar o sistema.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteUserId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESET DATABASE MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 text-center animate-scaleUp">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Restaurar Banco de Dados?
            </h3>
            <p className="text-xs text-slate-600">
              Isso recarregará os extintores, membros e contas padrão do SENAI. Se desejar, faça um backup antes.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetDatabase();
                  setShowResetConfirm(false);
                  onShowToast('Banco de dados restaurado para os dados padrão do SENAI.');
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirmar Restauração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
