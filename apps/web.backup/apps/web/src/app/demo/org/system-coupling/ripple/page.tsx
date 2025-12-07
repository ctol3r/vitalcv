'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Play, RotateCcw, Waves } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { SystemCouplingGraph } from '../../../../../components/systemCoupling/SystemCouplingGraph';

type EventType = 'license-cliff' | 'privilege-restriction' | 'surge' | 'credential-expiry';

interface Event {
  id: EventType;
  label: string;
  description: string;
  affectedDepartment: string;
  severity: 'high' | 'medium' | 'low';
}

const EVENTS: Event[] = [
  {
    id: 'license-cliff',
    label: 'License Cliff',
    description: 'Mass license expiration affecting multiple departments',
    affectedDepartment: 'anesthesia',
    severity: 'high',
  },
  {
    id: 'privilege-restriction',
    label: 'Privilege Restriction',
    description: 'Restriction on OR privileges due to compliance issue',
    affectedDepartment: 'or',
    severity: 'high',
  },
  {
    id: 'surge',
    label: 'Patient Surge',
    description: 'Unexpected patient volume increase',
    affectedDepartment: 'cardiology',
    severity: 'medium',
  },
  {
    id: 'credential-expiry',
    label: 'Credential Expiry',
    description: 'Critical credentialing department backlog',
    affectedDepartment: 'credentialing',
    severity: 'high',
  },
];

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
  strength: number;
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

export default function RippleSimulationPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rippleNodes, setRippleNodes] = useState<Set<string>>(new Set());
  const [animationStep, setAnimationStep] = useState(0);

  const selectedEventData = useMemo(() => {
    if (!selectedEvent) return null;
    return EVENTS.find((e) => e.id === selectedEvent);
  }, [selectedEvent]);

  // Calculate ripple propagation
  const calculateRipple = useCallback((eventId: EventType) => {
    const event = EVENTS.find((e) => e.id === eventId);
    if (!event) return new Set<string>();

    const affected = new Set<string>([event.affectedDepartment]);
    const visited = new Set<string>();
    const queue = [event.affectedDepartment];

    // BFS to find all affected departments
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all departments that depend on current
      MOCK_DEPENDENCIES.forEach((dep) => {
        if (dep.source === current && !affected.has(dep.target)) {
          affected.add(dep.target);
          queue.push(dep.target);
        }
      });
    }

    return affected;
  }, []);

  const animateRipple = useCallback(() => {
    if (!selectedEvent) return;

    setIsAnimating(true);
    setAnimationStep(0);
    setRippleNodes(new Set());

    const affectedNodes = calculateRipple(selectedEvent);
    const nodesArray = Array.from(affectedNodes);
    const steps = nodesArray.length;

    // Animate step by step
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps) {
        setRippleNodes(new Set(nodesArray.slice(0, currentStep + 1)));
        setAnimationStep(currentStep + 1);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 500);
  }, [selectedEvent, calculateRipple]);

  const resetAnimation = useCallback(() => {
    setIsAnimating(false);
    setRippleNodes(new Set());
    setAnimationStep(0);
  }, []);

  const graphData = useMemo(() => {
    const getNodeColor = (dept: Department) => {
      if (rippleNodes.has(dept.id)) {
        return '#f87171'; // Red for affected
      }
      const score = dept.loadScore;
      if (score >= 0.7) return '#ef4444';
      if (score >= 0.5) return '#f59e0b';
      if (score >= 0.3) return '#eab308';
      return '#22c55e';
    };

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
  }, [rippleNodes]);

  const affectedCount = useMemo(() => {
    if (!selectedEvent) return 0;
    return calculateRipple(selectedEvent).size;
  }, [selectedEvent, calculateRipple]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Demo • Org • System Coupling
          </p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Waves className="h-8 w-8 text-primary" aria-hidden="true" />
            Ripple Simulation
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Select an event to visualize how it propagates through the organizational dependency
            network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAnimation}
            disabled={!selectedEvent || isAnimating}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={animateRipple} disabled={!selectedEvent || isAnimating}>
            <Play className="mr-2 h-4 w-4" />
            {isAnimating ? 'Animating...' : 'Animate Ripple'}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Event Selection Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Event</CardTitle>
              <CardDescription>Choose an event to simulate its propagation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={selectedEvent || ''}
                onValueChange={(value) => {
                  setSelectedEvent(value as EventType);
                  resetAnimation();
                }}
              >
                {EVENTS.map((event) => (
                  <div key={event.id} className="flex items-start space-x-2">
                    <RadioGroupItem value={event.id} id={event.id} className="mt-1" />
                    <Label htmlFor={event.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{event.label}</div>
                      <div className="text-sm text-muted-foreground">{event.description}</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'mt-1',
                          event.severity === 'high'
                            ? 'border-rose-500 text-rose-700'
                            : event.severity === 'medium'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-amber-500 text-amber-700',
                        )}
                      >
                        {event.severity}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {selectedEventData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Affected Department</span>
                  <p className="font-medium">
                    {
                      MOCK_DEPARTMENTS.find((d) => d.id === selectedEventData.affectedDepartment)
                        ?.name
                    }
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Severity</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'mt-1',
                      selectedEventData.severity === 'high'
                        ? 'border-rose-500 text-rose-700'
                        : selectedEventData.severity === 'medium'
                        ? 'border-orange-500 text-orange-700'
                        : 'border-amber-500 text-amber-700',
                    )}
                  >
                    {selectedEventData.severity}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Propagation Impact</span>
                  <p className="text-2xl font-bold text-rose-600">{affectedCount} departments</p>
                  <p className="text-xs text-muted-foreground">Will be affected by ripple effect</p>
                </div>
              </CardContent>
            </Card>
          )}

          {isAnimating && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-primary">
                  <Waves className="h-5 w-5 animate-pulse" />
                  <span className="font-medium">Ripple propagating...</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Step {animationStep} of {affectedCount}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Graph Visualization */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5" />
                Ripple Propagation
              </CardTitle>
              <CardDescription>
                Red nodes indicate departments affected by the selected event. Watch the ripple
                spread through dependencies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                <SystemCouplingGraph
                  data={graphData}
                  selectedNode={selectedEventData?.affectedDepartment || null}
                  hoveredNode={null}
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-center text-muted-foreground">
                  <div>
                    <Waves className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select an event to begin simulation</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
