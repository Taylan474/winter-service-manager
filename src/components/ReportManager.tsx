import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCustomersWithCache, fetchTemplatesWithCache } from '../lib/data-cache';
import { generateReportPDF, downloadPDF, openPDFInNewTab } from '../lib/pdf-generator';
import ConfirmModal from './ConfirmModal';
import AlertModal from './AlertModal';
import DateInput from './DateInput';
import type { Report, ReportData, InvoiceTemplate, Customer } from '../types/billing';

type ReportManagerProps = {
  role: 'admin' | 'mitarbeiter' | 'gast' | null;
  userId: string;
};

const REPORT_TYPE_LABELS: Record<Report['report_type'], string> = {
  daily: 'Tagesbericht',
  weekly: 'Wochenbericht',
  monthly: 'Monatsbericht',
  custom: 'Benutzerdefiniert',
  work_summary: 'Arbeitsstunden-Zusammenfassung',
};

const STATUS_LABELS: Record<Report['status'], string> = {
  draft: 'Entwurf',
  finalized: 'Finalisiert',
  archived: 'Archiviert',
};

export default function ReportManager({ role, userId }: ReportManagerProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" }>({ show: false, title: "", message: "" });
  
  // Form state for report generation
  const [formData, setFormData] = useState({
    report_type: 'monthly' as Report['report_type'],
    title: '',
    period_start: '',
    period_end: '',
    customer_id: '',
    template_id: '',
  });

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        customer:customers(*)
      `)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setReports(data);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    const data = await fetchCustomersWithCache(false, true);
    setCustomers(data);
  }, []);

  const fetchTemplates = useCallback(async () => {
    const data = await fetchTemplatesWithCache(false);
    setTemplates(data);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchReports(), fetchCustomers(), fetchTemplates()]);
    setLoading(false);
  }, [fetchReports, fetchCustomers, fetchTemplates]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const getDefaultDates = (type: Report['report_type']) => {
    const today = new Date();
    let start: Date;
    let end: Date;
    
    switch (type) {
      case 'daily':
        start = today;
        end = today;
        break;
      case 'weekly':
        start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + 1); // Monday
        end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday
        break;
      case 'monthly':
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
    }
    
    return {
      period_start: start.toISOString().split('T')[0],
      period_end: end.toISOString().split('T')[0],
    };
  };

  const handleOpenModal = () => {
    const dates = getDefaultDates('monthly');
    const defaultTemplate = templates.find(t => t.is_default);
    setFormData({
      report_type: 'monthly',
      title: 'Monatsbericht',
      period_start: dates.period_start,
      period_end: dates.period_end,
      customer_id: '',
      template_id: defaultTemplate?.id || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleTypeChange = (type: Report['report_type']) => {
    const dates = getDefaultDates(type);
    setFormData({
      ...formData,
      report_type: type,
      title: REPORT_TYPE_LABELS[type],
      ...dates,
    });
  };

  const generateReportData = async (): Promise<ReportData> => {
    const { period_start, period_end } = formData;
    
    // Fetch work logs for the period
    let workLogsQuery = supabase
      .from('work_logs')
      .select(`
        *,
        user:users(name)
      `)
      .gte('date', period_start)
      .lte('date', period_end)
      .order('date');
    
    const { data: workLogs } = await workLogsQuery;
    
    // Fetch streets status
    let streetsQuery = supabase
      .from('streets')
      .select(`
        *,
        area:areas(
          name,
          city:cities(name)
        )
      `);
    
    const { data: streets } = await streetsQuery;
    
    // Fetch daily status for the period
    const { data: dailyStatus } = await supabase
      .from('daily_street_status')
      .select('*')
      .gte('date', period_start)
      .lte('date', period_end);
    
    // Build report data
    const workLogData = (workLogs || []).map(log => {
      const startMinutes = log.start_time ? 
        parseInt(log.start_time.split(':')[0]) * 60 + parseInt(log.start_time.split(':')[1]) : 0;
      const endMinutes = log.end_time ? 
        parseInt(log.end_time.split(':')[0]) * 60 + parseInt(log.end_time.split(':')[1]) : 0;
      
      return {
        id: log.id,
        user_name: log.user?.name || 'Unbekannt',
        date: log.date,
        start_time: log.start_time || '',
        end_time: log.end_time || '',
        street: log.street_name || '',
        notes: log.notes || '',
        duration_minutes: Math.max(0, endMinutes - startMinutes),
      };
    });
    
    const totalMinutes = workLogData.reduce((sum, log) => sum + log.duration_minutes, 0);
    
    // Map streets with status
    const streetData = (streets || []).map(street => {
      const statusHistory = (dailyStatus || [])
        .filter(ds => ds.street_id === street.id)
        .map(ds => ({
          date: ds.date,
          status: ds.status,
          started_at: ds.started_at,
          finished_at: ds.finished_at,
          assigned_users: ds.assigned_users || [],
        }));
      
      return {
        id: street.id,
        name: street.name,
        city: street.area?.city?.name || '',
        area: street.area?.name || '',
        status_history: statusHistory,
      };
    });
    
    // Calculate summary
    const latestStatuses = new Map<string, string>();
    (dailyStatus || []).forEach(ds => {
      const current = latestStatuses.get(ds.street_id);
      if (!current || ds.date > current) {
        latestStatuses.set(ds.street_id, ds.status);
      }
    });
    
    let completed = 0, inProgress = 0, open = 0;
    latestStatuses.forEach(status => {
      if (status === 'done') completed++;
      else if (status === 'in_progress') inProgress++;
      else open++;
    });
    
    return {
      work_logs: workLogData,
      streets: streetData,
      summary: {
        total_hours: totalMinutes / 60,
        total_streets: streets?.length || 0,
        streets_completed: completed,
        streets_in_progress: inProgress,
        streets_open: open,
      },
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: userId,
        period: { start: period_start, end: period_end },
      },
    };
  };

  const handleGenerateReport = async () => {
    if (!formData.title.trim() || !formData.period_start || !formData.period_end) return;
    
    setGenerating(true);
    
    try {
      // Generate report number
      const { data: numberData } = await supabase.rpc('generate_report_number');
      const reportNumber = numberData || `BR-${Date.now()}`;
      
      // Generate report data
      const reportData = await generateReportData();
      
      // Create report
      const { error } = await supabase
        .from('reports')
        .insert({
          report_number: reportNumber,
          report_type: formData.report_type,
          title: formData.title.trim(),
          period_start: formData.period_start,
          period_end: formData.period_end,
          customer_id: formData.customer_id || null,
          data: reportData,
          status: 'draft',
          created_by: userId,
        });
      
      if (error) {
        console.error('Error creating report:', error);
        setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Erstellen des Berichts", type: "error" });
      } else {
        fetchReports();
        handleCloseModal();
      }
    } catch (err) {
      console.error('Error generating report:', err);
    }
    
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    
    if (!error) {
      fetchReports();
    }
    setDeleteConfirm({ id: '', show: false });
  };

  const handleStatusChange = async (report: Report, newStatus: Report['status']) => {
    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', report.id);
    
    if (!error) {
      fetchReports();
    }
  };

  const handleDownloadPDF = async (report: Report) => {
    const template = templates.find(t => t.is_default) || templates[0];
    
    const doc = await generateReportPDF(
      report,
      template || null,
      { includeHeader: true, includeFooter: true }
    );
    
    downloadPDF(doc, `${report.report_number}.pdf`);
  };

  const handlePreviewPDF = async (report: Report) => {
    const template = templates.find(t => t.is_default) || templates[0];
    
    const doc = await generateReportPDF(
      report,
      template || null,
      { includeHeader: true, includeFooter: true }
    );
    
    openPDFInNewTab(doc);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="manager-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          Lade Berichte...
        </div>
      </div>
    );
  }

  const isAdmin = role === 'admin';
  const canCreate = role === 'admin' || role === 'mitarbeiter';

  return (
    <div className="manager-section">
      <div className="manager-header">
        <h2>Berichte</h2>
        {canCreate && (
          <button className="add-btn" onClick={handleOpenModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Neuer Bericht
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h3>Keine Berichte vorhanden</h3>
          <p>Erstellen Sie Ihren ersten Bericht für den Winterdienst.</p>
          {canCreate && (
            <button className="add-btn" onClick={handleOpenModal}>
              Ersten Bericht erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="report-cards">
          {reports.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-card-header">
                <div>
                  <span className="report-number">{report.report_number}</span>
                  <span className={`status-badge ${report.status}`}>
                    {STATUS_LABELS[report.status]}
                  </span>
                </div>
                <span className="report-type-badge">
                  {REPORT_TYPE_LABELS[report.report_type]}
                </span>
              </div>
              <div className="report-card-body">
                <h4>{report.title}</h4>
                <p className="report-period">
                  {formatDate(report.period_start)} - {formatDate(report.period_end)}
                </p>
                {report.customer && (
                  <p className="report-customer">Kunde: {report.customer.name}</p>
                )}
                {report.data?.summary && (
                  <div className="report-summary">
                    <span>{report.data.summary.total_streets} Straßen</span>
                    <span>•</span>
                    <span>{Math.round(report.data.summary.total_hours * 10) / 10}h</span>
                  </div>
                )}
              </div>
              <div className="report-card-footer">
                <div className="report-actions">
                  <button 
                    className="action-btn" 
                    onClick={() => handlePreviewPDF(report)}
                    title="Vorschau"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button 
                    className="action-btn" 
                    onClick={() => handleDownloadPDF(report)}
                    title="PDF herunterladen"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  {isAdmin && (
                    <button 
                      className="action-btn delete" 
                      onClick={() => setDeleteConfirm({ id: report.id, show: true })}
                      title="Löschen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
                {isAdmin && (
                  <select
                    value={report.status}
                    onChange={e => handleStatusChange(report, e.target.value as Report['status'])}
                    className="report-status-select"
                  >
                    <option value="draft">Entwurf</option>
                    <option value="finalized">Finalisiert</option>
                    <option value="archived">Archiviert</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Report Modal */}
      {showModal && (
        <div className="form-modal-overlay" onClick={handleCloseModal}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <div className="form-modal-header">
              <h3>Neuer Bericht</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="form-modal-body">
              <div className="form-group">
                <label>Berichtstyp</label>
                <select
                  value={formData.report_type}
                  onChange={e => handleTypeChange(e.target.value as Report['report_type'])}
                >
                  <option value="daily">Tagesbericht</option>
                  <option value="weekly">Wochenbericht</option>
                  <option value="monthly">Monatsbericht</option>
                  <option value="work_summary">Arbeitsstunden-Zusammenfassung</option>
                  <option value="custom">Benutzerdefiniert</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Titel *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Berichtstitel..."
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Von *</label>
                  <DateInput
                    value={formData.period_start}
                    onChange={value => setFormData({ ...formData, period_start: value })}
                    placeholder="Startdatum"
                    allowFuture={true}
                  />
                </div>
                <div className="form-group">
                  <label>Bis *</label>
                  <DateInput
                    value={formData.period_end}
                    onChange={value => setFormData({ ...formData, period_end: value })}
                    placeholder="Enddatum"
                    allowFuture={true}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Kunde (optional)</label>
                <select
                  value={formData.customer_id}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                >
                  <option value="">Alle Kunden</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>
                Abbrechen
              </button>
              <button 
                className="btn-save" 
                onClick={handleGenerateReport}
                disabled={!formData.title.trim() || !formData.period_start || !formData.period_end || generating}
              >
                {generating ? 'Wird erstellt...' : 'Bericht erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .report-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        
        .report-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          padding: 1.25rem;
        }
        
        .report-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .report-number {
          font-weight: 600;
          color: #888;
          font-size: 0.875rem;
          margin-right: 0.5rem;
        }
        
        .report-type-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          background: rgba(100, 108, 255, 0.2);
          color: #646cff;
          border-radius: 4px;
        }
        
        .report-card-body h4 {
          margin: 0 0 0.5rem 0;
          color: #fff;
          font-size: 1rem;
        }
        
        .report-period {
          color: #888;
          font-size: 0.875rem;
          margin: 0 0 0.25rem 0;
        }
        
        .report-customer {
          color: #666;
          font-size: 0.875rem;
          margin: 0;
        }
        
        .report-summary {
          display: flex;
          gap: 0.5rem;
          color: #888;
          font-size: 0.875rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #333;
        }
        
        .report-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #333;
        }
        
        .report-actions {
          display: flex;
          gap: 0.25rem;
        }
        
        .report-status-select {
          padding: 0.375rem 0.5rem;
          background: #242424;
          border: 1px solid #444;
          border-radius: 6px;
          color: #fff;
          font-size: 0.75rem;
        }
      `}</style>
      {deleteConfirm.show && (
        <ConfirmModal
          title="Bericht löschen"
          message="Möchten Sie diesen Bericht wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
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
