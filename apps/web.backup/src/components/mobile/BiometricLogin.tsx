/**
 * BiometricLogin UI Component
 * Task: B244C-MOF-028
 *
 * Provides interface to initiate biometric authentication
 * Displays fingerprint/Face ID icons
 * Shows fallback
 * Integrates with BiometricAuthIntegration
 * Responsive design
 */

'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, ScanFace, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  biometricAuthIntegration,
  type BiometricAvailability,
} from '@/lib/services/BiometricAuthIntegration';
import { cn } from '@/lib/utils';

interface BiometricLoginProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onFallback?: () => void;
  className?: string;
}

export function BiometricLogin({
  onSuccess,
  onError,
  onFallback,
  className,
}: BiometricLoginProps) {
  const [availability, setAvailability] = useState<BiometricAvailability>(
    biometricAuthIntegration.getAvailability(),
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check availability on mount
    const avail = biometricAuthIntegration.getAvailability();
    setAvailability(avail);
  }, []);

  const handleAuthenticate = async () => {
    if (!availability.available) {
      if (onFallback) {
        onFallback();
      }
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const success = await biometricAuthIntegration.authenticate({
        timeout: 60000,
      });

      if (success) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const authError = new Error('Biometric authentication failed');
        setError('Authentication failed. Please try again.');
        if (onError) {
          onError(authError);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getIcon = () => {
    switch (availability.type) {
      case 'fingerprint':
        return Fingerprint;
      case 'face':
        return ScanFace;
      case 'touch':
        return Fingerprint;
      default:
        return Lock;
    }
  };

  const getLabel = () => {
    switch (availability.type) {
      case 'fingerprint':
        return 'Use Fingerprint';
      case 'face':
        return 'Use Face ID';
      case 'touch':
        return 'Use Touch ID';
      default:
        return 'Biometric Login';
    }
  };

  const Icon = getIcon();

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          Biometric Authentication
        </CardTitle>
        <CardDescription>
          {availability.available
            ? `Use ${availability.type === 'face' ? 'Face ID' : availability.type === 'touch' ? 'Touch ID' : 'Fingerprint'} to sign in securely`
            : 'Biometric authentication is not available on this device'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {availability.available ? (
          <Button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className="w-full"
            size="lg"
            aria-label={getLabel()}
          >
            {isAuthenticating ? (
              <>
                <Lock className="mr-2 h-5 w-5 animate-pulse" />
                Authenticating...
              </>
            ) : (
              <>
                <Icon className="mr-2 h-5 w-5" />
                {getLabel()}
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Biometric authentication is not available. Please use an alternative login method.
              </AlertDescription>
            </Alert>
            {onFallback && (
              <Button onClick={onFallback} variant="outline" className="w-full">
                Use Password
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

