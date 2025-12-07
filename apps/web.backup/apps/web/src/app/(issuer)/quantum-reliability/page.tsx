'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Activity, Zap, TrendingDown, Atom, Waves } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

type ReliabilityState = 'valid' | 'weak' | 'decaying' | 'disputed';

interface ReliabilitySuperposition {
  states: Array<{
    state: ReliabilityState;
    probability: number;
  }>;
  coherence: number;
  uncertainty: number;
}

interface WaveFunction {
  amplitude: number;
  phase: number;
  probability: number;
}

interface DecoherenceEvent {
  timestamp: string;
  type: string;
  impact: number;
  severity: 'low' | 'medium' | 'high';
}

interface QuantumReliabilityField {
  credentialId: string;
  superposition: ReliabilitySuperposition;
  waveFunction: WaveFunction;
  coherence: number;
  uncertainty: number;
  decoherenceEvents: DecoherenceEvent[];
  phaseAlignment: Record<string, number>;
  collapseProbability: number;
  drift: Array<{
    timestamp: string;
    vector: number[];
  }>;
  entanglement: Array<{
    credentialId: string;
    correlation: number;
  }>;
}

export default function QuantumReliabilityPage() {
  const [field, setField] = useState<QuantumReliabilityField | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string>('');

  useEffect(() => {
    if (credentialId) {
      fetchField(credentialId);
    }
  }, [credentialId]);

  async function fetchField(id: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/quantum-reliability/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch quantum reliability field');
      }

      const data = await response.json();
      setField(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !field) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!field) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Quantum Reliability Field</CardTitle>
            <CardDescription>Enter a credential ID to view reliability analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Credential ID"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <button
                onClick={() => fetchField(credentialId)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Load
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare pie chart data
  const pieData = field.superposition.states.map(state => ({
    name: state.state.charAt(0).toUpperCase() + state.state.slice(1),
    value: state.probability * 100,
  }));

  const COLORS = {
    valid: '#10b981',
    weak: '#f59e0b',
    decaying: '#ef4444',
    disputed: '#8b5cf6',
  };

  const stateColors = pieData.map(d => COLORS[d.name.toLowerCase() as keyof typeof COLORS] || '#gray');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quantum Reliability Field</h1>
        <p className="text-muted-foreground mt-2">
          Probabilistic-quantum hybrid reliability modeling for credentials
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Coherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(field.coherence * 100).toFixed(1)}%</div>
            <Progress value={field.coherence * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Evidence alignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uncertainty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(field.uncertainty * 100).toFixed(1)}%</div>
            <Progress value={field.uncertainty * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Entropy in signals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wave Amplitude</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{field.waveFunction.amplitude.toFixed(3)}</div>
            <div className="flex items-center gap-1 mt-2">
              <Waves className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Quantum state</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collapse Probability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(field.collapseProbability * 100).toFixed(1)}%</div>
            <Progress value={field.collapseProbability * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Risk of collapse</p>
          </CardContent>
        </Card>
      </div>

      {/* Reliability Superposition */}
      <Card>
        <CardHeader>
          <CardTitle>Reliability Superposition</CardTitle>
          <CardDescription>Probability distribution across reliability states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stateColors[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-3">
              {field.superposition.states.map((state, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[state.state] || '#gray' }}
                    />
                    <span className="font-medium capitalize">{state.state}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={state.probability * 100} className="w-32" />
                    <span className="text-sm font-medium w-16 text-right">
                      {(state.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wave Function */}
      <Card>
        <CardHeader>
          <CardTitle>Wave Function</CardTitle>
          <CardDescription>Quantum wave function parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Amplitude</div>
              <div className="text-2xl font-bold">{field.waveFunction.amplitude.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phase</div>
              <div className="text-2xl font-bold">{(field.waveFunction.phase * 180 / Math.PI).toFixed(1)}°</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Probability</div>
              <div className="text-2xl font-bold">{(field.waveFunction.probability * 100).toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decoherence Events */}
      {field.decoherenceEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decoherence Events</CardTitle>
            <CardDescription>Disruptive events affecting reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {field.decoherenceEvents.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="font-medium capitalize">{event.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={event.severity === 'high' ? 'destructive' : 'secondary'}>
                      {event.severity}
                    </Badge>
                    <span className="text-sm font-medium">
                      Impact: {(event.impact * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase Alignment */}
      {Object.keys(field.phaseAlignment).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Multi-Chain Phase Alignment</CardTitle>
            <CardDescription>Reliability phase alignment across chains</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(field.phaseAlignment).map(([chain, alignment]) => (
                <div key={chain} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Atom className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">{chain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={alignment * 100} className="w-32" />
                    <span className="text-sm font-medium w-16 text-right">
                      {(alignment * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entanglement */}
      {field.entanglement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cross-Credential Entanglement</CardTitle>
            <CardDescription>Linked reliability risks across related credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {field.entanglement.map((ent, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{ent.credentialId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ent.correlation > 0.7 ? 'default' : 'secondary'}>
                      {ent.correlation > 0.7 ? 'Entangled' : 'Correlated'}
                    </Badge>
                    <span className="text-sm font-medium">
                      {(ent.correlation * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drift Mapping */}
      {field.drift.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reliability Field Drift</CardTitle>
            <CardDescription>Field migration across time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {field.drift.slice(-10).map((point, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(point.timestamp).toLocaleDateString()}
                  </span>
                  <span className="font-medium">
                    Magnitude: {Math.sqrt(point.vector.reduce((sum, v) => sum + v * v, 0)).toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








