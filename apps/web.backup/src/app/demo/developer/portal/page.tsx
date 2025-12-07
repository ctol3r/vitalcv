/**
 * Developer Portal UI
 *
 * Allows developers to sign up, manage API keys, upload modules,
 * view build status, scan results, and publish to marketplace.
 * Integrates OAuth and MFA.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import BuildStatus from '@/components/developer/BuildStatus';
import SecurityReportViewer from '@/components/developer/SecurityReportViewer';
import PublishingWizard from '@/components/developer/PublishingWizard';
import Link from 'next/link';

interface DeveloperAccount {
  id: string;
  email: string;
  name?: string;
  oauthProvider?: 'github' | 'google' | 'linkedin';
  mfaEnabled: boolean;
  createdAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
}

interface Module {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: 'draft' | 'uploading' | 'building' | 'scanning' | 'approved' | 'rejected' | 'published';
  buildStatus?: 'queued' | 'running' | 'passed' | 'failed';
  securityScanStatus?: 'pending' | 'passed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export default function DeveloperPortalPage() {
  const [account, setAccount] = useState<DeveloperAccount | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [showPublishingWizard, setShowPublishingWizard] = useState(false);

  useEffect(() => {
    fetchDeveloperData();
  }, []);

  async function fetchDeveloperData() {
    try {
      // Fetch developer account
      const accountRes = await fetch('/api/demo/developer/account');
      if (accountRes.status === 401) {
        setShowSignup(true);
        setLoading(false);
        return;
      }
      if (!accountRes.ok) throw new Error('Failed to fetch account');
      const accountData = await accountRes.json();
      setAccount(accountData);

      // Fetch API keys
      const keysRes = await fetch('/api/demo/developer/api-keys');
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
      }

      // Fetch modules
      const modulesRes = await fetch('/api/demo/developer/modules');
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        setModules(modulesData.modules || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(email: string, password: string, name?: string) {
    try {
      const res = await fetch('/api/demo/developer/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) throw new Error('Failed to sign up');
      const data = await res.json();
      setAccount(data.account);
      setShowSignup(false);
      await fetchDeveloperData();
    } catch (err) {
      alert(`Signup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleOAuthLogin(provider: 'github' | 'google' | 'linkedin') {
    // Redirect to OAuth provider
    window.location.href = `/api/demo/developer/oauth/${provider}`;
  }

  async function handleCreateApiKey(name: string) {
    try {
      const res = await fetch('/api/demo/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create API key');
      const data = await res.json();
      setApiKeys([...apiKeys, data.key]);
      setShowApiKeyForm(false);
      // Show the key once (it won't be shown again)
      alert(`API Key created: ${data.key.key}\n\nPlease copy this key now - it won't be shown again!`);
    } catch (err) {
      alert(`Failed to create API key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleDeleteApiKey(keyId: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const res = await fetch(`/api/demo/developer/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete API key');
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
    } catch (err) {
      alert(`Failed to delete API key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleUploadModule(file: File, name: string, description?: string) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      if (description) formData.append('description', description);

      const res = await fetch('/api/demo/developer/modules/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload module');
      await fetchDeveloperData();
      setShowUploadForm(false);
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleToggleMFA() {
    try {
      const res = await fetch('/api/demo/developer/mfa/toggle', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to toggle MFA');
      const data = await res.json();
      if (account) {
        setAccount({ ...account, mfaEnabled: data.mfaEnabled });
      }
    } catch (err) {
      alert(`Failed to toggle MFA: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Developer Portal</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (showSignup || !account) {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Developer Sign Up</CardTitle>
            <CardDescription>
              Create an account to start building and publishing modules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignupForm
              onSignup={handleSignup}
              onOAuthLogin={handleOAuthLogin}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Developer Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {account.name || account.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUploadForm(true)}>
            Upload Module
          </Button>
          <Link href="/demo/org/marketplace">
            <Button variant="outline">View Marketplace</Button>
          </Link>
        </div>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your developer account</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleToggleMFA}>
              {account.mfaEnabled ? 'Disable' : 'Enable'} MFA
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{account.email}</span>
            </div>
            {account.oauthProvider && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">OAuth Provider:</span>
                <Badge variant="outline">{account.oauthProvider}</Badge>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">MFA:</span>
              <Badge variant={account.mfaEnabled ? 'default' : 'outline'}>
                {account.mfaEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">
            Modules ({modules.length})
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            API Keys ({apiKeys.length})
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>My Modules</CardTitle>
              <CardDescription>
                Upload, build, and publish modules to the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Build</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{module.name}</div>
                            {module.description && (
                              <div className="text-xs text-muted-foreground">
                                {module.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{module.version}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              module.status === 'published'
                                ? 'default'
                                : module.status === 'rejected'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {module.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {module.buildStatus && (
                            <BuildStatus
                              moduleId={module.id}
                              status={module.buildStatus}
                              compact
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {module.securityScanStatus && (
                            <Badge
                              variant={
                                module.securityScanStatus === 'passed'
                                  ? 'default'
                                  : module.securityScanStatus === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                              }
                            >
                              {module.securityScanStatus}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedModule(module)}
                            >
                              View Details
                            </Button>
                            {module.status === 'approved' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedModule(module);
                                  setShowPublishingWizard(true);
                                }}
                              >
                                Publish
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No modules yet. Upload your first module to get started!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Manage your API keys for programmatic access
                  </CardDescription>
                </div>
                <Button onClick={() => setShowApiKeyForm(true)}>
                  Create API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {key.key.substring(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.lastUsed
                            ? new Date(key.lastUsed).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteApiKey(key.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No API keys yet. Create one to get started!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Module Details Modal */}
      {selectedModule && !showPublishingWizard && (
        <ModuleDetailsModal
          module={selectedModule}
          onClose={() => setSelectedModule(null)}
        />
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <UploadModuleForm
          onUpload={handleUploadModule}
          onClose={() => setShowUploadForm(false)}
        />
      )}

      {/* API Key Form */}
      {showApiKeyForm && (
        <CreateApiKeyForm
          onCreate={handleCreateApiKey}
          onClose={() => setShowApiKeyForm(false)}
        />
      )}

      {/* Publishing Wizard */}
      {showPublishingWizard && selectedModule && (
        <PublishingWizard
          module={selectedModule}
          onComplete={() => {
            setShowPublishingWizard(false);
            setSelectedModule(null);
            fetchDeveloperData();
          }}
          onCancel={() => {
            setShowPublishingWizard(false);
            setSelectedModule(null);
          }}
        />
      )}
    </div>
  );
}

