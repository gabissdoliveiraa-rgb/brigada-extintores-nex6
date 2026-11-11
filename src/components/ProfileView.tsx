/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { UserProfile } from '../types/brigada';
import {
  User,
  Pencil,
  Mail,
  Phone,
  Building2,
  Camera,
  Trash2,
} from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onOpenEdit: () => void;
  onLogout: () => void;
  onUpdateUser: (updated: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onOpenEdit,
  onLogout,
  onUpdateUser,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      onUpdateUser({
        ...user,
        avatarUrl: base64,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = () => {
    onUpdateUser({
      ...user,
      avatarUrl: undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-12">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Centered Profile Card - EXACT MATCH to image_399b102a.png */}
      <div className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-12 shadow-xs min-h-[500px] flex flex-col justify-between relative">
        {/* Top Left Title with Blue Underline */}
        <div>
          <div className="inline-block relative">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Meu Perfil
            </h1>
            <div className="h-1 bg-blue-600 rounded-full w-full mt-0.5" />
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Gerencie suas informações pessoais
          </p>
        </div>

        {/* Center: Big Avatar, Name, Role Badge, and Contacts */}
        <div className="flex flex-col items-center justify-center my-6 text-center">
          {/* Circular Avatar with Camera button */}
          <div className="relative group">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-300/80 border-4 border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              )}
            </div>

            {/* Quick Photo Upload Trigger */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
              title="Mudar foto de perfil"
              aria-label="Mudar foto de perfil"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {user.avatarUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="mt-2 text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remover foto</span>
            </button>
          )}

          {/* Name */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-3">
            {user.name}
          </h2>

          {/* Role Badge */}
          <div className="mt-2">
            <span className="inline-block px-8 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-red-200 text-red-600">
              {user.role.toUpperCase()}
            </span>
          </div>

          {/* Contact Info (Matching image_399b102a.png) */}
          <div className="mt-6 space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4 text-slate-600" />
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Phone className="w-4 h-4 text-slate-600" />
              <span className="font-medium">{user.phone}</span>
            </div>
            {user.responsibleSector && (
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{user.responsibleSector}</span>
              </div>
            )}
          </div>

          {/* Edit Data Link/Button */}
          <button
            onClick={onOpenEdit}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar dados</span>
          </button>
        </div>

        {/* Bottom Centered Red Button: SAIR */}
        <div className="flex justify-center pt-4">
          <button
            onClick={onLogout}
            className="w-48 sm:w-56 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-sm tracking-wider uppercase shadow-sm transition-all cursor-pointer"
          >
            SAIR
          </button>
        </div>
      </div>
    </div>
  );
};
