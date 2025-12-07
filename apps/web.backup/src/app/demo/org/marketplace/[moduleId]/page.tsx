/**
 * Module Detail & Purchase Page
 *
 * Shows module details, version history, vendor info, pricing options;
 * allows one-click purchase or subscription via BillingGateway
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface ModuleVersion {
  version: string;
  releasedAt: string;
  changelog?: string;
  downloadUrl?: string;
}

interface VendorInfo {
  id: string;
  name: string;
  email?: string;
  verified?: boolean;
  rating?: number;
  totalModules?: number;
}

interface MarketplaceModule {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  version: string;
  author: string;
  vendorId?: string;
  vendor?: VendorInfo;
  category?: string;
  capabilities?: string[];
  fiatPrice?: number;
  vitaPrice?: number;
  subscriptionPrice?: number;
  subscriptionInterval?: 'monthly' | 'yearly';
  featured?: boolean;
  rating?: number;
  reviewCount?: number;
  downloadCount?: number;
  versionHistory?: ModuleVersion[];
  metadata?: {
    tags?: string[];
    icon?: string;
    screenshots?: string[];
    documentation?: string;
    supportUrl?: string;
    license?: string;
  };
}

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  const [module, setModule] = useState<MarketplaceModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'one-time' | 'subscription'>('one-time');
  const [paymentMethod, setPaymentMethod] = useState<'FIAT' | 'VITA'>('FIAT');

  useEffect(() => {
    if (moduleId) {
      fetchModuleDetails();
    }
  }, [moduleId]);

  async function fetchModuleDetails() {
    try {
      const res = await fetch(`/api/marketplace/list?id=${moduleId}`);
      if (!res.ok) throw new Error('Failed to fetch module details');
      const data = await res.json();
      // Find the specific module in listings
      const foundModule = data.listings?.find((m: any) => m.id === moduleId);
      if (!foundModule) {
        throw new Error('Module not found');
      }
      setModule(foundModule);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase() {
    if (!module) return;

    setPurchasing(true);
    try {
      const res = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: module.id,
          orgId: 'current-org-id', // TODO: Get from auth context
          paymentType: paymentMethod,
          ...(purchaseType === 'subscription' && {
            subscription: true,
            interval: module.subscriptionInterval || 'monthly',
          }),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Purchase failed');
      }

      const data = await res.json();
      // Redirect to purchase history or success page
      router.push(`/demo/clinician/purchases?purchased=${module.id}`);
    } catch (err) {
      alert(`Purchase failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPurchasing(false);
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-muted-foreground">Loading module details...</div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-destructive">Error: {error || 'Module not found'}</div>
        <Link href="/demo/org/marketplace">
          <Button variant="outline" className="mt-4">Back to Marketplace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{module.name}</h1>
            {module.featured && (
              <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            by {module.vendor?.name || module.author} • v{module.version}
            {module.vendor?.verified && (
              <Badge variant="outline" className="ml-2">Verified Vendor</Badge>
            )}
          </div>
        </div>
        <Link href="/demo/org/marketplace">
          <Button variant="outline">Back to Marketplace</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {module.longDescription || module.description || 'No description available.'}
              </p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="versions">Version History</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Capabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  {module.capabilities && module.capabilities.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {module.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No capabilities listed</p>
                  )}
                </CardContent>
              </Card>

              {module.metadata?.tags && module.metadata.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {module.metadata.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {module.metadata?.license && (
                <Card>
                  <CardHeader>
                    <CardTitle>License</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{module.metadata.license}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="versions">
              <Card>
                <CardHeader>
                  <CardTitle>Version History</CardTitle>
                </CardHeader>
                <CardContent>
                  {module.versionHistory && module.versionHistory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Version</TableHead>
                          <TableHead>Released</TableHead>
                          <TableHead>Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {module.versionHistory.map((v, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline">v{v.version}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(v.releasedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              {v.changelog || 'No changelog available'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No version history available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews">
              <Card>
                <CardHeader>
                  <CardTitle>Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  {module.rating ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{module.rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">
                          ⭐ ({module.reviewCount || 0} reviews)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reviews yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Purchase */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* One-time Purchase */}
              {(module.fiatPrice || module.vitaPrice) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">One-time Purchase</span>
                    <span className="text-lg font-bold">
                      {formatPrice(module.fiatPrice, module.vitaPrice)}
                    </span>
                  </div>
                  {module.subscriptionPrice && (
                    <div className="text-xs text-muted-foreground">
                      or subscribe for ${(module.subscriptionPrice / 100).toFixed(2)}/{module.subscriptionInterval || 'month'}
                    </div>
                  )}
                </div>
              )}

              {/* Subscription */}
              {module.subscriptionPrice && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Subscription</span>
                    <span className="text-lg font-bold">
                      ${(module.subscriptionPrice / 100).toFixed(2)}/{module.subscriptionInterval || 'month'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Billed {module.subscriptionInterval === 'yearly' ? 'annually' : 'monthly'}
                  </div>
                </div>
              )}

              {/* Purchase Type Selection */}
              {module.subscriptionPrice && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Purchase Type</label>
                  <div className="flex gap-2">
                    <Button
                      variant={purchaseType === 'one-time' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPurchaseType('one-time')}
                    >
                      One-time
                    </Button>
                    <Button
                      variant={purchaseType === 'subscription' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPurchaseType('subscription')}
                    >
                      Subscribe
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {(module.fiatPrice || module.vitaPrice) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <div className="flex gap-2">
                    {module.fiatPrice && (
                      <Button
                        variant={paymentMethod === 'FIAT' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setPaymentMethod('FIAT')}
                      >
                        Credit Card
                      </Button>
                    )}
                    {module.vitaPrice && (
                      <Button
                        variant={paymentMethod === 'VITA' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setPaymentMethod('VITA')}
                      >
                        VITA
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Purchase Button */}
              <Button
                className="w-full"
                onClick={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? 'Processing...' : purchaseType === 'subscription' ? 'Subscribe Now' : 'Purchase Now'}
              </Button>

              {/* Stats */}
              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                {module.downloadCount !== undefined && (
                  <div className="flex justify-between">
                    <span>Downloads</span>
                    <span>{module.downloadCount.toLocaleString()}</span>
                  </div>
                )}
                {module.rating && (
                  <div className="flex justify-between">
                    <span>Rating</span>
                    <span>⭐ {module.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vendor Info */}
          {module.vendor && (
            <Card>
              <CardHeader>
                <CardTitle>Vendor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{module.vendor.name}</span>
                  {module.vendor.verified && (
                    <Badge variant="outline">Verified</Badge>
                  )}
                </div>
                {module.vendor.rating && (
                  <div className="text-sm text-muted-foreground">
                    ⭐ {module.vendor.rating.toFixed(1)} rating
                  </div>
                )}
                {module.vendor.totalModules !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    {module.vendor.totalModules} modules
                  </div>
                )}
                <Link href={`/demo/vendor/dashboard?vendor=${module.vendor.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View Vendor Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Support Links */}
          {(module.metadata?.supportUrl || module.metadata?.documentation) && (
            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {module.metadata.documentation && (
                  <Link href={module.metadata.documentation} target="_blank">
                    <Button variant="outline" size="sm" className="w-full">
                      Documentation
                    </Button>
                  </Link>
                )}
                {module.metadata.supportUrl && (
                  <Link href={module.metadata.supportUrl} target="_blank">
                    <Button variant="outline" size="sm" className="w-full">
                      Get Support
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

