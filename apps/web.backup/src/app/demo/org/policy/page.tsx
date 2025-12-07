/**
 * B230C-INTL-012: RegionalPolicy Control Panel
 *
 * Enables org admins to view and edit RegionalPolicyConfig overrides.
 * Highlights differences from defaults; warns about conflicts and regulator requirements.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Globe,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

interface RegionalPolicyConfig {
  id: string;
  countryCode: string;
  regionCode: string | null;
  orgId: string | null;
  dataRetentionDays: number;
  requiresExplicitConsent: boolean;
  requiresCookieConsent: boolean;
  allowedDataJurisdictions: string[];
  privacyRules: Record<string, any> | null;
  consentRequirements: Record<string, any> | null;
  metadata: Record<string, any> | null;
  isDefault: boolean;
  conflicts?: string[];
  warnings?: string[];
}

interface DefaultPolicy {
  countryCode: string;
  regionCode: string | null;
  dataRetentionDays: number;
  requiresExplicitConsent: boolean;
  requiresCookieConsent: boolean;
  allowedDataJurisdictions: string[];
}

const DEFAULT_POLICIES: DefaultPolicy[] = [
  {
    countryCode: 'US',
    regionCode: null,
    dataRetentionDays: 2555, // 7 years
    requiresExplicitConsent: true,
    requiresCookieConsent: true,
    allowedDataJurisdictions: ['US'],
  },
  {
    countryCode: 'EU',
    regionCode: null,
    dataRetentionDays: 1825, // 5 years (GDPR)
    requiresExplicitConsent: true,
    requiresCookieConsent: true,
    allowedDataJurisdictions: ['EU'],
  },
  {
    countryCode: 'GB',
    regionCode: null,
    dataRetentionDays: 1825, // 5 years
    requiresExplicitConsent: true,
    requiresCookieConsent: true,
    allowedDataJurisdictions: ['GB', 'EU'],
  },
];

const COUNTRY_CODES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'EU', label: 'European Union' },
];

const US_REGIONS = [
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'IL', label: 'Illinois' },
];

export default function RegionalPolicyPage() {
  const [policies, setPolicies] = useState<RegionalPolicyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<RegionalPolicyConfig>>({
    countryCode: '',
    regionCode: null,
    dataRetentionDays: 2555,
    requiresExplicitConsent: true,
    requiresCookieConsent: true,
    allowedDataJurisdictions: [],
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      setLoading(true);
      const res = await fetch('/api/demo/org/policy/regional');
      if (!res.ok) throw new Error('Failed to load policies');
      const data = await res.json();

      // Enrich with default comparison and warnings
      const enriched = data.policies.map((policy: RegionalPolicyConfig) => {
        const defaultPolicy = DEFAULT_POLICIES.find(
          (d) => d.countryCode === policy.countryCode && d.regionCode === policy.regionCode
        );

        const conflicts: string[] = [];
        const warnings: string[] = [];

        if (defaultPolicy) {
          if (policy.dataRetentionDays < defaultPolicy.dataRetentionDays) {
            warnings.push(
              `Data retention (${policy.dataRetentionDays} days) is shorter than default (${defaultPolicy.dataRetentionDays} days). May violate regulatory requirements.`
            );
          }
          if (!policy.requiresExplicitConsent && defaultPolicy.requiresExplicitConsent) {
            conflicts.push('Explicit consent disabled but required by default for this region.');
          }
          if (!policy.requiresCookieConsent && defaultPolicy.requiresCookieConsent) {
            warnings.push('Cookie consent disabled. May violate GDPR/CCPA requirements.');
          }
        }

        return {
          ...policy,
          isDefault: !policy.orgId,
          conflicts,
          warnings,
        };
      });

      setPolicies(enriched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }

  async function savePolicy() {
    try {
      setSaving(true);
      setError(null);

      const url = editingId
        ? `/api/demo/org/policy/regional/${editingId}`
        : '/api/demo/org/policy/regional';

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save policy');
      }

      await loadPolicies();
      setShowAddForm(false);
      setEditingId(null);
      setFormData({
        countryCode: '',
        regionCode: null,
        dataRetentionDays: 2555,
        requiresExplicitConsent: true,
        requiresCookieConsent: true,
        allowedDataJurisdictions: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }

  async function deletePolicy(id: string) {
    if (!confirm('Are you sure you want to delete this policy override?')) return;

    try {
      const res = await fetch(`/api/demo/org/policy/regional/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete policy');
      await loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  }

  function startEdit(policy: RegionalPolicyConfig) {
    setEditingId(policy.id);
    setFormData({
      countryCode: policy.countryCode,
      regionCode: policy.regionCode,
      dataRetentionDays: policy.dataRetentionDays,
      requiresExplicitConsent: policy.requiresExplicitConsent,
      requiresCookieConsent: policy.requiresCookieConsent,
      allowedDataJurisdictions: policy.allowedDataJurisdictions,
      privacyRules: policy.privacyRules,
      consentRequirements: policy.consentRequirements,
    });
    setShowAddForm(true);
  }

  function cancelEdit() {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      countryCode: '',
      regionCode: null,
      dataRetentionDays: 2555,
      requiresExplicitConsent: true,
      requiresCookieConsent: true,
      allowedDataJurisdictions: [],
    });
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Regional Policy Configuration</h1>
          <p className="text-muted-foreground">
            Manage country and region-specific policy overrides for data retention, consent requirements, and privacy rules.
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Override
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Policy Override' : 'Add Policy Override'}</CardTitle>
            <CardDescription>
              Create an organization-specific policy override for a country or region.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country Code</Label>
                <Select
                  value={formData.countryCode || ''}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                >
                  <SelectTrigger id="countryCode">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.countryCode === 'US' && (
                <div className="space-y-2">
                  <Label htmlFor="regionCode">Region/State (Optional)</Label>
                  <Select
                    value={formData.regionCode || ''}
                    onValueChange={(value) => setFormData({ ...formData, regionCode: value })}
                  >
                    <SelectTrigger id="regionCode">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {US_REGIONS.map((region) => (
                        <SelectItem key={region.value} value={region.value}>
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataRetentionDays">Data Retention (days)</Label>
              <Input
                id="dataRetentionDays"
                type="number"
                value={formData.dataRetentionDays}
                onChange={(e) =>
                  setFormData({ ...formData, dataRetentionDays: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="explicitConsent">Require Explicit Consent</Label>
                  <p className="text-sm text-muted-foreground">
                    Users must explicitly consent to data processing
                  </p>
                </div>
                <Switch
                  id="explicitConsent"
                  checked={formData.requiresExplicitConsent}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresExplicitConsent: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cookieConsent">Require Cookie Consent</Label>
                  <p className="text-sm text-muted-foreground">
                    Users must consent to cookie usage (GDPR/CCPA)
                  </p>
                </div>
                <Switch
                  id="cookieConsent"
                  checked={formData.requiresCookieConsent}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresCookieConsent: checked })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={savePolicy} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Policy Overrides</CardTitle>
          <CardDescription>
            Organization-specific policy overrides. Default policies are shown for reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country/Region</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No policy overrides configured. Click "Add Override" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">
                          {policy.countryCode}
                          {policy.regionCode && ` - ${policy.regionCode}`}
                        </span>
                        {policy.isDefault && (
                          <Badge variant="outline">Default</Badge>
                        )}
                        {!policy.isDefault && <Badge>Override</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{policy.dataRetentionDays} days</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {policy.requiresExplicitConsent && (
                          <Badge variant="outline" className="text-xs">Explicit</Badge>
                        )}
                        {policy.requiresCookieConsent && (
                          <Badge variant="outline" className="text-xs">Cookie</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {policy.conflicts && policy.conflicts.length > 0 && (
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">{policy.conflicts.length} conflict(s)</span>
                        </div>
                      )}
                      {policy.warnings && policy.warnings.length > 0 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">{policy.warnings.length} warning(s)</span>
                        </div>
                      )}
                      {(!policy.conflicts || policy.conflicts.length === 0) &&
                        (!policy.warnings || policy.warnings.length === 0) && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">OK</span>
                          </div>
                        )}
                    </TableCell>
                    <TableCell>
                      {!policy.isDefault && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(policy)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deletePolicy(policy.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

