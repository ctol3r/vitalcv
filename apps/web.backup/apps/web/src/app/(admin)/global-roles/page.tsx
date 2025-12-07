'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, RefreshCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleOntology {
  roles: Record<string, {
    name: string;
    region: string;
    hierarchy: string[];
    equivalencies: string[];
    trainingDependencies: string[];
    mobilityPathways: string[];
  }>;
  equivalencyMap: Record<string, string[]>;
  hierarchy: Record<string, string[]>;
  diffs: Array<{ roleId: string; change: string; detectedAt: string }>;
}

export default function GlobalRolesPage() {
  const [ontology, setOntology] = useState<RoleOntology | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadOntology();
  }, []);

  async function loadOntology() {
    setStatus('loading');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/role-ontology`);
      if (!response.ok) throw new Error('Failed to load ontology');
      const data = await response.json();
      setOntology(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[global-roles]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!ontology) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/role-ontology/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `global-role-ontology-${Date.now()}.json`;
    a.click();
  }

  const roleCount = ontology ? Object.keys(ontology.roles).length : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Global Clinical Role Ontology</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Global Clinical Role Ontology</h1>
            <p className="text-muted-foreground">
              Define and connect every clinical role globally, including equivalencies & transitions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!ontology}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadOntology} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {ontology && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Ontology Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total Roles</p>
                  <p className="text-2xl font-semibold">{roleCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Equivalency Mappings</p>
                  <p className="text-2xl font-semibold">{Object.keys(ontology.equivalencyMap).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recent Changes</p>
                  <p className="text-2xl font-semibold">{ontology.diffs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {ontology.diffs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Ontology Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ontology.diffs.slice(0, 10).map((diff, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{diff.roleId}</p>
                          <p className="text-sm text-muted-foreground">{diff.change}</p>
                        </div>
                        <Badge variant="secondary">
                          {new Date(diff.detectedAt).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Sample Roles</CardTitle>
              <CardDescription>First 10 roles in the ontology</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(ontology.roles).slice(0, 10).map(([roleId, role]) => (
                  <div key={roleId} className="rounded-lg border p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{role.name}</h4>
                        <Badge variant="outline">{role.region}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">ID: {roleId}</p>
                      {role.equivalencies.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Equivalencies:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {role.equivalencies.slice(0, 3).map((eq, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {eq}
                              </Badge>
                            ))}
                            {role.equivalencies.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{role.equivalencies.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

