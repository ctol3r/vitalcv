'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, Settings } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ATSOnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [orgId] = useState('demo-org-1'); // In production, get from auth

  async function handleConfigure() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/ats/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          provider,
          metadata: {
            apiUrl,
            apiKey,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStep(3);
      }
    } catch (error) {
      console.error('Configuration failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ATS Gateway Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Connect your ATS system (Workday, Taleo, Lever, Greenhouse) for instant verification
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Provider Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select ATS Provider</CardTitle>
              <CardDescription>Choose your ATS system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {['Workday', 'Taleo', 'Lever', 'Greenhouse'].map((p) => (
                  <Button
                    key={p}
                    variant={provider === p ? 'default' : 'outline'}
                    onClick={() => {
                      setProvider(p);
                      setStep(2);
                    }}
                    className="h-20"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Configure {provider}</CardTitle>
              <CardDescription>Enter your ATS API credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>API URL</Label>
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.workday.com/v1"
                />
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} variant="outline">
                  Back
                </Button>
                <Button onClick={handleConfigure} disabled={loading || !apiUrl || !apiKey}>
                  {loading ? 'Configuring...' : 'Configure'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Configuration Complete
              </CardTitle>
              <CardDescription>
                Your ATS gateway is now connected and ready to verify credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge>{provider}</Badge>
                  <span className="text-sm text-muted-foreground">Connected</span>
                </div>
                <Button onClick={() => window.location.href = '/employer/ats-sync'}>
                  Go to ATS Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

