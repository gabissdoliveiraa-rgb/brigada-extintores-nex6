/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_RECIPIENT_EMAIL,
  SCOPES,
  buildAttentionEmailContent,
  buildRawMimeEmail,
  extractRegisteredRecipientEmails,
  getUnsentAttentionExtinguishers,
  markAttentionAlertsSent,
  syncSentAttentionMapWithCurrentExtinguishers,
} from './gmailAlert';
import { Extinguisher } from '../types/brigada';

test('gmailAlert keeps minimal gmail.send scope', () => {
  assert.equal(ALERT_RECIPIENT_EMAIL, 'halloouii@gmail.com');
  assert.deepEqual(SCOPES, ['https://www.googleapis.com/auth/gmail.send']);
});

test('extractRegisteredRecipientEmails extracts valid deduplicated emails from database users', () => {
  const result = extractRegisteredRecipientEmails([
    { email: ' melissajesus@senaisp.edu.br ' },
    { email: 'joaosouza@senaisp.edu.br' },
    { email: 'MELISSAJESUS@senaisp.edu.br' },
    { email: 'invalido' },
    { email: '' },
    { email: 'brigadista@senaisp.edu.br' },
  ]);

  assert.deepEqual(result, [
    'melissajesus@senaisp.edu.br',
    'joaosouza@senaisp.edu.br',
    'brigadista@senaisp.edu.br',
  ]);
});

test('buildAttentionEmailContent builds descriptive subject and body for Atenção extinguisher', () => {
  const sample: Extinguisher[] = [
    {
      id: 'ext_1',
      code: '012311',
      type: 'Água',
      location: 'Mecânica corredor ímpar',
      floor: 'Térreo',
      capacity: '10L',
      status: 'Atenção',
      expirationDate: '11/02/2029',
      nextInspectionDate: '05/12/2026',
    },
  ];

  const { subject, bodyText } = buildAttentionEmailContent(sample, 'Melissa Jesus');
  assert.match(subject, /012311/);
  assert.match(bodyText, /012311/);
  assert.match(bodyText, /05\/12\/2026/);
  assert.match(bodyText, /Melissa Jesus/);

  const raw = buildRawMimeEmail(
    ['melissajesus@senaisp.edu.br', 'joaosouza@senaisp.edu.br'],
    subject,
    bodyText
  );
  assert.ok(raw.length > 20);
  assert.equal(raw.includes('+'), false);
  assert.equal(raw.includes('/'), false);

  const normalizedB64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(normalizedB64, 'base64').toString('utf-8');
  assert.match(
    decoded,
    /To: melissajesus@senaisp\.edu\.br, joaosouza@senaisp\.edu\.br/
  );
});

test('attention alert deduplication tracks sent alerts and resets when returning to Em dia', () => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0,
  };

  const extAttention: Extinguisher = {
    id: 'ext_99',
    code: '999001',
    type: 'CO2',
    location: 'Lab A',
    floor: '1º andar',
    capacity: '6kg',
    status: 'Atenção',
    nextInspectionDate: '25/11/2026',
  };

  assert.equal(getUnsentAttentionExtinguishers([extAttention]).length, 1);

  markAttentionAlertsSent([extAttention]);
  assert.equal(getUnsentAttentionExtinguishers([extAttention]).length, 0);

  // Returning to Em dia clears marker so future Atenção triggers again
  syncSentAttentionMapWithCurrentExtinguishers([
    { ...extAttention, status: 'Em dia', nextInspectionDate: '25/11/2027' },
  ]);
  assert.equal(getUnsentAttentionExtinguishers([extAttention]).length, 1);
});
