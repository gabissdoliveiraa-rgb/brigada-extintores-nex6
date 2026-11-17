/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Extinguisher, UserProfile } from '../types/brigada';
import {
  ALERT_RECIPIENT_EMAIL,
  buildAttentionEmailContent,
  getAccessToken,
  getSignedInGoogleUser,
  googleSignIn,
  sendExtinguisherAttentionEmail,
} from '../services/gmailAlert';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  Mail,
  AlertTriangle,
  X,
  Send,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface AttentionEmailConfirmModalProps {
  isOpen: boolean;
  extinguishers: Extinguisher[];
  recipientEmails: string[];
  user: UserProfile;
  onClose: () => void;
  onEmailSent: (sentCount: number, codes: string[], recipients: string[]) => void;
}

export const AttentionEmailConfirmModal: React.FC<
  AttentionEmailConfirmModalProps
> = ({ isOpen, extinguishers, recipientEmails, user, onClose, onEmailSent }) => {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getAccessToken()));
  const [googleEmail, setGoogleEmail] = useState<string | null>(
    () => getSignedInGoogleUser()?.email || null
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHasToken(Boolean(getAccessToken()));
      setGoogleEmail(getSignedInGoogleUser()?.email || null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen || extinguishers.length === 0) return null;

  const effectiveRecipients =
    recipientEmails.length > 0 ? recipientEmails : [ALERT_RECIPIENT_EMAIL];

  const { subject, bodyText } = buildAttentionEmailContent(
    extinguishers,
    user.name
  );

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setHasToken(true);
        setGoogleEmail(res.user.email || null);
      }
    } catch (err) {
      console.error('Erro no login Google:', err);
      setErrorMsg(
        'Não foi possível conectar com sua conta Google. Verifique se o pop-up não foi bloqueado e tente novamente.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmSend = async () => {
    setIsSending(true);
    setErrorMsg(null);
    const result = await sendExtinguisherAttentionEmail(
      extinguishers,
      effectiveRecipients,
      user.name
    );
    setIsSending(false);

    if (result.success) {
      const sentTo = result.recipients || effectiveRecipients;
      setSuccessMsg(
        `Alerta enviado com sucesso para ${sentTo.length} e-mail(s) cadastrado(s): ${sentTo.join(', ')}!`
      );
      onEmailSent(
        extinguishers.length,
        extinguishers.map((e) => e.code),
        sentTo
      );
      setTimeout(() => {
        onClose();
      }, 1500);
      return;
    }

    if (result.needsReauth) {
      setHasToken(false);
    }
    setErrorMsg(
      result.error || 'Erro desconhecido ao enviar e-mail de alerta.'
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Enviar alerta de extintor em Atenção?
              </h3>
              <p className="text-xs text-slate-500">
                Envio para todos os e-mails cadastrados no banco de dados via Gmail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Fechar confirmação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient & Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="space-y-1.5">
            <span className="text-slate-500 font-semibold block">
              Destinatários cadastrados no banco ({effectiveRecipients.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {effectiveRecipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-semibold text-slate-800"
                >
                  <Mail className="w-3 h-3 text-red-600 shrink-0" />
                  {email}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
            <span className="text-slate-500 font-semibold">Assunto:</span>
            <span className="font-medium text-slate-800 text-right truncate max-w-[340px]">
              {subject}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 font-semibold">
              Extintores em Atenção:
            </span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md">
              {extinguishers.length}{' '}
              {extinguishers.length === 1 ? 'extintor' : 'extintores'}
            </span>
          </div>
        </div>

        {/* Affected Extinguishers List */}
        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {extinguishers.map((ext) => (
            <div
              key={ext.id}
              className="p-3 flex items-center justify-between gap-3 text-xs bg-white"
            >
              <div>
                <p className="font-bold text-slate-900 font-mono">
                  #{ext.code} • {ext.type}
                </p>
                <p className="text-slate-500">
                  {ext.floor} — {ext.location}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-700 font-semibold">
                  {ext.status}
                </span>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Próx.: {ext.nextInspectionDate || ext.expirationDate || '-'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Preview */}
        <div>
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Prévia da Mensagem
          </p>
          <pre className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">
            {bodyText}
          </pre>
        </div>

        {/* Auth Section if not connected yet */}
        {!hasToken ? (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Conecte sua conta Google para enviar o e-mail de alerta para os{' '}
                <strong>{effectiveRecipients.length} e-mail(s) cadastrados no banco</strong> via Gmail.
              </p>
            </div>
            <div className="shrink-0">
              <GoogleSignInButton
                onClick={handleGoogleConnect}
                loading={isConnecting}
                label="Conectar Gmail"
              />
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-800">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Gmail conectado{googleEmail ? `: ${googleEmail}` : ''}
            </span>
          </div>
        )}

        {/* Feedback */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmSend}
            disabled={!hasToken || isSending || Boolean(successMsg)}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando via Gmail...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar e Enviar E-mail</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
