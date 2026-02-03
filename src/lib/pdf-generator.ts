// PDF Generation Service using jspdf and jspdf-autotable
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceItem, InvoiceTemplate, Report, Customer } from '../types/billing';
import { formatDate, formatCurrency } from './locale-config';
import { COMPANY_CONFIG } from './company-config';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

interface PDFOptions {
  includeHeader?: boolean;
  includeFooter?: boolean;
  includeLogo?: boolean;
}

// Draw the branded logo header
function drawSTHLogo(doc: jsPDF, x: number, y: number): number {
  // Company name in large bold italic with underline
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(51, 51, 51);
  doc.text(COMPANY_CONFIG.shortName, x, y);
  
  // Get width of text for underline
  const textWidth = doc.getTextWidth(COMPANY_CONFIG.shortName);
  
  // Draw underline
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.8);
  doc.line(x, y + 2, x + textWidth, y + 2);
  
  // Subtitle below
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY_CONFIG.subtitle.toUpperCase(), x, y + 10);
  
  return y + 20; // Return new Y position after logo
}

// Generate Invoice PDF
export async function generateInvoicePDF(
  invoice: Invoice,
  items: InvoiceItem[],
  customer: Customer,
  template: InvoiceTemplate | null,
  options: PDFOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [100, 108, 255]; // #646cff
  const textColor: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];

  // Header with S.T.H Logo
  if (options.includeHeader !== false) {
    // Draw branded S.T.H logo
    yPos = drawSTHLogo(doc, margin, yPos + 8);
    
    // Customer name below logo (like in the invoice image)
    if (template) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(51, 51, 51);
      doc.text(customer.name || '', margin, yPos);
      yPos += 6;
      
      // Customer address
      if (customer.address) {
        doc.text(customer.address, margin, yPos);
        yPos += 5;
      }
      if (customer.postal_code || customer.city) {
        doc.text(`${customer.postal_code || ''} ${customer.city || ''}`.trim(), margin, yPos);
        yPos += 5;
      }
    }
    yPos += 5;
  } else {
    // Fallback if no header
    yPos = drawSTHLogo(doc, margin, yPos + 8);
  }

  // Invoice Title "Rechnung" on right side (like in the image - italic gold/brown color)
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(180, 140, 80); // Gold/brown color matching the image
  doc.text('Rechnung', pageWidth - margin, margin + 10, { align: 'right' });

  // Invoice Details below "Rechnung" (right side)
  const rightCol = pageWidth - margin - 70;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  
  let detailsY = margin + 22;
  doc.text('DATUM:', rightCol, detailsY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.issue_date), rightCol + 25, detailsY);
  detailsY += 5;
  
  doc.setFont('helvetica', 'italic');
  doc.text('RE.-NR.', rightCol, detailsY);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, rightCol + 25, detailsY);
  detailsY += 8;
  
  // FÜR: Customer details on right side
  doc.setFont('helvetica', 'italic');
  doc.text('FÜR:', rightCol, detailsY);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name || '', rightCol + 25, detailsY);
  detailsY += 5;
  if (customer.address) {
    doc.text(customer.address, rightCol + 25, detailsY);
    detailsY += 5;
  }
  if (customer.postal_code || customer.city) {
    doc.text(`${customer.postal_code || ''} ${customer.city || ''}`.trim(), rightCol + 25, detailsY);
    detailsY += 8;
  }
  
  // ABSENDER: Sender details
  doc.setFont('helvetica', 'italic');
  doc.text('ABSENDER:', rightCol, detailsY);
  detailsY += 5;
  doc.setFont('helvetica', 'normal');
  if (template) {
    doc.text(template.company_name || COMPANY_CONFIG.shortName, rightCol + 25, detailsY - 5);
    if (template.company_address) {
      doc.text(template.company_address, rightCol + 25, detailsY);
      detailsY += 5;
    }
    if (template.company_postal_code || template.company_city) {
      doc.text(`${template.company_postal_code || ''} ${template.company_city || ''}`.trim(), rightCol + 25, detailsY);
      detailsY += 5;
    }
    if (template.company_phone) {
      doc.text(`Tel.: ${template.company_phone}`, rightCol + 25, detailsY);
    }
  }

  // Move yPos past the header section
  yPos = Math.max(yPos, detailsY + 15);

  // Period if available
  if (invoice.period_start && invoice.period_end) {
    doc.setFontSize(10);
    doc.setTextColor(...lightGray);
    doc.text(
      `Leistungszeitraum: ${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`,
      margin,
      yPos
    );
    yPos += 10;
  }

  // Items Table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.description,
    item.quantity.toFixed(2),
    item.unit || 'Stk.',
    formatCurrency(item.price_per_unit),
    `${item.tax_rate}%`,
    formatCurrency(item.line_total),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'MwSt.', 'Gesamt']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // Totals
  const totalsX = pageWidth - margin - 70;
  const totalsValueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  doc.text('Zwischensumme:', totalsX, yPos);
  doc.text(formatCurrency(invoice.subtotal), totalsValueX, yPos, { align: 'right' });
  yPos += 6;

  doc.text('MwSt.:', totalsX, yPos);
  doc.text(formatCurrency(invoice.tax_amount), totalsValueX, yPos, { align: 'right' });
  yPos += 6;

  // Divider line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, yPos, totalsValueX, yPos);
  yPos += 6;

  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Gesamtbetrag:', totalsX, yPos);
  doc.text(formatCurrency(invoice.total), totalsValueX, yPos, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  yPos += 15;

  // Notes
  if (invoice.notes) {
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text('Bemerkungen:', margin, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
    doc.text(splitNotes, margin, yPos);
    yPos += splitNotes.length * 4 + 5;
  }

  // Payment Terms
  if (template?.payment_terms) {
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    const splitTerms = doc.splitTextToSize(template.payment_terms, pageWidth - 2 * margin);
    doc.text(splitTerms, margin, yPos);
    yPos += splitTerms.length * 4;
  }

  // Bank Details
  if (template && (template.company_bank_name || template.company_bank_iban)) {
    yPos += 10;
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);
    doc.text('Bankverbindung:', margin, yPos);
    yPos += 4;
    if (template.company_bank_name) {
      doc.text(`Bank: ${template.company_bank_name}`, margin, yPos);
      yPos += 4;
    }
    if (template.company_bank_iban) {
      doc.text(`IBAN: ${template.company_bank_iban}`, margin, yPos);
      yPos += 4;
    }
    if (template.company_bank_bic) {
      doc.text(`BIC: ${template.company_bank_bic}`, margin, yPos);
    }
  }

  // Footer
  if (options.includeFooter !== false) {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(...lightGray);
    
    if (template?.footer_text) {
      doc.text(template.footer_text, pageWidth / 2, footerY, { align: 'center' });
    }
    
    // Page number
    doc.text(
      `Seite 1 von 1`,
      pageWidth - margin,
      footerY,
      { align: 'right' }
    );
  }

  return doc;
}

