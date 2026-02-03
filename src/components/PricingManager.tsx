import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchPricingWithCache, invalidatePricingCache } from '../lib/data-cache';
import ConfirmModal from './ConfirmModal';
import DateInput from './DateInput';
import type { Pricing, PricingFormData } from '../types/billing';

const UNIT_LABELS: Record<Pricing['unit'], string> = {
  hour: 'Pro Stunde',
  meter: 'Pro Meter',
  fixed: 'Pauschal',
  per_street: 'Pro Straße',
};

const emptyForm: PricingFormData = {
  name: '',
  description: '',
  unit: 'hour',
  price_per_unit: 0,
  tax_rate: 19,
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: '',
  is_active: true,
};

export default function PricingManager() {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<Pricing | null>(null);
  const [formData, setFormData] = useState<PricingFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });

  const fetchPricing = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    const data = await fetchPricingWithCache(forceRefresh);
    setPricing(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleOpenModal = (item?: Pricing) => {
    if (item) {
      setEditingPricing(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        tax_rate: item.tax_rate,
        valid_from: item.valid_from,
        valid_until: item.valid_until || '',
        is_active: item.is_active,
      });
    } else {
      setEditingPricing(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPricing(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || formData.price_per_unit <= 0) return;
    
    setSaving(true);
    
    const payload = {
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      unit: formData.unit,
      price_per_unit: formData.price_per_unit,
      tax_rate: formData.tax_rate ?? 19,
      valid_from: formData.valid_from || new Date().toISOString().split('T')[0],
      valid_until: formData.valid_until || null,
      is_active: formData.is_active ?? true,
    };
    
    if (editingPricing) {
      const { error } = await supabase
        .from('pricing')
        .update(payload)
        .eq('id', editingPricing.id);
      
      if (error) {
        console.error('Error updating pricing:', error);
      }
    } else {
      const { error } = await supabase
        .from('pricing')
        .insert(payload);
      
      if (error) {
        console.error('Error creating pricing:', error);
      }
    }
    
    setSaving(false);
    handleCloseModal();
    invalidatePricingCache();
    fetchPricing(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('pricing')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting pricing:', error);
    } else {
      invalidatePricingCache();
      fetchPricing(true);
    }
    setDeleteConfirm({ id: '', show: false });
  };

  const handleToggleActive = async (item: Pricing) => {
    const { error } = await supabase
      .from('pricing')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    
    if (!error) {
      invalidatePricingCache();
      fetchPricing(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Lade Preise...
        </div>
      </div>
    );
  }

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h2>Preise verwalten</h2>
        <button className="add-btn" onClick={() => handleOpenModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Preis
        </button>
      </div>

      {pricing.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <h3>Keine Preise vorhanden</h3>
          <p>Erstellen Sie Preise für die Winterdienst-Abrechnung.</p>
          <button className="add-btn" onClick={() => handleOpenModal()}>
            Ersten Preis anlegen
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Beschreibung</th>
              <th>Einheit</th>
              <th>Preis</th>
              <th>MwSt.</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {pricing.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.description || '-'}</td>
                <td>{UNIT_LABELS[item.unit]}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(item.price_per_unit)}</td>
                <td>{item.tax_rate}%</td>
                <td>
                  <span 
                    className={`status-badge ${item.is_active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleActive(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="actions">
                  <button className="action-btn" onClick={() => handleOpenModal(item)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button className="action-btn delete" onClick={() => setDeleteConfirm({ id: item.id, show: true })}>
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
              <h3>{editingPricing ? 'Preis bearbeiten' : 'Neuer Preis'}</h3>
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
                  placeholder="z.B. Winterdienst Standard"
                />
              </div>
              <div className="form-group">
                <label>Beschreibung</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Beschreibung der Leistung..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Einheit *</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value as Pricing['unit'] })}
                  >
                    <option value="hour">Pro Stunde</option>
                    <option value="meter">Pro Meter</option>
                    <option value="fixed">Pauschal</option>
                    <option value="per_street">Pro Straße</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Preis (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_unit}
                    onChange={e => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>MwSt. (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={e => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 19 })}
                    placeholder="19"
                  />
                </div>
                <div className="form-group">
                  <label>Gültig ab</label>
                  <DateInput
                    value={formData.valid_from}
                    onChange={value => setFormData({ ...formData, valid_from: value })}
                    placeholder="Startdatum"
                    allowFuture={true}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Gültig bis (optional)</label>
                <DateInput
                  value={formData.valid_until}
                  onChange={value => setFormData({ ...formData, valid_until: value })}
                  placeholder="Enddatum (optional)"
                  allowFuture={true}
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
                  <span style={{ color: '#fff' }}>Aktiver Preis</span>
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
                disabled={!formData.name.trim() || formData.price_per_unit <= 0 || saving}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.show && (
        <ConfirmModal
          title="Preis löschen"
          message="Möchten Sie diesen Preis wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
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
