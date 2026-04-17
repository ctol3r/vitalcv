import type { Metadata } from 'next';
import { IssuerPortal } from '@/components/issuer/IssuerPortal';

export const metadata: Metadata = {
  title: 'Issuer Command Center',
  description:
    'Issue, manage, and revoke cryptographically signed SD-JWT credentials ' +
    'for clinicians across your network.',
  robots: { index: false },
};

export default function IssuerPage() {
  return <IssuerPortal />;
}
