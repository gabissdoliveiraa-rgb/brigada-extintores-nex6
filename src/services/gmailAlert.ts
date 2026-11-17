/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { app } from '../firebase';
import { Extinguisher, RegisteredUser } from '../types/brigada';
import { getDaysUntilDate } from '../utils/brigadaLogic';

export const ALERT_RECIPIENT_EMAIL = 'halloouii@gmail.com';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Extracts deduplicated, valid e-mail addresses registered in the database.
 */
export function extractRegisteredRecipientEmails(
  users: Array<Pick<RegisteredUser, 'email'>>
): string[] {
  const seen = new Set<string>();
  const validEmails: string[] = [];

  for (const user of users) {
    const email = (user.email || '').trim();
    if (!email || !EMAIL_REGEX.test(email)) continue;
    const normalized = email.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      validEmails.push(email);
    }
  }

  return validEmails;
}

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory only access token caching (never localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getSignedInGoogleUser = (): User | null => {
  return cachedGoogleUser;
};

export const logoutGoogleAuth = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedGoogleUser = null;
};

export function encodeUtf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Utf8Subject(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildAttentionEmailContent(
  extinguishers: Extinguisher[],
  operatorName?: string
): { subject: string; bodyText: string } {
  const count = extinguishers.length;
  const subject =
    count === 1
      ? `[SENAI Brigada] Alerta de Atenção: Extintor #${extinguishers[0].code} próximo do vencimento`
      : `[SENAI Brigada] Alerta de Atenção: ${count} extintores próximos do vencimento`;

  const lines = extinguishers.map((ext, idx) => {
    const days = getDaysUntilDate(ext.nextInspectionDate || ext.expirationDate);
    const prazo =
      days === null
        ? ext.nextInspectionDate || ext.expirationDate || 'Data não informada'
        : days < 0
        ? `Vencido há ${Math.abs(days)} dia(s)`
        : days === 0
        ? 'Vence hoje'
        : `Vence em ${days} dia(s)`;

    return `${idx + 1}. Extintor #${ext.code} (${ext.type} - ${ext.capacity})
   - Pavimento/Local: ${ext.floor} — ${ext.location}
   - Próx. Inspeção: ${ext.nextInspectionDate || '-'} | Validade: ${ext.expirationDate || '-'}
   - Status: ${ext.status} (${prazo})`;
  });

  const bodyText = [
    'Olá,',
    '',
    'Este é um aviso automático do Sistema Brigada & Extintores SENAI.',
    count === 1
      ? 'O seguinte extintor encontra-se com o status ATENÇÃO (próximo do vencimento) e requer inspeção ou manutenção preventiva:'
      : `Os seguintes ${count} extintores encontram-se com o status ATENÇÃO (próximos do vencimento) e requerem inspeção ou manutenção preventiva:`,
    '',
    ...lines,
    '',
    `Data do envio: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    operatorName ? `Registrado por: ${operatorName}` : '',
    '',
    'Atenciosamente,',
    'Brigada de Incêndio & SST - SENAI',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { subject, bodyText };
}

export function buildRawMimeEmail(
  to: string | string[],
  subject: string,
  bodyText: string
): string {
  const toHeader = Array.isArray(to) ? to.join(', ') : to;
  const mime = [
    `To: ${toHeader}`,
    `Subject: ${encodeRfc2047Utf8Subject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyText,
  ].join('\r\n');

  return encodeUtf8ToBase64Url(mime);
}

export interface SendGmailAlertResult {
  success: boolean;
  messageId?: string;
  recipients?: string[];
  needsReauth?: boolean;
  error?: string;
}

export async function sendExtinguisherAttentionEmail(
  extinguishers: Extinguisher[],
  recipientEmails: string[],
  operatorName?: string
): Promise<SendGmailAlertResult> {
  if (!extinguishers || extinguishers.length === 0) {
    return {
      success: false,
      error: 'Nenhum extintor em atenção selecionado para envio.',
    };
  }

  const validRecipients = extractRegisteredRecipientEmails(
    recipientEmails.map((email) => ({ email }))
  );

  if (validRecipients.length === 0) {
    return {
      success: false,
      error:
        'Nenhum e-mail válido cadastrado no banco de dados para receber o alerta.',
    };
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      needsReauth: true,
      error: 'Conecte sua conta Google (Gmail) para autorizar o envio do alerta.',
    };
  }

  const { subject, bodyText } = buildAttentionEmailContent(
    extinguishers,
    operatorName
  );
  const raw = buildRawMimeEmail(validRecipients, subject, bodyText);

  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (res.status === 401 || res.status === 403) {
      cachedAccessToken = null;
      return {
        success: false,
        needsReauth: true,
        error:
          'Sua sessão do Gmail expirou ou precisa de permissão de envio. Faça login novamente com o Google.',
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error:
          errData?.error?.message ||
          `Falha ao enviar e-mail pelo Gmail (HTTP ${res.status}).`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
      recipients: validRecipients,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro de conexão ao tentar enviar e-mail via Gmail.',
    };
  }
}

export interface ServerAlertStatus {
  autoEmailConfigured: boolean;
  provider: 'smtp' | 'resend' | null;
  senderEmail: string | null;
}

export async function fetchServerAlertStatus(): Promise<ServerAlertStatus> {
  try {
    const res = await fetch('/api/alerts/status');
    if (!res.ok) {
      return { autoEmailConfigured: false, provider: null, senderEmail: null };
    }
    const data = (await res.json()) as Partial<ServerAlertStatus>;
    return {
      autoEmailConfigured: Boolean(data.autoEmailConfigured),
      provider: data.provider || null,
      senderEmail: data.senderEmail || null,
    };
  } catch {
    return { autoEmailConfigured: false, provider: null, senderEmail: null };
  }
}

export async function sendAutomaticServerAttentionEmail(
  extinguishers: Extinguisher[],
  recipientEmails: string[],
  operatorName?: string
): Promise<SendGmailAlertResult & { notConfigured?: boolean }> {
  if (!extinguishers || extinguishers.length === 0) {
    return {
      success: false,
      error: 'Nenhum extintor em atenção selecionado para envio.',
    };
  }

  const validRecipients = extractRegisteredRecipientEmails(
    recipientEmails.map((email) => ({ email }))
  );

  if (validRecipients.length === 0) {
    return {
      success: false,
      error:
        'Nenhum e-mail válido cadastrado no banco de dados para receber o alerta.',
    };
  }

  try {
    const res = await fetch('/api/alerts/send-attention', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extinguishers,
        recipients: validRecipients,
        operatorName,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      messageId?: string;
      recipients?: string[];
      notConfigured?: boolean;
      error?: string;
    };

    if (!res.ok || !data.success) {
      return {
        success: false,
        notConfigured: Boolean(data.notConfigured),
        error:
          data.error || `Falha no envio automático pelo servidor (HTTP ${res.status}).`,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
      recipients: data.recipients || validRecipients,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro de conexão com o servidor ao enviar alerta automático.',
    };
  }
}

export async function sendTestServerEmail(
  recipientEmails: string[],
  operatorName?: string
): Promise<SendGmailAlertResult & { notConfigured?: boolean }> {
  const validRecipients = extractRegisteredRecipientEmails(
    recipientEmails.map((email) => ({ email }))
  );

  try {
    const res = await fetch('/api/alerts/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: validRecipients,
        operatorName,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      messageId?: string;
      recipients?: string[];
      notConfigured?: boolean;
      error?: string;
    };

    if (!res.ok || !data.success) {
      return {
        success: false,
        notConfigured: Boolean(data.notConfigured),
        error:
          data.error ||
          `Falha ao enviar e-mail de teste pelo servidor (HTTP ${res.status}).`,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
      recipients: data.recipients || validRecipients,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro de conexão com o servidor ao enviar e-mail de teste.',
    };
  }
}

const SENT_ALERTS_STORAGE_KEY = 'senai_auto_email_sent_v1';

function buildExtinguisherAlertSignature(ext: Extinguisher): string {
  return `${ext.status}|${ext.nextInspectionDate || ''}|${ext.expirationDate || ''}`;
}

function readSentAlertsMap(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SENT_ALERTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeSentAlertsMap(map: Record<string, string>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SENT_ALERTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function getUnsentAttentionExtinguishers(
  extinguishers: Extinguisher[]
): Extinguisher[] {
  const map = readSentAlertsMap();
  return extinguishers.filter((ext) => {
    if (ext.status !== 'Atenção') return false;
    const sig = buildExtinguisherAlertSignature(ext);
    return map[ext.code] !== sig;
  });
}

export function markAttentionAlertsSent(extinguishers: Extinguisher[]) {
  const map = readSentAlertsMap();
  for (const ext of extinguishers) {
    if (ext.status === 'Atenção') {
      map[ext.code] = buildExtinguisherAlertSignature(ext);
    }
  }
  writeSentAlertsMap(map);
}

export function syncSentAttentionMapWithCurrentExtinguishers(
  extinguishers: Extinguisher[]
) {
  const map = readSentAlertsMap();
  let changed = false;
  for (const ext of extinguishers) {
    if (ext.status !== 'Atenção' && map[ext.code]) {
      delete map[ext.code];
      changed = true;
    }
  }
  if (changed) {
    writeSentAlertsMap(map);
  }
}

