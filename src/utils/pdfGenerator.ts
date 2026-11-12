/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Extinguisher, BrigadeMember, UserProfile, ActivityLogEntry } from '../types/brigada';
import { generateReportMetrics } from './brigadaLogic';

export interface PdfReportOptions {
  user: UserProfile;
  extinguishers: Extinguisher[];
  members: BrigadeMember[];
  period: 'Diário' | 'Semanal' | 'Mensal';
  selectedDate: string;
}

export function generatePdfReport({
  user,
  extinguishers,
  members,
  period,
  selectedDate,
}: PdfReportOptions): { success: boolean; filename: string } {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const metrics = generateReportMetrics(extinguishers);
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Header Banner (SENAI Red: #e30613)
    doc.setFillColor(227, 6, 19);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SENAI', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Serviço Nacional de Aprendizagem Industrial', 14, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BRIGADA & EXTINTORES', pageWidth - 14, 15, { align: 'right' });

    // 2. Report Sub-header & Title
    let currentY = 32;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RELATÓRIO TÉCNICO DE CONFORMIDADE E SEGURANÇA', 14, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Setor de Segurança e Saúde no Trabalho (SST) - SENAI-SP | Norma Regulamentadora NR-23`,
      14,
      currentY
    );

    // 3. Metadata Box
    currentY += 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Data de Emissão:', 18, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedDate, 48, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Periodicidade:', 18, currentY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(period, 48, currentY + 14);

    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Responsável Técnico:', 100, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${user.name} (${user.role})`, 138, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('E-mail de Contato:', 100, currentY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(user.email, 138, currentY + 14);

    // 4. KPI Cards
    currentY += 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Indicadores de Prontidão e Auditoria', 14, currentY);

    currentY += 4;
    const cardWidth = (pageWidth - 28 - 9) / 4;
    const cardHeight = 16;

    // Card 1: Total
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL EQUIPAMENTOS', 14 + cardWidth / 2, currentY + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${metrics.total}`, 14 + cardWidth / 2, currentY + 12, { align: 'center' });

    // Card 2: Regulares
    const card2X = 14 + cardWidth + 3;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(4, 120, 87);
    doc.text('EM DIA (CONFORMES)', card2X + cardWidth / 2, currentY + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${metrics.regular}`, card2X + cardWidth / 2, currentY + 12, { align: 'center' });

    // Card 3: A Vencer
    const card3X = card2X + cardWidth + 3;
    doc.setFillColor(254, 252, 232);
    doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text('A VENCER (30 DIAS)', card3X + cardWidth / 2, currentY + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${metrics.expiring}`, card3X + cardWidth / 2, currentY + 12, { align: 'center' });

    // Card 4: Vencidos
    const card4X = card3X + cardWidth + 3;
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(card4X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text('VENCIDOS / CRÍTICOS', card4X + cardWidth / 2, currentY + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${metrics.critical}`, card4X + cardWidth / 2, currentY + 12, { align: 'center' });

    currentY += cardHeight + 8;

    // 5. Equipment Inventory Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('2. Inventário Geral de Extintores de Incêndio', 14, currentY);

    const tableRows = extinguishers.map((ext) => [
      ext.code,
      ext.type,
      ext.floor,
      ext.location,
      ext.capacity,
      ext.status,
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Código', 'Tipo de Agente', 'Pavimento', 'Localização Específica', 'Capacidade', 'Status']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [227, 6, 19],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 24 },
        3: { cellWidth: 62 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw;
          if (val === 'Em dia') {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Atenção') {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // 6. Signatures block at the end
    const lastY = (doc as any).lastAutoTable?.finalY || currentY + 60;
    const availableSpace = doc.internal.pageSize.getHeight() - lastY;

    if (availableSpace < 40) {
      doc.addPage();
      currentY = 25;
    } else {
      currentY = lastY + 15;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Documento emitido eletronicamente pelo Sistema Brigada & Extintores SENAI para fins de conformidade legal.',
      14,
      currentY
    );

    currentY += 18;
    const signColWidth = (pageWidth - 28) / 2;

    // Line 1: User
    doc.setDrawColor(148, 163, 184);
    doc.line(20, currentY, 20 + signColWidth - 15, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(user.name, 20 + (signColWidth - 15) / 2, currentY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${user.role} - Brigada SENAI`, 20 + (signColWidth - 15) / 2, currentY + 9, { align: 'center' });

    // Line 2: SENAI SST
    const rightColStart = 14 + signColWidth + 5;
    doc.line(rightColStart, currentY, rightColStart + signColWidth - 15, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Coordenação de Segurança do Trabalho', rightColStart + (signColWidth - 15) / 2, currentY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Diretoria da Unidade SENAI-SP', rightColStart + (signColWidth - 15) / 2, currentY + 9, { align: 'center' });

    // 7. Save & Download the File
    const sanitizedDate = selectedDate.replace(/[/\\?%*:|"<>]/g, '-');
    const filename = `Relatorio_Brigada_Extintores_SENAI_${sanitizedDate}.pdf`;

    // Trigger client-side file download
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.rel = 'noopener';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          try {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(blobUrl);
          } catch {
            // Ignore clean up errors
          }
        }, 1500);
      } catch (e) {
        try {
          doc.save(filename);
        } catch {
          // Ignore save errors
        }
      }
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Erro ao gerar relatório PDF:', error);
    return { success: false, filename: '' };
  }
}

