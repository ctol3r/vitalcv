'use client';

import { useEffect, useState } from 'react';
import { SimulationAlert } from './SimulationAlert';
import { SimulationGraph } from './SimulationGraph';
import { SimulationPhase, SimulationTimeline } from './SimulationTimeline';

// Mock Network Data
const SIM_NODES = [
  { id: 'clinician', label: 'Dr. Sarah Chen', group: 'clinician', val: 20 },
  { id: 'cred-1', label: 'Medical License', group: 'credential', val: 15, status: 'Valid' },
  { id: 'issuer-1', label: 'State Medical Board', group: 'issuer', val: 15 },
  { id: 'decision-1', label: 'Access Auth', group: 'decision', val: 12 },
  { id: 'employer-1', label: 'General Hospital', group: 'employer', val: 18 },
  { id: 'employer-2', label: 'Mercy Clinic', group: 'employer', val: 18 },
];

const SIM_EDGES = [
  { source: 'clinician', target: 'cred-1', label: 'Hold' },
  { source: 'issuer-1', target: 'cred-1', label: 'Issue' },
  { source: 'cred-1', target: 'decision-1', label: 'Verify' },
  { source: 'decision-1', target: 'employer-1', label: 'Grant' },
  { source: 'decision-1', target: 'employer-2', label: 'Grant' },
];

export function TrustSimulation() {
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Orchestrate the simulation
    const runSimulation = async () => {
      // 1. Start with Verification
      setPhase('verification');
      await new Promise(r => setTimeout(r, 2000));

      // 2. Move to Decision (Healthy State)
      setPhase('decision');
      await new Promise(r => setTimeout(r, 3000));

      // 3. Suddenly, Revocation hits
      setPhase('revocation');
      setShowAlert(true); // Pop the alert card
      await new Promise(r => setTimeout(r, 2000));

      // 4. Ripple effect to employers
      setPhase('cascade');
      await new Promise(r => setTimeout(r, 5000));

      // Reset
      setShowAlert(false);
      setPhase('idle');

      // Loop
      setTimeout(runSimulation, 1000);
    };

    const timer = setTimeout(runSimulation, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full overflow-hidden flex flex-col items-center justify-center min-h-[600px] py-12">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)] pointer-events-none" />

      {/* Main Graph View */}
      <div className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden glass border-white/10 shadow-2xl">
        <SimulationGraph
          nodes={SIM_NODES as any}
          edges={SIM_EDGES as any}
          width={1024}
          height={576}
          currentPhase={phase}
          className="w-full h-full"
        />
      </div>

      {/* Overlays */}
      <SimulationTimeline currentPhase={phase} />
      <SimulationAlert
        isVisible={showAlert}
        organizations={['General Hospital', 'Mercy Clinic']}
      />
    </div>
  );
}
