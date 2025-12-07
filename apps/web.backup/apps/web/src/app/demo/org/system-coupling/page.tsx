'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, Network } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import styles from './progress-bar.module.css';

const SystemCouplingGraph = dynamic(
  () =>
    import('@/components/systemCoupling/SystemCouplingGraph').then(
      (mod) => mod.SystemCouplingGraph,
    ),
  {
    loading: () => <Skeleton className="h-[600px] w-full rounded-xl" />,
    ssr: false,
  },
);

interface Department {
  id: string;
  name: string;
  loadScore: number;
  predictedStress: number;
  category: 'clinical' | 'support' | 'administrative' | 'critical';
}

interface Dependency {
  source: string;
  target: string;
  strength: number; // 0-1
  type: 'credential' | 'resource' | 'data' | 'workflow';
}

const MOCK_DEPARTMENTS: Department[] = [
  {
    id: 'anesthesia',
    name: 'Anesthesia',
    loadScore: 0.85,
    predictedStress: 0.72,
    category: 'critical',
  },
  {
    id: 'or',
    name: 'Operating Room',
    loadScore: 0.78,
    predictedStress: 0.68,
    category: 'critical',
  },
  {
    id: 'cardiology',
    name: 'Cardiology',
    loadScore: 0.65,
    predictedStress: 0.55,
    category: 'clinical',
  },
  {
    id: 'radiology',
    name: 'Radiology',
    loadScore: 0.6,
    predictedStress: 0.5,
    category: 'clinical',
  },
  { id: 'pharmacy', name: 'Pharmacy', loadScore: 0.55, predictedStress: 0.45, category: 'support' },
  { id: 'lab', name: 'Laboratory', loadScore: 0.5, predictedStress: 0.4, category: 'support' },
  {
    id: 'hr',
    name: 'Human Resources',
    loadScore: 0.45,
    predictedStress: 0.35,
    category: 'administrative',
  },
  {
    id: 'credentialing',
    name: 'Credentialing',
    loadScore: 0.7,
    predictedStress: 0.6,
    category: 'administrative',
  },
];

const MOCK_DEPENDENCIES: Dependency[] = [
  { source: 'or', target: 'anesthesia', strength: 0.95, type: 'credential' },
  { source: 'or', target: 'radiology', strength: 0.75, type: 'workflow' },
  { source: 'cardiology', target: 'radiology', strength: 0.7, type: 'data' },
  { source: 'cardiology', target: 'lab', strength: 0.65, type: 'data' },
  { source: 'anesthesia', target: 'credentialing', strength: 0.85, type: 'credential' },
  { source: 'or', target: 'pharmacy', strength: 0.6, type: 'resource' },
  { source: 'radiology', target: 'credentialing', strength: 0.7, type: 'credential' },
  { source: 'pharmacy', target: 'credentialing', strength: 0.55, type: 'credential' },
];

const CATEGORY_COLORS: Record<Department['category'], string> = {
  critical: 'bg-rose-500',
  clinical: 'bg-blue-500',
  support: 'bg-emerald-500',
  administrative: 'bg-purple-500',
};