// Generate Report PDF
export async function generateReportPDF(
  report: Report,
  _template: InvoiceTemplate | null,
  options: PDFOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [100, 108, 255];
  const textColor: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];

  // Header with S.T.H Logo
  if (options.includeHeader !== false) {
    yPos = drawSTHLogo(doc, margin, yPos + 8);
  } else {
    yPos = drawSTHLogo(doc, margin, yPos + 8);
  }

  // Report Title
  doc.setFontSize(18);
  doc.setTextColor(...textColor);
  doc.text(report.title, margin, yPos);
  yPos += 8;

  // Report Info
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.text(
    `Berichtsnummer: ${report.report_number} | Zeitraum: ${formatDate(report.period_start)} - ${formatDate(report.period_end)}`,
    margin,
    yPos
  );
  yPos += 15;

  // Summary if available
  if (report.data.summary) {
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Zusammenfassung', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;

    const summaryData = [
      ['Gesamtstunden', `${Math.floor(report.data.summary.total_hours)}h ${Math.round((report.data.summary.total_hours % 1) * 60)}min`],
      ['Straßen gesamt', report.data.summary.total_streets.toString()],
      ['Erledigt', report.data.summary.streets_completed.toString()],
      ['In Bearbeitung', report.data.summary.streets_in_progress.toString()],
      ['Offen', report.data.summary.streets_open.toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      body: summaryData,
      theme: 'plain',
      bodyStyles: {
        fontSize: 10,
        textColor: textColor,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { halign: 'left' },
      },
      margin: { left: margin },
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Work Logs Table if available
  if (report.data.work_logs && report.data.work_logs.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Arbeitsstunden', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;

    const workLogData = report.data.work_logs.map((log) => [
      formatDate(log.date),
      log.user_name,
      log.start_time,
      log.end_time,
      `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}min`,
      log.street || '-',
      log.notes || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Datum', 'Mitarbeiter', 'Von', 'Bis', 'Dauer', 'Straße', 'Notizen']],
      body: workLogData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
      },
      margin: { left: margin, right: margin },
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Streets Status Table if available
  if (report.data.streets && report.data.streets.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Straßen-Status', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;

    const streetsData = report.data.streets.map((street) => {
      const lastStatus = street.status_history[street.status_history.length - 1];
      return [
        street.name,
        street.city,
        street.area,
        lastStatus?.status || '-',
        lastStatus?.assigned_users.join(', ') || '-',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Straße', 'Stadt', 'Gebiet', 'Status', 'Zugewiesen']],
      body: streetsData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
      },
      margin: { left: margin, right: margin },
    });
  }

  return doc;
}

// Download PDF
export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

// Open PDF in new tab
export function openPDFInNewTab(doc: jsPDF): void {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// Get PDF as base64
export function getPDFBase64(doc: jsPDF): string {
  return doc.output('datauristring');
}