// Signup Form Component
function SignupForm({
  onSignup,
  onOAuthLogin,
}: {
  onSignup: (email: string, password: string, name?: string) => void;
  onOAuthLogin: (provider: 'github' | 'google' | 'linkedin') => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Name (optional)</label>
        <Input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Email</label>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        onClick={() => onSignup(email, password, name)}
      >
        Sign Up
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={() => onOAuthLogin('github')}
        >
          GitHub
        </Button>
        <Button
          variant="outline"
          onClick={() => onOAuthLogin('google')}
        >
          Google
        </Button>
        <Button
          variant="outline"
          onClick={() => onOAuthLogin('linkedin')}
        >
          LinkedIn
        </Button>
      </div>
    </div>
  );
}

// Module Details Modal Component
function ModuleDetailsModal({
  module,
  onClose,
}: {
  module: Module;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{module.name}</CardTitle>
              <CardDescription>v{module.version}</CardDescription>
            </div>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Build Status</h3>
            <BuildStatus moduleId={module.id} status={module.buildStatus || 'queued'} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Security Scan</h3>
            <SecurityReportViewer moduleId={module.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Upload Module Form Component
function UploadModuleForm({
  onUpload,
  onClose,
}: {
  onUpload: (file: File, name: string, description?: string) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload New Module</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Module File</label>
          <Input
            type="file"
            accept=".zip,.tar.gz"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Module Name</label>
          <Input
            type="text"
            placeholder="my-awesome-module"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Description (optional)</label>
          <Input
            type="text"
            placeholder="What does this module do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (file && name) {
                onUpload(file, name, description || undefined);
              }
            }}
            disabled={!file || !name}
          >
            Upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Create API Key Form Component
function CreateApiKeyForm({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create API Key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Key Name</label>
          <Input
            type="text"
            placeholder="Production API Key"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (name) {
                onCreate(name);
              }
            }}
            disabled={!name}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

