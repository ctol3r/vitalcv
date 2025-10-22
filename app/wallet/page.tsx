'use client';

import { AccessLog, type AccessLogEntry } from '@/components/AccessLog';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { RevocationTimeline, type TimelineEvent } from '@/components/RevocationTimeline';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Credential {
  id: string;
  type: string;
  issuer: string;
  status: 'active' | 'revoked' | 'expired';
  issuedDate: string;
  expiryDate?: string;
}

export default function WalletPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [lastIssued, setLastIssued] = useState<any>(null);

  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    {
      type: 'issued',
      timestamp: '2023-01-15T10:00:00Z',
      auditRef: 'AUDIT-001',
      details: 'Credential issued by California Medical Board',
    },
    {
      type: 'verified',
      timestamp: '2023-06-10T14:30:00Z',
      auditRef: 'AUDIT-045',
      details: 'Verified by UCSF Medical Center',
    },
    {
      type: 'verified',
      timestamp: '2023-12-05T09:15:00Z',
      auditRef: 'AUDIT-102',
      details: 'Verified by Kaiser Permanente',
    },
  ]);

  const [accessLogEntries, setAccessLogEntries] = useState<AccessLogEntry[]>([
    {
      id: 'log-001',
      timestamp: '2023-12-05T09:15:00Z',
      credentialId: 'CRED-12345',
      verifier: 'Kaiser Permanente',
      auditRef: 'AUDIT-102',
      status: 'valid',
    },
    {
      id: 'log-002',
      timestamp: '2023-06-10T14:30:00Z',
      credentialId: 'CRED-12345',
      verifier: 'UCSF Medical Center',
      auditRef: 'AUDIT-045',
      status: 'valid',
    },
  ]);

  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('vitalcv_access_log');
    if (stored) {
      try {
        const parsedEntries = JSON.parse(stored);
        setAccessLogEntries(parsedEntries);
      } catch (error) {
        console.error('Failed to parse access log:', error);
      }
    }

    // Load last issued credential from localStorage
    const lastIssuedData = localStorage.getItem('vitalcv_last_issued');
    if (lastIssuedData) {
      try {
        const parsed = JSON.parse(lastIssuedData);
        setLastIssued(parsed);

        // Add to credentials list if not already there
        const existingCred = credentials.find((c) => c.id === parsed.credentialId);
        if (!existingCred) {
          const newCredential: Credential = {
            id: parsed.credentialId,
            type: parsed.type || 'Credential',
            issuer: parsed.issuer || 'Unknown',
            status: 'active',
            issuedDate: parsed.timestamp
              ? new Date(parsed.timestamp).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
          };
          setCredentials((prev) => [newCredential, ...prev]);
        }
      } catch (error) {
        console.error('Failed to parse last issued credential:', error);
      }
    }
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-100 text-green-800', label: 'Active' };
      case 'revoked':
        return { color: 'bg-red-100 text-red-800', label: 'Revoked' };
      case 'expired':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Expired' };
      default:
        return { color: 'bg-gray-100 text-gray-800', label: 'Unknown' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <header className="border-b bg-white/80 backdrop-blur-sm" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav
            className="hidden md:flex items-center space-x-6"
            role="navigation"
            aria-label="Main navigation"
          >
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <DarkModeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">My Wallet</h1>
          <p className="text-lg text-gray-600">
            Manage your verifiable credentials and access history
          </p>
          {lastIssued && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">Last Issued Credential</h3>
                  <p className="text-sm text-blue-700">
                    {lastIssued.type} - {lastIssued.credentialId}
                  </p>
                  <p className="text-xs text-blue-600">
                    Issued: {new Date(lastIssued.timestamp).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/verify?jwt=${encodeURIComponent(lastIssued.credentialId)}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Verify Now
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                  My Credentials
                </CardTitle>
                <CardDescription>
                  {credentials.length} credential{credentials.length !== 1 ? 's' : ''} in your
                  wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {credentials.map((credential) => {
                    const statusConfig = getStatusConfig(credential.status);
                    return (
                      <button
                        key={credential.id}
                        onClick={() => setSelectedCredential(credential.id)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                          selectedCredential === credential.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                        aria-pressed={selectedCredential === credential.id}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">{credential.type}</h3>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>ID:</strong> <code className="text-xs">{credential.id}</code>
                        </p>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Issuer:</strong> {credential.issuer}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Issued:</strong>{' '}
                          {new Date(credential.issuedDate).toLocaleDateString()}
                          {credential.expiryDate &&
                            ` | Expires: ${new Date(credential.expiryDate).toLocaleDateString()}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Tabs defaultValue="timeline" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="access">Access Log</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline">
                <RevocationTimeline
                  credentialId={selectedCredential || 'Select a credential'}
                  events={timelineEvents}
                />
              </TabsContent>

              <TabsContent value="access">
                <AccessLog entries={accessLogEntries} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
