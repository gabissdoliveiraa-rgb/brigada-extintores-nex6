/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Extinguisher } from '../types/brigada';
import {
  X,
  Download,
  Printer,
  QrCode,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { ExtinguisherIcon } from './ExtinguisherIcon';

interface ExtinguisherQrModalProps {
  extinguisher: Extinguisher;
  onClose: () => void;
}

export const ExtinguisherQrModal: React.FC<ExtinguisherQrModalProps> = ({
  extinguisher,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrValue = extinguisher.qrCode || `SENAI-EXT-${extinguisher.code}`;

  useEffect(() => {
    QRCode.toDataURL(qrValue, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Code:', err));
  }, [qrValue]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QRCode_Extintor_${extinguisher.code}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                QR Code do Extintor
              </h3>
              <p className="text-[11px] text-slate-500">
                Código: #{extinguisher.code}
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

        {/* Printable Label Card */}
        <div className="p-6">
          <div
            id="printable-qr-card"
            className="border-2 border-dashed border-slate-300 rounded-2xl p-5 bg-gradient-to-b from-white to-slate-50/50 flex flex-col items-center text-center shadow-xs"
          >
            {/* SENAI Header */}
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200 w-full justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span className="text-xs font-black tracking-wider text-slate-800 uppercase">
                SENAI · Brigada de Incêndio
              </span>
            </div>

            {/* Extinguisher Code & Type */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xl font-black text-red-600 font-mono tracking-tight">
                #{extinguisher.code}
              </span>
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

            <p className="text-xs font-bold text-slate-800 mb-1">
              {extinguisher.type} ({extinguisher.capacity})
            </p>

            <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-4">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {extinguisher.floor} · {extinguisher.location}
              </span>
            </div>

            {/* QR Code Graphic */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code para extintor ${extinguisher.code}`}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
                  Gerando QR Code...
                </div>
              )}
            </div>

            {/* Value payload */}
            <p className="text-[11px] font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-md border border-slate-200 mb-2">
              {qrValue}
            </p>

            <p className="text-[10px] text-slate-400 max-w-xs">
              Aponte a câmera no aplicativo para abrir a ficha completa deste extintor.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              Baixar PNG
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
