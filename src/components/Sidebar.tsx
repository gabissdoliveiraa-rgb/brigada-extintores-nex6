/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  ClipboardList,
  Users,
  Settings,
  FileBarChart2,
  Menu,
  X,
  Database,
  History,
} from 'lucide-react';
import { SenaiLogo } from './SenaiLogo';
import { ExtinguisherIcon } from './ExtinguisherIcon';

export type ViewTab =
  | 'inicio'
  | 'extintores'
  | 'inspecoes'
  | 'equipe'
  | 'historico'
  | 'relatorios'
  | 'configuracoes'
  | 'avisos'
  | 'banco_dados'
  | 'perfil';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onToggleMobile,
  isAdmin = false,
}) => {
  const menuItems: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'inicio',
      label: 'Início',
      icon: <Home className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'extintores',
      label: 'Extintores',
      icon: <ExtinguisherIcon size={20} className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'inspecoes',
      label: 'Inspeções',
      icon: <ClipboardList className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'equipe',
      label: 'Equipe Brigada',
      icon: <Users className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'historico',
      label: 'Histórico',
      icon: <History className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: <FileBarChart2 className="w-5 h-5 shrink-0" />,
    },
    // Only Administrators can see and access the Banco de Dados tab
    ...(isAdmin
      ? [
          {
            id: 'banco_dados' as ViewTab,
            label: 'Banco de Dados',
            icon: <Database className="w-5 h-5 shrink-0" />,
          },
        ]
      : []),
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onToggleMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between py-6 px-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Header with Logo */}
          <div className="flex items-center justify-between pb-8 pt-2 px-2 border-b border-slate-100 mb-6">
            <div
              className="cursor-pointer"
              onClick={() => {
                onSelectTab('inicio');
                if (mobileOpen) onToggleMobile();
              }}
            >
              <SenaiLogo size="sm" showSubtitle={true} />
            </div>
            <button
              onClick={onToggleMobile}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Navegação Principal">
            {menuItems.map((item) => {
              const isActive =
                currentTab === item.id ||
                (item.id === 'inicio' && currentTab === 'avisos');
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (mobileOpen) onToggleMobile();
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'text-red-600 font-semibold bg-red-50/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span
                    className={
                      isActive
                        ? 'text-red-600'
                        : 'text-slate-500 group-hover:text-slate-700'
                    }
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};
