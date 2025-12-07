'use client';

/**
 * B141D-FE-002: Flag override edit sheet (admin-only)
 *
 * Allows OrgAdmin/SiteAdmin to toggle a flag per org or globally
 * Requires confirmation
 * Shows last changed by/at
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Save,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  defaultValue: any;
  currentValue?: any;
  scope: 'GLOBAL' | 'ORG' | 'USER';
  allowedValues?: any[];
  createdAt: string;
  updatedAt: string;
  orgOverrides?: Array<{
    orgId: string;
    value: any;
    updatedAt: string;
    updatedBy?: string;
  }>;
  userOverrides?: Array<{
    userId: string;
    value: any;
    updatedAt: string;
    updatedBy?: string;
  }>;
  lastChanged?: {
    by: string;
    at: string;
    scope: 'GLOBAL' | 'ORG' | 'USER';
  };
}

export default function FlagDetailPage() {
  const router = useRouter();
  const params = useParams();
  const flagKey = params.key as string;

  const [flag, setFlag] = useState<FeatureFlag | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [scope, setScope] = useState<'GLOBAL' | 'ORG' | 'USER'>('ORG');
  const [orgId, setOrgId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');

  const fetchFlag = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/flags/${flagKey}`);
      if (!response.ok) {
        throw new Error('Failed to fetch flag');
      }
      const data = await response.json();
      setFlag(data);
      setNewValue(
        typeof data.currentValue !== 'undefined'
          ? String(data.currentValue)
          : String(data.defaultValue)
      );
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (flagKey) {
      fetchFlag();
    }
  }, [flagKey]);

  const handleSave = async () => {
    if (!flag) return;

    // Require confirmation for changes
    const confirmed = window.confirm(
      `Are you sure you want to change the flag "${flag.key}"? This will affect system behaviour.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      let value: any = newValue;

      // Parse value based on type
      if (flag.defaultValue === true || flag.defaultValue === false) {
        value = newValue === 'true' || newValue === 'enabled';
      } else if (typeof flag.defaultValue === 'number') {
        value = parseFloat(newValue);
      } else if (typeof flag.defaultValue === 'object') {
        try {
          value = JSON.parse(newValue);
        } catch {
          throw new Error('Invalid JSON format');
        }
      }

      const body: any = {
        flagKey: flag.key,
        scope,
        value,
      };

      if (scope === 'ORG') {
        if (!orgId) {
          throw new Error('Organization ID is required for org-scoped overrides');
        }
        body.orgId = orgId;
      } else if (scope === 'USER') {
        if (!userId) {
          throw new Error('User ID is required for user-scoped overrides');
        }
        body.userId = userId;
      }

      const response = await fetch(`/api/admin/flags/${flagKey}/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update flag');
      }

      setSuccess('Flag override saved successfully');
      fetchFlag(); // Refresh flag data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'boolean') {
      return value ? 'Enabled' : 'Disabled';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getValueBadge = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Enabled
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XCircle className="w-3 h-3 mr-1" />
          Disabled
        </Badge>
      );
    }
    return <Badge variant="outline">{formatValue(value)}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading flag details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!flag) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Flag Not Found</AlertTitle>
          <AlertDescription>
            The flag "{flagKey}" could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/flags')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Flags
        </Button>
        <div className="flex items-center gap-2 mb-2">
          <Flag className="w-6 h-6 text-blue-600" />
          <h1 className="text-3xl font-bold font-mono">{flag.key}</h1>
          <Badge variant="outline">{flag.scope}</Badge>
        </div>
        <p className="text-gray-600">{flag.description}</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current State */}
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
            <CardDescription>Current flag configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Default Value</Label>
              <div className="mt-1">{getValueBadge(flag.defaultValue)}</div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Current Value</Label>
              <div className="mt-1">
                {flag.currentValue !== undefined ? (
                  getValueBadge(flag.currentValue)
                ) : (
                  <Badge variant="outline">{formatValue(flag.defaultValue)}</Badge>
                )}
              </div>
            </div>

            {flag.lastChanged && (
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-500">Last Changed</Label>
                <div className="mt-1 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{new Date(flag.lastChanged.at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{flag.lastChanged.by}</span>
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {flag.lastChanged.scope}
                  </Badge>
                </div>
              </div>
            )}

            {flag.allowedValues && flag.allowedValues.length > 0 && (
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-500">Allowed Values</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {flag.allowedValues.map((val, idx) => (
                    <Badge key={idx} variant="outline">
                      {formatValue(val)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Override */}
        <Card>
          <CardHeader>
            <CardTitle>Create Override</CardTitle>
            <CardDescription>
              Override flag value for specific organization or user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Warning</AlertTitle>
              <AlertDescription className="text-yellow-700">
                Changes to feature flags affect system behaviour. All changes are logged and
                audited.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="scope">Scope</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG">Organization</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === 'ORG' && (
              <div>
                <Label htmlFor="orgId">Organization ID</Label>
                <Input
                  id="orgId"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="org_123..."
                />
              </div>
            )}

            {scope === 'USER' && (
              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="user_123..."
                />
              </div>
            )}

            <div>
              <Label htmlFor="value">
                Value{' '}
                {typeof flag.defaultValue === 'boolean' && '(true/false or enabled/disabled)'}
                {typeof flag.defaultValue === 'object' && '(JSON)'}
              </Label>
              {typeof flag.defaultValue === 'boolean' ? (
                <Select value={newValue} onValueChange={setNewValue}>
                  <SelectTrigger id="value">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={typeof flag.defaultValue === 'object' ? '{"key": "value"}' : 'Value'}
                />
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Override
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Overrides List */}
      {(flag.orgOverrides && flag.orgOverrides.length > 0) ||
      (flag.userOverrides && flag.userOverrides.length > 0) ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Active Overrides</CardTitle>
            <CardDescription>Current organization and user overrides</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {flag.orgOverrides && flag.orgOverrides.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Organization Overrides ({flag.orgOverrides.length})
                  </Label>
                  <div className="space-y-2">
                    {flag.orgOverrides.map((override, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-mono text-sm">{override.orgId}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Updated: {new Date(override.updatedAt).toLocaleString()}
                            {override.updatedBy && ` by ${override.updatedBy}`}
                          </div>
                        </div>
                        <div>{getValueBadge(override.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {flag.userOverrides && flag.userOverrides.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    User Overrides ({flag.userOverrides.length})
                  </Label>
                  <div className="space-y-2">
                    {flag.userOverrides.map((override, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-mono text-sm">{override.userId}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Updated: {new Date(override.updatedAt).toLocaleString()}
                            {override.updatedBy && ` by ${override.updatedBy}`}
                          </div>
                        </div>
                        <div>{getValueBadge(override.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

