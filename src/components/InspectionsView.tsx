/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ExtinguisherStatus,
  ExtinguisherType,
  Inspection,
  UserProfile,
} from '../types/brigada';
import { formatDate, validateDate } from '../utils/maskUtils';
import {
  canPerformAdminAction,
  computeStatusFromValidity,
  filterInspectionsByFloor,
  getDaysUntilDate,
} from '../utils/brigadaLogic';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import {
  Pencil,
  ArrowLeft,
  MapPin,
  Scale,
  Calendar,
  CalendarClock,
  Info,
  Search,
} from 'lucide-react';

interface InspectionsViewProps {
  user: UserProfile;
  inspections: Inspection[];
  onUpdateInspection: (updated: Inspection) => void;
}

const FLOORS = [
  'Térreo - Recepção e Portaria',
  'Térreo - Cantina e Oficinas',
  '1º andar',
  '2º andar',
  '3º andar',
  '4º andar',
  '5º andar',
  '6º andar',
  'Geral - Toda a unidade SENAI',
] as const;

type InspectionFloorType = (typeof FLOORS)[number];

function formatOffsetBrDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function getEffectiveInspectionStatus(insp: Inspection): ExtinguisherStatus {
  if (validateDate(insp.validityDate) || validateDate(insp.nextInspectionDate)) {
    return computeStatusFromValidity(insp.validityDate, insp.nextInspectionDate);
  }
  return insp.status;
}

function getValidityHint(validityDate?: string, nextInspectionDate?: string): string | null {
  const days = [getDaysUntilDate(validityDate), getDaysUntilDate(nextInspectionDate)].filter(
    (v): v is number => v !== null
  );
  if (days.length === 0) return null;
  const minDays = Math.min(...days);
  if (minDays < 0) return `Vencido há ${Math.abs(minDays)}d`;
  if (minDays === 0) return 'Vence hoje';
  if (minDays <= 30) return `Vence em ${minDays}d`;
  return `${minDays}d restantes`;
}

