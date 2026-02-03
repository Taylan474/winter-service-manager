import { useState, useEffect, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerManager from '../components/CustomerManager';
import PricingManager from '../components/PricingManager';
import TemplateManager from '../components/TemplateManager';
import InvoiceManager from '../components/InvoiceManager';
import ReportManager from '../components/ReportManager';
import { prefetchBillingData } from '../lib/data-cache';
import '../styles/billing.css';

type BillingTab = 'invoices' | 'customers' | 'pricing' | 'templates' | 'reports';

type BillingProps = {
  role: 'admin' | 'mitarbeiter' | 'gast' | null;
  userId: string;
};

export default function Billing({ role, userId }: BillingProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BillingTab>('invoices');

  // Pre-fetch billing data when entering the page to avoid loading delays on tab switch
  useEffect(() => {
    prefetchBillingData();
  }, []);

  const tabs: { id: BillingTab; label: string; icon: JSX.Element; adminOnly?: boolean }[] = [
    {
      id: 'invoices',
      label: 'Rechnungen',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'customers',
      label: 'Kunden',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      adminOnly: true,
    },
    {
      id: 'pricing',
      label: 'Preise',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      adminOnly: true,
    },
    {
      id: 'templates',
      label: 'Vorlagen',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
      adminOnly: true,
    },
    {
      id: 'reports',
      label: 'Berichte',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || role === 'admin');

  return (
    <div className="billing-page">
      <div className="billing-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Zurück
        </button>
        <div className="billing-title">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <h1>Abrechnung</h1>
        </div>
      </div>

      <div className="billing-tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="billing-content">
        {activeTab === 'invoices' && (
          <InvoiceManager role={role} userId={userId} />
        )}
        {activeTab === 'customers' && role === 'admin' && (
          <CustomerManager />
        )}
        {activeTab === 'pricing' && role === 'admin' && (
          <PricingManager />
        )}
        {activeTab === 'templates' && role === 'admin' && (
          <TemplateManager />
        )}
        {activeTab === 'reports' && (
          <ReportManager role={role} userId={userId} />
        )}
      </div>
    </div>
  );
}
