/**
 * Task 203.38 — Add frontend "Add to Wallet" button
 * Trigger credential-offer endpoint and show QR for wallet
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';
import { CredentialOfferModal } from './CredentialOfferModal';

interface AddToWalletButtonProps {
  credentialType: string;
  credentialConfigurationId: string;
  userId?: string;
  subjectDid?: string;
  npi?: string;
  metadata?: Record<string, any>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function AddToWalletButton({
  credentialType,
  credentialConfigurationId,
  userId,
  subjectDid,
  npi,
  metadata,
  variant = 'default',
  size = 'default',
  className,
}: AddToWalletButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credentialOffer, setCredentialOffer] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddToWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/oidc/credential-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialConfigurationIds: [credentialConfigurationId],
          userId,
          subjectDid,
          npi,
          metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to generate credential offer');
      }

      const data = await response.json();
      setCredentialOffer(data);
      setIsOpen(true);
    } catch (err: any) {
      console.error('Error generating credential offer:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleAddToWallet}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            Add to Wallet
          </>
        )}
      </Button>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {credentialOffer && (
        <CredentialOfferModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          credentialOffer={credentialOffer}
          credentialType={credentialType}
        />
      )}
    </>
  );
}

