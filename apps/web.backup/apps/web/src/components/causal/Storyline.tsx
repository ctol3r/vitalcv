'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, BookOpen, RefreshCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CausalEdge, CausalNode, CausalPath } from './PathDiagram';

export interface StorylineProps {
  path: CausalPath;
  eventTitle?: string;
  autoGenerate?: boolean;
  className?: string;
}

interface StorylineSegment {
  id: string;
  type: 'cause' | 'chain' | 'event' | 'outcome';
  text: string;
  nodeIds: string[];
  evidence?: Array<{ type: string; label: string }>;
}

interface GeneratedStoryline {
  title: string;
  segments: StorylineSegment[];
  summary: string;
  generatedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

function buildStorylineFromPath(path: CausalPath, eventTitle?: string): GeneratedStoryline {
  const segments: StorylineSegment[] = [];
  const nodeMap = new Map(path.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, CausalEdge[]>();

  path.edges.forEach((edge) => {
    if (!edgeMap.has(edge.source)) {
      edgeMap.set(edge.source, []);
    }
    edgeMap.get(edge.source)!.push(edge);
  });

  // Find root cause
  const rootCause = path.nodes.find((n) => n.id === path.rootCauseId);
  if (rootCause) {
    segments.push({
      id: 'root-cause',
      type: 'cause',
      text: `The root cause of this event is ${rootCause.label}. ${
        rootCause.description ||
        'This represents the fundamental issue that initiated the causal chain.'
      }`,
      nodeIds: [rootCause.id],
      evidence: rootCause.evidence,
    });
  }

  // Build chain by following edges from root cause
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: path.rootCauseId, depth: 0 }];
  const orderedNodes: Array<{ node: CausalNode; depth: number }> = [];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node && node.id !== path.rootCauseId) {
      orderedNodes.push({ node, depth });
    }

    const edges = edgeMap.get(nodeId) ?? [];
    edges.forEach((edge) => {
      if (!visited.has(edge.target)) {
        queue.push({ nodeId: edge.target, depth: depth + 1 });
      }
    });
  }

  // Sort by depth and add intermediate nodes
  orderedNodes.sort((a, b) => a.depth - b.depth);
  orderedNodes.forEach(({ node, depth }) => {
    const edges =
      edgeMap.get(
        node.id === path.rootCauseId
          ? path.rootCauseId
          : orderedNodes.find((n) => nodeMap.get(n.node.id)?.id === node.id)?.node.id || '',
      ) ?? [];
    const incomingEdge = path.edges.find((e) => e.target === node.id);

    if (node.type === 'intermediate') {
      segments.push({
        id: `intermediate-${node.id}`,
        type: 'chain',
        text: `This led to ${node.label}. ${
          node.description || 'An intermediate factor in the causal chain.'
        }${
          incomingEdge?.label ? ` The connection is characterized by ${incomingEdge.label}.` : ''
        }`,
        nodeIds: [node.id],
        evidence: node.evidence || incomingEdge?.evidence,
      });
    }
  });

  // Add event
  const eventNode = path.nodes.find((n) => n.id === path.eventId);
  if (eventNode) {
    segments.push({
      id: 'event',
      type: 'event',
      text: `Ultimately, this resulted in the event: ${eventTitle || eventNode.label}. ${
        eventNode.description || 'This is the final outcome of the causal chain.'
      }`,
      nodeIds: [eventNode.id],
      evidence: eventNode.evidence,
    });
  }

  // Generate summary
  const summary =
    segments.length > 0
      ? `The causal chain begins with ${
          rootCause?.label || 'an initial cause'
        } and progresses through ${
          segments.length - 1
        } intermediate steps, ultimately resulting in ${
          eventTitle || eventNode?.label || 'the observed event'
        }.`
      : 'Unable to generate storyline from the provided causal path.';

  return {
    title: eventTitle || `Causal Storyline: ${eventNode?.label || 'Event Analysis'}`,
    segments,
    summary,
    generatedAt: new Date().toISOString(),
    confidence: segments.length >= 3 ? 'high' : segments.length >= 2 ? 'medium' : 'low',
  };
}

