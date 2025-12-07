'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Network,
  Users,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamically import force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[600px]" />,
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

interface GraphNode {
  id: string;
  clinicianId: string;
  role?: string;
  specialty?: string;
  trustScore: number;
  endorsementsCount: number;
  communityTrustScore?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: 'supervisor-of' | 'collaborated-with' | 'verified-skill-for' | 'referenced-by';
  trustWeight: number;
  strength: number;
  recency: number;
  chainAnchored: boolean;
  verified: boolean;
  relationshipStrengthScore?: number;
}

interface NetworkData {
  node: GraphNode;
  connections: Array<{
    edge: GraphEdge;
    node: GraphNode;
    depth: number;
  }>;
}

interface IdentityGraphViewProps {
  clinicianId: string;
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  clinician: '#3b82f6', // blue
  supervisor: '#10b981', // green
  recruiter: '#f59e0b', // amber
  mentor: '#8b5cf6', // purple
  colleague: '#ec4899', // pink
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  'supervisor-of': '#10b981',
  'collaborated-with': '#3b82f6',
  'verified-skill-for': '#8b5cf6',
  'referenced-by': '#f59e0b',
};

export function IdentityGraphView({
  clinicianId,
  onNodeClick,
  className
}: IdentityGraphViewProps) {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const graphRef = useRef<any>();

  // Fetch network data
  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/graph/network/${clinicianId}?depth=2`);

        if (!response.ok) {
          throw new Error('Failed to fetch network');
        }

        const data = await response.json();
        setNetworkData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load network');
      } finally {
        setLoading(false);
      }
    };

    if (clinicianId) {
      fetchNetwork();
    }
  }, [clinicianId]);

  // Transform network data for force graph
  const graphData = useMemo(() => {
    if (!networkData) return { nodes: [], links: [] };

    const nodes: any[] = [];
    const links: any[] = [];
    const nodeMap = new Map<string, any>();

    // Add main node
    const mainNode = {
      id: networkData.node.id,
      clinicianId: networkData.node.clinicianId,
      role: networkData.node.role || 'clinician',
      specialty: networkData.node.specialty,
      trustScore: networkData.node.trustScore,
      endorsementsCount: networkData.node.endorsementsCount,
      communityTrustScore: networkData.node.communityTrustScore,
      isMain: true,
    };
    nodes.push(mainNode);
    nodeMap.set(mainNode.id, mainNode);

    // Add connection nodes
    for (const conn of networkData.connections) {
      if (!nodeMap.has(conn.node.id)) {
        const node = {
          id: conn.node.id,
          clinicianId: conn.node.clinicianId,
          role: conn.node.role || 'clinician',
          specialty: conn.node.specialty,
          trustScore: conn.node.trustScore,
          endorsementsCount: conn.node.endorsementsCount,
          depth: conn.depth,
          isMain: false,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      }

      // Add link
      links.push({
        id: conn.edge.id,
        source: conn.edge.fromNodeId === networkData.node.id
          ? networkData.node.id
          : conn.node.id,
        target: conn.edge.toNodeId === networkData.node.id
          ? networkData.node.id
          : conn.node.id,
        edgeType: conn.edge.edgeType,
        trustWeight: conn.edge.trustWeight,
        chainAnchored: conn.edge.chainAnchored,
        verified: conn.edge.verified,
        strength: conn.edge.strength,
      });
    }

    return { nodes, links };
  }, [networkData]);

  // Node color based on role
  const getNodeColor = (node: any) => {
    return ROLE_COLORS[node.role || 'clinician'] || '#6b7280';
  };

  // Node size based on trust score
  const getNodeSize = (node: any) => {
    const baseSize = node.isMain ? 12 : 8;
    return baseSize + (node.trustScore * 8);
  };

  // Node glow based on trust score (stronger = greener)
  const getNodeGlow = (node: any) => {
    const trust = node.trustScore || 0;
    // Green glow intensity based on trust (0-1 mapped to 0-255)
    const greenIntensity = Math.floor(trust * 255);
    return `rgba(16, 185, 129, ${trust * 0.6})`; // green with opacity
  };

  // Edge color based on type
  const getEdgeColor = (link: any) => {
    return EDGE_TYPE_COLORS[link.edgeType] || '#6b7280';
  };

  // Edge width based on trust weight
  const getEdgeWidth = (link: any) => {
    return 1 + (link.trustWeight * 3);
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(zoom + 0.2, 400);
      setZoom(zoom + 0.2);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(zoom - 0.2, 400);
      setZoom(zoom - 0.2);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
      setZoom(1);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Identity Network Graph</CardTitle>
          <CardDescription>Loading network connections...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[600px]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Identity Network Graph</CardTitle>
          <CardDescription>Error loading network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
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
              <Network className="h-5 w-5" />
              Identity Network Graph
            </CardTitle>
            <CardDescription>
              Visual map of professional relationships and trust connections
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel={(node: any) => `
              ${node.role || 'Clinician'}
              Trust: ${(node.trustScore * 100).toFixed(0)}%
              Endorsements: ${node.endorsementsCount}
            `}
            nodeColor={(node: any) => getNodeColor(node)}
            nodeVal={(node: any) => getNodeSize(node)}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
              const size = getNodeSize(node);
              const color = getNodeColor(node);
              const glow = getNodeGlow(node);

              // Draw glow
              ctx.beginPath();
              ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
              ctx.fillStyle = glow;
              ctx.fill();

              // Draw node
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.strokeStyle = node.isMain ? '#fff' : '#e5e7eb';
              ctx.lineWidth = node.isMain ? 2 : 1;
              ctx.stroke();

              // Draw label
              ctx.fillStyle = '#1f2937';
              ctx.font = `${node.isMain ? '12px' : '10px'} sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                node.role || 'Clinician',
                node.x,
                node.y + size + 12
              );
            }}
            linkLabel={(link: any) => `${link.edgeType} (${(link.trustWeight * 100).toFixed(0)}%)`}
            linkColor={(link: any) => getEdgeColor(link)}
            linkWidth={(link: any) => getEdgeWidth(link)}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.1}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            onEngineStop={() => {
              if (graphRef.current) {
                graphRef.current.zoomToFit(400);
              }
            }}
            d3Force="charge"
            d3ForceStrength={-300}
          />

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-4 space-y-2 min-w-[200px]">
            <div className="text-sm font-semibold mb-2">Node Types</div>
            {Object.entries(ROLE_COLORS).map(([role, color]) => (
              <div key={role} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize">{role}</span>
              </div>
            ))}
            <div className="text-sm font-semibold mt-4 mb-2">Edge Types</div>
            {Object.entries(EDGE_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-4 h-0.5"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </div>
            ))}
          </div>

          {/* Selected Node Info */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-4 min-w-[250px]">
              <div className="text-sm font-semibold mb-2">Node Details</div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium">Role:</span>{' '}
                  <span className="capitalize">{selectedNode.role || 'Clinician'}</span>
                </div>
                {selectedNode.specialty && (
                  <div>
                    <span className="font-medium">Specialty:</span>{' '}
                    <span>{selectedNode.specialty}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Trust Score:</span>{' '}
                  <span>{(selectedNode.trustScore * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="font-medium">Endorsements:</span>{' '}
                  <span>{selectedNode.endorsementsCount}</span>
                </div>
                {selectedNode.communityTrustScore !== undefined && (
                  <div>
                    <span className="font-medium">Community Trust:</span>{' '}
                    <span>{(selectedNode.communityTrustScore * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  window.location.href = `/clinicians/${selectedNode.clinicianId}`;
                }}
              >
                View Profile
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}








