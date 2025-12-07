'use client';

import { useState } from 'react';
import { DemoHeader } from '@/apps/web/src/components/layout/DemoHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Loader2, Lock } from 'lucide-react';

export default function DemoLoginPage() {
  const [npi, setNpi] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    // Demo-only behavior
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStatus('In the hosted demo we simulate OTP logins only. Enterprise tenants wire their production SSO providers.');
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <DemoHeader
        title="Demo Login"
        description="Use the mocked OTP flow below or review how enterprise customers launch VitalCV with their existing identity provider."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clinician OTP</CardTitle>
              <CardDescription>Demo accounts use a static OTP so you can explore without waiting for SMS/email.</CardDescription>
            </div>
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {status && (
              <Alert>
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="npi">NPI</Label>
              <Input
                id="npi"
                inputMode="numeric"
                maxLength={10}
                pattern="\\d{10}"
                placeholder="0000000000"
                value={npi}
                onChange={(event) => setNpi(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">Demo NPI: 1234567890</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                pattern="\\d{6}"
                placeholder="code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">Demo OTP: 000000</p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying demo credentials...
                </>
              ) : (
                'Sign in with OTP'
              )}
            </Button>

            <div className="pt-4 border-t">
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        disabled
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Login with SSO (Enterprise)
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>
                      Available in production tenants. Attach any SAML or OIDC provider so clinicians keep using their hospital credentials. Disabled in the hosted demo for safety.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
