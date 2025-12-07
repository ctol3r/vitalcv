/**
 * Start Page with NPI Entry
 * Detects NPI Type 1 (Individual) vs Type 2 (Organization)
 * Routes to appropriate onboarding flow
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  Shield,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function isValidNPI(npi: string) {
  if (!/^[12]\d{9}$/.test(npi)) return false;

  const payload = '80840' + npi.slice(0, 9);
  let sum = 0;

  for (let i = 0; i < payload.length; i++) {
    let d = parseInt(payload[payload.length - 1 - i], 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(npi[9], 10);
}

export default function StartPage() {
  const [npi, setNpi] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [npiData, setNpiData] = useState<any>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function handleGo() {
    setError('');
    setNpiData(null);

    if (!npi) {
      setError('Please enter an NPI number');
      return;
    }

    if (!isValidNPI(npi)) {
      setError('Invalid NPI format or checksum. Please check the number and try again.');

      // Log analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'npi_validation_failed', {
          npi_length: npi.length,
          error_type: 'invalid_format',
        });
      }

      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/npi/lookup?number=${npi}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.entityTypeCode) {
        setError('NPPES lookup failed or NPI not found. Please verify the number is correct.');

        // Log analytics event
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'npi_lookup_failed', {
            npi: npi,
            status: res.status,
          });
        }

        return;
      }

      setNpiData(data);

      // Log successful lookup
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'npi_lookup_success', {
          npi: npi,
          entity_type: data.entityTypeCode,
        });
      }

      toast({
        title: 'NPI Found',
        description: `${
          data.entityTypeCode === 1 ? 'Individual' : 'Organization'
        } provider detected`,
      });

      // Route based on entity type
      setTimeout(() => {
        if (data.entityTypeCode === 1) {
          router.push(`/claim/${npi}`); // Clinician wallet flow
        } else {
          router.push(`/org/${npi}`); // Organization issuer flow
        }
      }, 1500);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error('NPI lookup error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Welcome to VitalCV</h1>
          <p className="text-lg text-muted-foreground">
            Enter your NPI to get started with verifiable credentials
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Enter Your NPI Number</CardTitle>
            <CardDescription>
              We'll detect your provider type and route you to the appropriate workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* NPI Input */}
            <div className="space-y-2">
              <label htmlFor="npi-input" className="text-sm font-medium">
                National Provider Identifier (NPI)
              </label>
              <div className="flex gap-2">
                <Input
                  id="npi-input"
                  type="text"
                  inputMode="numeric"
                  value={npi}
                  onChange={(e) => setNpi(e.target.value.replace(/\D/g, ''))}
                  onKeyPress={handleKeyPress}
                  maxLength={10}
                  placeholder="Enter 10-digit NPI"
                  className={cn(
                    'font-mono text-lg',
                    error && 'border-red-500 focus-visible:ring-red-500',
                  )}
                  disabled={loading || !!npiData}
                />
                <Button onClick={handleGo} disabled={loading || !npi || !!npiData} size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : npiData ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Verified
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Message with NPI Data */}
            {npiData && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <strong>Provider Found:</strong>
                      <Badge variant="outline" className="bg-white">
                        {npiData.entityTypeCode === 1 ? (
                          <>
                            <User className="mr-1 h-3 w-3" />
                            Type 1 - Individual
                          </>
                        ) : (
                          <>
                            <Building2 className="mr-1 h-3 w-3" />
                            Type 2 - Organization
                          </>
                        )}
                      </Badge>
                    </div>
                    {npiData.basic?.name && <div className="text-sm">{npiData.basic.name}</div>}
                    <div className="text-xs text-muted-foreground">
                      Redirecting you to the appropriate workflow...
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>What happens next?</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <User className="h-4 w-4 mt-0.5 text-blue-600" />
                    <span>
                      <strong>Type 1 (Individual):</strong> Access your credential wallet and claim
                      verifiable credentials
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 text-purple-600" />
                    <span>
                      <strong>Type 2 (Organization):</strong> Set up your organization as a
                      credential issuer
                    </span>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Sample NPIs */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have an NPI? Try these samples:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNpi('1234567893')}
                  disabled={loading || !!npiData}
                >
                  Type 1 Sample
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNpi('2234567890')}
                  disabled={loading || !!npiData}
                >
                  Type 2 Sample
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Need help? Visit our{' '}
            <a href="/support" className="text-primary hover:underline">
              support page
            </a>{' '}
            or learn more about{' '}
            <a
              href="https://npiregistry.cms.hhs.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              NPI numbers
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