export default function SystemCouplingPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showLoadScore, setShowLoadScore] = useState(true);

  const selectedDepartment = useMemo(() => {
    if (!selectedNode) return null;
    return MOCK_DEPARTMENTS.find((d) => d.id === selectedNode);
  }, [selectedNode]);

  const getNodeColor = useCallback(
    (dept: Department) => {
      const score = showLoadScore ? dept.loadScore : dept.predictedStress;
      if (score >= 0.7) return '#ef4444'; // red
      if (score >= 0.5) return '#f59e0b'; // orange
      if (score >= 0.3) return '#eab308'; // yellow
      return '#22c55e'; // green
    },
    [showLoadScore],
  );

  const graphData = useMemo(() => {
    return {
      nodes: MOCK_DEPARTMENTS.map((dept) => ({
        id: dept.id,
        label: dept.name,
        color: getNodeColor(dept),
        loadScore: dept.loadScore,
        predictedStress: dept.predictedStress,
        category: dept.category,
      })),
      links: MOCK_DEPENDENCIES.map((dep) => ({
        source: dep.source,
        target: dep.target,
        strength: dep.strength,
        type: dep.type,
      })),
    };
  }, [getNodeColor]);

  const loadScoreWidth = useMemo(() => {
    if (!selectedDepartment) return '0%';
    return `${selectedDepartment.loadScore * 100}%`;
  }, [selectedDepartment]);

  const stressWidth = useMemo(() => {
    if (!selectedDepartment) return '0%';
    return `${selectedDepartment.predictedStress * 100}%`;
  }, [selectedDepartment]);

  // Map dynamic percentages to discrete CSS classes (5% increments) to avoid inline styles
  const getWidthClassName = useCallback((percentString: string) => {
    const pct = Math.max(
      0,
      Math.min(100, Math.round(parseFloat(percentString.replace('%', '')))),
    );
    const bucket = Math.round(pct / 5) * 5; // 0,5,10,...,100
    // Construct class key like styles.w65
    const key = `w${bucket}` as keyof typeof styles;
    return styles[key];
  }, []);

  const loadScoreWidthClass = useMemo(() => getWidthClassName(loadScoreWidth), [getWidthClassName, loadScoreWidth]);
  const stressWidthClass = useMemo(() => getWidthClassName(stressWidth), [getWidthClassName, stressWidth]);

  const loadScorePercentage = useMemo(() => {
    if (!selectedDepartment) return '0%';
    return `${(selectedDepartment.loadScore * 100).toFixed(0)}%`;
  }, [selectedDepartment]);

  const stressPercentage = useMemo(() => {
    if (!selectedDepartment) return '0%';
    return `${(selectedDepartment.predictedStress * 100).toFixed(0)}%`;
  }, [selectedDepartment]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Demo • Org • System Coupling
          </p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Network className="h-8 w-8 text-primary" aria-hidden="true" />
            System Coupling Explorer
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Interactive network visualization showing department dependencies. Edges represent
            dependency strength, nodes are colored by{' '}
            {showLoadScore ? 'load score' : 'predicted stress'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showLoadScore ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLoadScore(true)}
          >
            Load Score
          </Button>
          <Button
            variant={!showLoadScore ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLoadScore(false)}
          >
            Predicted Stress
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Graph Visualization */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" aria-hidden="true" />
                Dependency Network
              </CardTitle>
              <CardDescription>
                Click on nodes to view details. Edge thickness indicates dependency strength.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemCouplingGraph
                data={graphData}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeSelect={setSelectedNode}
                onNodeHover={setHoveredNode}
              />
            </CardContent>
          </Card>
        </div>

        {/* Node Details Panel */}
        <div className="space-y-4">
          {selectedDepartment ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedDepartment.name}</CardTitle>
                <CardDescription>Department Details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Load Score</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        selectedDepartment.loadScore >= 0.7
                          ? 'border-rose-500 text-rose-700'
                          : selectedDepartment.loadScore >= 0.5
                          ? 'border-orange-500 text-orange-700'
                          : 'border-emerald-500 text-emerald-700',
                      )}
                    >
                      {loadScorePercentage}
                    </Badge>
                  </div>
                  <div
                    className={cn(
                      'h-2 bg-muted rounded-full overflow-hidden',
                      styles.progressBarContainer,
                      loadScoreWidthClass,
                    )}
                  >
                    <div className={cn(styles.progressBar, styles.progressBarPrimary)} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Predicted Stress</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        selectedDepartment.predictedStress >= 0.7
                          ? 'border-rose-500 text-rose-700'
                          : selectedDepartment.predictedStress >= 0.5
                          ? 'border-orange-500 text-orange-700'
                          : 'border-emerald-500 text-emerald-700',
                      )}
                    >
                      {stressPercentage}
                    </Badge>
                  </div>
                  <div
                    className={cn(
                      'h-2 bg-muted rounded-full overflow-hidden',
                      styles.progressBarContainer,
                      stressWidthClass,
                    )}
                  >
                    <div className={cn(styles.progressBar, styles.progressBarOrange)} />
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Category</span>
                  <Badge className={cn('mt-1', CATEGORY_COLORS[selectedDepartment.category])}>
                    {selectedDepartment.category}
                  </Badge>
                </div>

                <div>
                  <span className="text-sm font-medium mb-2 block">Dependencies</span>
                  <div className="space-y-2">
                    {MOCK_DEPENDENCIES.filter(
                      (d) =>
                        d.source === selectedDepartment.id || d.target === selectedDepartment.id,
                    ).map((dep, idx) => {
                      const otherDept = MOCK_DEPARTMENTS.find(
                        (d) =>
                          d.id === (dep.source === selectedDepartment.id ? dep.target : dep.source),
                      );
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm p-2 rounded border"
                        >
                          <span>{otherDept?.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {(dep.strength * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-center text-muted-foreground">
                <div>
                  <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select a department node to view details</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Node Colors ({showLoadScore ? 'Load Score' : 'Predicted Stress'})
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-red-500" />
                    <span>High (≥70%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-orange-500" />
                    <span>Medium (50-69%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-yellow-500" />
                    <span>Low (30-49%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-500" />
                    <span>Very Low (&lt;30%)</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Edge Thickness</p>
                <p className="text-xs">Thicker edges indicate stronger dependencies</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
