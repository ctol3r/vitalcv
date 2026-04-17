import {
  JsonLd,
  ORGANIZATION_JSONLD,
} from '@/components/compare/JsonLd';
import type { Metadata } from 'next';
import { CalculatorClient } from './CalculatorClient';

export const metadata: Metadata = {
  title: 'Credentialing Cost Calculator — How Much Does Credentialing Cost?',
  description:
    'Calculate how much healthcare credentialing costs your organization. Enter your provider count and see estimated annual costs and potential savings with VitalCV.',
  alternates: {
    canonical: 'https://vitalcv.com/tools/credentialing-time-calculator',
  },
  openGraph: {
    title: 'Credentialing Cost Calculator',
    description:
      'How much does credentialing cost your organization? Calculate annual costs and potential savings.',
    url: 'https://vitalcv.com/tools/credentialing-time-calculator',
  },
};

export default function CredentialingCalculatorPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <JsonLd data={ORGANIZATION_JSONLD} />

      <div className="mx-auto max-w-3xl space-y-12">
        <header className="text-center space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Free Tool
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How Much Does Credentialing Cost Your Organization?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enter your numbers below to see estimated annual credentialing costs
            and how much you could save with faster verification.
          </p>
        </header>

        <CalculatorClient />
      </div>
    </main>
  );
}
