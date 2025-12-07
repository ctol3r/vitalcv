/**
 * Vendor Console UI
 *
 * Lets vendors upload new modules, manage versions, set prices,
 * view sales and revenue reports
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface VendorModule {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: 'draft' | 'active' | 'inactive';
  fiatPrice?: number;
  vitaPrice?: number;
  subscriptionPrice?: number;
  downloadCount?: number;
  purchaseCount?: number;
  revenue?: number;
  createdAt: string;
  updatedAt: string;
}

interface SalesReport {
  period: string;
  purchases: number;
  revenue: number;
  downloads: number;
}

interface RevenueData {
  totalRevenue: number;
  totalPurchases: number;
  totalDownloads: number;
  monthlyRevenue: SalesReport[];
}

export default function VendorDashboardPage() {
  const [modules, setModules] = useState<VendorModule[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    fetchVendorData();
  }, []);

  async function fetchVendorData() {
    try {
      // Fetch vendor modules
      const modulesRes = await fetch('/api/demo/vendor/modules');
      if (!modulesRes.ok) throw new Error('Failed to fetch modules');
      const modulesData = await modulesRes.json();
      setModules(modulesData.modules || []);

      // Fetch revenue data
      const revenueRes = await fetch('/api/demo/vendor/revenue');
      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        setRevenue(revenueData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleModuleStatusChange(moduleId: string, status: 'active' | 'inactive') {
    try {
      const res = await fetch(`/api/demo/vendor/modules/${moduleId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update module status');
      await fetchVendorData();
    } catch (err) {
      alert(`Failed to update status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function formatPrice(fiatPrice?: number, vitaPrice?: number): string {
    if (fiatPrice && fiatPrice > 0) {
      return `$${(fiatPrice / 100).toFixed(2)}`;
    }
    if (vitaPrice && vitaPrice > 0) {
      return `${vitaPrice} VITA`;
    }
    return 'Free';
  }

  function formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Vendor Dashboard</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Vendor Dashboard</h1>
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  const activeModules = modules.filter(m => m.status === 'active');
  const draftModules = modules.filter(m => m.status === 'draft');
  const inactiveModules = modules.filter(m => m.status === 'inactive');

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your modules, versions, pricing, and view sales reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUploadForm(true)}>
            Upload New Module
          </Button>
          <Link href="/demo/org/marketplace">
            <Button variant="outline">View Marketplace</Button>
          </Link>
        </div>
      </div>

      {/* Revenue Summary */}
      {revenue && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(revenue.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenue.totalPurchases}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenue.totalDownloads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeModules.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeModules.length})
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts ({draftModules.length})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive ({inactiveModules.length})
          </TabsTrigger>
          <TabsTrigger value="revenue">Revenue Reports</TabsTrigger>
        </TabsList>

        {/* Active Modules */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Modules</CardTitle>
            </CardHeader>
            <CardContent>
              {activeModules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Purchases</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeModules.map((module) => (
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
                          {formatPrice(module.fiatPrice, module.vitaPrice)}
                        </TableCell>
                        <TableCell>{module.purchaseCount || 0}</TableCell>
                        <TableCell>{module.downloadCount || 0}</TableCell>
                        <TableCell>
                          {module.revenue ? formatCurrency(module.revenue) : '$0.00'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/demo/org/marketplace/${module.id}`}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleModuleStatusChange(module.id, 'inactive')}
                            >
                              Deactivate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No active modules
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Draft Modules */}
        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle>Draft Modules</CardTitle>
            </CardHeader>
            <CardContent>
              {draftModules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftModules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div className="font-medium">{module.name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{module.version}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{module.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(module.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/demo/vendor/modules/${module.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleModuleStatusChange(module.id, 'active')}
                            >
                              Publish
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No draft modules
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inactive Modules */}
        <TabsContent value="inactive">
          <Card>
            <CardHeader>
              <CardTitle>Inactive Modules</CardTitle>
            </CardHeader>
            <CardContent>
              {inactiveModules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveModules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div className="font-medium">{module.name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{module.version}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(module.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleModuleStatusChange(module.id, 'active')}
                          >
                            Reactivate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No inactive modules
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Reports */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue && revenue.monthlyRevenue.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Purchases</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue.monthlyRevenue.map((report, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{report.period}</TableCell>
                        <TableCell>{report.purchases}</TableCell>
                        <TableCell>{report.downloads}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(report.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Form Modal (simplified - would be a proper dialog in production) */}
      {showUploadForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload New Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Module Name</label>
              <Input placeholder="Enter module name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input placeholder="Enter description" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadForm(false)}>Cancel</Button>
              <Button>Upload Module</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

