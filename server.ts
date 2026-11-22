/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function stripControlChars(value: unknown, maxLen = 200): string {
  return String(value ?? '')
    .replace(/[\r\n\x00-\x1F\x7F]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

interface SessionPayload {
  userId: string;
  email: string;
  role: 'Administrador' | 'Funcionário';
  exp: number;
}

function issueServerSessionToken(
  userId: string,
  email: string,
  role: 'Administrador' | 'Funcionário'
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload: SessionPayload = { userId, email, role, exp: expiresAt };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

function verifyServerSessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      !decoded ||
      !decoded.userId ||
      !decoded.email ||
      (decoded.role !== 'Administrador' && decoded.role !== 'Funcionário') ||
      typeof decoded.exp !== 'number' ||
      decoded.exp < Date.now()
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(
  bucket: string,
  ip: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

interface AlertExtinguisherPayload {
  id?: string;
  code: string;
  type: string;
  capacity?: string;
  floor: string;
  location: string;
  status: string;
  nextInspectionDate?: string;
  expirationDate?: string;
}

function getEmailProviderConfig() {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || '465');
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const resendFrom = (process.env.RESEND_FROM || '').trim();

  if (smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp' as const,
      senderEmail: smtpUser,
      smtpHost,
      smtpPort,
      smtpPass,
    };
  }

  if (resendApiKey && resendFrom) {
    return {
      configured: true,
      provider: 'resend' as const,
      senderEmail: resendFrom,
      resendApiKey,
    };
  }

  return {
    configured: false,
    provider: null,
    senderEmail: null,
  };
}

function sanitizeRecipients(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const item of recipients) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      valid.push(trimmed);
    }
  }
  return valid;
}

