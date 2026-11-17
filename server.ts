/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const subject =
    count === 1
      ? `[SENAI Brigada] Alerta de Atenção: Extintor #${extinguishers[0].code} próximo do vencimento`
      : `[SENAI Brigada] Alerta de Atenção: ${count} extintores próximos do vencimento`;

  const lines = extinguishers.map((ext, idx) => {
    return `${idx + 1}. Extintor #${ext.code} (${ext.type}${ext.capacity ? ` - ${ext.capacity}` : ''})
   - Pavimento/Local: ${ext.floor} — ${ext.location}
   - Próx. Inspeção: ${ext.nextInspectionDate || '-'} | Validade: ${ext.expirationDate || '-'}
   - Status: ${ext.status}`;
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

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
    operatorName ? `Registrado por: ${operatorName}` : '',
    '',
    'Atenciosamente,',
    'Brigada de Incêndio & SST - SENAI',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { subject, text };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

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

    const extinguishers = Array.isArray(body?.extinguishers)
      ? body.extinguishers
      : [];
    if (extinguishers.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Nenhum extintor em atenção informado para envio.',
      });
      return;
    }

    const recipients = sanitizeRecipients(body?.recipients);
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
      server: { middlewareMode: true },
      appType: 'spa',
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
