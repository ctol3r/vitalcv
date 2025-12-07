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
  Palette,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [loadingRequests, setLoadingRequests] = useState(true);
  const { session } = useSession();
  const [attestationRequests, setAttestationRequests] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([
    {
      id: 'CRED-12345',
      type: 'Medical License',
      holder: 'Dr. Sarah Johnson',
      issuer: 'California Medical Board',
      status: 'active',
      issuedDate: '2023-01-15',
      expiryDate: '2025-01-15',
    },
    {
      id: 'CRED-67890',
      type: 'Board Certification',
      holder: 'Dr. Michael Chen',
      issuer: 'American Board of Internal Medicine',
      status: 'active',
      issuedDate: '2023-03-20',
      expiryDate: '2026-03-20',
    },
    {
      id: 'CRED-11111',
      type: 'DEA Registration',
      holder: 'Dr. Emily Davis',
      issuer: 'Drug Enforcement Administration',
      status: 'revoked',
      issuedDate: '2022-06-10',
      expiryDate: '2025-06-10',
    },
  ]);

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

  // Branding state
  const [branding, setBranding] = useState<any>(null);
  const [brandingForm, setBrandingForm] = useState({
    logoUrl: '',
    primaryColor: '#2563eb', // Default blue-600
    accentColor: '#0f766e', // Default teal-700
    footerText: '',
  });

  const { toast } = useToast();

  // Load attestation requests and branding
  useEffect(() => {
    const loadData = async () => {
      setLoadingRequests(true);
      try {
        // Load requests
        const reqResponse = await fetch('/api/issuer/attest-request');
        if (reqResponse.ok) {
          const data = await reqResponse.json();
          setAttestationRequests(data.requests || []);
        }

        // Load branding
        const brandingResponse = await fetch('/api/org/customization');
        if (brandingResponse.ok) {
          const data = await brandingResponse.json();
          if (data && data.orgId) {
            setBranding(data);
            setBrandingForm({
              logoUrl: data.logoUrl || '',
              primaryColor: data.primaryColor || '#2563eb',
              accentColor: data.accentColor || '#0f766e',
              footerText: data.footerText || '',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoadingRequests(false);
      }
    };

    loadData();
  }, []);

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/org/customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandingForm),
      });

      if (!response.ok) throw new Error('Failed to update branding');

      const data = await response.json();
      setBranding(data);
      toast({
        title: 'Branding Updated',
        description: 'Organization customization has been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Could not update branding settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/issuer/credential`, {
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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/issuer/revoke`, {
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
      <header className="border-b bg-white/80 backdrop-blur-sm" style={{ borderTop: branding?.primaryColor ? `4px solid ${branding.primaryColor}` : undefined }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            {branding?.logoUrl ? (
               <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
               <Shield className="h-8 w-8" style={{ color: branding?.primaryColor || '#2563eb' }} />
            )}
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
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Credential Management</h1>
              <p className="text-lg text-gray-600">
                Issue new credentials and manage existing ones
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
                <TabsTrigger value="branding" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Branding
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
                    {loadingRequests ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-4 border rounded-lg bg-white/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-40" />
                              </div>
                              <Skeleton className="h-6 w-16" />
                            </div>
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-20" />
                              <Skeleton className="h-8 w-24" />
                              <Skeleton className="h-8 w-20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : attestationRequests.length === 0 ? (
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
                            style={{ borderLeftColor: branding?.primaryColor || undefined, borderLeftWidth: branding ? '4px' : undefined }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                    NPI: {request.npi}
                                    <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200 font-normal text-xs">
                                        Risk: Low
                                    </Badge>
                                </h3>
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
                              <Button size="sm" variant="default" style={{ backgroundColor: branding?.primaryColor }}>
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

              <TabsContent value="branding">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Organization Branding</CardTitle>
                    <CardDescription>
                      Customize your organization's appearance in the dashboard and issued credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateBranding} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="logoUrl">Logo URL</Label>
                            <Input
                              id="logoUrl"
                              placeholder="https://example.com/logo.png"
                              value={brandingForm.logoUrl}
                              onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
                            />
                            {brandingForm.logoUrl && (
                              <div className="mt-2 p-2 border rounded bg-gray-50 inline-block">
                                <img src={brandingForm.logoUrl} alt="Logo Preview" className="h-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="footerText">Footer Text</Label>
                            <Input
                              id="footerText"
                              placeholder="© 2025 My Organization"
                              value={brandingForm.footerText}
                              onChange={(e) => setBrandingForm({ ...brandingForm, footerText: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="primaryColor">Primary Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="primaryColor"
                                type="color"
                                className="w-12 h-10 p-1"
                                value={brandingForm.primaryColor}
                                onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                              />
                              <Input
                                value={brandingForm.primaryColor}
                                onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                                className="flex-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="accentColor">Accent Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="accentColor"
                                type="color"
                                className="w-12 h-10 p-1"
                                value={brandingForm.accentColor}
                                onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                              />
                              <Input
                                value={brandingForm.accentColor}
                                onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} style={{ backgroundColor: brandingForm.primaryColor }}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Palette className="mr-2 h-4 w-4" />}
                        Save Branding
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </RoleGuard>
      </main>
      {branding?.footerText && (
        <footer className="border-t bg-white/80 backdrop-blur-sm py-6 mt-12">
          <div className="container mx-auto px-4 text-center text-gray-500">
            {branding.footerText}
          </div>
        </footer>
      )}
    </div>
  );
}
