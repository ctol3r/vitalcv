"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Wallet, ArrowRight, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import OfferQr from '@/app/components/OfferQr';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000/api';

interface Offer {
  offer_id: string;
  pre_authorized_code: string;
  offer: any;
}

interface Credential {
  credential: string;
  credential_id: string;
  format: string;
}

export default function ClinicianWallet() {
  const [subject, setSubject] = useState('did:key:z6MkhaXgBZkv9hittGJQ8LmZr7w8mJEbLGcHZZhL3NNLnLwt');
  const [code, setCode] = useState('');
  const [offerId, setOfferId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const getOffer = async () => {
    try {
      setLoading('offer');
      const r = await fetch(`${BASE}/oidc4vci/offer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectDid: subject, type: 'MedicalLicense', userHint: 'Demo Clinician' })
      });

      if (!r.ok) {
        throw new Error('Failed to create offer');
      }

      const js: Offer = await r.json();
      setCode(js.pre_authorized_code);
      setOfferId(js.offer_id);
      setStep(2);

      toast({
        title: 'Offer Created',
        description: 'Pre-authorized code generated successfully',
      });
    } catch (error) {
      console.error('Offer error:', error);
      toast({
        title: 'Error',
        description: 'Failed to create offer. Make sure backend is running.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const getToken = async () => {
    try {
      setLoading('token');
      const r = await fetch(`${BASE}/oidc4vci/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          'grant_type': 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': code
        })
      });

      if (!r.ok) {
        throw new Error('Failed to exchange token');
      }

      const js = await r.json();
      setAccessToken(js.access_token);
      setStep(3);

      toast({
        title: 'Token Received',
        description: 'Access token obtained successfully',
      });
    } catch (error) {
      console.error('Token error:', error);
      toast({
        title: 'Error',
        description: 'Failed to exchange token',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const getCredential = async () => {
    try {
      setLoading('credential');
      const r = await fetch(`${BASE}/oidc4vci/credential`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, subjectDid: subject })
      });

      if (!r.ok) {
        throw new Error('Failed to get credential');
      }

      const js: Credential = await r.json();
      setCredential(js);
      setStep(4);

      toast({
        title: 'Credential Received',
        description: 'Verifiable credential issued successfully',
      });
    } catch (error) {
      console.error('Credential error:', error);
      toast({
        title: 'Error',
        description: 'Failed to receive credential',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const reset = () => {
    setStep(1);
    setCode('');
    setOfferId('');
    setAccessToken('');
    setCredential(null);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Wallet className="h-8 w-8" />
              Clinician Wallet Demo
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              OIDC4VCI Pre-Authorized Code Flow
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            Round 11 Pilot
          </Badge>
        </div>

        {/* Flow Status */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step > 1 ? 'bg-green-600 text-white' : step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {step > 1 ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                </div>
                <span className="text-sm font-medium">Offer</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step > 2 ? 'bg-green-600 text-white' : step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {step > 2 ? <CheckCircle2 className="h-5 w-5" /> : '2'}
                </div>
                <span className="text-sm font-medium">Token</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step > 3 ? 'bg-green-600 text-white' : step === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {step > 3 ? <CheckCircle2 className="h-5 w-5" /> : '3'}
                </div>
                <span className="text-sm font-medium">Credential</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${step >= 4 ? 'text-foreground' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 4 ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                  {step === 4 ? <CheckCircle2 className="h-5 w-5" /> : '4'}
                </div>
                <span className="text-sm font-medium">Complete</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column - Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Set up your credential request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject DID</label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="did:key:z..."
                  disabled={step > 1}
                />
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  onClick={getOffer}
                  disabled={!subject || loading !== null || step > 1}
                  className="w-full"
                  size="lg"
                >
                  {loading === 'offer' ? 'Creating...' : '1️⃣ Create Offer'}
                </Button>

                <Button
                  onClick={getToken}
                  disabled={!code || loading !== null || step !== 2}
                  variant={step === 2 ? 'default' : 'outline'}
                  className="w-full"
                  size="lg"
                >
                  {loading === 'token' ? 'Exchanging...' : '2️⃣ Get Token'}
                </Button>

                <Button
                  onClick={getCredential}
                  disabled={!accessToken || loading !== null || step !== 3}
                  variant={step === 3 ? 'default' : 'outline'}
                  className="w-full"
                  size="lg"
                >
                  {loading === 'credential' ? 'Receiving...' : '3️⃣ Get Credential'}
                </Button>

                {step === 4 && (
                  <Button onClick={reset} variant="outline" className="w-full">
                    ↻ Start Over
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          {offerId && (
            <OfferQr offerId={offerId} size={192} />
          )}
        </div>

        {/* Right Column - Details */}
        <div className="space-y-4">
          {/* Pre-auth Code */}
          {code && (
            <Card>
              <CardHeader>
                <CardTitle>Pre-Authorized Code</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs bg-muted p-2 rounded block overflow-auto">
                  {code}
                </code>
              </CardContent>
            </Card>
          )}

          {/* Access Token */}
          {accessToken && (
            <Card>
              <CardHeader>
                <CardTitle>Access Token</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs bg-muted p-2 rounded block overflow-auto">
                  {accessToken}
                </code>
              </CardContent>
            </Card>
          )}

          {/* Credential */}
          {credential && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Credential Received
                </CardTitle>
                <CardDescription>
                  ID: <code className="text-xs">{credential.credential_id}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Format:</span>{' '}
                  <Badge variant="outline">{credential.format}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium mb-1 block">JWT:</span>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                    {credential.credential}
                  </pre>
                </div>
                <div className="pt-2 space-y-2">
                  <Link href={`/status/credential/${credential.credential_id}`}>
                    <Button variant="outline" className="w-full">
                      Check Revocation Status
                    </Button>
                  </Link>
                  <Link href={`/wallet/${credential.credential_id}`}>
                    <Button variant="default" className="w-full">
                      Open in Wallet
                    </Button>
                  </Link>
                  <Link href={`/verify?credential=${encodeURIComponent(credential.credential)}`}>
                    <Button variant="secondary" className="w-full">
                      Verify Credential
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          {!credential && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <AlertCircle className="h-5 w-5" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p><strong>Step 1:</strong> Create a credential offer with a pre-authorized code</p>
                <p><strong>Step 2:</strong> Exchange the code for an access token</p>
                <p><strong>Step 3:</strong> Use the token to receive your credential</p>
                <p className="pt-2 text-xs">
                  This demo implements the OIDC4VCI pre-authorized code grant flow
                  with StatusList2021 revocation support.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Links */}
      <Card className="mt-8">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-4">
              <Link href="/status/1" className="text-primary hover:underline">
                StatusList2021 →
              </Link>
              <Link href="/agent" className="text-primary hover:underline">
                Agent Dashboard →
              </Link>
              <a
                href={`${BASE.replace('/api', '')}/docs/pilot-flow.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Documentation →
              </a>
            </div>
            <Badge variant="secondary">ALITA-G Pilot</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

