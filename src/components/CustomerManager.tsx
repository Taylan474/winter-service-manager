import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCustomersWithCache, invalidateCustomersCache } from '../lib/data-cache';
import ConfirmModal from './ConfirmModal';
import type { Customer, CustomerFormData } from '../types/billing';

const emptyForm: CustomerFormData = {
  name: '',
  company: '',
  address: '',
  postal_code: '',
  city: '',
  email: '',
  phone: '',
  tax_id: '',
  notes: '',
  is_active: true,
};

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });

  const fetchCustomers = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    const data = await fetchCustomersWithCache(forceRefresh, false);
    setCustomers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        company: customer.company || '',
        address: customer.address || '',
        postal_code: customer.postal_code || '',
        city: customer.city || '',
        email: customer.email || '',
        phone: customer.phone || '',
        tax_id: customer.tax_id || '',
        notes: customer.notes || '',
        is_active: customer.is_active,
      });
    } else {
      setEditingCustomer(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    
    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update({
          name: formData.name.trim(),
          company: formData.company?.trim() || null,
          address: formData.address?.trim() || null,
          postal_code: formData.postal_code?.trim() || null,
          city: formData.city?.trim() || null,
          email: formData.email?.trim() || null,
          phone: formData.phone?.trim() || null,
          tax_id: formData.tax_id?.trim() || null,
          notes: formData.notes?.trim() || null,
          is_active: formData.is_active,
        })
        .eq('id', editingCustomer.id);
      
      if (error) {
        console.error('Error updating customer:', error);
      }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert({
          name: formData.name.trim(),
          company: formData.company?.trim() || null,
          address: formData.address?.trim() || null,
          postal_code: formData.postal_code?.trim() || null,
          city: formData.city?.trim() || null,
          email: formData.email?.trim() || null,
          phone: formData.phone?.trim() || null,
          tax_id: formData.tax_id?.trim() || null,
          notes: formData.notes?.trim() || null,
          is_active: formData.is_active ?? true,
        });
      
      if (error) {
        console.error('Error creating customer:', error);
      }
    }
    
    setSaving(false);
    handleCloseModal();
    invalidateCustomersCache();
    fetchCustomers(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting customer:', error);
    } else {
      invalidateCustomersCache();
      fetchCustomers(true);
    }
    setDeleteConfirm({ id: '', show: false });
  };

  const handleToggleActive = async (customer: Customer) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: !customer.is_active })
      .eq('id', customer.id);
    
    if (!error) {
      invalidateCustomersCache();
      fetchCustomers(true);
    }
  };

  if (loading) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Lade Kunden...
        </div>
      </div>
    );
  }

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h2>Kunden verwalten</h2>
        <button className="add-btn" onClick={() => handleOpenModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Kunde
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>Keine Kunden vorhanden</h3>
          <p>Erstellen Sie Ihren ersten Kunden für die Rechnungsstellung.</p>
          <button className="add-btn" onClick={() => handleOpenModal()}>
            Ersten Kunden anlegen
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Firma</th>
              <th>Stadt</th>
              <th>E-Mail</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.company || '-'}</td>
                <td>{customer.city || '-'}</td>
                <td>{customer.email || '-'}</td>
                <td>
                  <span 
                    className={`status-badge ${customer.is_active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleActive(customer)}
                    style={{ cursor: 'pointer' }}
                  >
                    {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="actions">
                  <button className="action-btn" onClick={() => handleOpenModal(customer)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button className="action-btn delete" onClick={() => setDeleteConfirm({ id: customer.id, show: true })}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="form-modal-overlay" onClick={handleCloseModal}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <h3>{editingCustomer ? 'Kunden bearbeiten' : 'Neuer Kunde'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="form-modal-body">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Kundenname"
                />
              </div>
              <div className="form-group">
                <label>Firma</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Firmenname"
                />
              </div>
              <div className="form-group">
                <label>Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Straße und Hausnummer"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>PLZ</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="12345"
                  />
                </div>
                <div className="form-group">
                  <label>Stadt</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Stadt"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>E-Mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@beispiel.de"
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Steuernummer</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="DE123456789"
                />
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Interne Notizen zum Kunden..."
                />
              </div>
              <div className="form-group">
                <div className="toggle-wrapper">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ color: '#fff' }}>Aktiver Kunde</span>
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
                disabled={!formData.name.trim() || saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.show && (
        <ConfirmModal
          title="Kunden löschen"
          message="Möchten Sie diesen Kunden wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm({ id: '', show: false })}
          danger
        />
      )}
    </div>
  );
}
