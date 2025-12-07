'use client';

/**
 * Contact Issuer Button
 *
 * Opens mailto template with prefilled information
 */

import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface ContactIssuerButtonProps {
  issuerEmail: string;
  issuerName?: string;
  credentialId: string;
  subject?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ContactIssuerButton({
  issuerEmail,
  issuerName,
  credentialId,
  subject,
  variant = 'outline',
  size = 'sm',
  className,
}: ContactIssuerButtonProps) {
  const handleContact = () => {
    const defaultSubject = subject || `Inquiry regarding Credential ${credentialId}`;
    const body = `Hello${issuerName ? ` ${issuerName}` : ''},

I am writing regarding the following credential:
- Credential ID: ${credentialId}

Please provide information about:
- [Your question or request]

Thank you for your assistance.

Best regards`;

    const mailtoLink = `mailto:${issuerEmail}?subject=${encodeURIComponent(
      defaultSubject,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoLink;
  };

  return (
    <Button variant={variant} size={size} onClick={handleContact} className={className}>
      <Mail className="h-4 w-4 mr-2" />
      Contact Issuer
    </Button>
  );
}
