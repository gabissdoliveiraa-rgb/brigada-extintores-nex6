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
import { app, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  senderEmail?: string;
}

export interface ServerAlertStatus {
  autoEmailConfigured: boolean;
  provider: 'smtp' | 'resend' | 'emailjs' | null;
  senderEmail: string | null;
  apiBaseUrl?: string | null;
  isStaticHost?: boolean;
}

const EMAILJS_STORAGE_KEY = 'senai_emailjs_config_v1';
const API_BASE_URL_STORAGE_KEY = 'senai_api_base_url_v1';

export function isStaticGitHubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith('.github.io');
}

function sanitizeApiBaseUrl(raw?: string | null): string | null {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const isHttps = parsed.protocol === 'https:';
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) return null;
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getConfiguredApiBaseUrl(): string | null {
  if (typeof localStorage !== 'undefined') {
    const localRaw = localStorage.getItem(API_BASE_URL_STORAGE_KEY);
    const localSanitized = sanitizeApiBaseUrl(localRaw);
    if (localSanitized) return localSanitized;
  }
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_API_BASE_URL as string | undefined)
      : undefined;
  return sanitizeApiBaseUrl(envUrl);
}

function resolveApiEndpointBase(): string | null {
  const configured = getConfiguredApiBaseUrl();
  if (configured) return configured;
  if (isStaticGitHubPagesHost()) return null;
  return '';
}

const DEFAULT_EMAILJS_CONFIG: EmailJsConfig = {
  serviceId: 'service_i5dw1hf',
  templateId: 'template_24f3d0i',
  publicKey: 'PonhsfXqNQvY03MnM',
  senderEmail: 'nex6empresa@gmail.com',
};

export function getEmailJsConfig(): EmailJsConfig | null {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const serviceId =
    ((env?.VITE_EMAILJS_SERVICE_ID as string | undefined) || '').trim() ||
    DEFAULT_EMAILJS_CONFIG.serviceId;
  const templateId =
    ((env?.VITE_EMAILJS_TEMPLATE_ID as string | undefined) || '').trim() ||
    DEFAULT_EMAILJS_CONFIG.templateId;
  const publicKey =
    ((env?.VITE_EMAILJS_PUBLIC_KEY as string | undefined) || '').trim() ||
    DEFAULT_EMAILJS_CONFIG.publicKey;
  const senderEmail =
    ((env?.VITE_EMAILJS_SENDER_EMAIL as string | undefined) || '').trim() ||
    DEFAULT_EMAILJS_CONFIG.senderEmail ||
    '';

  if (!serviceId || !templateId || !publicKey) return null;
  return {
    serviceId,
    templateId,
    publicKey,
    senderEmail: senderEmail || undefined,
  };
}

export async function saveAutoEmailDeliverySettings(options: {
  emailjs: EmailJsConfig | null;
  apiBaseUrl: string | null;
}): Promise<{ cloudSynced: boolean }> {
  const cleanEmailJs =
    options.emailjs &&
    options.emailjs.serviceId.trim() &&
    options.emailjs.templateId.trim() &&
    options.emailjs.publicKey.trim()
      ? {
          serviceId: options.emailjs.serviceId.trim().slice(0, 120),
          templateId: options.emailjs.templateId.trim().slice(0, 120),
          publicKey: options.emailjs.publicKey.trim().slice(0, 160),
          senderEmail: (options.emailjs.senderEmail || '').trim().slice(0, 160) || undefined,
        }
      : null;

  const cleanApiBaseUrl = sanitizeApiBaseUrl(options.apiBaseUrl);

  if (typeof localStorage !== 'undefined') {
    if (cleanEmailJs) {
      localStorage.setItem(EMAILJS_STORAGE_KEY, JSON.stringify(cleanEmailJs));
    } else {
      localStorage.removeItem(EMAILJS_STORAGE_KEY);
    }
    if (cleanApiBaseUrl) {
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, cleanApiBaseUrl);
    } else {
      localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    }
  }

  let cloudSynced = false;
  if (db && auth?.currentUser?.emailVerified) {
    try {
      await setDoc(doc(db, 'app_settings', 'email_alert'), {
        id: 'email_alert',
        emailjsServiceId: cleanEmailJs?.serviceId || '',
        emailjsTemplateId: cleanEmailJs?.templateId || '',
        emailjsPublicKey: cleanEmailJs?.publicKey || '',
        emailjsSenderEmail: cleanEmailJs?.senderEmail || '',
        apiBaseUrl: cleanApiBaseUrl || '',
        updatedAt: new Date().toISOString(),
      });
      cloudSynced = true;
    } catch {
      // Non-blocking: localStorage still persists the configuration
    }
  }

  return { cloudSynced };
}

