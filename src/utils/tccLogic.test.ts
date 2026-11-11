/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimerSeconds,
  calculateTimerProgress,
  formatAbntCitation,
  calculateReadTime,
  filterReferences,
  validateTccData,
} from './tccLogic';

test('formatTimerSeconds formats seconds to MM:SS string correctly', () => {
  assert.equal(formatTimerSeconds(900), '15:00');
  assert.equal(formatTimerSeconds(65), '01:05');
  assert.equal(formatTimerSeconds(0), '00:00');
  assert.equal(formatTimerSeconds(-10), '00:00');
});

test('calculateTimerProgress returns percentage bounded between 0 and 100', () => {
  assert.equal(calculateTimerProgress(450, 900), 50);
  assert.equal(calculateTimerProgress(900, 900), 100);
  assert.equal(calculateTimerProgress(0, 900), 0);
  assert.equal(calculateTimerProgress(-10, 900), 0);
  assert.equal(calculateTimerProgress(1000, 900), 100);
});

test('formatAbntCitation creates standard ABNT reference string', () => {
  const result = formatAbntCitation({
    author: 'Silva, João Lucas',
    title: 'Inteligência Artificial na Saúde',
    source: 'São Paulo: Blucher',
    year: 2024,
  });
  assert.equal(result, 'SILVA, JOÃO LUCAS. Inteligência Artificial na Saúde. São Paulo: Blucher, 2024.');
});

test('calculateReadTime accurately calculates words and minutes', () => {
  const sample = 'Este é um parágrafo acadêmico de teste para avaliar a contagem precisa.';
  const { wordCount, readTimeMinutes } = calculateReadTime(sample);
  assert.equal(wordCount, 12);
  assert.equal(readTimeMinutes, 1);
});

test('filterReferences searches author, title and source case-insensitively', () => {
  const sampleRefs = [
    {
      id: '1',
      author: 'Russell, Stuart; Norvig, Peter',
      year: 2020,
      title: 'Artificial Intelligence: A Modern Approach',
      source: 'Pearson',
      abntFormatted: 'RUSSELL, Stuart; NORVIG, Peter. Artificial Intelligence. Pearson, 2020.',
    },
    {
      id: '2',
      author: 'Gil, Antonio Carlos',
      year: 2019,
      title: 'Como Elaborar Projetos de Pesquisa',
      source: 'Atlas',
      abntFormatted: 'GIL, Antonio Carlos. Como Elaborar Projetos de Pesquisa. Atlas, 2019.',
    },
  ];

  const results1 = filterReferences(sampleRefs, 'russell');
  assert.equal(results1.length, 1);
  assert.equal(results1[0].id, '1');

  const results2 = filterReferences(sampleRefs, 'pesquisa');
  assert.equal(results2.length, 1);
  assert.equal(results2[0].id, '2');

  const emptySearch = filterReferences(sampleRefs, '');
  assert.equal(emptySearch.length, 2);
});

test('validateTccData validates presence of mandatory fields', () => {
  const invalid = validateTccData({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 3);

  const valid = validateTccData({
    title: 'Desenvolvimento de Sistema Web para Telemedicina',
    studentName: 'Ana Beatriz Souza',
    institution: 'Universidade de São Paulo (USP)',
    abstractPt: 'Este trabalho apresenta um estudo aprofundado com mais de vinte caracteres para aprovação.',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});
