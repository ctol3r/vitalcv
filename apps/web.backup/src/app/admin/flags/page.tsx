'use client';

/**
 * B141D-FE-001: Admin feature flags UI (read-only list)
 *
 * Lists each flag key, description, default & current value
 * Read-only for now
 * Warns that changes affect system behaviour
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronRight,
  RefreshCw,
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
  }>;
  userOverrides?: Array<{
    userId: string;
    value: any;
    updatedAt: string;
  }>;
}

export default function FlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/flags');
      if (!response.ok) {
        throw new Error('Failed to fetch flags');
      }
      const data = await response.json();
      setFlags(data.flags || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

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
            <p className="text-gray-600">Loading feature flags...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Feature Flags</h1>
        <p className="text-gray-600">Manage system feature flags and overrides</p>
      </div>

      <Alert className="mb-6 border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">Warning</AlertTitle>
        <AlertDescription className="text-yellow-700">
          Changes to feature flags affect system behaviour. Only authorized administrators should
          modify flags. All changes are logged and audited.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {flags.map((flag) => (
          <Card key={flag.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-xl font-mono">{flag.key}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {flag.scope}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2">{flag.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/admin/flags/${flag.key}`)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Default Value</label>
                  <div className="mt-1">{getValueBadge(flag.defaultValue)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Value</label>
                  <div className="mt-1">
                    {flag.currentValue !== undefined ? (
                      getValueBadge(flag.currentValue)
                    ) : (
                      <Badge variant="outline">{formatValue(flag.defaultValue)}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {(flag.orgOverrides && flag.orgOverrides.length > 0) ||
              (flag.userOverrides && flag.userOverrides.length > 0) ? (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flag.orgOverrides && flag.orgOverrides.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Organization Overrides
                        </label>
                        <div className="mt-1 text-sm text-gray-600">
                          {flag.orgOverrides.length} organization(s)
                        </div>
                      </div>
                    )}
                    {flag.userOverrides && flag.userOverrides.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          User Overrides
                        </label>
                        <div className="mt-1 text-sm text-gray-600">
                          {flag.userOverrides.length} user(s)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {flag.allowedValues && flag.allowedValues.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-gray-500">Allowed Values</label>
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
        ))}

        {flags.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Flag className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No feature flags found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

