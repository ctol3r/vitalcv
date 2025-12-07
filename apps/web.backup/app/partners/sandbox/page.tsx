'use client';

/**
 * B133B-FE-005: Partner sandbox portal: API keys + quickstart panel
 *
 * Partner sandbox portal for managing API keys and viewing quickstart documentation.
 * Features:
 * - List all sandbox API keys
 * - Generate new sandbox keys
 * - Revoke/rotate keys
 * - Copy-to-clipboard for quick access
 * - View quickstart code snippets
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Copy,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Code
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SandboxKey {
  id: string;
  partnerId: string;
  keyPrefix: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export default function PartnerSandboxPage() {
  const [keys, setKeys] = useState<SandboxKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState('partner_demo');
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ key: string; keyPrefix: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, [partnerId]);

  async function loadKeys() {
    setLoading(true);
    try {
      const response = await fetch(`/api/sandbox/keys?partnerId=${partnerId}`);
      const data = await response.json();

      if (response.ok) {
        setKeys(data.keys || []);
      } else {
        toast({
          title: 'Error loading keys',
          description: data.message || 'Failed to load sandbox keys',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect to sandbox API',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/sandbox/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          name: newKeyName,
          metadata: {
            createdFrom: 'partner-portal',
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewlyCreatedKey({
          key: data.key,
          keyPrefix: data.keyPrefix,
        });
        setShowNewKeyDialog(false);
        setNewKeyName('');
        loadKeys();

        toast({
          title: 'API key created',
          description: 'Your new sandbox API key has been created',
        });
      } else {
        toast({
          title: 'Error creating key',
          description: data.message || 'Failed to create API key',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/sandbox/keys/${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadKeys();
        toast({
          title: 'Key revoked',
          description: 'API key has been revoked',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error revoking key',
          description: data.message || 'Failed to revoke API key',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  }

  async function rotateKey(keyId: string) {
    if (!confirm('Are you sure you want to rotate this API key? The old key will be revoked immediately.')) {
      return;
    }

    try {
      const response = await fetch(`/api/sandbox/keys/${keyId}/rotate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setNewlyCreatedKey({
          key: data.newKey.key,
          keyPrefix: data.newKey.keyPrefix,
        });
        loadKeys();
        toast({
          title: 'Key rotated',
          description: 'New API key has been issued',
        });
      } else {
        toast({
          title: 'Error rotating key',
          description: data.message || 'Failed to rotate API key',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to rotate API key',
        variant: 'destructive',
      });
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);

    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  }

  const codeSnippets = {
    curl: `curl -X POST \\
  -H "x-api-key: YOUR_SANDBOX_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "partnerId": "${partnerId}",
    "jobId": "job_123",
    "ttlSeconds": 1800
  }' \\
  https://sandbox-api.vitalcv.com/api/partners/widget-tokens`,

    javascript: `const response = await fetch('https://sandbox-api.vitalcv.com/api/partners/widget-tokens', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_SANDBOX_KEY_HERE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    partnerId: '${partnerId}',
    jobId: 'job_123',
    ttlSeconds: 1800
  })
});

const data = await response.json();
console.log('Widget token:', data.token);`,

    python: `import requests

response = requests.post(
    'https://sandbox-api.vitalcv.com/api/partners/widget-tokens',
    headers={
        'x-api-key': 'YOUR_SANDBOX_KEY_HERE',
        'Content-Type': 'application/json'
    },
    json={
        'partnerId': '${partnerId}',
        'jobId': 'job_123',
        'ttlSeconds': 1800
    }
)

data = response.json()
print('Widget token:', data['token'])`,
  };

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sandbox Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your sandbox API keys and test the VitalCV widget integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full text-sm font-medium">
            🏖️ Sandbox Mode
          </span>
        </div>
      </div>

      {/* Environment Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Sandbox Environment:</strong> This is a completely separate environment from production.
          All data is sample data and will never touch production systems.
        </AlertDescription>
      </Alert>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Sandbox API Keys
              </CardTitle>
              <CardDescription>
                Manage your sandbox API keys. These keys only work in the sandbox environment.
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewKeyDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading keys...
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet. Create your first sandbox key to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {key.keyPrefix}
                      </code>
                      <span className="font-medium">{key.name}</span>
                      {key.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  {key.isActive && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rotateKey(key.id)}
                        title="Rotate key"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeKey(key.id)}
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quickstart Code Snippets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Quickstart: Generate Widget Token
          </CardTitle>
          <CardDescription>
            Use these code snippets to generate widget tokens from your backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* cURL */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>cURL</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(codeSnippets.curl, 'cURL snippet')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{codeSnippets.curl}</code>
            </pre>
          </div>

          {/* JavaScript */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>JavaScript / Node.js</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(codeSnippets.javascript, 'JavaScript snippet')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{codeSnippets.javascript}</code>
            </pre>
          </div>

          {/* Python */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Python</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(codeSnippets.python, 'Python snippet')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{codeSnippets.python}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="/docs/partners/sandbox-quickstart.md"
            target="_blank"
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">Sandbox Quickstart Guide</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/partners/sandbox/widget-demo"
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">Try the Widget (Interactive Demo)</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="https://docs.vitalcv.com/api"
            target="_blank"
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">Full API Reference</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sandbox API Key</DialogTitle>
            <DialogDescription>
              Generate a new sandbox API key. This key will only work in the sandbox environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Development, Testing, CI/CD"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createKey();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose a descriptive name to help you identify this key later
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createKey}>Create Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={!!newlyCreatedKey} onOpenChange={() => setNewlyCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎉 API Key Created!</DialogTitle>
            <DialogDescription>
              Save this key securely. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Copy this key now and store it securely.
                It will only be shown once.
              </AlertDescription>
            </Alert>
            <div>
              <Label>API Key</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newlyCreatedKey?.key || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(newlyCreatedKey?.key || '', 'API key')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewlyCreatedKey(null)}>
              I've saved my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

