/**
 * User Purchase History UI
 *
 * Lists all modules a user has bought or subscribed to;
 * shows license keys, renewal dates, download links; supports re-billing
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface Purchase {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleVersion: string;
  purchaseType: 'one-time' | 'subscription';
  paymentType: 'FIAT' | 'VITA';
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  licenseKey?: string;
  downloadUrl?: string;
  purchasedAt: string;
  expiresAt?: string;
  renewalDate?: string;
  autoRenew?: boolean;
  metadata?: {
    invoiceId?: string;
    vitaTxId?: string;
    vendorId?: string;
    vendorName?: string;
  };
}

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  async function fetchPurchases() {
    try {
      const res = await fetch('/api/demo/clinician/purchases');
      if (!res.ok) throw new Error('Failed to fetch purchases');
      const data = await res.json();
      setPurchases(data.purchases || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRenewal(purchaseId: string) {
    setRenewing(purchaseId);
    try {
      const res = await fetch(`/api/demo/clinician/purchases/${purchaseId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Renewal failed');
      }
      await fetchPurchases();
    } catch (err) {
      alert(`Renewal failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRenewing(null);
    }
  }

  async function handleCancelSubscription(purchaseId: string) {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;

    try {
      const res = await fetch(`/api/demo/clinician/purchases/${purchaseId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Cancellation failed');
      }
      await fetchPurchases();
    } catch (err) {
      alert(`Cancellation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function formatPrice(amount: number, paymentType: 'FIAT' | 'VITA'): string {
    if (paymentType === 'FIAT') {
      return `$${(amount / 100).toFixed(2)}`;
    }
    return `${amount} VITA`;
  }

  function isExpiringSoon(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }

  function isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">My Purchases</h1>
        <div className="text-sm text-muted-foreground">Loading purchases...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">My Purchases</h1>
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  const activePurchases = purchases.filter(p => p.status === 'completed' && !isExpired(p.expiresAt));
  const subscriptions = purchases.filter(p => p.purchaseType === 'subscription' && p.status === 'completed');
  const expiredPurchases = purchases.filter(p => isExpired(p.expiresAt));
  const allPurchases = purchases;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your purchased modules, licenses, and subscriptions
          </p>
        </div>
        <Link href="/demo/org/marketplace">
          <Button variant="outline">Browse Marketplace</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allPurchases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePurchases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredPurchases.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Purchases</TabsTrigger>
          <TabsTrigger value="active">Active ({activePurchases.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({expiredPurchases.length})</TabsTrigger>
        </TabsList>

        {/* All Purchases */}
        <TabsContent value="all">
          <PurchaseTable
            purchases={allPurchases}
            onRenewal={handleRenewal}
            onCancel={handleCancelSubscription}
            renewing={renewing}
            formatPrice={formatPrice}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
        </TabsContent>

        {/* Active Purchases */}
        <TabsContent value="active">
          <PurchaseTable
            purchases={activePurchases}
            onRenewal={handleRenewal}
            onCancel={handleCancelSubscription}
            renewing={renewing}
            formatPrice={formatPrice}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
        </TabsContent>

        {/* Subscriptions */}
        <TabsContent value="subscriptions">
          <PurchaseTable
            purchases={subscriptions}
            onRenewal={handleRenewal}
            onCancel={handleCancelSubscription}
            renewing={renewing}
            formatPrice={formatPrice}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
        </TabsContent>

        {/* Expired Purchases */}
        <TabsContent value="expired">
          <PurchaseTable
            purchases={expiredPurchases}
            onRenewal={handleRenewal}
            onCancel={handleCancelSubscription}
            renewing={renewing}
            formatPrice={formatPrice}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PurchaseTableProps {
  purchases: Purchase[];
  onRenewal: (purchaseId: string) => void;
  onCancel: (purchaseId: string) => void;
  renewing: string | null;
  formatPrice: (amount: number, paymentType: 'FIAT' | 'VITA') => string;
  isExpiringSoon: (expiresAt?: string) => boolean;
  isExpired: (expiresAt?: string) => boolean;
}

function PurchaseTable({
  purchases,
  onRenewal,
  onCancel,
  renewing,
  formatPrice,
  isExpiringSoon,
  isExpired,
}: PurchaseTableProps) {
  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-sm text-muted-foreground">
            No purchases found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchases</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((purchase) => {
              const expiringSoon = isExpiringSoon(purchase.expiresAt);
              const expired = isExpired(purchase.expiresAt);

              return (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{purchase.moduleName}</div>
                      <div className="text-xs text-muted-foreground">
                        v{purchase.moduleVersion}
                      </div>
                      {purchase.metadata?.vendorName && (
                        <div className="text-xs text-muted-foreground">
                          by {purchase.metadata.vendorName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={purchase.purchaseType === 'subscription' ? 'default' : 'outline'}>
                      {purchase.purchaseType === 'subscription' ? 'Subscription' : 'One-time'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatPrice(purchase.amount, purchase.paymentType)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge
                        variant={
                          purchase.status === 'completed'
                            ? expired
                              ? 'destructive'
                              : expiringSoon
                              ? 'secondary'
                              : 'default'
                            : 'outline'
                        }
                      >
                        {purchase.status}
                      </Badge>
                      {expired && (
                        <div className="text-xs text-destructive">Expired</div>
                      )}
                      {expiringSoon && !expired && (
                        <div className="text-xs text-yellow-600">Expiring soon</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {purchase.licenseKey ? (
                      <div className="space-y-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {purchase.licenseKey.substring(0, 12)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(purchase.licenseKey!);
                            alert('License key copied to clipboard');
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {purchase.expiresAt ? (
                      <div className="text-sm">
                        {new Date(purchase.expiresAt).toLocaleDateString()}
                        {purchase.renewalDate && (
                          <div className="text-xs text-muted-foreground">
                            Renews: {new Date(purchase.renewalDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {purchase.downloadUrl && (
                        <Link href={purchase.downloadUrl} target="_blank">
                          <Button variant="outline" size="sm" className="w-full">
                            Download
                          </Button>
                        </Link>
                      )}
                      <Link href={`/demo/org/marketplace/${purchase.moduleId}`}>
                        <Button variant="ghost" size="sm" className="w-full">
                          View Module
                        </Button>
                      </Link>
                      {purchase.purchaseType === 'subscription' && purchase.status === 'completed' && (
                        <>
                          {expired || expiringSoon ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              onClick={() => onRenewal(purchase.id)}
                              disabled={renewing === purchase.id}
                            >
                              {renewing === purchase.id ? 'Renewing...' : 'Renew Now'}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => onCancel(purchase.id)}
                            >
                              Cancel Subscription
                            </Button>
                          )}
                        </>
                      )}
                      {expired && purchase.purchaseType === 'one-time' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => onRenewal(purchase.id)}
                          disabled={renewing === purchase.id}
                        >
                          {renewing === purchase.id ? 'Processing...' : 'Re-purchase'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

