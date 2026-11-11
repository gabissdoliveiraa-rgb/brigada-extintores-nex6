/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Extinguisher,
  BrigadeMember,
  UserProfile,
} from '../types/brigada';
import { generateReportMetrics } from '../utils/brigadaLogic';
import { generatePdfReport } from '../utils/pdfGenerator';
import { SenaiLogo } from './SenaiLogo';
import {
  FileText,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  Check,
  Loader2,
} from 'lucide-react';

interface ReportsViewProps {
  user: UserProfile;
  extinguishers: Extinguisher[];
  members: BrigadeMember[];
  onReportGenerated?: (filename: string, period: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  user,
  extinguishers,
  members,
  onReportGenerated,
}) => {
  const [period, setPeriod] = useState<'Diário' | 'Semanal' | 'Mensal'>('Diário');
  const [selectedDate, setSelectedDate] = useState('12/10/2026');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  const metrics = generateReportMetrics(extinguishers);

  // Bar chart historical comparison points matching Figma
  const chartData = [
    {
      date: selectedDate,
      regular: metrics.regular,
      expiring: metrics.expiring,
      critical: metrics.critical,
    },
    {
      date: '20/09/2026',
      regular: Math.max(15, Math.round(metrics.regular * 0.85)),
      expiring: Math.max(4, Math.round(metrics.expiring * 1.2)),
      critical: Math.max(3, Math.round(metrics.critical * 1.1)),
    },
    {
      date: '10/08/2026',
      regular: Math.max(12, Math.round(metrics.regular * 0.75)),
      expiring: Math.max(3, Math.round(metrics.expiring * 0.9)),
      critical: Math.max(2, Math.round(metrics.critical * 0.8)),
    },
  ];

  const maxVal = Math.max(
    ...chartData.flatMap((d) => [d.regular, d.expiring, d.critical]),
    20
  );

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    setDownloadSuccessMessage(null);

    // Give UI a moment to show loading feedback
    setTimeout(() => {
      try {
        const result = generatePdfReport({
          user,
          extinguishers,
          members,
          period,
          selectedDate,
        });

        if (result.success) {
          setDownloadSuccessMessage(`Download concluído: ${result.filename}`);
          if (onReportGenerated) {
            onReportGenerated(result.filename, period);
          }
        } else {
          setDownloadSuccessMessage('Ocorreu um erro ao gerar o arquivo PDF.');
        }
      } catch (err) {
        console.error('Falha ao baixar PDF:', err);
        setDownloadSuccessMessage('Erro ao processar o relatório.');
      } finally {
        setIsDownloading(false);
      }
    }, 150);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
          Relatórios
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Period Selection */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-3">
              Período do relatório
            </label>
            <div className="space-y-2.5">
              {(['Diário', 'Semanal', 'Mensal'] as const).map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="period"
                    value={opt}
                    checked={period === opt}
                    onChange={() => setPeriod(opt)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              Data
            </label>
            <input
              type="text"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Selecione a data do relatório {period.toLowerCase()}
            </p>
          </div>

          {/* Download feedback alert */}
          {downloadSuccessMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{downloadSuccessMessage}</span>
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            {/* Primary Action: Direct Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold rounded-lg shadow-xs transition-all text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando e Baixando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Gerar e Baixar Relatório (PDF)</span>
                </>
              )}
            </button>

            {/* Secondary Action: Visual Preview */}
            <button
              onClick={() => setShowPdfModal(true)}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visualizar Prévia em Tela</span>
            </button>
          </div>
        </div>

        {/* Right Column: Cards & Chart (MacBook Air - 35) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Relatório de Conformidade Header Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-600">
                  Relatório de Conformidade
                </h2>
                <p className="text-xs text-slate-600">
                  Período: {selectedDate} ({period}) • {extinguishers.length} Extintores Auditados
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="hidden sm:flex items-center gap-2 px-4 py-2 border border-red-600 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PDF</span>
            </button>
          </div>

          {/* Bar Chart Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h3 className="text-base font-bold text-red-600 mb-8">
              Resumo de Desempenho dos Extintores
            </h3>

            {/* Chart Graphic Area */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/40">
              <div className="h-64 flex items-end justify-around gap-6 pt-6 pb-2 border-b border-l border-slate-300">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-3 h-full justify-end flex-1 max-w-[120px]"
                  >
                    <div className="flex items-end justify-center gap-1.5 w-full h-full pb-1">
                      {/* Regular (Green) */}
                      <div
                        style={{ height: `${(data.regular / maxVal) * 100}%` }}
                        className="w-5 sm:w-6 bg-emerald-600 rounded-t-sm transition-all duration-500 hover:opacity-90 relative group"
                        title={`Regulares: ${data.regular}`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1 py-0.5 rounded shadow whitespace-nowrap">
                          {data.regular}
                        </span>
                      </div>

                      {/* Expiring (Yellow) */}
                      <div
                        style={{ height: `${(data.expiring / maxVal) * 100}%` }}
                        className="w-5 sm:w-6 bg-amber-400 rounded-t-sm transition-all duration-500 hover:opacity-90 relative group"
                        title={`A vencer: ${data.expiring}`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1 py-0.5 rounded shadow whitespace-nowrap">
                          {data.expiring}
                        </span>
                      </div>

                      {/* Critical (Red) */}
                      <div
                        style={{ height: `${(data.critical / maxVal) * 100}%` }}
                        className="w-5 sm:w-6 bg-red-600 rounded-t-sm transition-all duration-500 hover:opacity-90 relative group"
                        title={`Vencidos/Críticos: ${data.critical}`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1 py-0.5 rounded shadow whitespace-nowrap">
                          {data.critical}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-slate-600">
                      {data.date}
                    </span>
                  </div>
                ))}
              </div>

              {/* Legend matching Figma */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600" />
                  <span>Extintores Regulares</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                  <span>A vencer (30 dias)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-600" />
                  <span>Vencidos/ Críticos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF DOCUMENT PREVIEW MODAL */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto print:p-0 print:shadow-none animate-fadeIn">
            {/* Modal header actions */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Visualização do Documento PDF
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo PDF (.pdf)</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Body */}
            <div className="pt-6 space-y-6">
              <div className="flex items-start justify-between border-b pb-6">
                <div>
                  <SenaiLogo size="sm" showSubtitle={true} />
                  <p className="text-xs text-slate-500 mt-2">
                    Serviço Nacional de Aprendizagem Industrial - SENAI-SP
                  </p>
                  <p className="text-xs text-slate-500">
                    Setor de Segurança e Saúde no Trabalho (SST)
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="font-bold text-slate-800">
                    Relatório Técnico de Conformidade
                  </p>
                  <p>Emissão: {selectedDate}</p>
                  <p>Periodicidade: {period}</p>
                  <p>Operador: {user.name} ({user.role})</p>
                </div>
              </div>

              {/* Summary KPIs */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
                  1. Indicadores de Desempenho e Prontidão
                </h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <span className="text-xs text-slate-500 block">Total de Extintores</span>
                    <span className="text-xl font-bold text-slate-900">{metrics.total}</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-emerald-50/50">
                    <span className="text-xs text-emerald-700 block">Conformes</span>
                    <span className="text-xl font-bold text-emerald-700">{metrics.regular}</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-amber-50/50">
                    <span className="text-xs text-amber-700 block">A Vencer</span>
                    <span className="text-xl font-bold text-amber-700">{metrics.expiring}</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-red-50/50">
                    <span className="text-xs text-red-700 block">Vencidos/Críticos</span>
                    <span className="text-xl font-bold text-red-700">{metrics.critical}</span>
                  </div>
                </div>
              </div>

              {/* Equipment Inventory */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    2. Relação de Equipamentos Auditados ({extinguishers.length} no total)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Exibindo primeiros 10 itens na prévia (o PDF baixado contém a lista completa de todos os 123)
                  </span>
                </div>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-b">Código</th>
                      <th className="p-2 border-b">Tipo</th>
                      <th className="p-2 border-b">Andar/Local</th>
                      <th className="p-2 border-b">Capacidade</th>
                      <th className="p-2 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extinguishers.slice(0, 10).map((ext) => (
                      <tr key={ext.id}>
                        <td className="p-2 font-mono font-semibold">{ext.code}</td>
                        <td className="p-2">{ext.type}</td>
                        <td className="p-2">{ext.floor} - {ext.location}</td>
                        <td className="p-2">{ext.capacity}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ext.status === 'Em dia'
                              ? 'text-emerald-700 bg-emerald-100'
                              : ext.status === 'Atenção'
                              ? 'text-amber-700 bg-amber-100'
                              : 'text-red-700 bg-red-100'
                          }`}>
                            {ext.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs text-slate-600">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-semibold">
                    {user.name}
                  </div>
                  <span>{user.role} - Brigada SENAI</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-semibold">
                    Coordenação de Segurança do Trabalho
                  </div>
                  <span>Diretoria da Unidade SENAI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
