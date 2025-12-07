/**
 * Batch 201 - Task 201.8 - Interop Hub UI
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function InteropHubPage() {
  const [format, setFormat] = useState<'vci' | 'vp'>('vci');
  const [disclosurePolicy, setDisclosurePolicy] = useState<'minimal' | 'standard' | 'full'>('standard');
  const [inputFormat, setInputFormat] = useState<'OIDC4VP' | 'SD-JWT' | 'DIDComm' | 'CHAPI' | 'W3C'>('W3C');
  const [result, setResult] = useState<any>(null);

  const handleOIDC4VCI = async () => {
    try {
      const res = await fetch('/api/interop/oidc4vci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vc: { type: 'VerifiableCredential' },
          format
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleSDJWT = async () => {
    try {
      const res = await fetch('/api/interop/sd-jwt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vc: { type: 'VerifiableCredential' },
          disclosurePolicy
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleRoute = async () => {
    try {
      const res = await fetch('/api/interop/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentation: { type: 'VerifiablePresentation' },
          inputFormat
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credential Interoperability Hub</h1>
        <p className="text-muted-foreground mt-2">
          Full compatibility with OIDC4VCI/VP, SD-JWT, EUDI, DIDComm, CHAPI, and legacy systems
        </p>
      </div>

      <Tabs defaultValue="oidc" className="w-full">
        <TabsList>
          <TabsTrigger value="oidc">OIDC4VCI/VP</TabsTrigger>
          <TabsTrigger value="sdjwt">SD-JWT</TabsTrigger>
          <TabsTrigger value="route">Multi-Format Router</TabsTrigger>
        </TabsList>

        <TabsContent value="oidc">
          <Card>
            <CardHeader>
              <CardTitle>OIDC4VCI/VP Adapter</CardTitle>
              <CardDescription>Convert credentials to OIDC4VCI/VP format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vci">OIDC4VCI</SelectItem>
                    <SelectItem value="vp">OIDC4VP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleOIDC4VCI}>Convert</Button>
              {result && (
                <Alert>
                  <AlertDescription>
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sdjwt">
          <Card>
            <CardHeader>
              <CardTitle>SD-JWT Claims Mapper</CardTitle>
              <CardDescription>Map claims with adaptive disclosure policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Disclosure Policy</Label>
                <Select value={disclosurePolicy} onValueChange={(v: any) => setDisclosurePolicy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSDJWT}>Map Claims</Button>
              {result && (
                <Alert>
                  <AlertDescription>
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="route">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Format Presentation Router</CardTitle>
              <CardDescription>Accept any format → normalize → verify</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Input Format</Label>
                <Select value={inputFormat} onValueChange={(v: any) => setInputFormat(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OIDC4VP">OIDC4VP</SelectItem>
                    <SelectItem value="SD-JWT">SD-JWT</SelectItem>
                    <SelectItem value="DIDComm">DIDComm</SelectItem>
                    <SelectItem value="CHAPI">CHAPI</SelectItem>
                    <SelectItem value="W3C">W3C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleRoute}>Route & Verify</Button>
              {result && (
                <Alert>
                  <AlertDescription>
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