export async function loadCloudAutoEmailSettings(): Promise<boolean> {
  if (!db || !auth?.currentUser?.emailVerified) return false;
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'email_alert'));
    if (!snap.exists()) return false;
    const data = snap.data() as {
      emailjsServiceId?: string;
      emailjsTemplateId?: string;
      emailjsPublicKey?: string;
      emailjsSenderEmail?: string;
      apiBaseUrl?: string;
    };

    if (typeof localStorage !== 'undefined') {
      if (data.emailjsServiceId && data.emailjsTemplateId && data.emailjsPublicKey) {
        localStorage.setItem(
          EMAILJS_STORAGE_KEY,
          JSON.stringify({
            serviceId: data.emailjsServiceId,
            templateId: data.emailjsTemplateId,
            publicKey: data.emailjsPublicKey,
            senderEmail: data.emailjsSenderEmail || undefined,
          })
        );
      }
      const validUrl = sanitizeApiBaseUrl(data.apiBaseUrl);
      if (validUrl) {
        localStorage.setItem(API_BASE_URL_STORAGE_KEY, validUrl);
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function postEmailJsTemplate(
  cfg: EmailJsConfig,
  toEmail: string,
  subject: string,
  bodyText: string,
  operatorName: string | undefined,
  extinguishersCount: number,
  extinguisherCodes: string
): Promise<Response> {
  return fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: cfg.serviceId.trim(),
      template_id: cfg.templateId.trim(),
      user_id: cfg.publicKey.trim(),
      template_params: {
        to_email: toEmail,
        email: toEmail,
        reply_to: cfg.senderEmail?.trim() || toEmail.split(',')[0].trim(),
        from_name: 'SENAI Brigada & Extintores',
        name: operatorName || 'SENAI Brigada & Extintores',
        operator_name: operatorName || 'Administrador SENAI',
        subject,
        title: subject,
        message: bodyText,
        extinguisher_count: String(extinguishersCount),
        extinguisher_codes: extinguisherCodes,
      },
    }),
  });
}

async function sendViaEmailJs(
  extinguishers: Extinguisher[],
  validRecipients: string[],
  operatorName: string | undefined,
  cfg: EmailJsConfig
): Promise<SendGmailAlertResult> {
  const { subject, bodyText } = buildAttentionEmailContent(
    extinguishers,
    operatorName
  );
  const codes = extinguishers.map((e) => e.code).join(', ');

  try {
    const delivered: string[] = [];
    let lastError = '';

    // Send individually to every registered database recipient so EmailJS never
    // silently drops addresses after the first comma in a multi-recipient field.
    const results = await Promise.allSettled(
      validRecipients.map(async (recipient) => {
        const res = await postEmailJsTemplate(
          cfg,
          recipient,
          subject,
          bodyText,
          operatorName,
          extinguishers.length,
          codes
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `HTTP ${res.status}`);
        }
        return recipient;
      })
    );

    for (const outcome of results) {
      if (outcome.status === 'fulfilled') {
        delivered.push(outcome.value);
      } else {
        lastError =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason);
      }
    }

    if (delivered.length > 0) {
      return {
        success: true,
        messageId: 'emailjs-ok',
        recipients: delivered,
      };
    }

    return {
      success: false,
      error:
        lastError ||
        'Falha ao enviar via EmailJS. Verifique Service ID, Template ID e Public Key.',
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro de conexão ao enviar e-mail via EmailJS.',
    };
  }
}

export async function sendTestEmailViaEmailJs(
  cfg: EmailJsConfig,
  recipientEmail: string,
  operatorName?: string
): Promise<SendGmailAlertResult> {
  const trimmedRecipient = recipientEmail.trim();
  if (!EMAIL_REGEX.test(trimmedRecipient)) {
    return {
      success: false,
      error: 'Informe um e-mail válido para receber o teste.',
    };
  }

  try {
    const res = await postEmailJsTemplate(
      cfg,
      trimmedRecipient,
      '[SENAI Brigada] Teste de Envio Automático (GitHub Pages)',
      'Olá,\n\nEste é um e-mail de teste confirmando que o envio automático de alertas do Sistema SENAI Brigada & Extintores está funcionando corretamente no navegador.\n\nAtenciosamente,\nBrigada de Incêndio & SST - SENAI',
      operatorName,
      1,
      'TESTE'
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error:
          errText ||
          `Falha no teste EmailJS (HTTP ${res.status}). Confira os IDs e as variáveis {{to_email}}, {{subject}} e {{message}} no template.`,
      };
    }

    return {
      success: true,
      messageId: 'emailjs-test-ok',
      recipients: [trimmedRecipient],
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro de rede ao testar envio via EmailJS.',
    };
  }
}

