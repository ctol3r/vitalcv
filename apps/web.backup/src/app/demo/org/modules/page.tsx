/**
 * Module Management Console (Org Admin UI)
 *
 * Shows installed modules, versions, capabilities, health, error counts.
 * Allows enable/disable (where safe).
 */

'use client';

import { useState, useEffect } from 'react';
import { ModuleHealthDashboard } from '@/components/microkernel/ModuleHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface ModuleCapability {
  id: string;
  type: 'task' | 'event' | 'flow';
  name: string;
}

interface Module {
  id: string;
  name: string;
  enabled: boolean;
  version: string;
  capabilities: ModuleCapability[];
  health?: {
    failureRate: number;
    lastError?: string;
  };
  errorCount?: number;
  metadata?: {
    description?: string;
    author?: string;
    tags?: string[];
  };
}

export default function ModuleManagementPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const res = await fetch('/api/demo/org/modules');
      if (!res.ok) throw new Error('Failed to fetch modules');
      const data = await res.json();
      setModules(data.modules || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleModule(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/demo/org/modules/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle module');
      await fetchModules(); // Refresh
    } catch (err) {
      alert(`Failed to toggle module: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function canDisable(module: Module): boolean {
    // Can disable if module is not critical or if it's already disabled
    if (!module.enabled) return false;
    // In a real implementation, check if module is marked as critical
    return true; // For now, allow disabling all modules
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Module Management</h1>
        <div className="text-sm text-muted-foreground">Loading modules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Module Management</h1>
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  const capabilityCounts = modules.reduce((acc, m) => {
    const tasks = m.capabilities.filter(c => c.type === 'task').length;
    const events = m.capabilities.filter(c => c.type === 'event').length;
    const flows = m.capabilities.filter(c => c.type === 'flow').length;
    return {
      tasks: acc.tasks + tasks,
      events: acc.events + events,
      flows: acc.flows + flows,
    };
  }, { tasks: 0, events: 0, flows: 0 });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Module Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage installed modules, versions, capabilities, and health
          </p>
        </div>
        <Link href="/demo/org/modules/capabilities">
          <Button variant="outline">View Capabilities</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
            <div className="text-xs text-muted-foreground">
              {modules.filter(m => m.enabled).length} enabled
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{capabilityCounts.tasks}</div>
            <div className="text-xs text-muted-foreground">task capabilities</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{capabilityCounts.events}</div>
            <div className="text-xs text-muted-foreground">event handlers</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{capabilityCounts.flows}</div>
            <div className="text-xs text-muted-foreground">workflows</div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Installed Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{module.name}</div>
                      {module.metadata?.description && (
                        <div className="text-xs text-muted-foreground">
                          {module.metadata.description}
                        </div>
                      )}
                      {module.metadata?.tags && module.metadata.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {module.metadata.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">v{module.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-xs">
                        <Badge variant="outline" className="mr-1">
                          {module.capabilities.filter(c => c.type === 'task').length} tasks
                        </Badge>
                        <Badge variant="outline" className="mr-1">
                          {module.capabilities.filter(c => c.type === 'event').length} events
                        </Badge>
                        <Badge variant="outline">
                          {module.capabilities.filter(c => c.type === 'flow').length} flows
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {module.capabilities.length} total
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {module.health ? (
                      <div>
                        <div className="text-sm">
                          Failure: {(module.health.failureRate * 100).toFixed(1)}%
                        </div>
                        {module.health.lastError && (
                          <div className="text-xs text-destructive mt-1 truncate max-w-xs">
                            {module.health.lastError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No data</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {module.errorCount !== undefined ? (
                      <Badge variant={module.errorCount > 0 ? 'destructive' : 'outline'}>
                        {module.errorCount}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {module.enabled ? (
                      <Badge className="bg-green-50 text-green-700">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canDisable(module) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleModule(module.id, module.enabled)}
                      >
                        {module.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Critical</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Health Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Module Health Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleHealthDashboard />
        </CardContent>
      </Card>
    </div>
  );
}

