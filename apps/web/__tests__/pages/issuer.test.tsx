import { render, screen } from '@testing-library/react';
import IssuerPage from '@/app/issuer/page';

describe('Issuer Page', () => {
  it('renders the role headline and section layout', () => {
    render(<IssuerPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Issuer Attestation Console' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Purpose' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Core Signals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Primary Action' })).toBeInTheDocument();
  });

  it('labels placeholders as stubs', () => {
    render(<IssuerPage />);

    const stubLabels = screen.getAllByText(/Stub - no live data/i);
    expect(stubLabels.length).toBeGreaterThan(0);
  });

  it('includes a single primary action CTA', () => {
    render(<IssuerPage />);

    const cta = screen.getByRole('link', { name: 'Request Issuer Access' });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/signup');
  });
});
