/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserProfile, UserRole } from '../types/brigada';
import { Menu } from 'lucide-react';

interface HeaderUserProps {
  user: UserProfile;
  onOpenProfile: () => void;
  onSwitchRole?: (newRole: UserRole) => void;
  onToggleMobileMenu: () => void;
}

export const HeaderUser: React.FC<HeaderUserProps> = ({
  user,
  onOpenProfile,
  onToggleMobileMenu,
}) => {
  return (
    <header className="flex items-center justify-between lg:justify-end gap-3 pb-6 border-b border-transparent">
      {/* Mobile Hamburger Menu */}
      <button
        onClick={onToggleMobileMenu}
        className="lg:hidden p-2 text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
        aria-label="Abrir menu lateral"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">

        {/* User profile button */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 px-2 py-1 text-right group hover:bg-slate-100/80 rounded-lg transition-colors"
          aria-label="Ver perfil e configurações"
        >
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800 leading-none">
              {user.name}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-none">
              {user.role}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 overflow-hidden shrink-0 group-hover:border-red-400 transition-colors">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-5 h-5 text-slate-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
