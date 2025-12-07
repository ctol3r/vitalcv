/**
 * Domain Capability Explorer
 *
 * Shows what each module can do: tasks/events/flows.
 * Shows dependencies.
 * Auto-links to DAG visuals.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CapabilityDependency {
  id: string;
  name: string;
}

interface ModuleCapability {
  id: string;
  type: 'task' | 'event' | 'flow';
  name: string;
  dependencies?: CapabilityDependency[];
}

interface Module {
  id: string;
  name: string;
  enabled: boolean;
  capabilities: ModuleCapability[];
  metadata?: {
    moduleDependencies?: string[];
  };
}

export default function CapabilityExplorerPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'task' | 'event' | 'flow' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const res = await fetch('/api/demo/org/modules/capabilities');
      if (!res.ok) throw new Error('Failed to fetch capabilities');
      const data = await res.json();
      setModules(data.modules || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const filteredModules = modules.filter(module => {
    if (selectedModule && module.id !== selectedModule) return false;
    if (selectedType === 'all') return true;
    return module.capabilities.some(cap => cap.type === selectedType);
  });

  const allCapabilities = filteredModules.flatMap(module =>
    module.capabilities.map(cap => ({
      ...cap,
      moduleId: module.id,
      moduleName: module.name,
      moduleEnabled: module.enabled,
    }))
  );

  const capabilityTypeCounts = {
    task: allCapabilities.filter(c => c.type === 'task').length,
    event: allCapabilities.filter(c => c.type === 'event').length,
    flow: allCapabilities.filter(c => c.type === 'flow').length,
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Domain Capability Explorer</h1>
        <div className="text-sm text-muted-foreground">Loading capabilities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Domain Capability Explorer</h1>
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domain Capability Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore what each module can do: tasks, events, and flows
          </p>
        </div>
        <Link href="/demo/org/modules">
          <Button variant="outline">Back to Modules</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Module</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedModule || ''}
              onChange={(e) => setSelectedModule(e.target.value || null)}
            >
              <option value="">All Modules</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name} {!module.enabled && '(Disabled)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Capability Type</label>
            <div className="flex gap-2">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
              >
                All ({allCapabilities.length})
              </Button>
              <Button
                variant={selectedType === 'task' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('task')}
              >
                Tasks ({capabilityTypeCounts.task})
              </Button>
              <Button
                variant={selectedType === 'event' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('event')}
              >
                Events ({capabilityTypeCounts.event})
              </Button>
              <Button
                variant={selectedType === 'flow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('flow')}
              >
                Flows ({capabilityTypeCounts.flow})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allCapabilities
          .filter(cap => selectedType === 'all' || cap.type === selectedType)
          .map((capability) => (
            <Card key={`${capability.moduleId}-${capability.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">{capability.name}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                      {capability.moduleName}
                    </div>
                  </div>
                  <Badge
                    variant={
                      capability.type === 'task'
                        ? 'default'
                        : capability.type === 'event'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {capability.type}
                  </Badge>
                </div>
                {!capability.moduleEnabled && (
                  <Badge variant="outline" className="mt-2 bg-gray-50 text-gray-600">
                    Module Disabled
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Capability ID</div>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {capability.id}
                  </code>
                </div>
                {capability.dependencies && capability.dependencies.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Dependencies</div>
                    <div className="space-y-1">
                      {capability.dependencies.map((dep) => (
                        <div
                          key={dep.id}
                          className="text-xs bg-muted px-2 py-1 rounded flex items-center justify-between"
                        >
                          <span>{dep.name || dep.id}</span>
                          <Badge variant="outline" className="text-xs">
                            {dep.id}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href={`/demo/org/graph?capability=${capability.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View in DAG →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Module Dependencies */}
      {selectedModule && (
        <Card>
          <CardHeader>
            <CardTitle>Module Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const module = modules.find(m => m.id === selectedModule);
              const deps = module?.metadata?.moduleDependencies || [];
              if (deps.length === 0) {
                return <div className="text-sm text-muted-foreground">No dependencies</div>;
              }
              return (
                <div className="space-y-2">
                  {deps.map((depId) => {
                    const depModule = modules.find(m => m.id === depId);
                    return (
                      <div
                        key={depId}
                        className="flex items-center justify-between p-2 rounded-md bg-muted"
                      >
                        <span className="text-sm">
                          {depModule?.name || depId}
                        </span>
                        {depModule && (
                          <Badge variant={depModule.enabled ? 'default' : 'outline'}>
                            {depModule.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {allCapabilities.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          No capabilities found
        </div>
      )}
    </div>
  );
}

