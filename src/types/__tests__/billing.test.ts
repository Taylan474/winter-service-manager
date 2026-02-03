import { describe, it, expect } from 'vitest'
import type {
  Customer,
  Pricing,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceTemplate,
  Report,
  Snapshot,
} from '../billing'

// Type validation tests - these verify the type definitions are correct
// No runtime logic, just compile-time type checking

describe('Billing Types', () => {
  describe('Customer type', () => {
    it('should accept valid customer data', () => {
      const customer: Customer = {
        id: 'cust-123',
        name: 'Max Mustermann',
        email: 'max@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(customer.id).toBe('cust-123')
      expect(customer.name).toBe('Max Mustermann')
    })

    it('should accept optional fields', () => {
      const customer: Customer = {
        id: 'cust-123',
        name: 'Test',
        company: 'Test GmbH',
        email: 'test@test.de',
        phone: '+49 123 456',
        address: 'Street 1',
        postal_code: '12345',
        city: 'Berlin',
        notes: 'VIP customer',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(customer.company).toBe('Test GmbH')
      expect(customer.notes).toBe('VIP customer')
    })
  })

  describe('Pricing type', () => {
    it('should accept valid pricing data', () => {
      const pricing: Pricing = {
        id: 'price-123',
        name: 'Standard Rate',
        unit: 'hour',
        price_per_unit: 25.00,
        tax_rate: 19,
        is_active: true,
        valid_from: '2024-01-01',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(pricing.price_per_unit).toBe(25.00)
      expect(pricing.is_active).toBe(true)
    })

    it('should handle optional description and valid_until fields', () => {
      const pricing: Pricing = {
        id: 'price-123',
        name: 'Basic',
        description: 'Basic pricing tier',
        unit: 'fixed',
        price_per_unit: 100,
        tax_rate: 19,
        is_active: true,
        valid_from: '2024-01-01',
        valid_until: '2024-12-31',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(pricing.description).toBe('Basic pricing tier')
      expect(pricing.valid_until).toBe('2024-12-31')
    })
  })

  describe('Invoice type', () => {
    it('should accept valid invoice data', () => {
      const invoice: Invoice = {
        id: 'inv-123',
        customer_id: 'cust-123',
        invoice_number: 'INV-2024-001',
        status: 'draft',
        issue_date: '2024-01-15',
        due_date: '2024-02-15',
        subtotal: 1000,
        tax_amount: 190,
        total: 1190,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      }

      expect(invoice.status).toBe('draft')
      expect(invoice.total).toBe(1190)
    })

    it('should validate invoice status values', () => {
      const statuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
      
      statuses.forEach(status => {
        const invoice: Invoice = {
          id: 'inv-123',
          customer_id: 'cust-123',
          invoice_number: 'INV-001',
          status,
          issue_date: '2024-01-15',
          due_date: '2024-02-15',
          subtotal: 100,
          tax_amount: 19,
          total: 119,
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        }
        
        expect(invoice.status).toBe(status)
      })
    })
  })

  describe('InvoiceItem type', () => {
    it('should accept valid invoice item data', () => {
      const item: InvoiceItem = {
        id: 'item-123',
        invoice_id: 'inv-123',
        description: 'Winterdienst',
        quantity: 10,
        price_per_unit: 50,
        tax_rate: 19,
        line_total: 500,
        sort_order: 1,
        created_at: '2024-01-15T00:00:00Z',
      }

      expect(item.quantity).toBe(10)
      expect(item.line_total).toBe(500)
    })

    it('should handle optional unit field', () => {
      const item: InvoiceItem = {
        id: 'item-123',
        invoice_id: 'inv-123',
        description: 'Arbeitsstunden',
        quantity: 8,
        unit: 'Stunden',
        price_per_unit: 30,
        tax_rate: 19,
        line_total: 240,
        sort_order: 1,
        created_at: '2024-01-15T00:00:00Z',
      }

      expect(item.unit).toBe('Stunden')
    })
  })

  describe('InvoiceTemplate type', () => {
    it('should accept valid template data', () => {
      const template: InvoiceTemplate = {
        id: 'tpl-123',
        name: 'Standard',
        company_name: 'Winterdienst GmbH',
        company_address: 'Winterstraße 1',
        company_postal_code: '12345',
        company_city: 'Berlin',
        is_default: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(template.company_name).toBe('Winterdienst GmbH')
      expect(template.is_default).toBe(true)
    })

    it('should handle optional bank details', () => {
      const template: InvoiceTemplate = {
        id: 'tpl-123',
        name: 'With Bank',
        company_bank_name: 'Sparkasse',
        company_bank_iban: 'DE89 3704 0044 0532 0130 00',
        company_bank_bic: 'COBADEFFXXX',
        is_default: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(template.company_bank_iban).toBeDefined()
    })
  })

  describe('Report type', () => {
    it('should accept valid report data', () => {
      const report: Report = {
        id: 'rep-123',
        report_number: 'REP-2024-001',
        title: 'Monthly Report',
        report_type: 'monthly',
        status: 'draft',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        data: {
          summary: {
            total_hours: 100,
            total_streets: 50,
            streets_completed: 45,
            streets_in_progress: 5,
            streets_open: 0,
          },
        },
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
      }

      expect(report.report_type).toBe('monthly')
      expect(report.data.summary?.total_hours).toBe(100)
    })

    it('should handle different report types', () => {
      const reportTypes = ['daily', 'weekly', 'monthly', 'custom', 'work_summary'] as const
      
      reportTypes.forEach(type => {
        const report: Report = {
          id: 'rep-123',
          report_number: 'REP-001',
          title: 'Test',
          report_type: type,
          status: 'finalized',
          period_start: '2024-01-01',
          period_end: '2024-01-31',
          data: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
        
        expect(report.report_type).toBe(type)
      })
    })
  })

  describe('Snapshot type', () => {
    it('should accept valid snapshot data', () => {
      const snapshot: Snapshot = {
        id: 'snap-123',
        snapshot_type: 'invoice',
        reference_id: 'inv-123',
        snapshot_date: '2024-01-15',
        data: { invoice: { id: 'inv-123' } },
        created_at: '2024-01-15T00:00:00Z',
      }

      expect(snapshot.snapshot_type).toBe('invoice')
      expect(snapshot.data).toBeDefined()
    })

    it('should handle optional notes', () => {
      const snapshot: Snapshot = {
        id: 'snap-123',
        snapshot_type: 'report',
        reference_id: 'rep-123',
        snapshot_date: '2024-01-31',
        data: {},
        notes: 'End of month snapshot',
        created_at: '2024-01-31T23:59:59Z',
      }

      expect(snapshot.notes).toBe('End of month snapshot')
    })
  })
})

// Utility functions that could be added for billing validation
describe('Billing Utility Functions', () => {
  describe('Invoice calculations', () => {
    it('should calculate line total correctly', () => {
      const calculateLineTotal = (quantity: number, pricePerUnit: number): number => {
        return quantity * pricePerUnit
      }

      expect(calculateLineTotal(10, 50)).toBe(500)
      expect(calculateLineTotal(2.5, 100)).toBe(250)
    })

    it('should calculate tax amount correctly', () => {
      const calculateTax = (subtotal: number, taxRate: number): number => {
        return subtotal * (taxRate / 100)
      }

      expect(calculateTax(100, 19)).toBe(19)
      expect(calculateTax(1000, 7)).toBe(70)
    })

    it('should calculate invoice total correctly', () => {
      const calculateTotal = (subtotal: number, taxAmount: number): number => {
        return subtotal + taxAmount
      }

      expect(calculateTotal(100, 19)).toBe(119)
      expect(calculateTotal(1000, 190)).toBe(1190)
    })

    it('should round to 2 decimal places', () => {
      const roundCurrency = (amount: number): number => {
        return Math.round(amount * 100) / 100
      }

      expect(roundCurrency(10.999)).toBe(11)
      expect(roundCurrency(10.004)).toBe(10)
      expect(roundCurrency(10.005)).toBe(10.01)
    })
  })

  describe('Invoice number generation', () => {
    it('should generate sequential invoice numbers', () => {
      const generateInvoiceNumber = (prefix: string, year: number, sequence: number): string => {
        return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
      }

      expect(generateInvoiceNumber('INV', 2024, 1)).toBe('INV-2024-0001')
      expect(generateInvoiceNumber('INV', 2024, 42)).toBe('INV-2024-0042')
      expect(generateInvoiceNumber('INV', 2024, 9999)).toBe('INV-2024-9999')
    })
  })

  describe('Date formatting', () => {
    it('should format date for German locale', () => {
      const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      }

      expect(formatDate('2024-01-15')).toBe('15.01.2024')
    })

    it('should calculate due date from issue date', () => {
      const calculateDueDate = (issueDate: string, daysUntilDue: number): string => {
        const date = new Date(issueDate)
        date.setDate(date.getDate() + daysUntilDue)
        return date.toISOString().split('T')[0]
      }

      expect(calculateDueDate('2024-01-15', 30)).toBe('2024-02-14')
      expect(calculateDueDate('2024-01-01', 14)).toBe('2024-01-15')
    })
  })
})
