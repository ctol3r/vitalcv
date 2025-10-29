'use client';

/**
 * LinkGraph
 *
 * Visualizes AI-discovered semantic links in the credential graph
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocalLinkUpdate } from '@/hooks/useLocalLinkUpdate';
import { RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface LinkData {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  targetType: string;
  relationship: string;
  score: number;
  inferred: boolean;
}

interface LinkGraphProps {
  entityId: string;
  onNodeClick?: (nodeId: string) => void;
  autoRefresh?: boolean;
  className?: string;
}

export function LinkGraph({
  entityId,
  onNodeClick,
  autoRefresh = true,
  className,
}: LinkGraphProps) {
  const [links, setLinks] = useState<LinkData[]>([]);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  // Auto-refresh links
  useLocalLinkUpdate(
    (newLinks) => {
      setLinks((prev) => {
        // Merge with existing links, avoiding duplicates
        const existingIds = new Set(prev.map((l) => l.id));
        const uniqueNew = newLinks.filter((l) => !existingIds.has(l.id));
        return [...prev, ...uniqueNew];
      });
    },
    autoRefresh ? 15000 : 0,
  );

  // Load initial links
  useEffect(() => {
    const loadLinks = async () => {
      try {
        const response = await fetch(`/api/links?entity=${entityId}`);
        if (!response.ok) return;

        const data = await response.json();
        setLinks(data.links || []);
      } catch (err) {
        console.error('Load links error:', err);
      }
    };

    loadLinks();
  }, [entityId]);

  const triggerInference = async () => {
    try {
      const response = await fetch(`/api/links/infer?entity=${entityId}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Inference failed');

      const data = await response.json();
      toast.success(`Discovered ${data.links?.length || 0} new links!`);

      // Refresh links
      const refreshResponse = await fetch(`/api/links?entity=${entityId}`);
      const refreshData = await refreshResponse.json();
      setLinks(refreshData.links || []);
    } catch (err) {
      toast.error('Failed to trigger AI inference');
    }
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship) {
      case 'issued_by':
      case 'issued_to':
        return '📜';
      case 'verified_by':
        return '✓';
      case 'related_to':
        return '🔗';
      default:
        return '→';
    }
  };

  if (links.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Semantic Link Graph
          </CardTitle>
          <CardDescription>AI-powered relationship discovery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No links discovered yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click the button below to trigger AI analysis and discover semantic relationships.
            </p>
            <Button onClick={triggerInference} size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Run AI Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Semantic Link Graph
            </CardTitle>
            <CardDescription>
              {links.length} AI-discovered relationship{links.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={triggerInference}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className={`group relative flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-primary ${
                selectedLink === link.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => {
                setSelectedLink(link.id);
                onNodeClick?.(link.targetId);
              }}
            >
              {/* Relationship Indicator */}
              <div className="flex flex-col items-center justify-center min-w-[40px]">
                <div className="text-2xl">{getRelationshipIcon(link.relationship)}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {Math.round(link.score * 100)}%
                </div>
              </div>

              {/* Link Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{link.targetName}</h4>
                  {link.inferred && <span className="text-xs text-muted-foreground">(AI)</span>}
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {link.relationship.replace(/_/g, ' ')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{link.targetType}</span>
                </div>
              </div>

              {/* Sparkle indicator for inferred links */}
              {link.inferred && <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p>
            <Sparkles className="inline h-3 w-3 mr-1" />
            Links are discovered using AI semantic analysis. Click to explore relationships.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
