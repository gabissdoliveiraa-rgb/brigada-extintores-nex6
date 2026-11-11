/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Notice } from '../types/brigada';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { ViewTab } from './Sidebar';

interface NoticesViewProps {
  notices: Notice[];
  onNavigate: (tab: ViewTab) => void;
}

export const NoticesView: React.FC<NoticesViewProps> = ({
  notices,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'Todos' | 'Vencido' | 'A vencer'>('Todos');

  const filteredNotices = notices.filter((n) => {
    if (filter === 'Todos') return true;
    return n.status === filter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header matching MacBook Air - 19 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('inicio')}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          aria-label="Voltar para início"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
            Avisos
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Confira todos os avisos e pendências do sistema.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['Todos', 'Vencido', 'A vencer'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === st
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table Card (MacBook Air - 19) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-700 font-semibold text-xs">
                <th className="pb-3 px-3">Tipo</th>
                <th className="pb-3 px-3">Descrição</th>
                <th className="pb-3 px-3">Data</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNotices.map((notice) => (
                <tr
                  key={notice.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <span className="text-red-600 shrink-0">
                        {notice.type.includes('Recarga') ? (
                          <ExtinguisherIcon size={18} />
                        ) : (
                          <AlertTriangle size={18} />
                        )}
                      </span>
                      <span>{notice.type}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-slate-600">
                    {notice.description}
                  </td>

                  <td className="py-3 px-3 text-slate-600 font-mono text-xs tabular-nums">
                    {notice.date}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-block px-3 py-0.5 text-xs font-semibold rounded-md border ${
                        notice.status === 'A vencer'
                          ? 'border-amber-400 text-amber-700 bg-amber-50/50'
                          : 'border-red-400 text-red-700 bg-red-50/50'
                      }`}
                    >
                      {notice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
