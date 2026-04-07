import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Check Your NPI Readiness',
  description: 'Enter your NPI to instantly check your credentialing readiness across NPPES, OIG/LEIE, PECOS, and FSMB. No signup required for preview.',
};

export default function PassportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