export interface ActivityHistoryPdfOptions {
  user: UserProfile;
  logs: ActivityLogEntry[];
  categoryFilter?: string;
  userFilter?: string;
}

export function generateActivityHistoryPdf({
  user,
  logs,
  categoryFilter = 'Todos',
  userFilter = 'Todos',
}: ActivityHistoryPdfOptions): { success: boolean; filename: string } {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const emitDate = new Date().toLocaleDateString('pt-BR');
    const emitTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Header Banner (SENAI Red: #e30613)
    doc.setFillColor(227, 6, 19);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SENAI', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Serviço Nacional de Aprendizagem Industrial', 14, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HISTÓRICO DE ATIVIDADES & AUDITORIA', pageWidth - 14, 15, { align: 'right' });

    // 2. Report Sub-header & Title
    let currentY = 32;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('REGISTRO CRONOLÓGICO DE OPERAÇÕES DO SISTEMA', 14, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Rastreabilidade de vistorias, alterações em extintores, equipe da brigada e acessos | Norma NR-23',
      14,
      currentY
    );

    // 3. Metadata Box
    currentY += 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    // Metadata items
    doc.setFont('helvetica', 'bold');
    doc.text('Data de Emissão:', 18, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${emitDate} às ${emitTime}`, 46, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Emitido por:', 18, currentY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${user.name} (${user.role})`, 46, currentY + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('Filtro Categoria:', 120, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(categoryFilter, 150, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Filtro Responsável:', 120, currentY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(userFilter, 150, currentY + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('Total de Registros:', 220, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${logs.length} registro(s)`, 250, currentY + 6);

    // 4. AutoTable for Activity Logs
    currentY += 21;
    const tableData = logs.map((l, index) => [
      String(index + 1),
      l.formattedDateTime || '-',
      `${l.userName}\n(${l.userRole})`,
      l.category,
      l.description,
      l.targetFloor || '-',
      l.targetCode ? `#${l.targetCode}` : '-',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Item',
          'Data / Horário',
          'Responsável',
          'Categoria',
          'Descrição da Atividade',
          'Local',
          'Extintor',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [227, 6, 19],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 38 },
        2: { cellWidth: 38 },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = String(data.cell.raw);
          if (val === 'Extintores' || val === 'Inspeções') {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Brigada' || val === 'Usuários') {
            data.cell.styles.textColor = [37, 99, 235];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // 5. Footer & Signature
    const lastY = (doc as any).lastAutoTable?.finalY || currentY + 60;
    const availableSpace = doc.internal.pageSize.getHeight() - lastY;
    let signY = lastY + 12;

    if (availableSpace < 35) {
      doc.addPage();
      signY = 25;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Documento de auditoria gerado pelo Sistema Brigada & Extintores SENAI para fiscalização e rastreabilidade legal.',
      14,
      signY
    );

    // Save & Trigger Download
    const sanitizedDate = emitDate.replace(/[/\\?%*:|"<>]/g, '-');
    const filename = `Historico_Atividades_SENAI_${sanitizedDate}.pdf`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.rel = 'noopener';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          try {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(blobUrl);
          } catch {
            // Ignore clean up errors
          }
        }, 1500);
      } catch {
        doc.save(filename);
      }
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Erro ao gerar PDF do histórico:', error);
    return { success: false, filename: '' };
  }
}
