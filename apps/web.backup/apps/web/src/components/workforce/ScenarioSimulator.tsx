/**
 * Scenario Simulator Component
 * Phase 4: Task 32 - Scenario simulation ("What if 3 RNs retire?")
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { WorkforcePrediction } from '@/lib/workforce/models';
import { WorkforcePredictionEngine } from '@/lib/workforce/prediction-engine';
import { Play, RotateCcw } from 'lucide-react';

interface ScenarioSimulatorProps {
  basePrediction: WorkforcePrediction;
}

export function ScenarioSimulator({ basePrediction }: ScenarioSimulatorProps) {
  const [scenario, setScenario] = useState<{ specialty: string; count: number }[]>([]);
  const [simulatedPrediction, setSimulatedPrediction] = useState<WorkforcePrediction | null>(null);

  const addRetirement = () => {
    setScenario([...scenario, { specialty: '', count: 0 }]);
  };

  const updateRetirement = (index: number, field: 'specialty' | 'count', value: string | number) => {
    const updated = [...scenario];
    updated[index] = { ...updated[index], [field]: value };
    setScenario(updated);
  };

  const removeRetirement = (index: number) => {
    setScenario(scenario.filter((_, i) => i !== index));
  };

  const runSimulation = () => {
    const forecastDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const simulated = WorkforcePredictionEngine.simulateScenario(basePrediction, {
      retirements: scenario,
      forecastDate,
    });
    setSimulatedPrediction(simulated);
  };

  const resetSimulation = () => {
    setScenario([]);
    setSimulatedPrediction(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Simulator</CardTitle>
        <CardDescription>
          Simulate workforce impact: "What if X clinicians retire?"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {scenario.map((retirement, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Specialty (e.g., RN, MD, ICU)"
                value={retirement.specialty}
                onChange={(e) => updateRetirement(index, 'specialty', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Count"
                value={retirement.count}
                onChange={(e) => updateRetirement(index, 'count', parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <Button variant="outline" size="sm" onClick={() => removeRetirement(index)}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addRetirement} className="w-full">
            Add Retirement Scenario
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={runSimulation} className="gap-2" disabled={scenario.length === 0}>
            <Play className="h-4 w-4" />
            Run Simulation
          </Button>
          <Button variant="outline" onClick={resetSimulation} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {simulatedPrediction && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-semibold mb-2">Simulation Results</h4>
            <div className="space-y-1 text-sm">
              {simulatedPrediction.forecastedShortages.map((shortage) => (
                <div key={shortage.specialty} className="flex items-center justify-between">
                  <span>{shortage.specialty}</span>
                  <span className="font-medium">
                    Deficit: {shortage.deficit} ({shortage.urgency})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

