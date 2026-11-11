/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReferenceItem, TccData } from '../types/tcc';

/**
 * Formats a given number of seconds into "MM:SS" format.
 */
export function formatTimerSeconds(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculates remaining progress percentage from 0 to 100%.
 */
export function calculateTimerProgress(currentRemaining: number, totalDuration: number): number {
  if (totalDuration <= 0) return 0;
  const ratio = (currentRemaining / totalDuration) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

/**
 * Formats an academic bibliographic reference into standard ABNT style.
 * Example: SILVA, João. Título do Trabalho. São Paulo: Editora, 2024.
 */
export function formatAbntCitation(ref: {
  author: string;
  title: string;
  year: number;
  source: string;
}): string {
  const authorUpper = (ref.author || '').trim().toUpperCase();
  const cleanTitle = (ref.title || '').trim();
  const cleanSource = (ref.source || '').trim();
  const year = ref.year || new Date().getFullYear();

  return `${authorUpper}. ${cleanTitle}. ${cleanSource}, ${year}.`;
}

/**
 * Calculates reading time in minutes based on average 200 words per minute.
 */
export function calculateReadTime(text: string, wordsPerMinute: number = 200): { wordCount: number; readTimeMinutes: number } {
  if (!text || typeof text !== 'string') {
    return { wordCount: 0, readTimeMinutes: 1 };
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / (wordsPerMinute || 200)));
  return { wordCount, readTimeMinutes };
}

/**
 * Searches and filters academic references by query string.
 */
export function filterReferences(refs: ReferenceItem[], query: string): ReferenceItem[] {
  if (!query || !query.trim()) return refs;
  const q = query.toLowerCase().trim();
  return refs.filter(
    (item) =>
      item.author.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.year.toString().includes(q) ||
      item.abntFormatted.toLowerCase().includes(q)
  );
}

/**
 * Validates essential fields of a TccData object.
 */
export function validateTccData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Dados inválidos ou vazios.'] };
  }

  const d = data as Partial<TccData>;

  if (!d.title || d.title.trim().length < 5) {
    errors.push('O título da pesquisa deve conter ao menos 5 caracteres.');
  }
  if (!d.studentName || d.studentName.trim().length < 3) {
    errors.push('O nome do autor/estudante é obrigatório.');
  }
  if (!d.institution || d.institution.trim().length < 2) {
    errors.push('A instituição de ensino é obrigatória.');
  }
  if (!d.abstractPt || d.abstractPt.trim().length < 20) {
    errors.push('O resumo em português deve conter ao menos 20 caracteres.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
