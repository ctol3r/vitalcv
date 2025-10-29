'use client';

/**
 * LinkInspector - AI-powered semantic link analysis
 *
 * Shows entity relationships discovered through AI embeddings
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ExternalLink, Link as LinkIcon, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Link {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  targetType: 'credential' | 'issuer' | 'holder' | 'verifier' | 'npi';
  score: number;
  relationship: string;
  inferred: boolean;
  createdAt: string;
}

interface LinkInspectorProps {
  entityId: string;
  entityType?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export function LinkInspector({
  entityId,
  entityType,
  autoRefresh = true,
  refreshInterval = 15000,
  className,
}: LinkInspectorProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/links?entity=${entityId}`);
      if (!response.ok) throw new Error('Failed to fetch links');

      const data = await response.json();
      setLinks(data.links || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load links');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [entityId]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLinks, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, entityId]);

  const getRelationshipColor = (relationship: string) => {
    const colors: Record<string, string> = {
      issued_by: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      issued_to: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      verified_by: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      related_to: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      similar: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[relationship] || colors.similar;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI-Discovered Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            Link Analysis Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" onClick={fetchLinks} className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (links.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            AI-Discovered Links
          </CardTitle>
          <CardDescription>Semantic relationships discovered through AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No linked entities discovered yet. AI will analyze relationships as more data is added.
          </p>
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
              AI-Discovered Links
            </CardTitle>
            <CardDescription>
              {links.length} semantic relationship{links.length !== 1 ? 's' : ''} found
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLinks}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {link.targetType}
                  </Badge>
                  <span className="font-medium">{link.targetName}</span>
                  {link.inferred && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI-Inferred
                    </Badge>
                  )}
                </div>
                <Badge className={getRelationshipColor(link.relationship)}>
                  {link.relationship}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Confidence: {Math.round(link.score * 100)}%</span>
                  {link.createdAt && (
                    <span>• Analyzed {new Date(link.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  // Navigate to target entity
                  if (link.targetType === 'credential') {
                    window.location.href = `/wallet?credential=${link.targetId}`;
                  } else {
                    toast.info(`Navigating to ${link.targetName}`);
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p>
            <Sparkles className="inline h-3 w-3 mr-1" />
            Links are discovered automatically using AI semantic analysis of credential metadata,
            issuers, and relationships.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
