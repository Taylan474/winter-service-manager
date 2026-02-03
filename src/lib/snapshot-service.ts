// Snapshot Service - Archive system that stores data, not documents
// PDFs are regenerated on-demand from snapshot data

import { supabase } from './supabase';
import { generateInvoicePDF, generateReportPDF, downloadPDF } from './pdf-generator';
import type { Invoice, InvoiceItem, Customer, InvoiceTemplate, Report, Snapshot } from '../types/billing';

export type SnapshotType = 'invoice' | 'report' | 'street_status' | 'work_log';

export interface SnapshotData {
  invoice?: Invoice;
  items?: InvoiceItem[];
  customer?: Customer;
  template?: InvoiceTemplate;
  report?: Report;
  streets?: unknown[];
  work_logs?: unknown[];
  metadata?: Record<string, unknown>;
}

// Create a snapshot of data at a point in time
export async function createSnapshot(
  type: SnapshotType,
  referenceId: string,
  data: SnapshotData,
  notes?: string
): Promise<Snapshot | null> {
  const { data: snapshot, error } = await supabase
    .from('snapshots')
    .insert({
      snapshot_type: type,
      reference_id: referenceId,
      snapshot_date: new Date().toISOString().split('T')[0],
      data: data,
      notes: notes || `${type} snapshot`,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating snapshot:', error);
    return null;
  }

  return snapshot;
}

// Get a specific snapshot
export async function getSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error) {
    console.error('Error fetching snapshot:', error);
    return null;
  }

  return data;
}

// Get all snapshots for a reference (e.g., all versions of an invoice)
export async function getSnapshotsForReference(
  referenceId: string,
  type?: SnapshotType
): Promise<Snapshot[]> {
  let query = supabase
    .from('snapshots')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('snapshot_type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching snapshots:', error);
    return [];
  }

  return data || [];
}

// Get all snapshots of a specific type
export async function getSnapshotsByType(type: SnapshotType): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('snapshot_type', type)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching snapshots:', error);
    return [];
  }

  return data || [];
}

// Regenerate PDF from snapshot data
export async function regeneratePDFFromSnapshot(snapshot: Snapshot): Promise<void> {
  const data = snapshot.data as unknown as SnapshotData;

  if (snapshot.snapshot_type === 'invoice') {
    if (!data.invoice || !data.items || !data.customer) {
      throw new Error('Missing invoice data in snapshot');
    }

    const doc = await generateInvoicePDF(
      data.invoice,
      data.items,
      data.customer,
      data.template || null
    );

    const filename = `Rechnung_${data.invoice.invoice_number}_${snapshot.created_at.split('T')[0]}.pdf`;
    downloadPDF(doc, filename);
  } else if (snapshot.snapshot_type === 'report') {
    if (!data.report) {
      throw new Error('Missing report data in snapshot');
    }

    const doc = await generateReportPDF(
      data.report,
      data.template || null
    );

    const filename = `Bericht_${data.report.report_number}_${snapshot.created_at.split('T')[0]}.pdf`;
    downloadPDF(doc, filename);
  } else {
    throw new Error(`Cannot generate PDF for snapshot type: ${snapshot.snapshot_type}`);
  }
}

// Create invoice with automatic snapshot
export async function createInvoiceWithSnapshot(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[],
  customer: Customer,
  template: InvoiceTemplate | null
): Promise<{ invoice: Invoice; snapshot: Snapshot } | null> {
  // Insert invoice
  const { data: newInvoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();

  if (invoiceError || !newInvoice) {
    console.error('Error creating invoice:', invoiceError);
    return null;
  }

  // Insert items
  const itemsWithInvoiceId = items.map((item) => ({
    ...item,
    invoice_id: newInvoice.id,
  }));

  const { data: newItems, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsWithInvoiceId)
    .select();

  if (itemsError) {
    console.error('Error creating invoice items:', itemsError);
    // Cleanup invoice
    await supabase.from('invoices').delete().eq('id', newInvoice.id);
    return null;
  }

  // Create snapshot
  const snapshot = await createSnapshot(
    'invoice',
    newInvoice.id,
    {
      invoice: newInvoice,
      items: newItems as InvoiceItem[],
      customer,
      template: template || undefined,
    },
    `Invoice ${newInvoice.invoice_number} created`
  );

  if (!snapshot) {
    console.warn('Failed to create snapshot for invoice');
  }

  return {
    invoice: newInvoice,
    snapshot: snapshot!,
  };
}

// Create report with automatic snapshot
export async function createReportWithSnapshot(
  report: Omit<Report, 'id' | 'created_at' | 'updated_at'>,
  template: InvoiceTemplate | null
): Promise<{ report: Report; snapshot: Snapshot } | null> {
  // Insert report
  const { data: newReport, error: reportError } = await supabase
    .from('reports')
    .insert(report)
    .select()
    .single();

  if (reportError || !newReport) {
    console.error('Error creating report:', reportError);
    return null;
  }

  // Create snapshot
  const snapshot = await createSnapshot(
    'report',
    newReport.id,
    {
      report: newReport,
      template: template || undefined,
    },
    `Report ${newReport.report_number} created`
  );

  if (!snapshot) {
    console.warn('Failed to create snapshot for report');
  }

  return {
    report: newReport,
    snapshot: snapshot!,
  };
}

// Archive old data (move to snapshots and optionally delete)
export async function archiveStreetStatus(
  streetId: string,
  statusData: unknown,
  deleteOriginal = false
): Promise<Snapshot | null> {
  const snapshot = await createSnapshot(
    'street_status',
    streetId,
    { streets: [statusData] },
    `Street status archived`
  );

  if (snapshot && deleteOriginal) {
    // Delete original street status records if needed
    await supabase
      .from('street_statuses')
      .delete()
      .eq('street_id', streetId);
  }

  return snapshot;
}

// Bulk archive work logs for a period
export async function archiveWorkLogs(
  periodStart: string,
  periodEnd: string,
  workLogs: unknown[]
): Promise<Snapshot | null> {
  const referenceId = `worklogs_${periodStart}_${periodEnd}`;
  
  return createSnapshot(
    'work_log',
    referenceId,
    {
      work_logs: workLogs,
      metadata: {
        period_start: periodStart,
        period_end: periodEnd,
        archived_at: new Date().toISOString(),
        count: workLogs.length,
      },
    },
    `Work logs ${periodStart} to ${periodEnd}`
  );
}

// Delete old snapshots (retention policy)
export async function cleanupOldSnapshots(
  type: SnapshotType,
  retentionDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('snapshots')
    .delete()
    .eq('snapshot_type', type)
    .lt('created_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Error cleaning up snapshots:', error);
    return 0;
  }

  return data?.length || 0;
}
