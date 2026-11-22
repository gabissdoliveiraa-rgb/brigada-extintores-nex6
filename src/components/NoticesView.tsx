/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Extinguisher, Notice } from '../types/brigada';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import {
  ALERT_RECIPIENT_EMAIL,
  ServerAlertStatus,
} from '../services/gmailAlert';
import {
  ArrowLeft,
  AlertTriangle,
  Mail,
  Send,
  Server,
  Globe,
} from 'lucide-react';
import { ViewTab } from './Sidebar';

interface NoticesViewProps {
  isAdmin?: boolean;
  notices: Notice[];
  extinguishers?: Extinguisher[];
  recipientEmails?: string[];
  serverAlertStatus?: ServerAlertStatus;
  onNavigate: (tab: ViewTab) => void;
  onOpenAttentionEmailModal?: (items: Extinguisher[]) => void;
}

export const NoticesView: React.FC<NoticesViewProps> = ({
  isAdmin = false,
  notices,
  extinguishers = [],
  recipientEmails = [],
  serverAlertStatus,
  onNavigate,
  onOpenAttentionEmailModal,
}) => {
  const [filter, setFilter] = useState<'Todos' | 'Vencido' | 'A vencer'>('Todos');

  const attentionExtinguishers = extinguishers.filter(
    (e) => e.status === 'Atenção'
  );

  const effectiveRecipients =
    recipientEmails.length > 0 ? recipientEmails : [ALERT_RECIPIENT_EMAIL];

  const isEmailJsActive = serverAlertStatus?.provider !== 'smtp';
  const senderLabel = serverAlertStatus?.senderEmail || 'nex6empresa@gmail.com';

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
            Confira todos os avisos, pendências e alertas por e-mail do sistema.
          </p>
        </div>
      </div>

      {/* Email Notification Card for Atenção Extinguishers */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-amber-900 font-bold text-sm">
              <Mail className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Alertas por E-mail para Extintores em Atenção ({attentionExtinguishers.length})
              </span>
              {!isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-slate-700 border border-slate-300">
                  Envio exclusivo para Administradores
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isEmailJsActive ? (
                    <Globe className="w-3 h-3" />
                  ) : (
                    <Server className="w-3 h-3" />
                  )}
                  {`Envio Automático Ativo (${senderLabel})`}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-800">
              {!isAdmin
                ? 'Apenas usuários com perfil Administrador podem disparar alertas automáticos ou manuais por e-mail.'
                : `Assim que qualquer extintor entra em Atenção (perto de vencer), o sistema envia o alerta automaticamente para todos os ${effectiveRecipients.length} e-mail(s) cadastrados no banco.`}
            </p>
          </div>

          {isAdmin && onOpenAttentionEmailModal && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={attentionExtinguishers.length === 0}
                onClick={() => onOpenAttentionEmailModal(attentionExtinguishers)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{`Reenviar Agora (${attentionExtinguishers.length})`}</span>
              </button>
            </div>
          )}
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
              {filteredNotices.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-xs text-slate-400"
                  >
                    Nenhum aviso ou pendência encontrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredNotices.map((notice) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
