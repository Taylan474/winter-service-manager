import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Invoice, InvoiceItem, Customer, InvoiceTemplate, Report } from '../../types/billing'

// Since jsPDF is installed, we don't mock it - we test with the real library
// This ensures our PDF generation actually works

describe('PDF Generator', () => {
  let mockInvoice: Invoice
  let mockItems: InvoiceItem[]
  let mockCustomer: Customer
  let mockTemplate: InvoiceTemplate
  let mockReport: Report

  beforeEach(() => {
    vi.clearAllMocks()

    mockInvoice = {
      id: 'inv-123',
      customer_id: 'cust-123',
      invoice_number: 'INV-2024-001',
      status: 'draft',
      issue_date: '2024-01-15',
      due_date: '2024-02-15',
      period_start: '2024-01-01',
      period_end: '2024-01-31',
      subtotal: 1000,
      tax_amount: 190,
      total: 1190,
      notes: 'Test invoice notes',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    }

    mockItems = [
      {
        id: 'item-1',
        invoice_id: 'inv-123',
        description: 'Winterdienst Januar',
        quantity: 10,
        unit: 'Stunden',
        price_per_unit: 50,
        tax_rate: 19,
        line_total: 500,
        sort_order: 1,
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 'item-2',
        invoice_id: 'inv-123',
        description: 'Materialkosten',
        quantity: 5,
        unit: 'kg',
        price_per_unit: 100,
        tax_rate: 19,
        line_total: 500,
        sort_order: 2,
        created_at: '2024-01-15T10:00:00Z',
      },
    ]

    mockCustomer = {
      id: 'cust-123',
      name: 'Max Mustermann',
      company: 'Muster GmbH',
      email: 'max@muster.de',
      phone: '+49 123 456789',
      address: 'Musterstraße 1',
      postal_code: '12345',
      city: 'Musterstadt',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    mockTemplate = {
      id: 'tpl-123',
      name: 'Standard Template',
      company_name: 'Winterdienst GmbH',
      company_address: 'Winterstraße 1',
      company_postal_code: '54321',
      company_city: 'Winterstadt',
      company_phone: '+49 987 654321',
      company_email: 'info@winterdienst.de',
      company_bank_name: 'Sparkasse',
      company_bank_iban: 'DE89 3704 0044 0532 0130 00',
      company_bank_bic: 'COBADEFFXXX',
      payment_terms: 'Zahlbar innerhalb von 14 Tagen',
      footer_text: 'Vielen Dank für Ihren Auftrag!',
      is_default: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    mockReport = {
      id: 'rep-123',
      report_number: 'REP-2024-001',
      title: 'Monatsbericht Januar 2024',
      report_type: 'monthly',
      status: 'draft',
      period_start: '2024-01-01',
      period_end: '2024-01-31',
      data: {
        summary: {
          total_hours: 45.5,
          total_streets: 20,
          streets_completed: 18,
          streets_in_progress: 2,
          streets_open: 0,
        },
        work_logs: [
          {
            id: 'log-1',
            date: '2024-01-15',
            user_name: 'Hans Müller',
            start_time: '06:00',
            end_time: '10:00',
            duration_minutes: 240,
            street: 'Hauptstraße',
            notes: 'Streugut aufgetragen',
          },
        ],
        streets: [],
      },
      created_at: '2024-02-01T10:00:00Z',
      updated_at: '2024-02-01T10:00:00Z',
    }
  })

  describe('generateInvoicePDF', () => {
    it('should create a PDF document', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const doc = await generateInvoicePDF(mockInvoice, mockItems, mockCustomer, mockTemplate)
      
      expect(doc).toBeDefined()
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210) // A4 width in mm
    })

    it('should work without a template', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const doc = await generateInvoicePDF(mockInvoice, mockItems, mockCustomer, null)
      
      expect(doc).toBeDefined()
    })

    it('should work without invoice notes', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const invoiceWithoutNotes = { ...mockInvoice, notes: undefined }
      const doc = await generateInvoicePDF(invoiceWithoutNotes, mockItems, mockCustomer, mockTemplate)
      
      expect(doc).toBeDefined()
    })

    it('should work without period dates', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const invoiceWithoutPeriod = { 
        ...mockInvoice, 
        period_start: undefined, 
        period_end: undefined 
      }
      const doc = await generateInvoicePDF(invoiceWithoutPeriod, mockItems, mockCustomer, mockTemplate)
      
      expect(doc).toBeDefined()
    })

    it('should handle customer without company', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const customerWithoutCompany = { ...mockCustomer, company: undefined }
      const doc = await generateInvoicePDF(mockInvoice, mockItems, customerWithoutCompany, mockTemplate)
      
      expect(doc).toBeDefined()
    })

    it('should handle empty items array', async () => {
      const { generateInvoicePDF } = await import('../pdf-generator')
      const doc = await generateInvoicePDF(mockInvoice, [], mockCustomer, mockTemplate)
      
      expect(doc).toBeDefined()
    })
  })

  describe('generateReportPDF', () => {
    it('should create a report PDF document', async () => {
      const { generateReportPDF } = await import('../pdf-generator')
      const doc = await generateReportPDF(mockReport, mockTemplate)
      
      expect(doc).toBeDefined()
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210) // A4 width in mm
    })

    it('should work without a template', async () => {
      const { generateReportPDF } = await import('../pdf-generator')
      const doc = await generateReportPDF(mockReport, null)
      
      expect(doc).toBeDefined()
    })

    it('should handle report without summary', async () => {
      const { generateReportPDF } = await import('../pdf-generator')
      const reportWithoutSummary = { 
        ...mockReport, 
        data: { ...mockReport.data, summary: undefined } 
      }
      const doc = await generateReportPDF(reportWithoutSummary, mockTemplate)
      
      expect(doc).toBeDefined()
    })

    it('should handle report without work logs', async () => {
      const { generateReportPDF } = await import('../pdf-generator')
      const reportWithoutLogs = { 
        ...mockReport, 
        data: { ...mockReport.data, work_logs: undefined } 
      }
      const doc = await generateReportPDF(reportWithoutLogs, mockTemplate)
      
      expect(doc).toBeDefined()
    })
  })

  describe('PDF utility functions', () => {
    it('should get PDF as base64', async () => {
      const { generateInvoicePDF, getPDFBase64 } = await import('../pdf-generator')
      const doc = await generateInvoicePDF(mockInvoice, mockItems, mockCustomer, mockTemplate)
      const base64 = getPDFBase64(doc)
      
      expect(base64).toBeDefined()
      expect(base64).toMatch(/^data:application\/pdf;/)
    })
  })
})
