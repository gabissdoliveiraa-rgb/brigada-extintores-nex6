/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Extinguisher, Notice } from '../types/brigada';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import {
  ALERT_RECIPIENT_EMAIL,
  ServerAlertStatus,
  getAccessToken,
  getConfiguredApiBaseUrl,
  getEmailJsConfig,
  getSignedInGoogleUser,
  googleSignIn,
  initAuth,
  logoutGoogleAuth,
  saveAutoEmailDeliverySettings,
  sendTestEmailViaEmailJs,
} from '../services/gmailAlert';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  ArrowLeft,
  AlertTriangle,
  Mail,
  Send,
  LogOut,
  CheckCircle2,
  Server,
  Settings,
  Globe,
  Loader2,
  X,
} from 'lucide-react';
import { ViewTab } from './Sidebar';

interface NoticesViewProps {
  isAdmin?: boolean;
  adminEmail?: string;
  notices: Notice[];
  extinguishers?: Extinguisher[];
  recipientEmails?: string[];
  serverAlertStatus?: ServerAlertStatus;
  onNavigate: (tab: ViewTab) => void;
  onOpenAttentionEmailModal?: (items: Extinguisher[]) => void;
  onRefreshAlertStatus?: () => void;
  onShowToast?: (message: string) => void;
}