function buildAlertEmailBody(
  extinguishers: AlertExtinguisherPayload[],
  operatorName?: string
) {
  const count = extinguishers.length;
  const firstCode = stripControlChars(extinguishers[0]?.code, 40);
  const subject =
    count === 1
      ? `[SENAI Brigada] Alerta de Atenção: Extintor #${firstCode} próximo do vencimento`
      : `[SENAI Brigada] Alerta de Atenção: ${count} extintores próximos do vencimento`;

  const lines = extinguishers.map((ext, idx) => {
    const code = stripControlChars(ext.code, 40);
    const type = stripControlChars(ext.type, 50);
    const capacity = stripControlChars(ext.capacity, 30);
    const floor = stripControlChars(ext.floor, 60);
    const location = stripControlChars(ext.location, 120);
    const nextInsp = stripControlChars(ext.nextInspectionDate || '-', 30);
    const expDate = stripControlChars(ext.expirationDate || '-', 30);
    const status = stripControlChars(ext.status, 30);

    return `${idx + 1}. Extintor #${code} (${type}${capacity ? ` - ${capacity}` : ''})
   - Pavimento/Local: ${floor} — ${location}
   - Próx. Inspeção: ${nextInsp} | Validade: ${expDate}
   - Status: ${status}`;
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const cleanOperator = stripControlChars(operatorName, 80);

  const text = [
    'Olá,',
    '',
    'Este é um aviso automático do Sistema Brigada & Extintores SENAI.',
    count === 1
      ? 'O seguinte extintor encontra-se com o status ATENÇÃO (próximo do vencimento) e requer inspeção ou manutenção preventiva:'
      : `Os seguintes ${count} extintores encontram-se com o status ATENÇÃO (próximos do vencimento) e requerem inspeção ou manutenção preventiva:`,
    '',
    ...lines,
    '',
    `Data do envio: ${dateStr} às ${timeStr}`,
    cleanOperator ? `Registrado por: ${cleanOperator}` : '',
    '',
    'Atenciosamente,',
    'Brigada de Incêndio & SST - SENAI',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { subject, text };
}

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return false;
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;

  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return true;

  if (process.env.APP_URL) {
    try {
      if (new URL(process.env.APP_URL).origin === origin) return true;
    } catch {
      // Ignore malformed APP_URL
    }
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(), geolocation=()'
    );

    if (req.path.startsWith('/api/')) {
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      if (origin && isAllowedCorsOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }

    next();
  });

  app.use(express.json({ limit: '512kb' }));

  // Issue short-lived signed session token for authenticated app users
  app.post('/api/auth/session', (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkIpRateLimit('auth_session', clientIp, 30, 15 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'Muitas solicitações de sessão. Tente novamente em alguns minutos.',
      });
      return;
    }

    const body = req.body as {
      userId?: string;
      email?: string;
      role?: string;
    };
    const userId = stripControlChars(body?.userId, 128);
    const email = stripControlChars(body?.email, 160);
    const role = body?.role;

    if (
      !userId ||
      !EMAIL_REGEX.test(email) ||
      (role !== 'Administrador' && role !== 'Funcionário')
    ) {
      res.status(400).json({
        success: false,
        error: 'Dados de sessão inválidos.',
      });
      return;
    }

    const { token, expiresAt } = issueServerSessionToken(userId, email, role);
    res.json({ success: true, token, expiresAt });
  });

  // Check whether server-side automatic email sender is configured
  app.get('/api/alerts/status', (_req, res) => {
    const cfg = getEmailProviderConfig();
    res.json({
      autoEmailConfigured: cfg.configured,
      provider: cfg.provider,
      senderEmail: cfg.senderEmail,
    });
  });

  // Automatically dispatch attention alerts to all registered DB emails
  app.post('/api/alerts/send-attention', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const session = verifyServerSessionToken(bearerToken);
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Sessão não autenticada para disparo de alertas.',
      });
      return;
    }

    if (session.role !== 'Administrador') {
      res.status(403).json({
        success: false,
        forbidden: true,
        error: 'Apenas administradores têm permissão para enviar alertas automáticos por e-mail.',
      });
      return;
    }

    const clientIp = req.ip || 'unknown';
    if (!checkIpRateLimit('send_attention', clientIp, 10, 15 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'Limite de envios atingido temporariamente. Aguarde alguns minutos.',
      });
      return;
    }

    const cfg = getEmailProviderConfig();
    if (!cfg.configured) {
      res.status(503).json({
        success: false,
        notConfigured: true,
        error:
          'Remetente automático do servidor ainda não configurado (defina SMTP_USER e SMTP_PASS nos Secrets).',
      });
      return;
    }

    const body = req.body as {
      extinguishers?: AlertExtinguisherPayload[];
      recipients?: string[];
      operatorName?: string;
    };

    const rawExtinguishers = Array.isArray(body?.extinguishers)
      ? body.extinguishers
      : [];
    if (rawExtinguishers.length === 0 || rawExtinguishers.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Quantidade inválida de extintores informada (1 a 50).',
      });
      return;
    }
    const extinguishers = rawExtinguishers.slice(0, 50);

    const recipients = sanitizeRecipients(body?.recipients).slice(0, 50);
    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Nenhum e-mail válido cadastrado no banco de dados.',
      });
      return;
    }

    const { subject, text } = buildAlertEmailBody(
      extinguishers,
      body?.operatorName
    );

    try {
      if (cfg.provider === 'smtp') {
        const transporter = nodemailer.createTransport({
          host: cfg.smtpHost,
          port: cfg.smtpPort,
          secure: cfg.smtpPort === 465,
          auth: {
            user: cfg.senderEmail,
            pass: cfg.smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"SENAI Brigada & Extintores" <${cfg.senderEmail}>`,
          to: recipients.join(', '),
          subject,
          text,
        });

        res.json({
          success: true,
          provider: 'smtp',
          messageId: info.messageId,
          recipients,
        });
        return;
      }

      if (cfg.provider === 'resend') {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.senderEmail,
            to: recipients,
            subject,
            text,
          }),
        });

        if (!resendRes.ok) {
          const errData = (await resendRes.json().catch(() => ({}))) as {
            message?: string;
          };
          res.status(502).json({
            success: false,
            error:
              errData?.message ||
              `Falha ao enviar via Resend (HTTP ${resendRes.status}).`,
          });
          return;
        }

        const data = (await resendRes.json()) as { id?: string };
        res.json({
          success: true,
          provider: 'resend',
          messageId: data.id,
          recipients,
        });
      }
    } catch (err) {
      console.error('Erro no envio automático de e-mail:', err);
      res.status(500).json({
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Erro interno ao enviar e-mail automático pelo servidor.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // In dev middleware mode behind the preview proxy, Vite 8's default /@vite/client
    // attempts to connect a WebSocket to port 24678 and throws an unhandled rejection.
    // Serve an HMR-disabled client module with full CSS injection and zero WebSocket traffic.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript; charset=utf-8').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    invalidate: noop,
    decline: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SENAI Brigada server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
