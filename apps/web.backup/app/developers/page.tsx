/**
 * Developers Portal Page
 * Task: 1106-frontend-0010
 *
 * API quickstarts (curl & JS) for /api/issuer/issue and /api/verifier/present
 * Error catalog with stable anchor links
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, CheckCircle2, Terminal, Code2, BookOpen, AlertTriangle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { VERIFIER_ERROR_MESSAGES, type VerifierErrorCode } from '@/lib/verifier-errors';

export default function DevelopersPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Developer Portal</h1>
        <p className="text-lg text-muted-foreground">
          Integration guides, API references, and error handling for VitalCV
        </p>
      </div>

      {/* Quick Start Section */}
      <section className="mb-16" id="quickstart">
        <h2 className="text-3xl font-bold mb-6">Quick Start</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Issuer API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Issue Credential
              </CardTitle>
              <CardDescription>POST /api/issuer/issue</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="curl">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(issuerCurlExample, 'cURL command')}
                    >
                      {copied === 'cURL command' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <ScrollArea className="h-64">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {issuerCurlExample}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="javascript" className="space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(issuerJsExample, 'JavaScript code')}
                    >
                      {copied === 'JavaScript code' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <ScrollArea className="h-64">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {issuerJsExample}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Verifier API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Verify Presentation
              </CardTitle>
              <CardDescription>POST /api/verifier/present</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="curl">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(verifierCurlExample, 'cURL verify')}
                    >
                      {copied === 'cURL verify' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <ScrollArea className="h-64">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {verifierCurlExample}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="javascript" className="space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(verifierJsExample, 'JavaScript verify')}
                    >
                      {copied === 'JavaScript verify' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <ScrollArea className="h-64">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {verifierJsExample}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Error Catalog Section */}
      <section id="error-catalog">
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <AlertTriangle className="h-8 w-8" />
          Error Catalog
        </h2>
        <p className="text-muted-foreground mb-8">
          Complete reference of all verification error codes with descriptions and recommended actions.
        </p>

        <div className="space-y-4">
          {Object.entries(VERIFIER_ERROR_MESSAGES).map(([code, error]) => (
            <Card key={code} id={`error-${code.toLowerCase()}`} className="scroll-mt-20">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {error.severity === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                    {error.severity === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                    <div>
                      <CardTitle className="text-xl">
                        <code className="font-mono">{code}</code>
                      </CardTitle>
                      <CardDescription className="mt-1">{error.userMessage}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'}>
                    {error.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">User Guidance:</p>
                    <p>{error.userGuidance}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Recoverable:</p>
                      <Badge variant={error.recoverable ? 'default' : 'outline'}>
                        {error.recoverable ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {error.ctaText && (
                      <div>
                        <p className="font-medium text-muted-foreground mb-1">Suggested CTA:</p>
                        <code className="text-xs">{error.ctaText}</code>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium text-xs text-muted-foreground mb-2">Example Response:</p>
                    <pre className="text-xs overflow-x-auto">
{`{
  "verified": false,
  "error": "${error.message}",
  "errorCode": "${code}",
  "details": "Additional context..."
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-12" />

      {/* Additional Resources */}
      <section>
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Additional Resources
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>API Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Complete API documentation with all endpoints and schemas
              </p>
              <Button variant="outline" className="w-full">
                View Docs →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SDK Libraries</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Client libraries for JavaScript, Python, Go, and more
              </p>
              <Button variant="outline" className="w-full">
                Browse SDKs →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Join our Discord for help, feedback, and feature requests
              </p>
              <Button variant="outline" className="w-full">
                Join Discord →
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// Example code snippets
const issuerCurlExample = `curl -X POST https://vitalcv.com/api/issuer/issue \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "credentialSubject": {
      "npi": "1234567893",
      "licenseNumber": "MD123456",
      "licenseType": "Medical Doctor",
      "state": "CA",
      "specialty": "Cardiology",
      "status": "Active"
    },
    "credentialType": "MedicalLicense",
    "expirationDate": "2025-12-31T23:59:59Z"
  }'`;

const issuerJsExample = `// Using fetch API
const response = await fetch('https://vitalcv.com/api/issuer/issue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    credentialSubject: {
      npi: '1234567893',
      licenseNumber: 'MD123456',
      licenseType: 'Medical Doctor',
      state: 'CA',
      specialty: 'Cardiology',
      status: 'Active'
    },
    credentialType: 'MedicalLicense',
    expirationDate: '2025-12-31T23:59:59Z'
  })
});

const result = await response.json();
console.log('Issued credential:', result);`;

const verifierCurlExample = `curl -X POST https://vitalcv.com/api/verifier/present \\
  -H "Content-Type: application/json" \\
  -d '{
    "presentation": "eyJhbGciOiJFZERTQS..."
  }'`;

const verifierJsExample = `// Using fetch API
const response = await fetch('https://vitalcv.com/api/verifier/present', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    presentation: 'eyJhbGciOiJFZERTQS...'  // VP JWT or JSON
  })
});

const result = await response.json();

if (result.verified) {
  console.log('✓ Verified!', result.credential);
} else {
  console.error('✗ Failed:', result.errorCode, result.error);
}`;