export function getInitialAlertStatus(): ServerAlertStatus {
  const isStaticHost = isStaticGitHubPagesHost();
  const configuredApiUrl = getConfiguredApiBaseUrl();
  const emailJsCfg = getEmailJsConfig();

  if (emailJsCfg) {
    return {
      autoEmailConfigured: true,
      provider: 'emailjs',
      senderEmail: emailJsCfg.senderEmail || 'nex6empresa@gmail.com',
      apiBaseUrl: configuredApiUrl,
      isStaticHost,
    };
  }

  return {
    autoEmailConfigured: false,
    provider: null,
    senderEmail: null,
    apiBaseUrl: configuredApiUrl,
    isStaticHost,
  };
}

export async function fetchServerAlertStatus(): Promise<ServerAlertStatus> {
  const isStaticHost = isStaticGitHubPagesHost();
  const apiBase = resolveApiEndpointBase();
  const configuredApiUrl = getConfiguredApiBaseUrl();

  if (apiBase !== null) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${apiBase}/api/alerts/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as Partial<ServerAlertStatus>;
          if (data.autoEmailConfigured) {
            return {
              autoEmailConfigured: true,
              provider: data.provider || 'smtp',
              senderEmail: data.senderEmail || null,
              apiBaseUrl: configuredApiUrl,
              isStaticHost,
            };
          }
        }
      }
    } catch {
      // Backend unavailable; fall through to EmailJS check
    }
  }

  const emailJsCfg = getEmailJsConfig();
  if (emailJsCfg) {
    return {
      autoEmailConfigured: true,
      provider: 'emailjs',
      senderEmail: emailJsCfg.senderEmail || 'nex6empresa@gmail.com',
      apiBaseUrl: configuredApiUrl,
      isStaticHost,
    };
  }

  return {
    autoEmailConfigured: false,
    provider: null,
    senderEmail: null,
    apiBaseUrl: configuredApiUrl,
    isStaticHost,
  };
}

let inMemoryServerSessionToken: string | null = null;

export async function establishServerSession(user: {
  id: string;
  email: string;
  role: string;
}): Promise<string | null> {
  const apiBase = resolveApiEndpointBase();
  if (apiBase === null) return null;

  try {
    const res = await fetch(`${apiBase}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    inMemoryServerSessionToken = data.token || null;
    return inMemoryServerSessionToken;
  } catch {
    return null;
  }
}

export function clearServerSession(): void {
  inMemoryServerSessionToken = null;
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

  const apiBase = resolveApiEndpointBase();
  const emailJsCfg = getEmailJsConfig();

  if (apiBase !== null) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (inMemoryServerSessionToken) {
        headers.Authorization = `Bearer ${inMemoryServerSessionToken}`;
      }

      const res = await fetch(`${apiBase}/api/alerts/send-attention`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          extinguishers,
          recipients: validRecipients,
          operatorName,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          messageId?: string;
          recipients?: string[];
          notConfigured?: boolean;
          error?: string;
        };

        if (res.ok && data.success) {
          return {
            success: true,
            messageId: data.messageId,
            recipients: data.recipients || validRecipients,
          };
        }

        if (data.notConfigured && emailJsCfg) {
          return await sendViaEmailJs(
            extinguishers,
            validRecipients,
            operatorName,
            emailJsCfg
          );
        }

        return {
          success: false,
          notConfigured: Boolean(data.notConfigured),
          error:
            data.error ||
            `Falha no envio automático pelo servidor (HTTP ${res.status}).`,
        };
      }
    } catch (err) {
      if (emailJsCfg) {
        return await sendViaEmailJs(
          extinguishers,
          validRecipients,
          operatorName,
          emailJsCfg
        );
      }
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Erro de conexão com o servidor ao enviar alerta automático.',
      };
    }
  }

  if (emailJsCfg) {
    return await sendViaEmailJs(
      extinguishers,
      validRecipients,
      operatorName,
      emailJsCfg
    );
  }

  return {
    success: false,
    notConfigured: true,
    error: isStaticGitHubPagesHost()
      ? 'Configure o EmailJS (ou a URL do servidor backend) na aba Avisos para habilitar o envio automático no GitHub Pages.'
      : 'Envio automático ainda não configurado.',
  };
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