export const NoticesView: React.FC<NoticesViewProps> = ({
  isAdmin = false,
  adminEmail = '',
  notices,
  extinguishers = [],
  recipientEmails = [],
  serverAlertStatus,
  onNavigate,
  onOpenAttentionEmailModal,
  onRefreshAlertStatus,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<'Todos' | 'Vencido' | 'A vencer'>('Todos');
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getAccessToken());
  const [googleEmail, setGoogleEmail] = useState<string | null>(
    () => getSignedInGoogleUser()?.email || null
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin-only GitHub Pages / EmailJS & External Backend configuration state
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [serviceId, setServiceId] = useState(() => getEmailJsConfig()?.serviceId || '');
  const [templateId, setTemplateId] = useState(() => getEmailJsConfig()?.templateId || '');
  const [publicKey, setPublicKey] = useState(() => getEmailJsConfig()?.publicKey || '');
  const [senderEmail, setSenderEmail] = useState(
    () => getEmailJsConfig()?.senderEmail || 'nex6empresa@gmail.com'
  );
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getConfiguredApiBaseUrl() || '');
  const [testRecipient, setTestRecipient] = useState(
    () => adminEmail || recipientEmails[0] || ALERT_RECIPIENT_EMAIL
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsub = initAuth(
      (u) => {
        setNeedsAuth(false);
        setGoogleEmail(u.email || null);
      },
      () => {
        setNeedsAuth(true);
        setGoogleEmail(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (showAutoConfig) {
      const cfg = getEmailJsConfig();
      if (cfg) {
        setServiceId(cfg.serviceId);
        setTemplateId(cfg.templateId);
        setPublicKey(cfg.publicKey);
        if (cfg.senderEmail) setSenderEmail(cfg.senderEmail);
      }
      setApiBaseUrl(getConfiguredApiBaseUrl() || '');
    }
  }, [showAutoConfig]);

  const attentionExtinguishers = extinguishers.filter(
    (e) => e.status === 'Atenção'
  );

  const effectiveRecipients =
    recipientEmails.length > 0 ? recipientEmails : [ALERT_RECIPIENT_EMAIL];

  const isAutoServerActive = Boolean(serverAlertStatus?.autoEmailConfigured);
  const isEmailJsActive = serverAlertStatus?.provider === 'emailjs';
  const isStaticHost = Boolean(serverAlertStatus?.isStaticHost);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setNeedsAuth(false);
        setGoogleEmail(res.user.email || null);
      }
    } catch {
      setAuthError('Falha ao conectar conta Google. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogleAuth();
    setNeedsAuth(true);
    setGoogleEmail(null);
  };

  const handleSaveAutoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSavingConfig(true);
    setConfigFeedback(null);

    const hasAnyEmailJsField =
      serviceId.trim() || templateId.trim() || publicKey.trim();
    if (
      hasAnyEmailJsField &&
      (!serviceId.trim() || !templateId.trim() || !publicKey.trim())
    ) {
      setConfigFeedback({
        type: 'error',
        text: 'Para usar o EmailJS, preencha Service ID, Template ID e Public Key.',
      });
      setIsSavingConfig(false);
      return;
    }

    const { cloudSynced } = await saveAutoEmailDeliverySettings({
      emailjs: hasAnyEmailJsField
        ? {
            serviceId: serviceId.trim(),
            templateId: templateId.trim(),
            publicKey: publicKey.trim(),
            senderEmail: senderEmail.trim() || undefined,
          }
        : null,
      apiBaseUrl: apiBaseUrl.trim() || null,
    });

    onRefreshAlertStatus?.();
    const msg = hasAnyEmailJsField || apiBaseUrl.trim()
      ? cloudSynced
        ? 'Configuração de envio automático salva e sincronizada na nuvem!'
        : 'Configuração de envio automático salva neste navegador!'
      : 'Configuração de envio automático removida.';
    setConfigFeedback({ type: 'success', text: msg });
    onShowToast?.(msg);
    setIsSavingConfig(false);
  };

  const handleTestEmailJsSend = async () => {
    if (!isAdmin) return;
    if (!serviceId.trim() || !templateId.trim() || !publicKey.trim()) {
      setConfigFeedback({
        type: 'error',
        text: 'Preencha Service ID, Template ID e Public Key antes de testar o envio.',
      });
      return;
    }
    setIsTestingSend(true);
    setConfigFeedback(null);

    const result = await sendTestEmailViaEmailJs(
      {
        serviceId: serviceId.trim(),
        templateId: templateId.trim(),
        publicKey: publicKey.trim(),
        senderEmail: senderEmail.trim() || undefined,
      },
      testRecipient,
      adminEmail || 'Administrador SENAI'
    );

    setIsTestingSend(false);
    if (result.success) {
      await saveAutoEmailDeliverySettings({
        emailjs: {
          serviceId: serviceId.trim(),
          templateId: templateId.trim(),
          publicKey: publicKey.trim(),
          senderEmail: senderEmail.trim() || undefined,
        },
        apiBaseUrl: apiBaseUrl.trim() || null,
      });
      onRefreshAlertStatus?.();
      const okMsg = `E-mail de teste enviado com sucesso para ${testRecipient.trim()}! Envio automático ativado no GitHub Pages.`;
      setConfigFeedback({ type: 'success', text: okMsg });
      onShowToast?.(okMsg);
    } else {
      setConfigFeedback({
        type: 'error',
        text: result.error || 'Falha ao enviar e-mail de teste via EmailJS.',
      });
    }
  };

  const filteredNotices = notices.filter((n) => {
    if (filter === 'Todos') return true;
    return n.status === filter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header matching MacBook Air - 19 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('inicio')}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          aria-label="Voltar para início"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
            Avisos
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Confira todos os avisos, pendências e alertas por e-mail do sistema.
          </p>
        </div>
      </div>

      {/* Email Notification Card for Atenção Extinguishers */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-amber-900 font-bold text-sm">
              <Mail className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Alertas por E-mail para Extintores em Atenção ({attentionExtinguishers.length})
              </span>
              {!isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-slate-700 border border-slate-300">
                  Envio exclusivo para Administradores
                </span>
              ) : isAutoServerActive ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isEmailJsActive ? (
                    <Globe className="w-3 h-3" />
                  ) : (
                    <Server className="w-3 h-3" />
                  )}
                  {isEmailJsActive
                    ? `Envio Automático Ativo via EmailJS (${serverAlertStatus?.senderEmail})`
                    : `Envio Automático Ativo (${serverAlertStatus?.senderEmail})`}
                </span>
              ) : isStaticHost ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-amber-800 border border-amber-300">
                  Configure o EmailJS para envio automático no GitHub Pages
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-amber-800 border border-amber-300">
                  Envio via Gmail conectado ou configure EmailJS
                </span>
              )}
            </div>
            <p className="text-xs text-amber-800">
              {!isAdmin
                ? 'Apenas usuários com perfil Administrador podem disparar alertas automáticos ou manuais por e-mail.'
                : isAutoServerActive
                ? `Assim que qualquer extintor entra em Atenção (perto de vencer), o sistema envia o alerta automaticamente ${isEmailJsActive ? 'direto pelo navegador (EmailJS)' : 'em segundo plano'} para os ${effectiveRecipients.length} e-mail(s) cadastrados no banco.`
                : isStaticHost
                ? 'No GitHub Pages não há servidor Node.js rodando. Clique em "Configurar Envio" ao lado para ativar o EmailJS gratuito (funciona direto no navegador) ou informar a URL do servidor backend.'
                : `Quando um extintor entra no status Atenção (perto de vencer), o alerta é preparado para os ${effectiveRecipients.length} e-mail(s) cadastrados em Banco de Dados & E-mails.`}
            </p>
            {isAdmin && authError && (
              <p className="text-xs text-red-600 font-medium">{authError}</p>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowAutoConfig((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  {showAutoConfig
                    ? 'Fechar Configuração'
                    : isAutoServerActive
                    ? 'Configurar Envio'
                    : 'Configurar Envio (GitHub Pages)'}
                </span>
              </button>

              {!isAutoServerActive && !isStaticHost && (
                needsAuth ? (
                  <GoogleSignInButton
                    onClick={handleGoogleLogin}
                    loading={isLoggingIn}
                    label="Conectar Gmail"
                  />
                ) : (
                  <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-3 py-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{googleEmail || 'Gmail conectado'}</span>
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                      title="Desconectar Gmail"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}

              {onOpenAttentionEmailModal && (
                <button
                  type="button"
                  disabled={attentionExtinguishers.length === 0}
                  onClick={() => {
                    if (!isAutoServerActive && isStaticHost && !getEmailJsConfig()) {
                      setShowAutoConfig(true);
                      onShowToast?.(
                        'Configure o EmailJS abaixo para disparar e-mails automáticos pelo GitHub Pages.'
                      );
                      return;
                    }
                    onOpenAttentionEmailModal(attentionExtinguishers);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isAutoServerActive
                      ? `Reenviar Agora (${attentionExtinguishers.length})`
                      : `Enviar Alerta (${attentionExtinguishers.length})`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Admin-only Configuration Drawer for GitHub Pages Automatic Email */}
        {isAdmin && showAutoConfig && (
          <form
            onSubmit={handleSaveAutoConfig}
            className="bg-white border border-amber-200 rounded-xl p-4 sm:p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configuração de Envio Automático no GitHub Pages
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permite ao Administrador enviar alertas automáticos direto da página estática do GitHub Pages sem precisar fazer login com o Google.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoConfig(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Fechar painel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800">
                Passo rápido (EmailJS gratuito — 200 envios/mês):
              </p>
              <p>
                1. Crie uma conta em <strong>emailjs.com</strong> e conecte o Gmail remetente (ex.: <span className="font-mono">nex6empresa@gmail.com</span>) em <em>Email Services</em> para obter o <strong>Service ID</strong>.
              </p>
              <p>
                2. Em <em>Email Templates</em>, crie um template com <strong>To Email</strong> = <code className="bg-white px-1 rounded border">{'{{to_email}}'}</code>, <strong>Subject</strong> = <code className="bg-white px-1 rounded border">{'{{subject}}'}</code> e corpo <code className="bg-white px-1 rounded border">{'{{message}}'}</code> para obter o <strong>Template ID</strong>.
              </p>
              <p>
                3. Copie sua <strong>Public Key</strong> em <em>Account → General</em> e preencha abaixo (ou defina as variáveis <code className="bg-white px-1 rounded border">VITE_EMAILJS_*</code> nas Variables do repositório GitHub).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  EmailJS Service ID
                </label>
                <input
                  type="text"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  placeholder="ex: service_abc123"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  EmailJS Template ID
                </label>
                <input
                  type="text"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="ex: template_xyz789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  EmailJS Public Key
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ex: aBcDeFgHiJkLmNoP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail remetente exibido (opcional)
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="nex6empresa@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  URL de Servidor Backend Próprio (opcional — substitui EmailJS se informado)
                </label>
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://seu-servidor-node.onrender.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Test box */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2 border-t border-slate-100">
              <div className="flex-1">
                <label className="block font-semibold text-slate-700 mb-1">
                  Testar envio EmailJS para:
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="halloouii@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <button
                type="button"
                onClick={handleTestEmailJsSend}
                disabled={isTestingSend || isSavingConfig}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold rounded-lg text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isTestingSend ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Testar Envio</span>
                  </>
                )}
              </button>
              <button
                type="submit"
                disabled={isSavingConfig || isTestingSend}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-bold rounded-lg text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSavingConfig ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Configuração</span>
                )}
              </button>
            </div>

            {configFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium border ${
                  configFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {configFeedback.text}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['Todos', 'Vencido', 'A vencer'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === st
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table Card (MacBook Air - 19) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-700 font-semibold text-xs">
                <th className="pb-3 px-3">Tipo</th>
                <th className="pb-3 px-3">Descrição</th>
                <th className="pb-3 px-3">Data</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNotices.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-xs text-slate-400"
                  >
                    Nenhum aviso ou pendência encontrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredNotices.map((notice) => (
                  <tr
                    key={notice.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 text-slate-800 font-medium">
                        <span className="text-red-600 shrink-0">
                          {notice.type.includes('Recarga') ? (
                            <ExtinguisherIcon size={18} />
                          ) : (
                            <AlertTriangle size={18} />
                          )}
                        </span>
                        <span>{notice.type}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      {notice.description}
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-mono text-xs tabular-nums">
                      {notice.date}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-3 py-0.5 text-xs font-semibold rounded-md border ${
                          notice.status === 'A vencer'
                            ? 'border-amber-400 text-amber-700 bg-amber-50/50'
                            : 'border-red-400 text-red-700 bg-red-50/50'
                        }`}
                      >
                        {notice.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
