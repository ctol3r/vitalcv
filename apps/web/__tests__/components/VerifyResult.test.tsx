import { VerifyResult } from '@/components/VerifyResult';
import { useToast } from '@/hooks/use-toast';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock the useToast hook
jest.mock('@/hooks/use-toast');
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Mock the QRShare component
jest.mock('@/components/QRShare', () => ({
  QRShare: ({ credentialId, status, details }: any) => (
    <div data-testid="qr-share">
      QR Share for {credentialId} - {status}
    </div>
  ),
}));

// Mock the RevocationTimeline component
jest.mock('@/components/RevocationTimeline', () => ({
  RevocationTimeline: ({ credentialId, isOpen, onToggle }: any) => (
    <div data-testid="revocation-timeline">
      <button onClick={onToggle} data-testid="toggle-timeline">
        Toggle Timeline
      </button>
      <div data-testid="timeline-open">{isOpen ? 'open' : 'closed'}</div>
    </div>
  ),
}));

describe('VerifyResult Component', () => {
  const mockToast = jest.fn();

  beforeEach(() => {
    mockUseToast.mockReturnValue({
      toast: mockToast,
      dismiss: jest.fn(),
      toasts: [],
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    result: {
      status: 'valid' as const,
      credentialId: 'test-credential-123',
      auditRef: 'audit-ref-456',
      timestamp: '2024-01-15T10:30:00Z',
      details: {
        issuer: 'Test Issuer',
        issuedDate: '2024-01-01T00:00:00Z',
        expiryDate: '2025-01-01T00:00:00Z',
        reason: 'Test reason',
        disclosureType: 'full',
      },
    },
    onRecheck: jest.fn(),
    isRechecking: false,
    lastCheckTime: new Date('2024-01-15T10:30:00Z'),
  };

  describe('Rendering', () => {
    it('renders valid credential status correctly', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText('Credential Valid')).toBeInTheDocument();
      expect(
        screen.getByText('This credential has been successfully verified and is currently active.'),
      ).toBeInTheDocument();
      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(screen.getByText('test-credential-123')).toBeInTheDocument();
    });

    it('renders revoked credential status correctly', () => {
      const revokedProps = {
        ...defaultProps,
        result: {
          ...defaultProps.result,
          status: 'revoked' as const,
        },
      };

      render(<VerifyResult {...revokedProps} />);

      expect(screen.getByText('Credential Revoked')).toBeInTheDocument();
      expect(
        screen.getByText('This credential has been revoked and is no longer valid.'),
      ).toBeInTheDocument();
      expect(screen.getByText('revoked')).toBeInTheDocument();
    });

    it('renders unknown credential status correctly', () => {
      const unknownProps = {
        ...defaultProps,
        result: {
          ...defaultProps.result,
          status: 'unknown' as const,
        },
      };

      render(<VerifyResult {...unknownProps} />);

      expect(screen.getByText('Credential Unknown')).toBeInTheDocument();
      expect(
        screen.getByText('This credential could not be found in our verification system.'),
      ).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('renders credential details when provided', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText('Test Issuer')).toBeInTheDocument();
      expect(screen.getByText('1/1/2024')).toBeInTheDocument(); // issued date
      expect(screen.getByText('1/1/2025')).toBeInTheDocument(); // expiry date
      expect(screen.getByText('Test reason')).toBeInTheDocument();
      expect(screen.getByText('full')).toBeInTheDocument();
    });

    it('renders audit reference when provided', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText('audit-ref-456')).toBeInTheDocument();
    });

    it('renders verification timestamp when provided', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText(/Verified:/)).toBeInTheDocument();
    });

    it('renders last check time when provided', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onRecheck when recheck button is clicked', () => {
      const mockOnRecheck = jest.fn();
      const props = { ...defaultProps, onRecheck: mockOnRecheck };

      render(<VerifyResult {...props} />);

      const recheckButton = screen.getByRole('button', { name: /re-check credential status/i });
      fireEvent.click(recheckButton);

      expect(mockOnRecheck).toHaveBeenCalledTimes(1);
    });

    it('shows loading state when rechecking', () => {
      const props = { ...defaultProps, isRechecking: true };

      render(<VerifyResult {...props} />);

      expect(screen.getByText('Re-checking...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /re-check credential status/i })).toBeDisabled();
    });

    it('copies credential ID to clipboard when copy button is clicked', async () => {
      render(<VerifyResult {...defaultProps} />);

      const copyButton = screen.getByRole('button', { name: /copy credential id to clipboard/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-credential-123');
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Copied',
          description: 'Credential ID copied to clipboard',
        });
      });
    });

    it('handles clipboard error gracefully', async () => {
      const mockClipboardError = new Error('Clipboard access denied');
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(mockClipboardError);

      render(<VerifyResult {...defaultProps} />);

      const copyButton = screen.getByRole('button', { name: /copy credential id to clipboard/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      });
    });

    it('toggles revocation timeline when timeline toggle is clicked', () => {
      render(<VerifyResult {...defaultProps} />);

      const toggleButton = screen.getByTestId('toggle-timeline');
      const timelineStatus = screen.getByTestId('timeline-open');

      // Initially closed
      expect(timelineStatus).toHaveTextContent('closed');

      // Click to open
      fireEvent.click(toggleButton);
      expect(timelineStatus).toHaveTextContent('open');

      // Click to close
      fireEvent.click(toggleButton);
      expect(timelineStatus).toHaveTextContent('closed');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<VerifyResult {...defaultProps} />);

      const card = screen.getByRole('region', { name: /credential valid/i });
      expect(card).toHaveAttribute('aria-live', 'polite');

      const recheckButton = screen.getByRole('button', { name: /re-check credential status/i });
      expect(recheckButton).toBeInTheDocument();

      const copyButton = screen.getByRole('button', { name: /copy credential id to clipboard/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('has proper screen reader text for icons', () => {
      render(<VerifyResult {...defaultProps} />);

      const icons = screen.getAllByRole('img', { hidden: true });
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing details gracefully', () => {
      const propsWithoutDetails = {
        ...defaultProps,
        result: {
          status: 'valid' as const,
          credentialId: 'test-credential-123',
        },
      };

      render(<VerifyResult {...propsWithoutDetails} />);

      expect(screen.getByText('Credential Valid')).toBeInTheDocument();
      expect(screen.getByText('test-credential-123')).toBeInTheDocument();
    });

    it('handles missing audit reference gracefully', () => {
      const propsWithoutAudit = {
        ...defaultProps,
        result: {
          ...defaultProps.result,
          auditRef: undefined,
        },
      };

      render(<VerifyResult {...propsWithoutAudit} />);

      expect(screen.getByText('Credential Valid')).toBeInTheDocument();
      expect(screen.queryByText('audit-ref-456')).not.toBeInTheDocument();
    });

    it('handles missing timestamp gracefully', () => {
      const propsWithoutTimestamp = {
        ...defaultProps,
        result: {
          ...defaultProps.result,
          timestamp: undefined,
        },
      };

      render(<VerifyResult {...propsWithoutTimestamp} />);

      expect(screen.getByText('Credential Valid')).toBeInTheDocument();
      expect(screen.queryByText(/Verified:/)).not.toBeInTheDocument();
    });

    it('handles missing last check time gracefully', () => {
      const propsWithoutLastCheck = {
        ...defaultProps,
        lastCheckTime: null,
      };

      render(<VerifyResult {...propsWithoutLastCheck} />);

      expect(screen.getByText('Credential Valid')).toBeInTheDocument();
      expect(screen.queryByText(/Last checked:/)).not.toBeInTheDocument();
    });

    it('handles partial details gracefully', () => {
      const propsWithPartialDetails = {
        ...defaultProps,
        result: {
          ...defaultProps.result,
          details: {
            issuer: 'Test Issuer',
            // Missing other details
          },
        },
      };

      render(<VerifyResult {...propsWithPartialDetails} />);

      expect(screen.getByText('Test Issuer')).toBeInTheDocument();
      expect(screen.queryByText('1/1/2024')).not.toBeInTheDocument();
      expect(screen.queryByText('Test reason')).not.toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats issued date correctly', () => {
      render(<VerifyResult {...defaultProps} />);

      // The date should be formatted according to the locale
      expect(screen.getByText('1/1/2024')).toBeInTheDocument();
    });

    it('formats expiry date correctly', () => {
      render(<VerifyResult {...defaultProps} />);

      expect(screen.getByText('1/1/2025')).toBeInTheDocument();
    });

    it('formats verification timestamp correctly', () => {
      render(<VerifyResult {...defaultProps} />);

      // Should show the formatted timestamp
      expect(screen.getByText(/Verified:/)).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('renders QRShare component with correct props', () => {
      render(<VerifyResult {...defaultProps} />);

      const qrShare = screen.getByTestId('qr-share');
      expect(qrShare).toHaveTextContent('QR Share for test-credential-123 - valid');
    });

    it('renders RevocationTimeline component with correct props', () => {
      render(<VerifyResult {...defaultProps} />);

      const timeline = screen.getByTestId('revocation-timeline');
      expect(timeline).toBeInTheDocument();

      const toggleButton = screen.getByTestId('toggle-timeline');
      expect(toggleButton).toBeInTheDocument();
    });
  });
});

