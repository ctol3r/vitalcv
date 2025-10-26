import { QRShare } from '@/components/QRShare';
import { useToast } from '@/hooks/use-toast';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock the useToast hook
jest.mock('@/hooks/use-toast');
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Mock the QRCodeDisplay component
jest.mock('@/components/QRCodeDisplay', () => ({
  QRCodeDisplay: ({ data, size, alt }: any) => (
    <div data-testid="qr-code-display" data-size={size} data-alt={alt}>
      QR Code for: {data}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('QRShare Component', () => {
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

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
    });

    // Mock window.open
    window.open = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    credentialId: 'test-credential-123',
    status: 'valid',
    details: {
      issuer: 'Test Issuer',
      issuedDate: '2024-01-01T00:00:00Z',
      expiryDate: '2025-01-01T00:00:00Z',
      reason: 'Test reason',
      disclosureType: 'full',
    },
  };

  describe('Rendering', () => {
    it('renders share QR and share link buttons', () => {
      render(<QRShare {...defaultProps} />);

      expect(screen.getByText('Share QR')).toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
    });

    it('opens QR dialog when share QR button is clicked', async () => {
      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(screen.getByText('Verifiable Presentation QR Code')).toBeInTheDocument();
      });
    });

    it('opens share dialog when share link button is clicked', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        expect(screen.getByText('One-Time Share Link')).toBeInTheDocument();
      });
    });
  });

  describe('QR Code Generation', () => {
    it('generates VP token when QR dialog is opened', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ vpToken: 'mock-vp-token-123' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4000/verifier/presentation',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              credentialId: 'test-credential-123',
              status: 'valid',
              details: defaultProps.details,
            }),
          }),
        );
      });
    });

    it('handles VP token generation error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to generate VP token',
          variant: 'destructive',
        });
      });
    });

    it('displays QR code when VP token is generated', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ vpToken: 'mock-vp-token-123' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(screen.getByTestId('qr-code-display')).toBeInTheDocument();
        expect(screen.getByText('mock-vp-token-123')).toBeInTheDocument();
      });
    });
  });

  describe('Share URL Generation', () => {
    it('generates share URL when share link dialog is opened', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        expect(screen.getByText('One-Time Share Link')).toBeInTheDocument();
        expect(screen.getByText(/https:\/\/example\.com\/verify\?data=/)).toBeInTheDocument();
      });
    });

    it('automatically copies share URL to clipboard', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: '✅ Copied',
          description: 'Share URL copied to clipboard',
          duration: 2000,
        });
      });
    });
  });

  describe('Copy to Clipboard', () => {
    it('copies VP token to clipboard', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ vpToken: 'mock-vp-token-123' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        const copyButton = screen.getByText('Copy Token');
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('mock-vp-token-123');
        expect(mockToast).toHaveBeenCalledWith({
          title: '✅ Copied',
          description: 'VP Token copied to clipboard',
          duration: 2000,
        });
      });
    });

    it('copies credential ID to clipboard', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        const copyIdButton = screen.getByText('Copy ID');
        fireEvent.click(copyIdButton);
      });

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-credential-123');
        expect(mockToast).toHaveBeenCalledWith({
          title: '✅ Copied',
          description: 'Credential ID copied to clipboard',
          duration: 2000,
        });
      });
    });

    it('handles clipboard error gracefully', async () => {
      const mockClipboardError = new Error('Clipboard access denied');
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(mockClipboardError);

      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: '❌ Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
          duration: 3000,
        });
      });
    });
  });

  describe('Download QR Code', () => {
    it('downloads QR code when download button is clicked', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ vpToken: 'mock-vp-token-123' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Mock document.createElement and click
      const mockLink = {
        download: '',
        href: '',
        click: jest.fn(),
      };
      const mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockLink as any);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        const downloadButton = screen.getByText('Download QR');
        fireEvent.click(downloadButton);
      });

      expect(mockLink.download).toBe('credential-test-credential-123-qr.png');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: '✅ Downloaded',
        description: 'QR code downloaded successfully',
        duration: 2000,
      });

      mockCreateElement.mockRestore();
    });
  });

  describe('Web Share API', () => {
    it('uses Web Share API when available', async () => {
      const mockShare = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        share: mockShare,
      });

      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        const shareButton = screen.getByText('Share');
        fireEvent.click(shareButton);
      });

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalledWith({
          title: 'VitalCV Credential Verification',
          text: 'Check this credential verification',
          url: expect.stringContaining('https://example.com/verify?data='),
        });
      });
    });

    it('falls back to clipboard when Web Share API is not available', async () => {
      // Remove navigator.share
      delete (navigator as any).share;

      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        const shareButton = screen.getByText('Share');
        fireEvent.click(shareButton);
      });

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });

    it('handles Web Share API error gracefully', async () => {
      const mockShare = jest.fn().mockRejectedValue(new Error('Share cancelled'));
      Object.assign(navigator, {
        share: mockShare,
      });

      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        const shareButton = screen.getByText('Share');
        fireEvent.click(shareButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: '❌ Error',
          description: 'Failed to share',
          variant: 'destructive',
          duration: 3000,
        });
      });
    });
  });

  describe('Open Link', () => {
    it('opens share URL in new tab when open link button is clicked', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      await waitFor(() => {
        const openLinkButton = screen.getByText('Open Link');
        fireEvent.click(openLinkButton);
      });

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/verify?data='),
        '_blank',
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles missing details gracefully', () => {
      const propsWithoutDetails = {
        credentialId: 'test-credential-123',
        status: 'valid',
      };

      render(<QRShare {...propsWithoutDetails} />);

      expect(screen.getByText('Share QR')).toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
    });

    it('handles network error during VP token generation', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to generate VP token',
          variant: 'destructive',
        });
      });
    });

    it('handles invalid response during VP token generation', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to generate VP token',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state while generating VP token', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          new Promise((resolve) => setTimeout(() => resolve({ vpToken: 'mock-token' }), 100)),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      render(<QRShare {...defaultProps} />);

      const shareQRButton = screen.getByText('Share QR');
      fireEvent.click(shareQRButton);

      // Should show loading spinner
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows loading state while generating share URL', async () => {
      render(<QRShare {...defaultProps} />);

      const shareLinkButton = screen.getByText('Share Link');
      fireEvent.click(shareLinkButton);

      // Should show loading spinner briefly
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

