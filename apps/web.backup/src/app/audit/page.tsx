'use client';

/**
 * B123C-AUD-007: Audit Anchors Index Viewer
 *
 * Displays Merkle roots list with block height, copy JSON functionality,
 * and search/filter capabilities.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Search, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface MerkleRoot {
  id: string;
  root: string;
  blockHeight: number;
  timestamp: string;
  transactionHash: string;
  anchorCount: number;
  status: 'confirmed' | 'pending' | 'failed';
}

export default function AuditAnchorsPage() {
  const [merkleRoots, setMerkleRoots] = useState<MerkleRoot[]>([]);
  const [filteredRoots, setFilteredRoots] = useState<MerkleRoot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRoot, setSelectedRoot] = useState<MerkleRoot | null>(null);

  useEffect(() => {
    // Fetch Merkle roots from API
    fetchMerkleRoots();
  }, []);

  useEffect(() => {
    // Filter roots based on search query
    if (searchQuery.trim() === '') {
      setFilteredRoots(merkleRoots);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRoots(
        merkleRoots.filter(
          (root) =>
            root.root.toLowerCase().includes(query) ||
            root.transactionHash.toLowerCase().includes(query) ||
            root.blockHeight.toString().includes(query)
        )
      );
    }
  }, [searchQuery, merkleRoots]);

  async function fetchMerkleRoots() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/audit/merkle-roots');
      if (!response.ok) throw new Error('Failed to fetch Merkle roots');

      const data = await response.json();
      setMerkleRoots(data.roots || []);
      setFilteredRoots(data.roots || []);
    } catch (error) {
      console.error('Error fetching Merkle roots:', error);
      toast.error('Failed to load Merkle roots');
      // Mock data for demo
      setMerkleRoots(getMockRoots());
      setFilteredRoots(getMockRoots());
    } finally {
      setLoading(false);
    }
  }

  function getMockRoots(): MerkleRoot[] {
    return [
      {
        id: '1',
        root: '0xabc123def4567890123456789012345678901234567890123456789012345678',
        blockHeight: 1234567,
        timestamp: '2025-11-09T12:00:00Z',
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        anchorCount: 42,
        status: 'confirmed',
      },
      {
        id: '2',
        root: '0xdef456abc1237890123456789012345678901234567890123456789012345678',
        blockHeight: 1234568,
        timestamp: '2025-11-09T12:05:00Z',
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        anchorCount: 38,
        status: 'confirmed',
      },
      {
        id: '3',
        root: '0x789012def456abc1234567890123456789012345678901234567890123456789',
        blockHeight: 1234569,
        timestamp: '2025-11-09T12:10:00Z',
        transactionHash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
        anchorCount: 0,
        status: 'pending',
      },
    ];
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }

  function downloadJSON(root: MerkleRoot) {
    const json = JSON.stringify(root, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `merkle-root-${root.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('JSON downloaded');
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  function truncateHash(hash: string, length: number = 16): string {
    if (hash.length <= length) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Anchors Index</h1>
          <p className="text-muted-foreground mt-2">
            View Merkle roots and audit anchors on-chain
          </p>
        </div>
        <Button onClick={fetchMerkleRoots} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Merkle Roots</CardTitle>
          <CardDescription>
            Search by root hash, transaction hash, or block height
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by root hash, transaction hash, or block height..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredRoots.length} of {merkleRoots.length} roots</span>
          </div>
        </CardContent>
      </Card>

      {/* Merkle Roots List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Loading Merkle roots...</p>
            </CardContent>
          </Card>
        ) : filteredRoots.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No Merkle roots found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRoots.map((root) => (
            <Card key={root.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-mono break-all">
                      {truncateHash(root.root, 20)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Block Height: <span className="font-semibold">{root.blockHeight.toLocaleString()}</span>
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      root.status === 'confirmed'
                        ? 'default'
                        : root.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {root.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Root Hash */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Merkle Root</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 font-mono text-sm bg-muted p-2 rounded break-all">
                        {root.root}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(root.root, 'Merkle root')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Transaction Hash */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 font-mono text-sm bg-muted p-2 rounded break-all">
                        {root.transactionHash}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(root.transactionHash, 'Transaction hash')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(`https://explorer.example.com/tx/${root.transactionHash}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                      <p className="text-sm mt-1">{formatTimestamp(root.timestamp)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Anchor Count</label>
                      <p className="text-sm mt-1 font-semibold">{root.anchorCount}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-sm mt-1 capitalize">{root.status}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Block Height</label>
                      <p className="text-sm mt-1 font-semibold">{root.blockHeight.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRoot(root);
                        copyToClipboard(JSON.stringify(root, null, 2), 'Merkle root JSON');
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadJSON(root)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/audit/${root.id}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

