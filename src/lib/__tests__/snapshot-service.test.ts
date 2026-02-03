import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../supabase'
import {
  createSnapshot,
  getSnapshot,
  getSnapshotsForReference,
  getSnapshotsByType,
  archiveWorkLogs,
  cleanupOldSnapshots,
} from '../snapshot-service'
import type { Snapshot } from '../../types/billing'

// Mock the supabase module completely
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('Snapshot Service', () => {
  const mockSnapshot: Snapshot = {
    id: 'snap-123',
    snapshot_type: 'invoice',
    reference_id: 'inv-123',
    snapshot_date: '2024-01-15',
    data: {
      invoice: {
        id: 'inv-123',
        invoice_number: 'INV-2024-001',
      },
    },
    notes: 'Test snapshot',
    created_at: '2024-01-15T10:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSnapshot', () => {
    it('should create a snapshot and return it', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSnapshot,
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await createSnapshot(
        'invoice',
        'inv-123',
        { invoice: { id: 'inv-123' } } as unknown as Parameters<typeof createSnapshot>[2],
        'Test snapshot'
      )

      expect(result).toEqual(mockSnapshot)
      expect(supabase.from).toHaveBeenCalledWith('snapshots')
      expect(mockInsert).toHaveBeenCalledWith({
        snapshot_type: 'invoice',
        reference_id: 'inv-123',
        snapshot_date: expect.any(String),
        data: { invoice: { id: 'inv-123' } },
        notes: 'Test snapshot',
      })
    })

    it('should return null on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await createSnapshot('invoice', 'inv-123', {})

      expect(result).toBeNull()
    })

    it('should use default notes if not provided', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSnapshot,
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>)

      await createSnapshot('report', 'rep-123', {})

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'report snapshot',
        })
      )
    })
  })

  describe('getSnapshot', () => {
    it('should fetch a snapshot by ID', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSnapshot,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshot('snap-123')

      expect(result).toEqual(mockSnapshot)
      expect(supabase.from).toHaveBeenCalledWith('snapshots')
    })

    it('should return null if snapshot not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshot('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getSnapshotsForReference', () => {
    it('should fetch all snapshots for a reference', async () => {
      const mockSnapshots = [mockSnapshot]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockSnapshots,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshotsForReference('inv-123')

      expect(result).toEqual(mockSnapshots)
    })

    it('should filter by type if provided', async () => {
      const mockEq = vi.fn()
      mockEq.mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      })
      mockEq.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [mockSnapshot],
          error: null,
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [mockSnapshot],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshotsForReference('inv-123', 'invoice')

      expect(result).toBeDefined()
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Error' },
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshotsForReference('inv-123')

      expect(result).toEqual([])
    })
  })

  describe('getSnapshotsByType', () => {
    it('should fetch snapshots by type', async () => {
      const mockSnapshots = [mockSnapshot]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockSnapshots,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSnapshotsByType('invoice')

      expect(result).toEqual(mockSnapshots)
    })
  })

  describe('archiveWorkLogs', () => {
    it('should create a snapshot for work logs', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockSnapshot,
                snapshot_type: 'work_log',
                reference_id: 'worklogs_2024-01-01_2024-01-31',
              },
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const workLogs = [
        { date: '2024-01-15', user: 'test', hours: 4 },
      ]

      const result = await archiveWorkLogs('2024-01-01', '2024-01-31', workLogs)

      expect(result).toBeDefined()
      expect(result?.snapshot_type).toBe('work_log')
    })
  })

  describe('cleanupOldSnapshots', () => {
    it('should delete old snapshots and return count', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await cleanupOldSnapshots('invoice', 30)

      expect(result).toBe(2)
    })

    it('should return 0 on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Error' },
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await cleanupOldSnapshots('invoice', 30)

      expect(result).toBe(0)
    })
  })
})
