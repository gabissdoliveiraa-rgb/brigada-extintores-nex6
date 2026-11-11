/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Extinguisher,
  ExtinguisherStatus,
  ExtinguisherType,
  UserProfile,
} from '../types/brigada';
import { canPerformAdminAction } from '../utils/brigadaLogic';
import { formatDate, validateDate } from '../utils/maskUtils';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import { QrCameraScanner } from './QrCameraScanner';
import { ExtinguisherQrModal } from './ExtinguisherQrModal';
import { ExtinguisherDetailsModal } from './ExtinguisherDetailsModal';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  QrCode,
  Camera,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Eye,
  Layers,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface ExtinguishersViewProps {
  user: UserProfile;
  extinguishers: Extinguisher[];
  onAddExtinguisher: (newExt: Extinguisher) => void;
  onUpdateExtinguisher: (updated: Extinguisher) => void;
  onDeleteExtinguisher: (id: string) => void;
}

const FLOORS = [
  'Todos',
  'Térreo',
  '1º andar',
  '2º andar',
  '3º andar',
  '4º andar',
  '5º andar',
  '6º andar',
] as const;

type FloorFilterType = (typeof FLOORS)[number];

const FORM_FLOORS = [
  'Térreo',
  '1º andar',
  '2º andar',
  '3º andar',
  '4º andar',
  '5º andar',
  '6º andar',
] as const;

type FormFloorType = (typeof FORM_FLOORS)[number];

/**
 * Calculates well-spaced extinguisher pin positions strictly bounded inside
 * the dashed schematic rectangle (Y: 25% - 75%, X: 8% - 92%, center divider at 48%).
 */
function computePinLayout(items: Extinguisher[], isExpanded: boolean) {
  const total = items.length;
  if (total === 0) return [];

  let rowCount = 1;
  if (isExpanded) {
    if (total > 24) rowCount = 5;
    else if (total > 16) rowCount = 4;
    else if (total > 8) rowCount = 3;
    else rowCount = 2;
  } else {
    if (total > 16) rowCount = 3;
    else if (total > 7) rowCount = 2;
    else rowCount = 1;
  }

  // Safe vertical bounds inside the pontilhados (dashed lines at 25% and 75%):
  // Pins + labels stay strictly inside: 38% - 62% collapsed, 34% - 66% expanded.
  const yMin = isExpanded ? 34 : rowCount === 1 ? 50 : rowCount === 2 ? 43 : 38;
  const yMax = isExpanded ? 66 : rowCount === 1 ? 50 : rowCount === 2 ? 57 : 62;
  const yStep = rowCount > 1 ? (yMax - yMin) / (rowCount - 1) : 0;

  const itemsPerRow = Math.ceil(total / rowCount);

  return items.map((_, idx) => {
    const row = Math.floor(idx / itemsPerRow);
    const colInRow = idx % itemsPerRow;
    const countInThisRow = Math.min(itemsPerRow, total - row * itemsPerRow);

    const y = rowCount === 1 ? 50 : yMin + row * yStep;

    // Center divider dashed line is at 48%.
    // Left room: 14% to 42%. Right room: 54% to 86%.
    const half = Math.ceil(countInThisRow / 2);
    let x = 50;
    if (colInRow < half) {
      const xStart = 14;
      const xEnd = 42;
      const xStep = half > 1 ? (xEnd - xStart) / (half - 1) : 0;
      x = half === 1 ? 28 : xStart + colInRow * xStep;
    } else {
      const rightCol = colInRow - half;
      const rightTotal = countInThisRow - half;
      const xStart = 54;
      const xEnd = 86;
      const xStep = rightTotal > 1 ? (xEnd - xStart) / (rightTotal - 1) : 0;
      x = rightTotal === 1 ? 70 : xStart + rightCol * xStep;
    }

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });
}

