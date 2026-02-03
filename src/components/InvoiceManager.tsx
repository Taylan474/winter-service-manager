import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/data-fetch';
import { fetchCustomersWithCache, fetchTemplatesWithCache } from '../lib/data-cache';
import { generateInvoicePDF, downloadPDF, openPDFInNewTab } from '../lib/pdf-generator';
import ConfirmModal from './ConfirmModal';
import AlertModal from './AlertModal';
import DateInput from './DateInput';
import type { Invoice, InvoiceItem, Customer, InvoiceTemplate, InvoiceFormData, InvoiceItemFormData } from '../types/billing';

type InvoiceManagerProps = {
  role: 'admin' | 'mitarbeiter' | 'gast' | null;
  userId: string;
};

const STATUS_LABELS: Record<Invoice['status'], string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  overdue: 'Überfällig',
};

const emptyItem: InvoiceItemFormData = {
  description: '',
  quantity: 1,
  unit: 'Stk.',
  price_per_unit: 0,
  tax_rate: 19,
};

export default function InvoiceManager({ role, userId }: InvoiceManagerProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" }>({ show: false, title: "", message: "" });
  
  // Form state
  const [formData, setFormData] = useState<InvoiceFormData>({
    customer_id: '',
    template_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    notes: '',
    internal_notes: '',
    items: [{ ...emptyItem }],
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error: fetchError } = await withRetry(async () => {
        return await supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(*),
            template:invoice_templates(*)
          `)
          .order('created_at', { ascending: false });
      });
      
      if (fetchError) throw fetchError;
      setInvoices(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Fehler beim Laden der Rechnungen. Bitte aktualisieren Sie die Seite.');
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomersWithCache(false, true);
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await fetchTemplatesWithCache(false);
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchInvoices(), fetchCustomers(), fetchTemplates()]);
    setLoading(false);
  }, [fetchInvoices, fetchCustomers, fetchTemplates]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleOpenModal = async (invoice?: Invoice) => {
    if (invoice) {
      // Load invoice items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');
      
      setEditingInvoice(invoice);
      setFormData({
        customer_id: invoice.customer_id,
        template_id: invoice.template_id || '',
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        period_start: invoice.period_start || '',
        period_end: invoice.period_end || '',
        notes: invoice.notes || '',
        internal_notes: invoice.internal_notes || '',
        items: items?.length ? items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'Stk.',
          price_per_unit: item.price_per_unit,
          tax_rate: item.tax_rate,
        })) : [{ ...emptyItem }],
      });
    } else {
      setEditingInvoice(null);
      const defaultTemplate = templates.find(t => t.is_default);
      setFormData({
        customer_id: '',
        template_id: defaultTemplate?.id || '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period_start: '',
        period_end: '',
        notes: '',
        internal_notes: '',
        items: [{ ...emptyItem }],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingInvoice(null);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    
    formData.items.forEach(item => {
      const lineTotal = item.quantity * item.price_per_unit;
      subtotal += lineTotal;
      taxAmount += lineTotal * ((item.tax_rate || 19) / 100);
    });
    
    return {
      subtotal,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
    };
  };

  const handleSave = async () => {
    if (!formData.customer_id || formData.items.length === 0) return;
    
    setSaving(true);
    const totals = calculateTotals();
    
    if (editingInvoice) {
      // Update invoice
      const { error } = await supabase
        .from('invoices')
        .update({
          customer_id: formData.customer_id,
          template_id: formData.template_id || null,
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          period_start: formData.period_start || null,
          period_end: formData.period_end || null,
          notes: formData.notes || null,
          internal_notes: formData.internal_notes || null,
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total: totals.total,
        })
        .eq('id', editingInvoice.id);
      
      if (!error) {
        // Delete old items and insert new
        await supabase.from('invoice_items').delete().eq('invoice_id', editingInvoice.id);
        
        const itemsToInsert = formData.items.map((item, index) => ({
          invoice_id: editingInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'Stk.',
          price_per_unit: item.price_per_unit,
          tax_rate: item.tax_rate || 19,
          line_total: item.quantity * item.price_per_unit,
          sort_order: index,
        }));
        
        await supabase.from('invoice_items').insert(itemsToInsert);
      }
    } else {
      // Generate invoice number
      const { data: numberData } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = numberData || `RE-${Date.now()}`;
      
      // Create invoice
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: formData.customer_id,
          template_id: formData.template_id || null,
          status: 'draft',
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          period_start: formData.period_start || null,
          period_end: formData.period_end || null,
          notes: formData.notes || null,
          internal_notes: formData.internal_notes || null,
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total: totals.total,
          created_by: userId,
        })
        .select()
        .single();
      
      if (!error && newInvoice) {
        // Insert items
        const itemsToInsert = formData.items.map((item, index) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'Stk.',
          price_per_unit: item.price_per_unit,
          tax_rate: item.tax_rate || 19,
          line_total: item.quantity * item.price_per_unit,
          sort_order: index,
        }));
        
        await supabase.from('invoice_items').insert(itemsToInsert);
      }
    }
    
    setSaving(false);
    handleCloseModal();
    fetchInvoices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting invoice:', error);
    } else {
      fetchInvoices();
    }
    setDeleteConfirm({ id: '', show: false });
  };

  const handleStatusChange = async (invoice: Invoice, newStatus: Invoice['status']) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice.id);
    
    if (!error) {
      fetchInvoices();
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    // Load items
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order');
    
    const customer = customers.find(c => c.id === invoice.customer_id) || invoice.customer;
    const template = templates.find(t => t.id === invoice.template_id) || invoice.template;
    
    if (!customer) {
      setAlertModal({ show: true, title: "Fehler", message: "Kunde nicht gefunden", type: "error" });
      return;
    }
    
    const doc = await generateInvoicePDF(
      invoice,
      (items || []) as InvoiceItem[],
      customer as Customer,
      template as InvoiceTemplate || null,
      { includeHeader: true, includeFooter: true }
    );
    
    downloadPDF(doc, `${invoice.invoice_number}.pdf`);
  };

  const handlePreviewPDF = async (invoice: Invoice) => {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order');
    
    const customer = customers.find(c => c.id === invoice.customer_id) || invoice.customer;
    const template = templates.find(t => t.id === invoice.template_id) || invoice.template;
    
    if (!customer) {
      setAlertModal({ show: true, title: "Fehler", message: "Kunde nicht gefunden", type: "error" });
      return;
    }
    
    const doc = await generateInvoicePDF(
      invoice,
      (items || []) as InvoiceItem[],
      customer as Customer,
      template as InvoiceTemplate || null,
      { includeHeader: true, includeFooter: true }
    );
    
    openPDFInNewTab(doc);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { ...emptyItem }],
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: newItems.length ? newItems : [{ ...emptyItem }],
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItemFormData, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div style={{
            width: '32px',
            height: '32px',
            margin: '0 auto 1rem',
            border: '3px solid #333',
            borderTop: '3px solid #646cff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Lade Rechnungen...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ff5555' }}>
          <p>{error}</p>
          <button 
            onClick={loadAllData}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#646cff',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = role === 'admin';
  const totals = calculateTotals();

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h2>Rechnungen</h2>
        {isAdmin && (
          <button className="add-btn" onClick={() => handleOpenModal()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Neue Rechnung
          </button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>Keine Rechnungen vorhanden</h3>
          <p>Erstellen Sie Ihre erste Rechnung.</p>
          {isAdmin && (
            <button className="add-btn" onClick={() => handleOpenModal()}>
              Erste Rechnung erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="invoice-cards">
          {invoices.map(invoice => (
            <div key={invoice.id} className="invoice-card">
              <div className="invoice-card-header">
                <span className="invoice-number">{invoice.invoice_number}</span>
                <span className={`status-badge ${invoice.status}`}>
                  {STATUS_LABELS[invoice.status]}
                </span>
              </div>
              <div className="invoice-card-body">
                <p className="customer-name">{invoice.customer?.name || 'Unbekannt'}</p>
                <p>Ausgestellt: {formatDate(invoice.issue_date)}</p>
                <p>Fällig: {formatDate(invoice.due_date)}</p>
              </div>
              <div className="invoice-card-footer">
                <span className="invoice-total">{formatCurrency(invoice.total)}</span>
                <div className="invoice-actions">
                  <button 
                    className="action-btn" 
                    onClick={() => handlePreviewPDF(invoice)}
                    title="Vorschau"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button 
                    className="action-btn" 
                    onClick={() => handleDownloadPDF(invoice)}
                    title="PDF herunterladen"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  {isAdmin && (
                    <>
                      <button 
                        className="action-btn" 
                        onClick={() => handleOpenModal(invoice)}
                        title="Bearbeiten"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button 
                        className="action-btn delete" 
                        onClick={() => setDeleteConfirm({ id: invoice.id, show: true })}
                        title="Löschen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="invoice-status-select">
                  <select
                    value={invoice.status}
                    onChange={e => handleStatusChange(invoice, e.target.value as Invoice['status'])}
                  >
                    <option value="draft">Entwurf</option>
                    <option value="sent">Versendet</option>
                    <option value="paid">Bezahlt</option>
                    <option value="overdue">Überfällig</option>
                    <option value="cancelled">Storniert</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invoice Modal */}
      {showModal && (
        <div className="form-modal-overlay" onClick={handleCloseModal}>
          <div className="form-modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <h3>{editingInvoice ? 'Rechnung bearbeiten' : 'Neue Rechnung'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="form-modal-body">
              {/* Customer & Template */}
              <div className="form-row">
                <div className="form-group">
                  <label>Kunde *</label>
                  <select
                    value={formData.customer_id}
                    onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                  >
                    <option value="">Kunde auswählen...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Vorlage</label>
                  <select
                    value={formData.template_id}
                    onChange={e => setFormData({ ...formData, template_id: e.target.value })}
                  >
                    <option value="">Keine Vorlage</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.is_default ? '(Standard)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Rechnungsdatum *</label>
                  <DateInput
                    value={formData.issue_date}
                    onChange={value => setFormData({ ...formData, issue_date: value })}
                    placeholder="Datum wählen"
                    allowFuture={true}
                  />
                </div>
                <div className="form-group">
                  <label>Fälligkeitsdatum *</label>
                  <DateInput
                    value={formData.due_date}
                    onChange={value => setFormData({ ...formData, due_date: value })}
                    placeholder="Datum wählen"
                    allowFuture={true}
                  />
                </div>
              </div>

              {/* Period */}
              <div className="form-row">
                <div className="form-group">
                  <label>Leistungszeitraum von</label>
                  <DateInput
                    value={formData.period_start}
                    onChange={value => setFormData({ ...formData, period_start: value })}
                    placeholder="Startdatum"
                    allowFuture={true}
                  />
                </div>
                <div className="form-group">
                  <label>Leistungszeitraum bis</label>
                  <DateInput
                    value={formData.period_end}
                    onChange={value => setFormData({ ...formData, period_end: value })}
                    placeholder="Enddatum"
                    allowFuture={true}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="form-group">
                <label>Positionen</label>
                <div className="invoice-items-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Beschreibung</th>
                        <th style={{ width: '12%' }}>Menge</th>
                        <th style={{ width: '10%' }}>Einheit</th>
                        <th style={{ width: '15%' }}>Einzelpreis</th>
                        <th style={{ width: '10%' }}>MwSt.</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              value={item.description}
                              onChange={e => updateItem(index, 'description', e.target.value)}
                              placeholder="Beschreibung..."
                              style={{ width: '100%', padding: '0.5rem' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantity}
                              onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '0.5rem' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={e => updateItem(index, 'unit', e.target.value)}
                              style={{ width: '100%', padding: '0.5rem' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price_per_unit}
                              onChange={e => updateItem(index, 'price_per_unit', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '0.5rem' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={item.tax_rate}
                              onChange={e => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 19)}
                              style={{ width: '100%', padding: '0.5rem' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {formatCurrency(item.quantity * item.price_per_unit)}
                              <button 
                                className="action-btn delete" 
                                onClick={() => removeItem(index)}
                                style={{ marginLeft: '0.5rem' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    type="button" 
                    className="btn-cancel" 
                    onClick={addItem}
                    style={{ marginTop: '0.75rem' }}
                  >
                    + Position hinzufügen
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="invoice-totals">
                <div className="total-row">
                  <span>Netto:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="total-row">
                  <span>MwSt.:</span>
                  <span>{formatCurrency(totals.tax_amount)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>Gesamt:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="form-row">
                <div className="form-group">
                  <label>Bemerkungen (auf Rechnung)</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Sichtbare Bemerkungen..."
                  />
                </div>
                <div className="form-group">
                  <label>Interne Notizen</label>
                  <textarea
                    value={formData.internal_notes}
                    onChange={e => setFormData({ ...formData, internal_notes: e.target.value })}
                    placeholder="Nur intern sichtbar..."
                  />
                </div>
              </div>
            </div>
            <div className="form-modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>
                Abbrechen
              </button>
              <button 
                className="btn-save" 
                onClick={handleSave}
                disabled={!formData.customer_id || saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .invoice-actions {
          display: flex;
          gap: 0.25rem;
        }
        
        .invoice-status-select {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #333;
        }
        
        .invoice-status-select select {
          width: 100%;
          padding: 0.5rem;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 6px;
          color: #fff;
          font-size: 0.875rem;
        }
        
        .invoice-items-table {
          background: #1a1a1a;
          border-radius: 8px;
          padding: 0.5rem;
        }
        
        .invoice-items-table input {
          background: #242424;
          border: 1px solid #444;
          border-radius: 4px;
          color: #fff;
          font-size: 0.875rem;
        }
        
        .invoice-items-table input:focus {
          outline: none;
          border-color: #646cff;
        }
        
        .invoice-totals {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #1a1a1a;
          border-radius: 8px;
          max-width: 300px;
          margin-left: auto;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          color: #888;
        }
        
        .total-row.grand-total {
          border-top: 1px solid #444;
          margin-top: 0.5rem;
          padding-top: 1rem;
          font-size: 1.125rem;
          font-weight: 700;
          color: #646cff;
        }
      `}</style>
      {deleteConfirm.show && (
        <ConfirmModal
          title="Rechnung löschen"
          message="Möchten Sie diese Rechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm({ id: '', show: false })}
          danger
        />
      )}

      {alertModal.show && (
        <AlertModal
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ show: false, title: "", message: "" })}
        />
      )}
    </div>
  );
}
