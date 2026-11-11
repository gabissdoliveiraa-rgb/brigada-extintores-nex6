/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ActivityLogEntry,
  BrigadeMember,
  Extinguisher,
  Inspection,
  Notice,
  UserProfile,
} from '../types/brigada';
import { Users, CheckCircle2, AlertTriangle, History, ArrowRight } from 'lucide-react';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import { calculateDashboardStats } from '../utils/brigadaLogic';
import { ViewTab } from './Sidebar';

interface DashboardViewProps {
  user: UserProfile;
  members: BrigadeMember[];
  extinguishers: Extinguisher[];
  inspections: Inspection[];
  notices: Notice[];
  activityLogs?: ActivityLogEntry[];
  onNavigate: (tab: ViewTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  members,
  extinguishers,
  inspections,
  notices,
  activityLogs = [],
  onNavigate,
}) => {
  const stats = calculateDashboardStats(members, extinguishers);
  const firstName = user.name.split(' ')[0] || user.name;

  // Derive upcoming inspections directly from real extinguishers in database
  const upcomingInspections = (
    inspections.length > 0
      ? inspections.slice(0, 4).map((i) => ({
          code: i.code,
          location: `${i.location} (${i.floor})`,
          nextDate: i.nextInspectionDate,
          status: i.status,
        }))
      : extinguishers.slice(0, 4).map((e) => ({
          code: e.code,
          location: `${e.location} (${e.floor})`,
          nextDate: e.nextInspectionDate || '15/08/2026',
          status: e.status,
        }))
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Greeting Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Bem vindo(a), {firstName}!
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Aqui está um resumo geral do sistema.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Membros da Brigada */}
        <div
          onClick={() => onNavigate('equipe')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <span className="text-xs font-medium text-slate-600">
            Membros da Brigada
          </span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {stats.totalBrigade}
            </span>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Extintores cadastrados */}
        <div
          onClick={() => onNavigate('extintores')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <span className="text-xs font-medium text-slate-600">
            Extintores cadastrados
          </span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {stats.totalExtinguishers}
            </span>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <ExtinguisherIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Inspeções em dia */}
        <div
          onClick={() => onNavigate('inspecoes')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <span className="text-xs font-medium text-slate-600">
            Inspeções em dia
          </span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {stats.inspectionsUpToDate}
            </span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Inspeções vencidas */}
        <div
          onClick={() => onNavigate('avisos')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <span className="text-xs font-medium text-slate-600">
            Inspeções vencidas
          </span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {stats.inspectionsExpired}
            </span>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Split Section: Próximas Inspeções & Avisos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: Próximas inspeções */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-red-600 tracking-tight mb-4">
              Próximas inspeções
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    <th className="pb-3 px-2">Extintores</th>
                    <th className="pb-3 px-2">Local</th>
                    <th className="pb-3 px-2">Próxima inspeção</th>
                    <th className="pb-3 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingInspections.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-2 font-medium text-slate-900">
                        {row.code}
                      </td>
                      <td className="py-3.5 px-2 text-slate-600">{row.location}</td>
                      <td className="py-3.5 px-2 text-slate-600 tabular-nums font-mono text-xs">
                        {row.nextDate}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-md border border-emerald-400 text-emerald-700 bg-emerald-50/50">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigate('inspecoes')}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-lg text-xs tracking-wide transition-all shadow-xs"
            >
              Ver todas as inspeções
            </button>
          </div>
        </div>

        {/* Right Card: Avisos */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4">
              Avisos
            </h2>

            <div className="space-y-3.5">
              {notices.slice(0, 3).map((notice) => (
                <div
                  key={notice.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onNavigate('avisos')}
                >
                  <div className="mt-0.5 text-red-600 shrink-0">
                    {notice.type.includes('Recarga') ? (
                      <ExtinguisherIcon size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {notice.description}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Vencido em {notice.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigate('avisos')}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-lg text-xs tracking-wide transition-all shadow-xs text-center"
            >
              Ver todos os avisos
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Histórico Recente de Atividades
              </h2>
              <p className="text-xs text-slate-500">
                Últimas ações e alterações realizadas no sistema
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('historico')}
            className="self-start sm:self-auto text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5 cursor-pointer hover:underline"
          >
            <span>Ver histórico completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {(activityLogs && activityLogs.length > 0 ? activityLogs.slice(0, 4) : []).map((log) => (
            <div
              key={log.id}
              onClick={() => onNavigate('historico')}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer border border-slate-100"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {log.userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 font-medium">
                  {log.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-mono">
                  <span>{log.formattedDateTime}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-sans text-slate-600 font-semibold">{log.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
