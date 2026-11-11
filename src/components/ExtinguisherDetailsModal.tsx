/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Extinguisher, UserProfile } from '../types/brigada';
import { canPerformAdminAction } from '../utils/brigadaLogic';
import { ExtinguisherQrModal } from './ExtinguisherQrModal';
import {
  X,
  QrCode,
  MapPin,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  FileText,
} from 'lucide-react';
import { ExtinguisherIcon } from './ExtinguisherIcon';

interface ExtinguisherDetailsModalProps {
  extinguisher: Extinguisher;
  user: UserProfile;
  onClose: () => void;
  onEdit: (ext: Extinguisher) => void;
}

export const ExtinguisherDetailsModal: React.FC<
  ExtinguisherDetailsModalProps
> = ({ extinguisher, user, onClose, onEdit }) => {
  const isAdmin = canPerformAdminAction(user.role);
  const [showQrLabelModal, setShowQrLabelModal] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl text-white ${
                  extinguisher.status === 'Em dia'
                    ? 'bg-emerald-600'
                    : extinguisher.status === 'Atenção'
                    ? 'bg-amber-500'
                    : 'bg-red-600'
                }`}
              >
                <ExtinguisherIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Extintor #{extinguisher.code}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      extinguisher.status === 'Em dia'
                        ? 'bg-emerald-100 text-emerald-800'
                        : extinguisher.status === 'Atenção'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {extinguisher.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {extinguisher.type} · {extinguisher.capacity}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-5">
            {/* Direct match banner */}
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
              <Sparkles className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Extintor localizado via leitura de QR Code (Doc. RH 049).
              </span>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Andar / Piso
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-600" />
                  {extinguisher.floor}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Localização
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  {extinguisher.location}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Data de Compra / Carga
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {extinguisher.purchaseDate || '11/02/2024'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Próxima Inspeção
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {extinguisher.nextInspectionDate || '15/10/2026'}
                </span>
              </div>
            </div>

            {/* QR Code preview strip */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800">
                  <QrCode className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Etiqueta QR Code
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {extinguisher.qrCode || `SENAI-EXT-${extinguisher.code}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQrLabelModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors shadow-2xs"
              >
                Ver / Imprimir
              </button>
            </div>

            {/* Observações */}
            {extinguisher.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                <span className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Observações:
                </span>
                <p className="text-[11px] leading-relaxed">
                  {extinguisher.notes}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors shadow-2xs"
            >
              Fechar
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(extinguisher);
                }}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Extintor
              </button>
            )}
          </div>
        </div>
      </div>

      {showQrLabelModal && (
        <ExtinguisherQrModal
          extinguisher={extinguisher}
          onClose={() => setShowQrLabelModal(false)}
        />
      )}
    </>
  );
};
