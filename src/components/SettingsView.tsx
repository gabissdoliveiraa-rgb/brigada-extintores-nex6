/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types/brigada';
import {
  User,
  Pencil,
  LogOut,
  ArrowLeft,
  Camera,
  Trash2,
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

interface SettingsViewProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onLogout: () => void;
  initialEditing?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdateUser,
  onLogout,
  initialEditing = false,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editCargo] = useState(user.role);
  const [editSector, setEditSector] = useState(
    user.responsibleSector || SENAI_SECTOR_OPTIONS[2]
  );
  const [editBirthDate, setEditBirthDate] = useState(
    user.birthDate || '27/07/2000'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);

  // Field error states
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    sector?: string;
  }>({});

  // Synchronize when user prop updates
  useEffect(() => {
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone);
    setEditSector(user.responsibleSector || SENAI_SECTOR_OPTIONS[2]);
    setEditBirthDate(user.birthDate || '27/07/2000');
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  useEffect(() => {
    setIsEditing(initialEditing);
  }, [initialEditing]);

  // Handle phone change with automatic Brazilian mask (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhone(raw);
    setEditPhone(formatted);

    if (formatted) {
      const check = validatePhone(formatted);
      setErrors((prev) => ({
        ...prev,
        phone: check.valid ? undefined : check.error,
      }));
    } else {
      setErrors((prev) => ({ ...prev, phone: 'Telefone é obrigatório' }));
    }
  };

  // Handle birth date change with automatic / mask (DD/MM/AAAA)
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatDate(raw);
    setEditBirthDate(formatted);

    if (formatted.length === 10) {
      const check = validateDate(formatted);
      setErrors((prev) => ({
        ...prev,
        birthDate: check.valid ? undefined : check.error,
      }));
    } else if (formatted.length > 0 && formatted.length < 10) {
      setErrors((prev) => ({
        ...prev,
        birthDate: 'Data incompleta (formato: DD/MM/AAAA)',
      }));
    } else {
      setErrors((prev) => ({ ...prev, birthDate: undefined }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditName(val);
    const check = validateName(val);
    setErrors((prev) => ({
      ...prev,
      name: check.valid ? undefined : check.error,
    }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditEmail(val);
    const check = validateEmail(val);
    setErrors((prev) => ({
      ...prev,
      email: check.valid ? undefined : check.error,
    }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAvatarUrl(base64);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarUrl(undefined);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const nameCheck = validateName(editName);
    const emailCheck = validateEmail(editEmail);
    const phoneCheck = validatePhone(editPhone);
    const dateCheck = validateDate(editBirthDate);

    const newErrors = {
      name: nameCheck.valid ? undefined : nameCheck.error,
      email: emailCheck.valid ? undefined : emailCheck.error,
      phone: phoneCheck.valid ? undefined : phoneCheck.error,
      birthDate: dateCheck.valid ? undefined : dateCheck.error,
      sector: editSector ? undefined : 'Selecione um andar ou setor',
    };

    setErrors(newErrors);

    const hasError = Object.values(newErrors).some((err) => !!err);
    if (hasError) {
      return;
    }

    onUpdateUser({
      ...user,
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      responsibleSector: editSector,
      birthDate: editBirthDate.trim(),
      avatarUrl,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Hidden file input for changing profile photo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
          Configurações
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Gerencie suas informações e preferências
        </p>
      </div>

      {isEditing ? (
        /* EDIT PROFILE SCREEN */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <button
              onClick={() => {
                setIsEditing(false);
                setErrors({});
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-red-600">
                Editar seus dados
              </h2>
              <p className="text-xs text-slate-500">
                Atualize suas informações pessoais e foto de perfil
              </p>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Profile Card with Photo Changer */}
              <div className="lg:col-span-4 border border-slate-200 rounded-2xl p-6 text-center space-y-4 bg-slate-50/60">
                <div className="relative w-28 h-28 mx-auto">
                  <div className="w-28 h-28 rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-400 overflow-hidden shadow-inner">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-slate-400" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Mudar foto de perfil"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline block mx-auto cursor-pointer"
                  >
                    Alterar foto
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] text-slate-500 hover:text-red-600 flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remover foto</span>
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {editName || 'Seu Nome'}
                  </h3>
                  <span className="inline-block mt-1 px-3 py-0.5 text-xs font-bold rounded-md bg-red-100 text-red-600">
                    {editCargo.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Right Form Fields */}
              <div className="lg:col-span-8 border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Suas informações
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={handleNameChange}
                      placeholder="Seu nome completo"
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Cargo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={editCargo}
                      disabled
                      className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed font-medium"
                    />
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={handlePhoneChange}
                      placeholder="(11) 97340-9476"
                      maxLength={15}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.phone
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {errors.phone && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={handleEmailChange}
                      placeholder="usuario@senaisp.edu.br"
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.email
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Responsável pelo andar/setor */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Responsável pelo andar/setor *
                    </label>
                    <select
                      value={editSector}
                      onChange={(e) => {
                        setEditSector(e.target.value);
                        setErrors((prev) => ({ ...prev, sector: undefined }));
                      }}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.sector
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:ring-red-500'
                      }`}
                    >
                      {SENAI_SECTOR_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {errors.sector && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.sector}</span>
                      </p>
                    )}
                  </div>

                  {/* Data de nascimento */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de nascimento *
                    </label>
                    <input
                      type="text"
                      value={editBirthDate}
                      onChange={handleBirthDateChange}
                      placeholder="27/07/2000"
                      maxLength={10}
                      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.birthDate
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:ring-red-500'
                      }`}
                    />
                    {errors.birthDate && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.birthDate}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setErrors({});
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* MAIN CONFIGURAÇÕES VIEW (MacBook Air - 27) */
        <div className="space-y-6">
          {/* Dados da conta Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-6">
              Dados da conta
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nome completo
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800">
                  {user.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  E-mail
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Cargo
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                  {user.role}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Telefone
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                  {user.phone}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Responsável pelo andar/setor
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                  {user.responsibleSector || '1º andar - Administração e Coordenação'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Data de nascimento
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                  {user.birthDate || '27/07/2000'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 mt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar dados</span>
              </button>
            </div>
          </div>

          {/* Sair da conta Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Sair da conta
                </h3>
                <p className="text-xs text-slate-500">
                  Encerrar a sua sessão atual.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-lg text-xs tracking-wide transition-all shadow-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION (MacBook Air - 6) */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900 mb-6">
              Tem certeza que deseja sair da sua conta?
            </h3>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogout();
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
