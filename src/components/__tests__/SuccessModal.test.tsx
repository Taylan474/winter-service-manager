import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuccessModal from '../SuccessModal'

describe('SuccessModal Component', () => {
  const mockOnClose = vi.fn()
  
  const defaultProps = {
    title: 'Success!',
    message: 'Operation completed successfully',
    onClose: mockOnClose
  }

  // Reset mock before each test
  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('renders with correct title and message', () => {
    render(<SuccessModal {...defaultProps} />)
    
    expect(screen.getByText('Success!')).toBeInTheDocument()
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument()
  })

  it('displays checkmark icon', () => {
    render(<SuccessModal {...defaultProps} />)
    
    const svg = document.querySelector('.success-checkmark')
    expect(svg).toBeInTheDocument()
  })

  it('calls onClose when clicking the button', () => {
    render(<SuccessModal {...defaultProps} />)
    
    const button = screen.getByRole('button', { name: /verstanden/i })
    fireEvent.click(button)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the overlay', () => {
    render(<SuccessModal {...defaultProps} />)
    
    const overlay = document.querySelector('.success-overlay')
    if (overlay) {
      fireEvent.click(overlay)
    }
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders different titles and messages correctly', () => {
    const customProps = {
      title: 'Custom Title',
      message: 'Custom message text',
      onClose: mockOnClose
    }
    
    render(<SuccessModal {...customProps} />)
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom message text')).toBeInTheDocument()
  })
})