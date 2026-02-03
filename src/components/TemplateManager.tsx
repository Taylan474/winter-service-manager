import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchTemplatesWithCache, invalidateTemplatesCache } from '../lib/data-cache';
import ConfirmModal from './ConfirmModal';
import type { InvoiceTemplate } from '../types/billing';

interface TemplateFormData {
  name: string;
  is_default: boolean;
  header_logo_url: string;
  header_text: string;
  footer_text: string;
  company_name: string;
  company_address: string;
  company_postal_code: string;
  company_city: string;
  company_tax_id: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_bank_name: string;
  company_bank_iban: string;
  company_bank_bic: string;
  payment_terms: string;
  notes: string;
}

const emptyForm: TemplateFormData = {
  name: '',
  is_default: false,
  header_logo_url: '',
  header_text: '',
  footer_text: '',
  company_name: '',
  company_address: '',
  company_postal_code: '',
  company_city: '',
  company_tax_id: '',
  company_phone: '',
  company_email: '',
  company_website: '',
  company_bank_name: '',
  company_bank_iban: '',
  company_bank_bic: '',
  payment_terms: 'Zahlbar innerhalb von 14 Tagen netto.',
  notes: '',
};

export default function TemplateManager() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'company' | 'bank' | 'content'>('company');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });

  const fetchTemplates = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    const data = await fetchTemplatesWithCache(forceRefresh);
    setTemplates(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenModal = (template?: InvoiceTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        is_default: template.is_default,
        header_logo_url: template.header_logo_url || '',
        header_text: template.header_text || '',
        footer_text: template.footer_text || '',
        company_name: template.company_name || '',
        company_address: template.company_address || '',
        company_postal_code: template.company_postal_code || '',
        company_city: template.company_city || '',
        company_tax_id: template.company_tax_id || '',
        company_phone: template.company_phone || '',
        company_email: template.company_email || '',
        company_website: template.company_website || '',
        company_bank_name: template.company_bank_name || '',
        company_bank_iban: template.company_bank_iban || '',
        company_bank_bic: template.company_bank_bic || '',
        payment_terms: template.payment_terms || 'Zahlbar innerhalb von 14 Tagen netto.',
        notes: template.notes || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData(emptyForm);
    }
    setActiveSection('company');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    
    // If setting as default, unset other defaults first
    if (formData.is_default) {
      await supabase
        .from('invoice_templates')
        .update({ is_default: false })
        .eq('is_default', true);
    }
    
    const payload = {
      name: formData.name.trim(),
      is_default: formData.is_default,
      header_logo_url: formData.header_logo_url?.trim() || null,
      header_text: formData.header_text?.trim() || null,
      footer_text: formData.footer_text?.trim() || null,
      company_name: formData.company_name?.trim() || null,
      company_address: formData.company_address?.trim() || null,
      company_postal_code: formData.company_postal_code?.trim() || null,
      company_city: formData.company_city?.trim() || null,
      company_tax_id: formData.company_tax_id?.trim() || null,
      company_phone: formData.company_phone?.trim() || null,
      company_email: formData.company_email?.trim() || null,
      company_website: formData.company_website?.trim() || null,
      company_bank_name: formData.company_bank_name?.trim() || null,
      company_bank_iban: formData.company_bank_iban?.trim() || null,
      company_bank_bic: formData.company_bank_bic?.trim() || null,
      payment_terms: formData.payment_terms?.trim() || null,
      notes: formData.notes?.trim() || null,
    };
    
    if (editingTemplate) {
      const { error } = await supabase
        .from('invoice_templates')
        .update(payload)
        .eq('id', editingTemplate.id);
      
      if (error) {
        console.error('Error updating template:', error);
      }
    } else {
      const { error } = await supabase
        .from('invoice_templates')
        .insert(payload);
      
      if (error) {
        console.error('Error creating template:', error);
      }
    }
    
    setSaving(false);
    handleCloseModal();
    invalidateTemplatesCache();
    fetchTemplates(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('invoice_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting template:', error);
    } else {
      invalidateTemplatesCache();
      fetchTemplates(true);
    }
    setDeleteConfirm({ id: '', show: false });
  };

  const handleSetDefault = async (id: string) => {
    // Unset all defaults first
    await supabase
      .from('invoice_templates')
      .update({ is_default: false })
      .eq('is_default', true);
    
    // Set this one as default
    const { error } = await supabase
      .from('invoice_templates')
      .update({ is_default: true })
      .eq('id', id);
    
    if (!error) {
      invalidateTemplatesCache();
      fetchTemplates(true);
    }
  };

  if (loading) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Lade Vorlagen...
        </div>
      </div>
    );
  }

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h2>Rechnungsvorlagen & Firmendaten</h2>
        <button className="add-btn" onClick={() => handleOpenModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neue Vorlage
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <h3>Keine Vorlagen vorhanden</h3>
          <p>Erstellen Sie eine Vorlage mit Ihren Firmendaten für Rechnungen.</p>
          <button className="add-btn" onClick={() => handleOpenModal()}>
            Erste Vorlage anlegen
          </button>
        </div>
      ) : (
        <div className="template-cards">
          {templates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-card-header">
                <div>
                  <h3>{template.name}</h3>
                  {template.is_default && (
                    <span className="status-badge active">Standard</span>
                  )}
                </div>
                <div className="template-actions">
                  <button className="action-btn" onClick={() => handleOpenModal(template)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!template.is_default && (
                    <button 
                      className="action-btn" 
                      onClick={() => handleSetDefault(template.id)}
                      title="Als Standard setzen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  )}
                  <button className="action-btn delete" onClick={() => setDeleteConfirm({ id: template.id, show: true })}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="template-card-body">
                {template.company_name && (
                  <p className="company-name">{template.company_name}</p>
                )}
                {template.company_address && (
                  <p className="company-details">
                    {template.company_address}
                    {template.company_postal_code && `, ${template.company_postal_code}`}
                    {template.company_city && ` ${template.company_city}`}
                  </p>
                )}
                {template.company_email && (
                  <p className="company-details">{template.company_email}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="form-modal-overlay" onClick={handleCloseModal}>
          <div className="form-modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <h3>{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            {/* Section Tabs */}
            <div className="form-section-tabs">
              <button 
                className={`section-tab ${activeSection === 'company' ? 'active' : ''}`}
                onClick={() => setActiveSection('company')}
              >
                Firma
              </button>
              <button 
                className={`section-tab ${activeSection === 'bank' ? 'active' : ''}`}
                onClick={() => setActiveSection('bank')}
              >
                Bankdaten
              </button>
              <button 
                className={`section-tab ${activeSection === 'content' ? 'active' : ''}`}
                onClick={() => setActiveSection('content')}
              >
                Texte
              </button>
            </div>
            
            <div className="form-modal-body">
              <div className="form-group">
                <label>Vorlagenname *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Standard-Rechnung"
                />
              </div>
              
              <div className="form-group">
                <div className="toggle-wrapper">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ color: '#fff' }}>Als Standard-Vorlage verwenden</span>
                </div>
              </div>
              
              {/* Company Section */}
              {activeSection === 'company' && (
                <>
                  <div className="form-group">
                    <label>Firmenname</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Ihre Firma GmbH"
                    />
                  </div>
                  <div className="form-group">
                    <label>Adresse</label>
                    <input
                      type="text"
                      value={formData.company_address}
                      onChange={e => setFormData({ ...formData, company_address: e.target.value })}
                      placeholder="Straße und Hausnummer"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>PLZ</label>
                      <input
                        type="text"
                        value={formData.company_postal_code}
                        onChange={e => setFormData({ ...formData, company_postal_code: e.target.value })}
                        placeholder="12345"
                      />
                    </div>
                    <div className="form-group">
                      <label>Stadt</label>
                      <input
                        type="text"
                        value={formData.company_city}
                        onChange={e => setFormData({ ...formData, company_city: e.target.value })}
                        placeholder="Stadt"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Telefon</label>
                      <input
                        type="tel"
                        value={formData.company_phone}
                        onChange={e => setFormData({ ...formData, company_phone: e.target.value })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                    <div className="form-group">
                      <label>E-Mail</label>
                      <input
                        type="email"
                        value={formData.company_email}
                        onChange={e => setFormData({ ...formData, company_email: e.target.value })}
                        placeholder="info@firma.de"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Website</label>
                      <input
                        type="url"
                        value={formData.company_website}
                        onChange={e => setFormData({ ...formData, company_website: e.target.value })}
                        placeholder="https://www.firma.de"
                      />
                    </div>
                    <div className="form-group">
                      <label>Steuernummer / USt-ID</label>
                      <input
                        type="text"
                        value={formData.company_tax_id}
                        onChange={e => setFormData({ ...formData, company_tax_id: e.target.value })}
                        placeholder="DE123456789"
                      />
                    </div>
                  </div>
                </>
              )}
              
              {/* Bank Section */}
              {activeSection === 'bank' && (
                <>
                  <div className="form-group">
                    <label>Bank</label>
                    <input
                      type="text"
                      value={formData.company_bank_name}
                      onChange={e => setFormData({ ...formData, company_bank_name: e.target.value })}
                      placeholder="Sparkasse / Volksbank / etc."
                    />
                  </div>
                  <div className="form-group">
                    <label>IBAN</label>
                    <input
                      type="text"
                      value={formData.company_bank_iban}
                      onChange={e => setFormData({ ...formData, company_bank_iban: e.target.value })}
                      placeholder="DE89 3704 0044 0532 0130 00"
                    />
                  </div>
                  <div className="form-group">
                    <label>BIC</label>
                    <input
                      type="text"
                      value={formData.company_bank_bic}
                      onChange={e => setFormData({ ...formData, company_bank_bic: e.target.value })}
                      placeholder="COBADEFFXXX"
                    />
                  </div>
                </>
              )}
              
              {/* Content Section */}
              {activeSection === 'content' && (
                <>
                  <div className="form-group">
                    <label>Logo URL</label>
                    <input
                      type="url"
                      value={formData.header_logo_url}
                      onChange={e => setFormData({ ...formData, header_logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div className="form-group">
                    <label>Kopfzeilen-Text</label>
                    <textarea
                      value={formData.header_text}
                      onChange={e => setFormData({ ...formData, header_text: e.target.value })}
                      placeholder="Text, der oben auf der Rechnung erscheint..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Zahlungsbedingungen</label>
                    <textarea
                      value={formData.payment_terms}
                      onChange={e => setFormData({ ...formData, payment_terms: e.target.value })}
                      placeholder="Zahlbar innerhalb von 14 Tagen netto..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Fußzeilen-Text</label>
                    <textarea
                      value={formData.footer_text}
                      onChange={e => setFormData({ ...formData, footer_text: e.target.value })}
                      placeholder="Text, der unten auf jeder Seite erscheint..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Interne Notizen</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notizen zur Vorlage (nicht auf Rechnung)..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="form-modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>
                Abbrechen
              </button>
              <button 
                className="btn-save" 
                onClick={handleSave}
                disabled={!formData.name.trim() || saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .template-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        
        .template-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          padding: 1.25rem;
        }
        
        .template-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .template-card-header h3 {
          margin: 0 0 0.5rem 0;
          color: #fff;
          font-size: 1rem;
        }
        
        .template-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .template-card-body .company-name {
          color: #fff;
          font-weight: 500;
          margin: 0 0 0.25rem 0;
        }
        
        .template-card-body .company-details {
          color: #888;
          font-size: 0.875rem;
          margin: 0 0 0.25rem 0;
        }
        
        .form-section-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 0 1.5rem;
          border-bottom: 1px solid #333;
        }
        
        .section-tab {
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #888;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .section-tab:hover {
          color: #fff;
        }
        
        .section-tab.active {
          color: #646cff;
          border-bottom-color: #646cff;
        }
      `}</style>
      {deleteConfirm.show && (
        <ConfirmModal
          title="Vorlage löschen"
          message="Möchten Sie diese Vorlage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm({ id: '', show: false })}
          danger
        />
      )}    </div>
  );
}
