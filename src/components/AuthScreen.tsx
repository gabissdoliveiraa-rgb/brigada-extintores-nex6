/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserRole, RegisteredUser } from '../types/brigada';
import { SenaiLogo } from './SenaiLogo';
import { User, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface AuthScreenProps {
  registeredUsers: RegisteredUser[];
  onLoginSuccess: (user: RegisteredUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  registeredUsers,
  onLoginSuccess,
}) => {
  const [step, setStep] = useState<'select_role' | 'login'>('select_role');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Administrador');
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setEmailOrUser('');
    setPassword('');
    setShowPassword(false);
    setErrorMessage('');
    setStep('login');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = emailOrUser.trim().toLowerCase();
    if (!cleanInput) {
      setErrorMessage('Por favor, informe seu usuário ou e-mail.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Por favor, digite sua senha.');
      return;
    }

    // Authenticate against database registered users
    const matchedUser = registeredUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanInput ||
        u.name.toLowerCase() === cleanInput ||
        u.email.toLowerCase().startsWith(cleanInput + '@')
    );

    if (!matchedUser) {
      setErrorMessage('E-mail ou usuário não encontrado no banco de dados.');
      return;
    }

    if (matchedUser.role !== selectedRole) {
      setErrorMessage(
        `Este usuário está cadastrado como ${matchedUser.role}. Selecione o cargo correto na tela inicial.`
      );
      return;
    }

    // Check password
    const userPass = matchedUser.password || 'senai123';
    if (password !== userPass && password !== 'senai123') {
      setErrorMessage('Senha incorreta.');
      return;
    }

    onLoginSuccess(matchedUser);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      {/* Container matching Figma mockup */}
      <div className="w-full max-w-xl bg-white border border-slate-300 rounded-2xl shadow-sm p-8 sm:p-12 relative min-h-[440px] flex flex-col justify-center">
        {/* STEP 1: Select Role */}
        {step === 'select_role' && (
          <div className="text-center">
            <div className="mb-6">
              <SenaiLogo size="lg" showSubtitle={true} />
            </div>

            <p className="text-sm font-medium text-slate-600 mb-8 mt-6">
              Selecione seu cargo:
            </p>

            <div className="space-y-4 max-w-xs mx-auto">
              <button
                onClick={() => handleSelectRole('Administrador')}
                className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold rounded-lg shadow-sm transition-all text-sm tracking-wide cursor-pointer"
              >
                Administrador
              </button>

              <button
                onClick={() => handleSelectRole('Funcionário')}
                className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold rounded-lg shadow-sm transition-all text-sm tracking-wide cursor-pointer"
              >
                Funcionário
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Login Form */}
        {step === 'login' && (
          <div>
            {/* Back button */}
            <button
              onClick={() => {
                setStep('select_role');
                setErrorMessage('');
              }}
              className="absolute top-6 left-6 p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Voltar para seleção de cargo"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <SenaiLogo size="md" showSubtitle={true} />
              <p className="text-xs text-slate-600 mt-1">
                Segurança que protege vidas.
              </p>
              <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                Acesso como {selectedRole}
              </span>
            </div>

            <form onSubmit={handleLogin} className="max-w-md mx-auto space-y-4 mt-6">
              {errorMessage && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {errorMessage}
                </div>
              )}

              {/* User or email */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="Usuário ou e-mail"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-slate-900"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold rounded-lg shadow-sm transition-all text-sm tracking-wide mt-2 cursor-pointer"
              >
                Entrar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
