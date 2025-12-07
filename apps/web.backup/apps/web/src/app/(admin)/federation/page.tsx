'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowClockwise,
  LinkIcon,
  PlusCircle,
  ShieldCheck,
  Trash2,
  TreePine,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface FederationTreeNode {
  did: string;
  parentDid?: string;
  trustLevel?: number;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  children: FederationTreeNode[];
}

interface FederationTreeResponse {
  roots: FederationTreeNode[];
  stats: {
    totalLinks: number;
    totalRoots: number;
    lastUpdated?: string;
  };
}

export default function FederationAdminPage() {
  const { toast } = useToast();
  const [tree, setTree] = useState<FederationTreeResponse | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [formState, setFormState] = useState({
    parentDid: '',
    childDid: '',
    trustLevel: 3,
    metadata: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const response = await fetch(`${API_BASE}/api/trust/federation/tree`);
      if (!response.ok) {
        throw new Error(`Failed to load federation tree (${response.status})`);
      }
      const payload = (await response.json()) as FederationTreeResponse;
      setTree(payload);
    } catch (error) {
      console.error('federation tree load failed', error);
      toast({
        title: 'Unable to load federation tree',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingTree(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const flatLinkCount = useMemo(() => {
    if (!tree?.roots) return 0;
    const walk = (nodes: FederationTreeNode[]): number =>
      nodes.reduce((sum, node) => sum + node.children.length + walk(node.children), 0);
    return walk(tree.roots);
  }, [tree]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.parentDid || !formState.childDid) {
      toast({
        title: 'Missing fields',
        description: 'Parent DID and child DID are required.',
        variant: 'destructive',
      });
      return;
    }
    let parsedMetadata: Record<string, any> | undefined;
    if (formState.metadata) {
      try {
        parsedMetadata = JSON.parse(formState.metadata);
      } catch (error) {
        toast({
          title: 'Invalid metadata JSON',
          description: error instanceof Error ? error.message : 'Unable to parse metadata payload',
          variant: 'destructive',
        });
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/trust/federation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentDid: formState.parentDid.trim(),
          childDid: formState.childDid.trim(),
          trustLevel: formState.trustLevel,
          metadata: parsedMetadata,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'Unable to add federation link');
      }
      setFormState((prev) => ({
        ...prev,
        childDid: '',
        metadata: '',
      }));
      toast({
        title: 'Federated issuer added',
        description: `${formState.childDid} now inherits trust from ${formState.parentDid}.`,
      });
      fetchTree();
    } catch (error) {
      toast({
        title: 'Failed to add federated issuer',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (parentDid: string, childDid: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/trust/federation/${encodeURIComponent(parentDid)}/${encodeURIComponent(childDid)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'Unable to remove federated issuer');
      }
      toast({
        title: 'Federated issuer removed',
        description: `Revoked ${childDid} from ${parentDid}.`,
      });
      fetchTree();
    } catch (error) {
      toast({
        title: 'Failed to remove link',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issuer Federation Graph</h1>
          <p className="text-muted-foreground">
            Manage cross-organization trust inheritance for issuers participating in the NCI network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTree} disabled={loadingTree}>
            <ArrowClockwise className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="min-h-[420px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TreePine className="h-5 w-5 text-emerald-500" />
                Federation tree
              </CardTitle>
              <CardDescription>
                {tree?.stats
                  ? `${tree.stats.totalRoots} root issuers · ${flatLinkCount} linked issuers`
                  : 'Loading trust graph...'}
              </CardDescription>
            </div>
            {tree?.stats?.lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(tree.stats.lastUpdated).toLocaleString()}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingTree ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowClockwise className="h-4 w-4 animate-spin" />
                Loading federation links...
              </div>
            ) : tree?.roots?.length ? (
              <div className="max-h-[520px] overflow-y-auto pr-2">
                {tree.roots.map((root) => (
                  <FederationNode key={root.did} node={root} onRemove={handleRemove} depth={0} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                No federation links defined yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add child issuer</CardTitle>
            <CardDescription>Attach downstream issuers to an existing trust anchor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="parentDid">Parent DID</Label>
                <Input
                  id="parentDid"
                  placeholder="did:web:trusted.health"
                  value={formState.parentDid}
                  onChange={(event) => setFormState((prev) => ({ ...prev, parentDid: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="childDid">Child DID</Label>
                <Input
                  id="childDid"
                  placeholder="did:web:child.health"
                  value={formState.childDid}
                  onChange={(event) => setFormState((prev) => ({ ...prev, childDid: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustLevel">Trust level (1-5)</Label>
                <Input
                  id="trustLevel"
                  type="number"
                  min={1}
                  max={5}
                  value={formState.trustLevel}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, trustLevel: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata (JSON)</Label>
                <Textarea
                  id="metadata"
                  placeholder='{"jurisdiction":"CA","notes":"auto-onboarded"}'
                  value={formState.metadata}
                  onChange={(event) => setFormState((prev) => ({ ...prev, metadata: event.target.value }))}
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {saving ? 'Adding...' : 'Add child issuer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FederationNode({
  node,
  onRemove,
  depth,
}: {
  node: FederationTreeNode;
  onRemove: (parentDid: string, childDid: string) => void;
  depth: number;
}) {
  const isRoot = !node.parentDid;
  return (
    <div className="space-y-2">
      <div
        className="flex items-start gap-3 rounded-lg border p-3"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isRoot ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <LinkIcon className="h-4 w-4 text-slate-500" />
            )}
            <span className="font-mono text-sm">{node.did}</span>
            {!isRoot && typeof node.trustLevel === 'number' && (
              <Badge variant="outline">Trust {node.trustLevel}/5</Badge>
            )}
          </div>
          {node.metadata && (
            <p className="mt-1 text-xs text-muted-foreground">
              {JSON.stringify(node.metadata)}
            </p>
          )}
          {node.createdAt && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Linked {new Date(node.createdAt).toLocaleString()}
            </p>
          )}
        </div>
        {!isRoot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(node.parentDid!, node.did)}
            aria-label="Remove link"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {(node.children ?? []).map((child) => (
        <FederationNode key={`${node.did}-${child.did}`} node={child} onRemove={onRemove} depth={depth + 1} />
      ))}
    </div>
  );
}

