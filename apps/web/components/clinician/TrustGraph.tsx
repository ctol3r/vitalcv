'use client';

import { useEffect, useState } from 'react';
import { TrustGraphCanvas } from '../graph/TrustGraphCanvas';
import { CredentialInspector } from '../graph/CredentialInspector';
import { GraphNode, GraphEdge } from '../graph/types';

interface TrustGraphProps {
  npi: string;
}

export function TrustGraph({ npi }: TrustGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [activeNode, setActiveNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(`/api/graph/${npi}`);
        if (!res.ok) throw new Error('Failed to fetch graph');
        const data = await res.json();
        
        setNodes(data.nodes || []);
        
        const rawEdges = data.edges || [];
        const processedEdges = rawEdges.map((e: any) => {
          let type = 'ISSUED_BY'; // Default relationship
          const targetNode = data.nodes?.find((n: any) => n.id === e.target);
          const sourceNode = data.nodes?.find((n: any) => n.id === e.source);
          
          if (sourceNode?.group === 'employer' || targetNode?.group === 'employer') {
            type = 'ACCEPTED_BY';
          } else if (sourceNode?.group === 'credential' || targetNode?.group === 'credential') {
            type = 'VERIFIED_BY';
          } else if (sourceNode?.group === 'clinician' || targetNode?.group === 'clinician') {
            type = 'DEPENDS_ON';
          }
          
          return {
            ...e,
            type
          };
        });
        
        setEdges(processedEdges);
      } catch (err) {
        console.error('Error fetching graph data', err);
      }
    }
    fetchGraph();
  }, [npi]);

  return (
    <div className="relative w-full h-[600px]">
      <TrustGraphCanvas 
        nodes={nodes} 
        edges={edges} 
        onNodeClick={(node) => setActiveNode(node.id === activeNode?.id ? null : node)}
        activeNodeId={activeNode?.id || null}
      />
      <CredentialInspector 
        node={activeNode} 
        onClose={() => setActiveNode(null)} 
      />
    </div>
  );
}
