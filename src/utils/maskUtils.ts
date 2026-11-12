/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats digits into Brazilian phone mask: (XX) 9XXXX-XXXX or (XX) XXXX-XXXX
 */
export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;

  // If mobile number (starts with 9 or length > 10)
  const isMobile = digits[2] === '9' || digits.length > 10;

  if (isMobile) {
    if (digits.length <= 7) {
      const suffix = digits.length === 7 ? '-' : '';
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}${suffix}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  // Landline (8 digits + DDD = 10 digits)
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/**
 * Formats digits into Brazilian date mask: DD/MM/AAAA
 */
export function formatDate(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Validates Brazilian phone number (10 or 11 digits)
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return { valid: false, error: 'Telefone é obrigatório' };
  }
  if (digits.length < 10) {
    return { valid: false, error: 'Telefone inválido (mínimo 10 dígitos com DDD)' };
  }
  if (digits.length > 11) {
    return { valid: false, error: 'Telefone inválido (máximo 11 dígitos)' };
  }
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return { valid: false, error: 'DDD inválido' };
  }
  return { valid: true };
}

/**
 * Validates Email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'E-mail é obrigatório' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'E-mail inválido (ex: usuario@senaisp.edu.br)' };
  }
  return { valid: true };
}

/**
 * Validates Date format (DD/MM/AAAA) with realistic day and month
 */
export function validateDate(dateStr: string): { valid: boolean; error?: string } {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return { valid: false, error: 'Data de nascimento é obrigatória' };
  }
  const parts = trimmed.split('/');
  if (parts.length !== 3) {
    return { valid: false, error: 'Data inválida (formato: DD/MM/AAAA)' };
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, error: 'Data inválida' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Mês inválido (deve ser entre 01 e 12)' };
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Dia inválido (deve ser entre 01 e 31)' };
  }
  const currentYear = new Date().getFullYear();
  if (year < 1920 || year > currentYear) {
    return { valid: false, error: `Ano deve estar entre 1920 e ${currentYear}` };
  }
  return { valid: true };
}

/**
 * Validates Full Name (minimum 3 characters, letters only)
 */
export function validateName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nome completo é obrigatório' };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: 'Nome deve ter pelo menos 3 caracteres' };
  }
  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'Nome não pode conter números' };
  }
  return { valid: true };
}

export const SENAI_SECTOR_OPTIONS = [
  'Térreo - Recepção e Portaria',
  'Térreo - Cantina e Oficinas',
  '1º andar',
  '2º andar',
  '3º andar',
  '4º andar',
  '5º andar',
  '6º andar',
  'Geral - Toda a unidade SENAI',
];
