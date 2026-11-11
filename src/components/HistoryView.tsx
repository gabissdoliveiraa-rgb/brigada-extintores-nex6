/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ActivityCategory,
  ActivityLogEntry,
  UserProfile,
} from '../types/brigada';
import { filterActivityLogs } from '../utils/activityUtils';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import {
  History,
  Search,
  Filter,
  Users,
  ClipboardList,
  FileBarChart2,
  UserCheck,
  Shield,
  Trash2,
  Clock,
  Download,
  AlertCircle,
} from 'lucide-react';

interface HistoryViewProps {
  user: UserProfile;
  activityLogs: ActivityLogEntry[];
  onClearHistory?: () => void;
  onRefresh?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  activityLogs,
  onClearHistory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedUser, setSelectedUser] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Extract unique user names for filter dropdown
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    activityLogs.forEach((l) => set.add(l.userName));
    return Array.from(set).sort();
  }, [activityLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return filterActivityLogs(
      activityLogs,
      selectedCategory,
      selectedUser,
      searchTerm
    );
  }, [activityLogs, selectedCategory, selectedUser, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = activityLogs.length;
    const extinguishersCount = activityLogs.filter(
      (l) => l.category === 'Extintores' || l.category === 'Inspeções'
    ).length;
    const brigadeCount = activityLogs.filter(
      (l) => l.category === 'Brigada' || l.category === 'Usuários'
    ).length;
    const reportsCount = activityLogs.filter(
      (l) => l.category === 'Relatórios' || l.category === 'Sistema'
    ).length;
    return { total, extinguishersCount, brigadeCount, reportsCount };
  }, [activityLogs]);

  const categories: { label: string; value: string }[] = [
    { label: 'Todos', value: 'Todos' },
    { label: 'Extintores', value: 'Extintores' },
    { label: 'Inspeções', value: 'Inspeções' },
    { label: 'Equipe Brigada', value: 'Brigada' },
    { label: 'Relatórios', value: 'Relatórios' },
    { label: 'Usuários', value: 'Usuários' },
    { label: 'Sistema', value: 'Sistema' },
  ];

  const getCategoryIcon = (cat: ActivityCategory) => {
    switch (cat) {
      case 'Extintores':
        return <ExtinguisherIcon size={18} className="text-red-600" />;
      case 'Inspeções':
        return <ClipboardList className="w-4 h-4 text-emerald-600" />;
      case 'Brigada':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'Relatórios':
        return <FileBarChart2 className="w-4 h-4 text-amber-600" />;
      case 'Usuários':
        return <UserCheck className="w-4 h-4 text-purple-600" />;
      case 'Sistema':
      default:
        return <Shield className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activityLogs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `historico_atividades_senai_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
            Histórico de Atividades
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Registro cronológico de quem fez o que no sistema (extintores, brigada, inspeções e relatórios).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Exportar dados do histórico"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          {user.role === 'Administrador' && onClearHistory && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Limpar histórico do sistema"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total de Registros</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Extintores e Vistorias</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{stats.extinguishersCount}</span>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <ExtinguisherIcon size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Equipe e Usuários</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{stats.brigadeCount}</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Relatórios e Sistema</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{stats.reportsCount}</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <FileBarChart2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Category Tabs (Segmented Buttons) */}
        <div>
          <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            Filtrar por Categoria
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* User filter & search input */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por ação, extintor, pessoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              aria-label="Filtrar por usuário"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 cursor-pointer"
            >
              <option value="Todos">Todos os Responsáveis</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {(selectedCategory !== 'Todos' || selectedUser !== 'Todos' || searchTerm) && (
            <div className="sm:col-span-3 flex items-center justify-end">
              <button
                onClick={() => {
                  setSelectedCategory('Todos');
                  setSelectedUser('Todos');
                  setSearchTerm('');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Registro de Atividades ({filteredLogs.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Mais recentes primeiro
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              Nenhuma atividade encontrada com os filtros selecionados.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tente redefinir a busca ou a categoria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const userInitial = log.userName.charAt(0).toUpperCase();

              return (
                <div
                  key={log.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex items-start gap-4"
                >
                  {/* Avatar Icon */}
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                    {userInitial}
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-slate-900">
                        {log.userName}
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
                        ({log.userRole})
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {log.category}
                      </span>
                    </div>

                    {/* Action Description */}
                    <p className="text-sm text-slate-800 mt-1 font-medium">
                      {log.description}
                    </p>

                    {/* Bottom Metadata: Timestamp (exact format requested) */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 font-mono text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{log.formattedDateTime}</span>
                      </div>

                      {log.targetFloor && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-600">
                            Local: {log.targetFloor}
                          </span>
                        </>
                      )}

                      {log.targetCode && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="font-mono text-slate-600">
                            Extintor: #{log.targetCode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Category Accent Indicator */}
                  <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 shrink-0" title={log.category}>
                    {getCategoryIcon(log.category)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Limpar Histórico?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja apagar todos os registros de histórico? Esta ação é irreversível.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onClearHistory) onClearHistory();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Sim, Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