export const ExtinguishersView: React.FC<ExtinguishersViewProps> = ({
  user,
  extinguishers,
  onAddExtinguisher,
  onUpdateExtinguisher,
  onDeleteExtinguisher,
}) => {
  const isAdmin = canPerformAdminAction(user.role);

  const [selectedFloor, setSelectedFloor] = useState<FloorFilterType>('Todos');

  const [viewMode, setViewMode] = useState<
    'list' | 'create' | 'edit' | 'qr_scan'
  >('list');

  // Currently edited or deleted extinguisher
  const [activeExtinguisher, setActiveExtinguisher] =
    useState<Extinguisher | null>(null);
  const [deleteModalExtinguisher, setDeleteModalExtinguisher] =
    useState<Extinguisher | null>(null);
  const [selectedExtinguisherForDetails, setSelectedExtinguisherForDetails] =
    useState<Extinguisher | null>(null);
  const [selectedExtinguisherForQrModal, setSelectedExtinguisherForQrModal] =
    useState<Extinguisher | null>(null);
  const [isBuscaRapidaExpanded, setIsBuscaRapidaExpanded] = useState(false);
  const [qrScanBanner, setQrScanBanner] = useState<string | null>(null);
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  // Form states for Create/Edit
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<ExtinguisherType>('Pó Químico ABC');
  const [formLocation, setFormLocation] = useState('');
  const [formCapacity, setFormCapacity] = useState('6kg');
  const [formStatus, setFormStatus] = useState<ExtinguisherStatus>('Em dia');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFloor, setFormFloor] = useState<FormFloorType>('Térreo');

  const filteredExtinguishers = useMemo(() => {
    if (selectedFloor === 'Todos') {
      return extinguishers;
    }
    return extinguishers.filter((e) => e.floor === selectedFloor);
  }, [extinguishers, selectedFloor]);

  const pinPositions = useMemo(() => {
    if (selectedFloor === 'Todos') return [];
    return computePinLayout(filteredExtinguishers, isBuscaRapidaExpanded);
  }, [filteredExtinguishers, selectedFloor, isBuscaRapidaExpanded]);

  const handleStartCreate = () => {
    setFormCode('');
    setFormType('Pó Químico ABC');
    setFormLocation('');
    setFormCapacity('6kg');
    setFormStatus('Em dia');
    setFormPurchaseDate('');
    setFormNotes('');
    setFormFloor(selectedFloor === 'Todos' ? 'Térreo' : selectedFloor);
    setQrScanBanner(null);
    setQrScanError(null);
    setViewMode('create');
  };

  const handleStartEdit = (ext: Extinguisher) => {
    setActiveExtinguisher(ext);
    setFormCode(ext.code);
    setFormType(ext.type);
    setFormLocation(ext.location);
    setFormCapacity(ext.capacity);
    setFormStatus(ext.status);
    setFormPurchaseDate(ext.purchaseDate || '10/01/2024');
    setFormNotes(ext.notes || '');
    setFormFloor(ext.floor);
    setViewMode('edit');
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;

    const newExt: Extinguisher = {
      id: `ext_${Date.now()}`,
      code: formCode.trim(),
      type: formType,
      location: formLocation.trim() || 'Área Principal',
      floor: formFloor,
      capacity: formCapacity.trim() || '6kg',
      status: formStatus,
      purchaseDate: formPurchaseDate || new Date().toLocaleDateString('pt-BR'),
      notes: formNotes,
      qrCode: `SENAI-EXT-${formCode.trim()}`,
      x: 18 + Math.floor(Math.random() * 64),
      y: 42 + Math.floor(Math.random() * 16),
    };

    onAddExtinguisher(newExt);
    setViewMode('list');
    setSelectedExtinguisherForQrModal(newExt);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExtinguisher) return;

    const updated: Extinguisher = {
      ...activeExtinguisher,
      code: formCode,
      type: formType,
      location: formLocation,
      floor: formFloor,
      capacity: formCapacity,
      status: formStatus,
      notes: formNotes,
      purchaseDate: formPurchaseDate,
      qrCode: activeExtinguisher.qrCode || `SENAI-EXT-${formCode.trim()}`,
    };

    onUpdateExtinguisher(updated);
    setViewMode('list');
    setActiveExtinguisher(null);
  };

  const handleConfirmDelete = () => {
    if (deleteModalExtinguisher) {
      onDeleteExtinguisher(deleteModalExtinguisher.id);
      setDeleteModalExtinguisher(null);
    }
  };

  const handleQrScanSuccess = (scannedText: string) => {
    setQrScanError(null);
    let cleanCode = scannedText.trim();
    if (cleanCode.startsWith('SENAI-EXT-')) {
      cleanCode = cleanCode.replace('SENAI-EXT-', '');
    } else if (cleanCode.startsWith('EXT-')) {
      cleanCode = cleanCode.replace('EXT-', '');
    }

    // Direct match: find corresponding extinguisher in the system
    const match = extinguishers.find(
      (e) =>
        e.code.toLowerCase() === cleanCode.toLowerCase() ||
        e.qrCode === scannedText ||
        e.qrCode === `SENAI-EXT-${cleanCode}` ||
        (e.qrCode && e.qrCode.toLowerCase() === scannedText.toLowerCase())
    );

    if (match) {
      setSelectedFloor(match.floor);
      setSelectedExtinguisherForDetails(match);
      setViewMode('list');
      setQrScanBanner(
        `Extintor #${match.code} (${match.type}) localizado com sucesso no ${match.floor}!`
      );
    } else {
      setQrScanError(
        `Nenhum extintor cadastrado corresponde ao QR Code "${scannedText}". Verifique o código e tente novamente.`
      );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* VIEW: CADASTRAR NOVO EXTINTOR (MacBook Air - 16 layout) */}
      {viewMode === 'create' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-red-600">
              Cadastrar Novo Extintor
            </h2>
          </div>

          {qrScanBanner && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800 text-sm animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium">{qrScanBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setQrScanBanner(null)}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer underline"
              >
                Fechar
              </button>
            </div>
          )}

          <form onSubmit={handleSaveCreate} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="Ex: ABC 05 ou CO2 04"
                    className={`w-full px-4 py-3 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 placeholder:text-slate-400 text-slate-900 ${
                      formCode.trim() === ''
                        ? 'border-slate-300 focus:ring-red-500'
                        : 'border-slate-300 focus:ring-red-500'
                    }`}
                  />
                  {formCode.trim() === '' && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium">
                      Código obrigatório (ex: ABC 01)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Tipo *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(e.target.value as ExtinguisherType)
                    }
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
                  >
                    <option value="Pó Químico ABC">Pó Químico ABC</option>
                    <option value="CO2">CO2 (Dióxido de Carbono)</option>
                    <option value="Água">Água Pressurizada</option>
                    <option value="Espuma Mecânica">Espuma Mecânica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Capacidade
                  </label>
                  <select
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
                  >
                    <option value="4kg">4kg</option>
                    <option value="6kg">6kg</option>
                    <option value="8kg">8kg</option>
                    <option value="10L">10L</option>
                    <option value="12kg">12kg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Andar / Pavimento
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) =>
                      setFormFloor(e.target.value as typeof formFloor)
                    }
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
                  >
                    {FLOORS.map((fl) => (
                      <option key={fl} value={fl}>
                        {fl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Local / Setor
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ex: Recepção, Cantina, Laboratório..."
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-slate-400 text-slate-900"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Data da compra
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(formatDate(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    className={`w-full px-4 py-3 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 placeholder:text-slate-400 text-slate-900 ${
                      formPurchaseDate && !validateDate(formPurchaseDate)
                        ? 'border-red-400 focus:ring-red-500'
                        : 'border-slate-300 focus:ring-red-500'
                    }`}
                  />
                  {formPurchaseDate && !validateDate(formPurchaseDate) && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium">
                      Data inválida (formato DD/MM/AAAA)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Observações
                  </label>
                  <textarea
                    rows={8}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Digite algumas observações...."
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-slate-400 text-slate-900 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Buttons matching MacBook Air - 16 */}
            {/* Bottom Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
              <button
                type="submit"
                className="w-full sm:w-auto px-10 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Salvar e Gerar QR Code
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="w-full sm:w-auto px-8 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-all shadow-2xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW: QR CODE SCANNER (Direcionar para o extintor correspondente) */}
      {viewMode === 'qr_scan' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button
              onClick={() => {
                setViewMode('list');
                setQrScanError(null);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Voltar para extintores"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-red-600">
                Direcionar para Extintor via QR Code
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aponte a câmera para a etiqueta QR Code do extintor para abrir sua ficha correspondente.
              </p>
            </div>
          </div>

          {qrScanError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-red-800 text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{qrScanError}</span>
              </div>
              <button
                type="button"
                onClick={() => setQrScanError(null)}
                className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
              >
                Dispensar
              </button>
            </div>
          )}

          <QrCameraScanner
            onScan={handleQrScanSuccess}
            onCancel={() => {
              setViewMode('list');
              setQrScanError(null);
            }}
          />
        </div>
      )}

      {/* VIEW: EDIT EXTINGUISHER (MacBook Air - 22) */}
      {viewMode === 'edit' && activeExtinguisher && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-red-600">
              Editar Extintor
            </h2>
          </div>

          {/* Bordered card container matching MacBook Air - 22 */}
          <div className="border border-slate-300 rounded-2xl p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="text-red-600 shrink-0">
                  <ExtinguisherIcon size={44} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                    {formCode}
                  </h3>
                  <p className="text-sm text-slate-600">{formType}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 block mb-1">Status</span>
                <span className="inline-block px-4 py-1 text-xs font-semibold rounded-md border border-emerald-400 text-emerald-700 bg-emerald-50/50">
                  {formStatus}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {!formCode.trim() && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      Código obrigatório
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(e.target.value as ExtinguisherType)
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Pó Químico ABC">Pó Químico ABC</option>
                    <option value="CO2">CO2</option>
                    <option value="Água">Água</option>
                    <option value="Espuma Mecânica">Espuma Mecânica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Local
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Capacidade
                  </label>
                  <select
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="4kg">4kg</option>
                    <option value="6kg">6kg</option>
                    <option value="8kg">8kg</option>
                    <option value="10L">10L</option>
                    <option value="12kg">12kg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Data da Compra
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(formatDate(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {formPurchaseDate && !validateDate(formPurchaseDate) && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      Data inválida (DD/MM/AAAA)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as ExtinguisherStatus)
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Em dia">Em dia</option>
                    <option value="Atenção">Atenção</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Andar
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) =>
                      setFormFloor(e.target.value as typeof formFloor)
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {FLOORS.map((fl) => (
                      <option key={fl} value={fl}>
                        {fl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Observações
                  </label>
                  <textarea
                    rows={4}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Observações adicionais (opcional)"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-6 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW: MAIN LIST OF EXTINGUISHERS (MacBook Air - 12 / 17) */}
      {viewMode === 'list' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
                Extintores
              </h1>
              <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200">
                {extinguishers.length} no banco de dados
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setQrScanError(null);
                  setViewMode('qr_scan');
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-sm cursor-pointer"
                title="Abre a câmera para ler o QR Code e abrir a ficha do extintor"
              >
                <QrCode className="w-4 h-4 text-red-500" />
                <span>Escanear QR Code</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo extintor</span>
                </button>
              )}
            </div>
          </div>

          {/* Floor filter tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                FILTRAR POR LOCAL
              </p>
              <span className="text-xs text-slate-500 font-medium">
                Mostrando {filteredExtinguishers.length} de {extinguishers.length} extintores
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FLOORS.map((floor) => {
                const isSelected = selectedFloor === floor;
                const count =
                  floor === 'Todos'
                    ? extinguishers.length
                    : extinguishers.filter((e) => e.floor === floor).length;
                return (
                  <button
                    key={floor}
                    onClick={() => {
                      setSelectedFloor(floor);
                      setIsBuscaRapidaExpanded(false);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <span>{floor}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Busca Rápida Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-600 font-medium">
                  {selectedFloor === 'Todos'
                    ? 'Busca rápida (Todos os andares)'
                    : `Busca rápida ${selectedFloor}`}
                </p>
                <span className="text-[11px] font-semibold text-slate-400">
                  ({filteredExtinguishers.length} {filteredExtinguishers.length === 1 ? 'extintor' : 'extintores'})
                </span>
              </div>

              {selectedFloor !== 'Todos' && filteredExtinguishers.length > 15 && (
                <button
                  type="button"
                  onClick={() => setIsBuscaRapidaExpanded((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-red-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
                  title={
                    isBuscaRapidaExpanded
                      ? 'Recolher espaço da busca rápida'
                      : 'Expandir espaço da busca rápida'
                  }
                >
                  {isBuscaRapidaExpanded ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-[11px]">Recolher</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-[11px]">Expandir</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {selectedFloor === 'Todos' ? (
              <div className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[140px] shadow-xs">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-900">
                  Visão geral de todos os {extinguishers.length} extintores cadastrados
                </p>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Selecione um andar específico nos botões acima para ver os pinos de localização na planta esquemática, ou consulte todos na tabela logo abaixo.
                </p>
              </div>
            ) : (
              <div
                className={`w-full bg-white border border-slate-300 rounded-2xl relative overflow-hidden flex items-center justify-center transition-all duration-300 shadow-xs ${
                  isBuscaRapidaExpanded ? 'h-[520px]' : 'h-40 sm:h-48'
                }`}
              >
                {/* Floor schematic walls */}
                <svg
                  className="absolute inset-0 w-full h-full text-slate-200"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line
                    x1="8%"
                    y1="25%"
                    x2="92%"
                    y2="25%"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  <line
                    x1="8%"
                    y1="75%"
                    x2="92%"
                    y2="75%"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  <line
                    x1="8%"
                    y1="25%"
                    x2="8%"
                    y2="75%"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="92%"
                    y1="25%"
                    x2="92%"
                    y2="75%"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="48%"
                    y1="25%"
                    x2="48%"
                    y2="75%"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                </svg>

                {/* Extinguisher pins plotted strictly within the dashed boundaries */}
                {filteredExtinguishers.map((ext, idx) => {
                  const pinPos = pinPositions[idx] || { x: 50, y: 50 };
                  return (
                    <div
                      key={ext.id}
                      style={{
                        left: `${pinPos.x}%`,
                        top: `${pinPos.y}%`,
                      }}
                      onClick={() => setSelectedExtinguisherForDetails(ext)}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group flex flex-col items-center z-10 transition-all duration-300"
                      title={`${ext.code} (${ext.type}) - ${ext.location} (Clique para ver detalhes e QR Code)`}
                    >
                      <div
                        className={`p-1 rounded-full border shadow-xs transition-transform group-hover:scale-125 ${
                          ext.status === 'Em dia'
                            ? 'bg-emerald-600 text-white border-white'
                            : ext.status === 'Atenção'
                            ? 'bg-amber-500 text-white border-white'
                            : 'bg-red-600 text-white border-white'
                        }`}
                      >
                        <ExtinguisherIcon size={12} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table matching MacBook Air - 12 (Funcionário) / MacBook Air - 17 (Admin) */}
          <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-900 font-bold text-sm">
                    <th className="pb-4 px-3 font-semibold">Codigo</th>
                    <th className="pb-4 px-3 font-semibold">Tipo</th>
                    {selectedFloor === 'Todos' && (
                      <th className="pb-4 px-3 font-semibold">Andar</th>
                    )}
                    <th className="pb-4 px-3 font-semibold">Local</th>
                    <th className="pb-4 px-3 font-semibold">Capacidade</th>
                    <th className="pb-4 px-3 font-semibold">Status</th>
                    <th className="pb-4 px-3 font-semibold text-center">QR Code</th>
                    <th className="pb-4 px-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExtinguishers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={selectedFloor === 'Todos' ? 8 : 7}
                        className="py-8 text-center text-xs text-slate-400"
                      >
                        Nenhum extintor encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredExtinguishers.map((ext) => (
                      <tr
                        key={ext.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedExtinguisherForDetails(ext)}
                            className="font-bold text-slate-900 hover:text-red-600 transition-colors font-mono cursor-pointer underline decoration-dotted"
                            title="Clique para ver a ficha completa"
                          >
                            #{ext.code}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700">
                          {ext.type}
                        </td>
                        {selectedFloor === 'Todos' && (
                          <td className="py-3.5 px-3 font-medium text-slate-600">
                            {ext.floor}
                          </td>
                        )}
                        <td className="py-3.5 px-3 text-slate-700">
                          {ext.location}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700">
                          {ext.capacity}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block px-3.5 py-0.5 text-xs font-semibold rounded-md border ${
                              ext.status === 'Em dia'
                                ? 'border-emerald-400 text-emerald-700 bg-emerald-50/50'
                                : ext.status === 'Atenção'
                                ? 'border-amber-400 text-amber-700 bg-amber-50/50'
                                : 'border-red-400 text-red-700 bg-red-50/50'
                            }`}
                          >
                            {ext.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedExtinguisherForQrModal(ext)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                            title={`Ver e Imprimir QR Code de ${ext.code}`}
                          >
                            <QrCode className="w-3.5 h-3.5 text-red-600" />
                            <span>Ver QR</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedExtinguisherForDetails(ext)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Ver ficha completa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(ext)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  title={`Editar ${ext.code}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteModalExtinguisher(ext)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  title={`Excluir ${ext.code}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL: DELETE CONFIRMATION (MacBook Air - 29) */}
      {deleteModalExtinguisher && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center animate-scaleIn">
            <h3 className="text-base font-bold text-slate-900 mb-8">
              Tem certeza que deseja excluir este extintor?
            </h3>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setDeleteModalExtinguisher(null)}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE LABEL CARD (Ver / Imprimir) */}
      {selectedExtinguisherForQrModal && (
        <ExtinguisherQrModal
          extinguisher={selectedExtinguisherForQrModal}
          onClose={() => setSelectedExtinguisherForQrModal(null)}
        />
      )}

      {/* MODAL: EXTINGUISHER DETAILS (Direcionado via QR Code ou clique) */}
      {selectedExtinguisherForDetails && (
        <ExtinguisherDetailsModal
          extinguisher={selectedExtinguisherForDetails}
          user={user}
          onClose={() => setSelectedExtinguisherForDetails(null)}
          onEdit={(ext) => {
            setSelectedExtinguisherForDetails(null);
            handleStartEdit(ext);
          }}
        />
      )}
    </div>
  );
};