async function generateLLMStoryline(
  path: CausalPath,
  eventTitle?: string,
): Promise<GeneratedStoryline> {
  // In a real implementation, this would call an LLM API
  // For now, we'll use the rule-based generation with some enhancements
  const baseStoryline = buildStorylineFromPath(path, eventTitle);

  // Simulate LLM enhancement by adding more narrative context
  const enhancedSegments = baseStoryline.segments.map((segment, idx) => {
    let enhancedText = segment.text;

    if (segment.type === 'cause' && idx === 0) {
      enhancedText = `${enhancedText} This foundational issue sets the stage for subsequent developments in the causal chain.`;
    } else if (segment.type === 'chain') {
      enhancedText = `${enhancedText} This intermediary factor acts as a critical link between earlier causes and eventual outcomes.`;
    } else if (segment.type === 'event') {
      enhancedText = `${enhancedText} This represents the culmination of the causal sequence, where all contributing factors converge.`;
    }

    return { ...segment, text: enhancedText };
  });

  return {
    ...baseStoryline,
    segments: enhancedSegments,
  };
}

export function Storyline({ path, eventTitle, autoGenerate = true, className }: StorylineProps) {
  const [storyline, setStoryline] = useState<GeneratedStoryline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStoryline = async () => {
    setLoading(true);
    setError(null);
    try {
      // In a real implementation, this would call an API that uses an LLM
      const response = await fetch('/api/demo/org/causal/storyline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ path, eventTitle }),
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const payload = await response.json();
      setStoryline(payload as GeneratedStoryline);
    } catch (err) {
      console.warn('Storyline generation falling back to rule-based narrative', err);
      // Fallback to rule-based generation
      const generated = await generateLLMStoryline(path, eventTitle);
      setStoryline(generated);
      setError('Using rule-based narrative. LLM generation unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGenerate && path.nodes.length > 0) {
      loadStoryline();
    }
  }, [path, eventTitle, autoGenerate]);

  const confidenceColors = {
    high: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    low: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  if (loading && !storyline) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-spin" aria-hidden="true" />
            Generating narrative storyline…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!storyline) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-sm text-muted-foreground">
            Unable to generate storyline. Please ensure the causal path contains nodes.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              Causal Storyline
            </CardTitle>
            <CardDescription>
              Human-readable narrative explaining the causal chain from root cause to event.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={confidenceColors[storyline.confidence]}>
              {storyline.confidence.toUpperCase()} CONFIDENCE
            </Badge>
            <Button variant="outline" size="sm" onClick={loadStoryline} disabled={loading}>
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Regenerate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-400/70 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-2">{storyline.title}</h3>
          <p className="text-sm text-muted-foreground italic">{storyline.summary}</p>
        </div>

        <div className="space-y-4">
          {storyline.segments.map((segment, idx) => {
            const segmentIcons = {
              cause: '🎯',
              chain: '🔗',
              event: '⚡',
              outcome: '📊',
            };

            const segmentLabels = {
              cause: 'Root Cause',
              chain: 'Causal Link',
              event: 'Event',
              outcome: 'Outcome',
            };

            return (
              <div key={segment.id} className="relative rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                    {segmentIcons[segment.type]}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {segmentLabels[segment.type]}
                      </Badge>
                      {idx < storyline.segments.length - 1 && (
                        <span className="text-xs text-muted-foreground">→</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                    {segment.evidence && segment.evidence.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          Supporting Evidence
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {segment.evidence.map((ev, evIdx) => (
                            <Badge key={evIdx} variant="outline" className="text-xs">
                              {ev.type}: {ev.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p>
            Narrative generated on {new Date(storyline.generatedAt).toLocaleString()}. This
            storyline is based on the causal path structure and may be enhanced with additional
            context when LLM generation is available.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
