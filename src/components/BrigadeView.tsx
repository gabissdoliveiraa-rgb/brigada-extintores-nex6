/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  BrigadeMember,
  UserProfile,
} from '../types/brigada';
import { canPerformAdminAction, calculateBrigadeStats } from '../utils/brigadaLogic';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Users,
  Star,
  User,
  CheckCircle2,
  AlertTriangle,
  Search,
  Upload,
  Camera,
  AlertCircle,
} from 'lucide-react';
import {
  formatPhone,
  formatDate,
  validatePhone,
  validateEmail,
  validateDate,
  validateName,
  SENAI_SECTOR_OPTIONS,
} from '../utils/maskUtils';

interface BrigadeViewProps {
  user: UserProfile;
  members: BrigadeMember[];
  onAddMember: (newMember: BrigadeMember) => void;
  onUpdateMember: (updated: BrigadeMember) => void;
  onDeleteMember: (id: string) => void;
}

export const BrigadeView: React.FC<BrigadeViewProps> = ({
  user,
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const isAdmin = canPerformAdminAction(user.role);
  const stats = calculateBrigadeStats(members);

  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | 'Líder' | 'Brigadista'>('Todos');

  // Currently edited or deleted member
  const [activeMember, setActiveMember] = useState<BrigadeMember | null>(null);
  const [deleteModalMember, setDeleteModalMember] = useState<BrigadeMember | null>(null);

  // File input refs for photo upload
  const createPhotoRef = useRef<HTMLInputElement>(null);
  const editPhotoRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formRole, setFormRole] = useState<'Líder da Brigada' | 'Brigadista'>('Brigadista');
  const [formFunction, setFormFunction] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formResponsibleFloor, setFormResponsibleFloor] = useState<BrigadeMember['responsibleFloor']>('1º andar');
  const [formTrainingStatus, setFormTrainingStatus] = useState<'Em dia' | 'Vencido'>('Em dia');
  const [formTrainingExpiration, setFormTrainingExpiration] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | undefined>(undefined);

  // Validation errors
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    date?: string;
  }>({});

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.functionDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.responsibleFloor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'Todos' ||
      (roleFilter === 'Líder' && m.isLeader) ||
      (roleFilter === 'Brigadista' && !m.isLeader);

    return matchesSearch && matchesRole;
  });

  const handleStartCreate = () => {
    setFormName('');
    setFormJobTitle('Técnico Operacional');
    setFormRole('Brigadista');
    setFormFunction('Apoiar nas ações de combate e evacuação');
    setFormPhone('');
    setFormEmail('');
    setFormResponsibleFloor('1º andar');
    setFormTrainingStatus('Em dia');
    setFormTrainingExpiration('10/12/2026');
    setFormAvatarUrl(undefined);
    setFormErrors({});
    setViewMode('create');
  };

  const handleStartEdit = (member: BrigadeMember) => {
    setActiveMember(member);
    setFormName(member.name);
    setFormJobTitle(member.jobTitle);
    setFormRole(member.isLeader ? 'Líder da Brigada' : 'Brigadista');
    setFormFunction(member.functionDescription);
    setFormPhone(member.phone);
    setFormEmail(member.email);
    setFormResponsibleFloor(member.responsibleFloor);
    setFormTrainingStatus(member.trainingStatus);
    setFormTrainingExpiration(member.trainingExpirationDate || '15/12/2026');
    setFormAvatarUrl(member.avatarUrl);
    setFormErrors({});
    setViewMode('edit');
  };

  // Automatic phone mask and live validation
  const handlePhoneChange = (val: string) => {
    const formatted = formatPhone(val);
    setFormPhone(formatted);
    if (formatted) {
      const chk = validatePhone(formatted);
      setFormErrors((prev) => ({ ...prev, phone: chk.valid ? undefined : chk.error }));
    } else {
      setFormErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  // Automatic date mask and live validation
  const handleDateChange = (val: string) => {
    const formatted = formatDate(val);
    setFormTrainingExpiration(formatted);
    if (formatted.length === 10) {
      const chk = validateDate(formatted);
      setFormErrors((prev) => ({ ...prev, date: chk.valid ? undefined : chk.error }));
    } else if (formatted.length > 0 && formatted.length < 10) {
      setFormErrors((prev) => ({ ...prev, date: 'Data incompleta (DD/MM/AAAA)' }));
    } else {
      setFormErrors((prev) => ({ ...prev, date: undefined }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormAvatarUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateAll = () => {
    const nameChk = validateName(formName);
    const phoneChk = validatePhone(formPhone);
    const emailChk = validateEmail(formEmail);
    const dateChk = formTrainingExpiration ? validateDate(formTrainingExpiration) : { valid: true };

    const errors = {
      name: nameChk.valid ? undefined : nameChk.error,
      phone: phoneChk.valid ? undefined : phoneChk.error,
      email: emailChk.valid ? undefined : emailChk.error,
      date: dateChk.valid ? undefined : dateChk.error,
    };
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    const newMember: BrigadeMember = {
      id: `member_${Date.now()}`,
      name: formName.trim(),
      role: formRole,
      isLeader: formRole === 'Líder da Brigada',
      jobTitle: formJobTitle.trim() || 'Brigadista',
      functionDescription: formFunction.trim() || 'Apoio geral na brigada',
      phone: formPhone.trim(),
      email: formEmail.trim(),
      responsibleFloor: formResponsibleFloor,
      trainingStatus: formTrainingStatus,
      trainingExpirationDate: formTrainingExpiration,
      avatarUrl: formAvatarUrl,
    };

    onAddMember(newMember);
    setViewMode('list');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !validateAll()) return;

    const updated: BrigadeMember = {
      ...activeMember,
      name: formName.trim(),
      role: formRole,
      isLeader: formRole === 'Líder da Brigada',
      jobTitle: formJobTitle.trim(),
      functionDescription: formFunction.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      responsibleFloor: formResponsibleFloor,
      trainingStatus: formTrainingStatus,
      trainingExpirationDate: formTrainingExpiration,
      avatarUrl: formAvatarUrl,
    };

    onUpdateMember(updated);
    setViewMode('list');
    setActiveMember(null);
  };

  const handleConfirmDelete = () => {
    if (deleteModalMember) {
      onDeleteMember(deleteModalMember.id);
      setDeleteModalMember(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Hidden file inputs for photo upload */}
      <input
        type="file"
        ref={createPhotoRef}
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        type="file"
        ref={editPhotoRef}
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* VIEW: CREATE MEMBER FORM (MacBook Air - 20) */}
      {viewMode === 'create' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Voltar para lista"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-red-600">
              Cadastrar Novo Membro
            </h2>
          </div>

          <form onSubmit={handleSaveCreate}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form fields */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      const chk = validateName(e.target.value);
                      setFormErrors((prev) => ({ ...prev, name: chk.valid ? undefined : chk.error }));
                    }}
                    placeholder="Digite o nome completo"
                    className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                      formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{formErrors.name}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                    placeholder="Ex: Técnico em Segurança do Trabalho"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Função na Brigada
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) =>
                        setFormRole(e.target.value as 'Líder da Brigada' | 'Brigadista')
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Brigadista">Brigadista</option>
                      <option value="Líder da Brigada">Líder da Brigada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Responsável pelo Andar / Setor
                    </label>
                    <select
                      value={formResponsibleFloor}
                      onChange={(e) =>
                        setFormResponsibleFloor(e.target.value as BrigadeMember['responsibleFloor'])
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Térreo - Recepção e Portaria">Térreo - Recepção e Portaria</option>
                      <option value="Térreo - Cantina e Oficinas">Térreo - Cantina e Oficinas</option>
                      <option value="1º andar">1º andar</option>
                      <option value="2º andar">2º andar</option>
                      <option value="3º andar">3º andar</option>
                      <option value="4º andar">4º andar</option>
                      <option value="5º andar">5º andar</option>
                      <option value="6º andar">6º andar</option>
                      <option value="Geral - Toda a unidade SENAI">Geral - Toda a unidade SENAI</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descrição da Função
                  </label>
                  <input
                    type="text"
                    value={formFunction}
                    onChange={(e) => setFormFunction(e.target.value)}
                    placeholder="Ex: Apoiar nas ações de combate e evacuação"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 98000-0000"
                      maxLength={15}
                      className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.phone}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => {
                        setFormEmail(e.target.value);
                        const chk = validateEmail(e.target.value);
                        setFormErrors((prev) => ({ ...prev, email: chk.valid ? undefined : chk.error }));
                      }}
                      placeholder="usuario@senaisp.edu.br"
                      className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Situação do Treinamento
                    </label>
                    <select
                      value={formTrainingStatus}
                      onChange={(e) =>
                        setFormTrainingStatus(e.target.value as 'Em dia' | 'Vencido')
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Em dia">Em dia</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vencimento do Treinamento
                    </label>
                    <input
                      type="text"
                      value={formTrainingExpiration}
                      onChange={(e) => handleDateChange(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.date ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.date && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.date}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Box Matching Figma with REAL UPLOAD */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div
                  onClick={() => createPhotoRef.current?.click()}
                  className="w-full max-w-sm h-64 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-500 hover:border-red-400 hover:bg-red-50/20 transition-all cursor-pointer relative overflow-hidden"
                >
                  {formAvatarUrl ? (
                    <>
                      <img
                        src={formAvatarUrl}
                        alt="Foto selecionada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-lg">
                          Trocar foto
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-3 text-slate-400" />
                      <span className="text-sm font-bold tracking-wider text-slate-700">
                        ADICIONAR FOTO
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        Clique para selecionar uma foto
                      </span>
                    </>
                  )}
                </div>
                {formAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setFormAvatarUrl(undefined)}
                    className="mt-2 text-xs text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover foto</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Salvar Membro
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW: EDIT MEMBER FORM (MacBook Air - 27) */}
      {viewMode === 'edit' && activeMember && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button
              onClick={() => {
                setViewMode('list');
                setActiveMember(null);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-red-600">
              Editar Membro da Brigada
            </h2>
          </div>

          <form onSubmit={handleSaveEdit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Profile Preview */}
              <div className="lg:col-span-4 border border-slate-200 rounded-2xl p-6 text-center space-y-4 bg-slate-50/50">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="w-24 h-24 rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-500 overflow-hidden shadow-inner">
                    {formAvatarUrl ? (
                      <img
                        src={formAvatarUrl}
                        alt={formName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => editPhotoRef.current?.click()}
                    className="absolute bottom-0 right-0 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Mudar foto"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {formName || 'Nome'}
                  </h3>
                  <span className="inline-block mt-1 px-3 py-0.5 text-xs font-bold rounded-md bg-red-100 text-red-600">
                    {formRole.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Right Form Fields */}
              <div className="lg:col-span-8 border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Informações do membro
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        const chk = validateName(e.target.value);
                        setFormErrors((prev) => ({ ...prev, name: chk.valid ? undefined : chk.error }));
                      }}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.name}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Função na Brigada
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) =>
                        setFormRole(e.target.value as 'Líder da Brigada' | 'Brigadista')
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Líder da Brigada">Líder da brigada</option>
                      <option value="Brigadista">Brigadista</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 98000-0000"
                      maxLength={15}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.phone}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => {
                        setFormEmail(e.target.value);
                        const chk = validateEmail(e.target.value);
                        setFormErrors((prev) => ({ ...prev, email: chk.valid ? undefined : chk.error }));
                      }}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{formErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Responsável pelo Andar
                    </label>
                    <select
                      value={formResponsibleFloor}
                      onChange={(e) =>
                        setFormResponsibleFloor(e.target.value as BrigadeMember['responsibleFloor'])
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Térreo - Recepção e Portaria">Térreo - Recepção e Portaria</option>
                      <option value="Térreo - Cantina e Oficinas">Térreo - Cantina e Oficinas</option>
                      <option value="1º andar">1º andar</option>
                      <option value="2º andar">2º andar</option>
                      <option value="3º andar">3º andar</option>
                      <option value="4º andar">4º andar</option>
                      <option value="5º andar">5º andar</option>
                      <option value="6º andar">6º andar</option>
                      <option value="Geral - Toda a unidade SENAI">Geral - Toda a unidade SENAI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Situação do Treinamento
                    </label>
                    <select
                      value={formTrainingStatus}
                      onChange={(e) =>
                        setFormTrainingStatus(e.target.value as 'Em dia' | 'Vencido')
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Em dia">Em dia</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('list');
                      setActiveMember(null);
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* VIEW: MAIN LIST OF BRIGADE MEMBERS */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
              Equipe da Brigada
            </h1>

            {isAdmin && (
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-lg text-xs tracking-wide transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo membro</span>
              </button>
            )}
          </div>

          {/* 5 Stats Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-600 leading-tight">
                Total de Membros
              </span>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.total.toString().padStart(2, '0')}
                </span>
                <Users className="w-6 h-6 text-red-600" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-600 leading-tight">
                Líderes
              </span>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.leaders.toString().padStart(2, '0')}
                </span>
                <Star className="w-6 h-6 text-amber-400 fill-amber-100" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-600 leading-tight">
                Brigadistas
              </span>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.brigadistas.toString().padStart(2, '0')}
                </span>
                <User className="w-6 h-6 text-red-500" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-600 leading-tight">
                Trein. em Dia
              </span>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.trainingUpToDate.toString().padStart(2, '0')}
                </span>
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-slate-600 leading-tight">
                Trein. Venc.
              </span>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.trainingExpired.toString().padStart(2, '0')}
                </span>
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar membro"
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Função:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                {(['Todos', 'Líder', 'Brigadista'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      roleFilter === r
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Member Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row gap-4 items-start relative hover:border-slate-300 transition-colors"
              >
                {/* Real Avatar */}
                <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 mx-auto sm:mx-0 overflow-hidden shadow-inner">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {member.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 mt-1 text-[11px] font-bold rounded-md bg-red-100 text-red-600">
                        <Star className="w-3 h-3 fill-red-500" />
                        <span>{member.role}</span>
                      </span>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartEdit(member)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                          aria-label={`Editar ${member.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModalMember(member)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                          aria-label={`Excluir ${member.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Function and Contact */}
                  <div className="mt-3 text-xs space-y-1 text-slate-600">
                    <p>
                      <strong className="text-slate-800">Função: </strong>
                      {member.functionDescription}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-[11px]">
                      <p>
                        <strong className="text-slate-700">Telefone: </strong>
                        {member.phone}
                      </p>
                      <p className="truncate">
                        <strong className="text-slate-700">E-mail: </strong>
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Footer Tags */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px]">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-semibold border ${
                        member.trainingStatus === 'Em dia'
                          ? 'border-emerald-400 text-emerald-700 bg-emerald-50/50'
                          : 'border-red-400 text-red-700 bg-red-50/50'
                      }`}
                    >
                      Treinamento {member.trainingStatus.toLowerCase()}
                    </span>
                    <span className="font-semibold text-red-600">
                      Responsável pelo {member.responsibleFloor}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL: DELETE CONFIRMATION (MacBook Air - 26) */}
      {deleteModalMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Confirmar exclusão
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Tem certeza que deseja excluir o membro{' '}
              <strong>{deleteModalMember.name}</strong> da brigada?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalMember(null)}
                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
