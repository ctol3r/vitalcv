/**
 * Wallet Page
 * List view of all credentials with filtering and search
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CredentialCard } from '@/components/wallet/CredentialCard';
import { ShareCredentialModal } from '@/components/wallet/ShareCredentialModal';
import { ConnectModal } from '@/components/wallet/ConnectModal';
import { useToast } from '@/hooks/use-toast';
import { Credential, CredentialStatus, getCredentials } from '@/lib/wallet-api';
import { saveCred, loadCreds } from '../lib/store';
import { Plus, Search, Wallet, Download, Share2, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function WalletPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CredentialStatus | 'all'>('all');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const data = await getCredentials();
      setCredentials(data);

      // Save each credential to localStorage for offline access
      data.forEach(cred => {
        saveCred(cred.id, cred);
      });
    } catch (error) {
      console.error('Failed to load credentials:', error);

      // Try loading from localStorage as fallback
      const localCreds = loadCreds();
      const localCredsArray = Object.keys(localCreds).map(key => localCreds[key]);
      if (localCredsArray.length > 0) {
        setCredentials(localCredsArray);
        toast({
          title: 'Loaded from cache',
          description: 'Showing cached credentials (offline mode)',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load credentials. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = (credential: Credential) => {
    setSelectedCredential(credential);
    setShowShareModal(true);
  };

  const handleCopyShareLink = (credential: Credential) => {
    const credJson = JSON.stringify(credential);
    const encoded = encodeURIComponent(credJson);
    const url = `${window.location.origin}/wallet/import#${encoded}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied',
      description: 'Share link copied to clipboard',
    });
  };

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch =
      cred.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.issuer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || cred.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: credentials.length,
    valid: credentials.filter((c) => c.status === 'valid').length,
    expiring: credentials.filter((c) => c.status === 'expiring').length,
    revoked: credentials.filter((c) => c.status === 'revoked').length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="h-8 w-8" />
              My Wallet
            </h1>
            <p className="text-lg text-muted-foreground mt-2">Manage your verifiable credentials</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConnectModal(true)}>
              <QrCode className="mr-2 h-4 w-4" />
              Connect
            </Button>
            <Button variant="outline" asChild>
              <Link href="/wallet/import">
                <Download className="mr-2 h-4 w-4" />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/claim/start">
                <Plus className="mr-2 h-4 w-4" />
                Claim Credential
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
              <div className="text-sm text-muted-foreground">Valid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.expiring}</div>
              <div className="text-sm text-muted-foreground">Expiring</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
              <div className="text-sm text-muted-foreground">Revoked</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search credentials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="valid">Valid</TabsTrigger>
                <TabsTrigger value="expiring">Expiring</TabsTrigger>
                <TabsTrigger value="revoked">Revoked</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Credentials List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCredentials.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== 'all'
                ? 'No credentials found'
                : 'No credentials yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by claiming your first credential'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button asChild>
                <Link href="/claim/start">
                  <Plus className="mr-2 h-4 w-4" />
                  Claim Your First Credential
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCredentials.map((credential) => (
            <div key={credential.id} className="relative">
              <CredentialCard credential={credential} onShare={handleShare} />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleCopyShareLink(credential)}
                title="Copy share link"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      {selectedCredential && (
        <ShareCredentialModal
          credential={selectedCredential}
          open={showShareModal}
          onOpenChange={setShowShareModal}
        />
      )}

      {/* Connect Modal */}
      <ConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
      />
    </div>
  );
}
