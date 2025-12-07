'use client';

/**
 * B121C-OPS-030: Operational audit: block-level hash evidence viewer
 *
 * Block hash visualized; copyable JSON; pagination works
 *
 * Acceptance Criteria:
 * - block hash visualized
 * - copyable JSON
 * - pagination works
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, CheckCircle2, ExternalLink, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BlockHashEvidence {
  id: string;
  blockHash: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
  evidenceType: string;
  metadata: Record<string, any>;
  merkleRoot?: string;
  parentHash?: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function BlockHashEvidenceViewer() {
  const [blocks, setBlocks] = useState<BlockHashEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<BlockHashEvidence | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBlocks = async (page: number = 1, query: string = '') => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
        ...(query && { q: query }),
      });

      const response = await fetch(`${backendUrl}/api/audit/blocks?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch blocks: ${response.statusText}`);
      }

      const data = await response.json();
      setBlocks(data.blocks || []);
      setPagination({
        page: data.pagination?.page || page,
        pageSize: data.pagination?.pageSize || pagination.pageSize,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      });
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load block hash evidence',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks(pagination.page, searchQuery);
  }, [pagination.page]);

  const handleSearch = () => {
    fetchBlocks(1, searchQuery);
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(label);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadJSON = (block: BlockHashEvidence) => {
    const json = JSON.stringify(block, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block-evidence-${block.blockNumber}-${block.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatHash = (hash: string, length: number = 16) => {
    if (!hash) return 'N/A';
    if (hash.length <= length) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-8)}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Block-Level Hash Evidence Viewer</h1>
        <p className="text-muted-foreground mt-2">
          View and verify block-level hash evidence with pagination and JSON export
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by block hash, transaction hash, or evidence type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocks Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Block Hash Evidence</CardTitle>
              <CardDescription>
                Showing {blocks.length} of {pagination.total} blocks
              </CardDescription>
            </div>
            <Badge variant="outline">
              Page {pagination.page} of {pagination.totalPages}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading blocks...</div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No blocks found</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Block #</TableHead>
                      <TableHead>Block Hash</TableHead>
                      <TableHead>Transaction Hash</TableHead>
                      <TableHead>Evidence Type</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocks.map((block) => (
                      <TableRow
                        key={block.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedBlock(block)}
                      >
                        <TableCell className="font-mono font-medium">
                          #{block.blockNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono">
                              {formatHash(block.blockHash)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(block.blockHash, `block-hash-${block.id}`);
                              }}
                            >
                              {copiedId === `block-hash-${block.id}` ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono">
                              {formatHash(block.transactionHash)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(block.transactionHash, `tx-hash-${block.id}`);
                              }}
                            >
                              {copiedId === `tx-hash-${block.id}` ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{block.evidenceType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(block.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadJSON(block);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              JSON
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBlock(block);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} blocks
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchBlocks(pagination.page - 1, searchQuery)}
                    disabled={pagination.page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchBlocks(pagination.page + 1, searchQuery)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block Detail Modal/Drawer */}
      {selectedBlock && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Block Evidence Details</CardTitle>
                <CardDescription>
                  Block #{selectedBlock.blockNumber} - {selectedBlock.evidenceType}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBlock(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Block Hash Visualization */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Block Hash</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono break-all">{selectedBlock.blockHash}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(selectedBlock.blockHash, 'block-hash-full')}
                    >
                      {copiedId === 'block-hash-full' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    SHA-256 Hash: {selectedBlock.blockHash.length} characters
                  </div>
                </div>
              </div>

              {/* Transaction Hash */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Transaction Hash</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono break-all">
                      {selectedBlock.transactionHash}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCopy(selectedBlock.transactionHash, 'tx-hash-full')
                      }
                    >
                      {copiedId === 'tx-hash-full' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Merkle Root (if available) */}
              {selectedBlock.merkleRoot && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Merkle Root</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono break-all">
                        {selectedBlock.merkleRoot}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(selectedBlock.merkleRoot!, 'merkle-root')}
                      >
                        {copiedId === 'merkle-root' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Copyable JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Complete JSON Evidence</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(JSON.stringify(selectedBlock, null, 2), 'json')}
                  >
                    {copiedId === 'json' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedBlock, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Metadata */}
              {selectedBlock.metadata && Object.keys(selectedBlock.metadata).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Metadata</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(selectedBlock.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <div className="flex justify-end">
                <Button onClick={() => handleDownloadJSON(selectedBlock)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

