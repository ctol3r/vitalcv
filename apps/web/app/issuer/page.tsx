'use client';

import type React from 'react';

import { DarkModeToggle } from '@/components/DarkModeToggle';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RoleGuard } from '@/components/RoleGuard';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/hooks/use-toast';
import { PilotBanner } from '@/components/PilotBanner';
import { usePilotMode } from '@/hooks/usePilotMode';
import { addEvent } from '@/lib/event-cache';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Credential {
  id: string;
  type: string;
  holder: string;
  issuer: string;
  status: 'active' | 'revoked' | 'expired';
  issuedDate: string;
  expiryDate?: string;
}

export default function IssuerPage() {
  const [activeTab, setActiveTab] = useState('issue');
  const [loading, setLoading] = useState(false);
  const { session } = useSession();
  const [attestationRequests, setAttestationRequests] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  // Issue form state
  const [issueForm, setIssueForm] = useState({
    credentialType: '',
    subjectId: '',
    licenseNumber: '',
    issuingAuthority: '',
    expiryDate: '',
    additionalData: '',
  });

  // Revoke form state
  const [revokeForm, setRevokeForm] = useState({
    credentialId: '',
    reason: '',
  });

  const { toast } = useToast();
  const { pilotEnabled, hospitalLabel, clinicianLabel } = usePilotMode();
  const issuerLabel = pilotEnabled ? hospitalLabel : 'Demo Hospital';
  const holderLabel = pilotEnabled ? clinicianLabel : 'Demo Clinician';

  // Load attestation requests
  useEffect(() => {
    const loadAttestationRequests = async () => {
      try {
        const response = await fetch('/api/issuer/attest-request');
        if (response.ok) {
          const data = await response.json();
          setAttestationRequests(data.requests || []);
        }
      } catch (error) {
        console.error('Failed to load attestation requests:', error);
      }
    };

    loadAttestationRequests();
  }, []);

  // Load issued credentials from the real backend (no demo mocks)
  useEffect(() => {
    let mounted = true;
    const loadCredentials = async () => {
      try {
        const resp = await fetch('/api/issuer/credentials', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Failed to load credentials: ${resp.status} ${resp.statusText}`);
        const data = await resp.json();
        const list = Array.isArray(data?.credentials) ? data.credentials : [];
        if (!mounted) return;
        setCredentials(
          list.map((c: any) => ({
            id: String(c.id),
            type: String(c.type || ''),
            holder: String(c.holder || ''),
            issuer: String(c.issuer || ''),
            status: (c.status === 'revoked' ? 'revoked' : 'active') as Credential['status'],
            issuedDate: String(c.issuedDate || ''),
            expiryDate: c.expiryDate ? String(c.expiryDate) : undefined,
          })),
        );
      } catch (error) {
        console.error('Failed to load credentials:', error);
        toast({
          title: 'Backend unavailable',
          description: 'Unable to load issued credentials. Check the Live Proof bar for system status.',
          variant: 'destructive',
        });
      }
    };

    loadCredentials();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/issuer/credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: issueForm.credentialType,
          subjectId: issueForm.subjectId,
          licenseNumber: issueForm.licenseNumber,
          issuingAuthority: issueForm.issuingAuthority,
          expiryDate: issueForm.expiryDate,
          additionalData: issueForm.additionalData
            ? JSON.parse(issueForm.additionalData)
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to issue credential: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const issuedId = data.credentialId || `CRED-${Date.now()}`;
      const jwt = data.jwt;

      // Add new credential to list
      const newCredential: Credential = {
        id: issuedId,
        type: issueForm.credentialType,
        holder: issueForm.subjectId,
        issuer: issueForm.issuingAuthority,
        status: 'active',
        issuedDate: new Date().toISOString().split('T')[0],
        expiryDate: issueForm.expiryDate,
      };

      setCredentials((prev) => [newCredential, ...prev]);

      // Save to localStorage for wallet
      const walletData = {
        credentialId: issuedId,
        jwt: jwt,
        timestamp: new Date().toISOString(),
        type: issueForm.credentialType,
        issuer: issueForm.issuingAuthority,
      };
      localStorage.setItem('vitalcv_last_issued', JSON.stringify(walletData));

      // Add issued event to cache
      addEvent({
        credentialId: issuedId,
        type: 'issued',
        timestamp: new Date().toISOString(),
        auditRef: data.auditRef,
        details: {
          issuer: issueForm.issuingAuthority,
          subjectId: issueForm.subjectId,
          reason: 'Credential issued',
        },
      });

      // Save to /tmp/issue.json for helper script
      if (typeof window !== 'undefined') {
        try {
          await fetch('/api/save-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(walletData),
          });
        } catch (err) {
          console.warn('Failed to save issue data:', err);
        }
      }

      // Reset form
      setIssueForm({
        credentialType: '',
        subjectId: '',
        licenseNumber: '',
        issuingAuthority: '',
        expiryDate: '',
        additionalData: '',
      });

      toast({
        title: 'Credential Issued',
        description: (
          <div className="space-y-2">
            <p>Credential {issuedId} has been successfully issued.</p>
            <div className="flex gap-2">
              <Link
                href={`/verify?jwt=${encodeURIComponent(issuedId)}`}
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                Verify Credential →
              </Link>
              <Link
                href={`/wallet`}
                className="text-green-600 hover:text-green-800 underline font-medium"
              >
                View Wallet →
              </Link>
            </div>
          </div>
        ),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to issue credential';
      toast({
        title: 'Issue Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/status/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: revokeForm.credentialId,
          reason: revokeForm.reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to revoke credential: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Update credential status in list
      setCredentials((prev) =>
        prev.map((cred) =>
          cred.id === revokeForm.credentialId ? { ...cred, status: 'revoked' as const } : cred,
        ),
      );

      // Add revoked event to cache
      addEvent({
        credentialId: revokeForm.credentialId,
        type: 'revoked',
        timestamp: new Date().toISOString(),
        auditRef: data.auditRef,
        details: {
          reason: revokeForm.reason,
        },
      });

      // Reset form
      setRevokeForm({
        credentialId: '',
        reason: '',
      });

      toast({
        title: 'Credential Revoked',
        description: `Credential ${revokeForm.credentialId} has been successfully revoked`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke credential';
      toast({
        title: 'Revocation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> };
      case 'revoked':
        return { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> };
      case 'expired':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: <AlertTriangle className="h-4 w-4" />,
        };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: null };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/wallet" className="text-gray-600 hover:text-blue-600 transition-colors">
              Wallet
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
            {session && session.roles.length > 1 && <RoleSwitcher availableRoles={session.roles} />}
            <DarkModeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12">
        <RoleGuard requireIssuerAccess>
          <PilotBanner />
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Credential Management</h1>
              <p className="text-lg text-gray-600">
                Issue new credentials and manage existing ones
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Operating as {issuerLabel} issuing to a {holderLabel}.
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="issue" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Issue Credential
                </TabsTrigger>
                <TabsTrigger value="revoke" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Revoke Credential
                </TabsTrigger>
                <TabsTrigger value="attestations" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Attestation Requests
                  {attestationRequests.length > 0 && (
                    <Badge className="ml-2">{attestationRequests.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issue">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Issue New Credential</CardTitle>
                    <CardDescription>Create and issue a new verifiable credential</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ErrorBoundary>
                      <form onSubmit={handleIssueCredential} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="credentialType">Credential Type *</Label>
                            <Select
                              value={issueForm.credentialType}
                              onValueChange={(value) =>
                                setIssueForm((prev) => ({ ...prev, credentialType: value }))
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select credential type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Medical License">Medical License</SelectItem>
                                <SelectItem value="Board Certification">
                                  Board Certification
                                </SelectItem>
                                <SelectItem value="DEA Registration">DEA Registration</SelectItem>
                                <SelectItem value="Nursing License">Nursing License</SelectItem>
                                <SelectItem value="Pharmacy License">Pharmacy License</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="licenseNumber">License Number *</Label>
                            <Input
                              id="licenseNumber"
                              type="text"
                              placeholder="Enter license number"
                              value={issueForm.licenseNumber}
                              onChange={(e) =>
                                setIssueForm((prev) => ({ ...prev, licenseNumber: e.target.value }))
                              }
                              required
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="subjectId">Subject ID *</Label>
                            <Input
                              id="subjectId"
                              type="text"
                              placeholder="Enter subject identifier (e.g., NPI, email)"
                              value={issueForm.subjectId}
                              onChange={(e) =>
                                setIssueForm((prev) => ({ ...prev, subjectId: e.target.value }))
                              }
                              required
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label htmlFor="issuingAuthority">Issuing Authority *</Label>
                            <Input
                              id="issuingAuthority"
                              type="text"
                              placeholder="Enter issuing authority"
                              value={issueForm.issuingAuthority}
                              onChange={(e) =>
                                setIssueForm((prev) => ({
                                  ...prev,
                                  issuingAuthority: e.target.value,
                                }))
                              }
                              required
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="expiryDate">Expiry Date</Label>
                          <Input
                            id="expiryDate"
                            type="date"
                            value={issueForm.expiryDate}
                            onChange={(e) =>
                              setIssueForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="additionalData">Additional Data (JSON)</Label>
                          <Textarea
                            id="additionalData"
                            placeholder='{"specialization": "Cardiology", "boardScore": 95}'
                            value={issueForm.additionalData}
                            onChange={(e) =>
                              setIssueForm((prev) => ({ ...prev, additionalData: e.target.value }))
                            }
                            className="mt-1"
                            rows={3}
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={
                            loading ||
                            !issueForm.credentialType ||
                            !issueForm.subjectId ||
                            !issueForm.licenseNumber ||
                            !issueForm.issuingAuthority
                          }
                          aria-describedby="issue-form-help"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Issuing Credential...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Issue Credential
                            </>
                          )}
                        </Button>
                        <div id="issue-form-help" className="sr-only">
                          Fill in all required fields to issue a new credential. The credential will
                          be saved to your wallet and can be verified immediately.
                        </div>
                      </form>
                    </ErrorBoundary>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="revoke">
                <div className="space-y-6">
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Revoke Credential</CardTitle>
                      <CardDescription>
                        Revoke an existing credential and provide a reason
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ErrorBoundary>
                        <form onSubmit={handleRevokeCredential} className="space-y-4">
                          <div>
                            <Label htmlFor="credentialId">Credential ID *</Label>
                            <Select
                              value={revokeForm.credentialId}
                              onValueChange={(value) =>
                                setRevokeForm((prev) => ({ ...prev, credentialId: value }))
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select credential to revoke" />
                              </SelectTrigger>
                              <SelectContent>
                                {credentials
                                  .filter((cred) => cred.status === 'active')
                                  .map((cred) => (
                                    <SelectItem key={cred.id} value={cred.id}>
                                      {cred.id} - {cred.holder} ({cred.type})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="reason">Reason for Revocation *</Label>
                            <Textarea
                              id="reason"
                              placeholder="Enter the reason for revoking this credential"
                              value={revokeForm.reason}
                              onChange={(e) =>
                                setRevokeForm((prev) => ({ ...prev, reason: e.target.value }))
                              }
                              required
                              className="mt-1"
                              rows={3}
                            />
                          </div>

                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Warning: Revoking a credential is permanent and cannot be undone. The
                              credential will be immediately marked as invalid.
                            </AlertDescription>
                          </Alert>

                          <Button
                            type="submit"
                            variant="destructive"
                            className="w-full"
                            disabled={loading || !revokeForm.credentialId || !revokeForm.reason}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Revoking Credential...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Revoke Credential
                              </>
                            )}
                          </Button>
                        </form>
                      </ErrorBoundary>
                    </CardContent>
                  </Card>

                  {/* Credentials List */}
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Issued Credentials</CardTitle>
                      <CardDescription>View and manage all issued credentials</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {credentials.map((credential) => {
                          const statusConfig = getStatusConfig(credential.status);
                          return (
                            <div
                              key={credential.id}
                              className="flex items-center justify-between p-4 border rounded-lg bg-white/50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold">{credential.id}</h3>
                                  <Badge className={statusConfig.color}>
                                    {statusConfig.icon}
                                    <span className="ml-1 capitalize">{credential.status}</span>
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">
                                  <strong>{credential.holder}</strong> - {credential.type}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Issued: {new Date(credential.issuedDate).toLocaleDateString()}
                                  {credential.expiryDate &&
                                    ` | Expires: ${new Date(
                                      credential.expiryDate,
                                    ).toLocaleDateString()}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="attestations">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Attestation Requests</CardTitle>
                    <CardDescription>
                      Review and approve Level 3 identity attestation requests from clinicians
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attestationRequests.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending attestation requests</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {attestationRequests.map((request) => (
                          <div
                            key={request.requestId}
                            className="p-4 border rounded-lg bg-white/50"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">NPI: {request.npi}</h3>
                                <p className="text-sm text-gray-600">
                                  Request ID: {request.requestId}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Requested: {new Date(request.requestedAt).toLocaleString()}
                                </p>
                              </div>
                              <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="default">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline">
                                Review Details
                              </Button>
                              <Button size="sm" variant="destructive">
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </RoleGuard>
      </main>
    </div>
  );
}