export const InspectionsView: React.FC<InspectionsViewProps> = ({
  user,
  inspections,
  onUpdateInspection,
}) => {
  const isAdmin = canPerformAdminAction(user.role);
  const [selectedFloor, setSelectedFloor] = useState<InspectionFloorType>(
    'Térreo - Recepção e Portaria'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ExtinguisherStatus>('Todos');

  const [activeInspection, setActiveInspection] = useState<Inspection | null>(
    null
  );

  // Form states for editing
  const [editCode, setEditCode] = useState('');
  const [editExtinguisherType, setEditExtinguisherType] =
    useState<ExtinguisherType>('Pó Químico ABC');
  const [editDate, setEditDate] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editStatus, setEditStatus] = useState<ExtinguisherStatus>('Em dia');
  const [editNotes, setEditNotes] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCapacity, setEditCapacity] = useState('6kg');
  const [editValidityDate, setEditValidityDate] = useState('');
  const [editNextInspectionDate, setEditNextInspectionDate] = useState('');

  const floorInspections = filterInspectionsByFloor(inspections, selectedFloor);
  const q = searchQuery.trim().toLowerCase();
  const filteredInspections = floorInspections.filter((insp) => {
    const effective = getEffectiveInspectionStatus(insp);
    const matchesStatus = statusFilter === 'Todos' || effective === statusFilter;
    const matchesSearch =
      !q ||
      insp.code.toLowerCase().includes(q) ||
      insp.extinguisherCode.toLowerCase().includes(q) ||
      insp.extinguisherType.toLowerCase().includes(q) ||
      insp.location.toLowerCase().includes(q) ||
      insp.responsible.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleStartEdit = (insp: Inspection) => {
    if (!isAdmin) return;
    const effective = getEffectiveInspectionStatus(insp);
    setActiveInspection(insp);
    setEditCode(insp.code);
    setEditExtinguisherType(insp.extinguisherType);
    setEditDate(insp.date);
    setEditResponsible(insp.responsible);
    setEditStatus(effective);
    setEditNotes(insp.notes || 'Tudo Conforme.');
    setEditLocation(insp.location);
    setEditCapacity(insp.capacity);
    setEditValidityDate(insp.validityDate);
    setEditNextInspectionDate(insp.nextInspectionDate);
  };

  const handleValidityDateChange = (raw: string) => {
    const formatted = formatDate(raw);
    setEditValidityDate(formatted);
    if (validateDate(formatted) || validateDate(editNextInspectionDate)) {
      setEditStatus(computeStatusFromValidity(formatted, editNextInspectionDate));
    }
  };

  const handleNextInspectionDateChange = (raw: string) => {
    const formatted = formatDate(raw);
    setEditNextInspectionDate(formatted);
    if (validateDate(editValidityDate) || validateDate(formatted)) {
      setEditStatus(computeStatusFromValidity(editValidityDate, formatted));
    }
  };

  const handleStatusSelectChange = (newStatus: ExtinguisherStatus) => {
    setEditStatus(newStatus);
    const currentDerived = computeStatusFromValidity(editValidityDate, editNextInspectionDate);
    if (currentDerived !== newStatus) {
      if (newStatus === 'Em dia') {
        const nextValid = formatOffsetBrDate(365);
        setEditNextInspectionDate(nextValid);
        const valDays = getDaysUntilDate(editValidityDate);
        if (valDays !== null && valDays <= 30) {
          setEditValidityDate(formatOffsetBrDate(365));
        }
      } else if (newStatus === 'Atenção') {
        setEditNextInspectionDate(formatOffsetBrDate(15));
        const valDays = getDaysUntilDate(editValidityDate);
        if (valDays !== null && valDays < 0) {
          setEditValidityDate(formatOffsetBrDate(15));
        }
      } else if (newStatus === 'Vencido') {
        setEditNextInspectionDate(formatOffsetBrDate(-1));
      }
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !activeInspection) return;

    const syncedStatus =
      validateDate(editValidityDate) || validateDate(editNextInspectionDate)
        ? computeStatusFromValidity(editValidityDate, editNextInspectionDate)
        : editStatus;

    const updated: Inspection = {
      ...activeInspection,
      code: editCode,
      extinguisherType: editExtinguisherType,
      date: editDate,
      responsible: editResponsible,
      status: syncedStatus,
      notes: editNotes,
      location: editLocation,
      capacity: editCapacity,
      validityDate: editValidityDate,
      nextInspectionDate: editNextInspectionDate,
    };

    onUpdateInspection(updated);
    setActiveInspection(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* VIEW: EDIT INSPECTION FORM (Admin only) */}
      {isAdmin && activeInspection ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button
              onClick={() => setActiveInspection(null)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Voltar para lista de inspeções"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-red-600">
                Editar inspeção
              </h2>
              <p className="text-xs text-slate-500">
                Atualize as informações da inspeção realizada
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveEdit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Dados da Inspeção */}
              <div className="lg:col-span-7 border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Dados da Inspeção
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Código
                    </label>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Extintor
                    </label>
                    <input
                      type="text"
                      value={editExtinguisherType}
                      onChange={(e) =>
                        setEditExtinguisherType(
                          e.target.value as ExtinguisherType
                        )
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data da Inspeção *
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editDate}
                      onChange={(e) => setEditDate(formatDate(e.target.value))}
                      placeholder="DD/MM/AAAA"
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        editDate && !validateDate(editDate)
                          ? 'border-red-400'
                          : 'border-slate-300'
                      }`}
                    />
                    {editDate && !validateDate(editDate) && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">
                        Data inválida (formato DD/MM/AAAA)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Responsável *
                    </label>
                    <input
                      type="text"
                      value={editResponsible}
                      onChange={(e) => setEditResponsible(e.target.value)}
                      placeholder="Nome do inspetor"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    {!editResponsible.trim() && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">
                        Responsável obrigatório
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status (sincronizado com a validade)
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        handleStatusSelectChange(e.target.value as ExtinguisherStatus)
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Em dia">Em dia</option>
                      <option value="Atenção">Atenção (vence em até 30 dias)</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {getValidityHint(editValidityDate, editNextInspectionDate)
                          ? `Prazo pela validade/próxima inspeção: ${getValidityHint(editValidityDate, editNextInspectionDate)}.`
                          : 'Alterar as datas de validade atualiza o status automaticamente.'}
                      </span>
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Card Extintor info & Next Dates */}
              <div className="lg:col-span-5 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                    <ExtinguisherIcon size={26} color="white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-red-700 block">
                      Extintor #{activeInspection.extinguisherCode}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {editExtinguisherType}
                    </h4>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 text-sm">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">Local</p>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">
                        Capacidade
                      </p>
                      <input
                        type="text"
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">
                        Data de Validade
                      </p>
                      <input
                        type="text"
                        maxLength={10}
                        value={editValidityDate}
                        onChange={(e) => handleValidityDateChange(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded mt-0.5 font-mono"
                      />
                      {editValidityDate && !validateDate(editValidityDate) && (
                        <p className="text-[11px] text-red-600 mt-0.5 font-medium">
                          Data inválida
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarClock className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">
                        Próxima Inspeção
                      </p>
                      <input
                        type="text"
                        maxLength={10}
                        value={editNextInspectionDate}
                        onChange={(e) => handleNextInspectionDateChange(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded mt-0.5 font-mono"
                      />
                      {editNextInspectionDate &&
                        !validateDate(editNextInspectionDate) && (
                          <p className="text-[11px] text-red-600 mt-0.5 font-medium">
                            Data inválida
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveInspection(null)}
                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* MAIN INSPECTIONS LIST */
        <>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
              Inspeções
            </h1>
          </div>

          {/* Floor filter tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                Filtrar por local
              </p>
              <span className="text-xs text-slate-500 font-medium">
                Mostrando {filteredInspections.length} de {inspections.length} inspeções
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FLOORS.map((floor) => {
                const isSelected = selectedFloor === floor;
                return (
                  <button
                    key={floor}
                    onClick={() => setSelectedFloor(floor)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {floor}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, extintor, local ou responsável..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['Todos', 'Em dia', 'Atenção', 'Vencido'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Inspections Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-700 font-semibold text-xs">
                    <th className="pb-3 px-3">Código</th>
                    <th className="pb-3 px-3">Extintor</th>
                    <th className="pb-3 px-3">Data Inspeção</th>
                    <th className="pb-3 px-3">Validade</th>
                    <th className="pb-3 px-3">Próx. Inspeção</th>
                    <th className="pb-3 px-3">Responsável</th>
                    <th className="pb-3 px-3">Status</th>
                    {isAdmin && <th className="pb-3 px-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInspections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 8 : 7}
                        className="py-8 text-center text-xs text-slate-400"
                      >
                        <p>Nenhuma inspeção encontrada para os filtros selecionados.</p>
                        {(searchQuery || statusFilter !== 'Todos') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('Todos');
                            }}
                            className="mt-2 text-red-600 font-semibold hover:underline cursor-pointer"
                          >
                            Limpar filtros
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map((insp) => {
                      const effectiveStatus = getEffectiveInspectionStatus(insp);
                      const hint = getValidityHint(insp.validityDate, insp.nextInspectionDate);
                      return (
                        <tr
                          key={insp.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-slate-900 font-mono">
                            {insp.code}
                            <span className="block text-[10px] font-normal text-slate-400">
                              #{insp.extinguisherCode}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {insp.extinguisherType}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono tabular-nums text-xs">
                            {insp.date}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-mono tabular-nums text-xs">
                            {insp.validityDate || '-'}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-mono tabular-nums text-xs">
                            {insp.nextInspectionDate || '-'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {insp.responsible}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-3 py-0.5 text-xs font-semibold rounded-md border ${
                                effectiveStatus === 'Em dia'
                                  ? 'border-emerald-400 text-emerald-700 bg-emerald-50/50'
                                  : effectiveStatus === 'Atenção'
                                  ? 'border-amber-400 text-amber-700 bg-amber-50/50'
                                  : 'border-red-400 text-red-700 bg-red-50/50'
                              }`}
                            >
                              {effectiveStatus}
                            </span>
                            {hint && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                {hint}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleStartEdit(insp)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                aria-label={`Editar inspeção ${insp.code}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
