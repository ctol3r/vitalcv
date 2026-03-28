import { InternalPilotOpsConsole } from '@/components/pilot-ops/InternalPilotOpsConsole';
import { PilotDiagnosticsPanel } from '@/components/pilot-ops/PilotDiagnosticsPanel';
import { SourceHealthPanel } from '@/components/pilot-ops/SourceHealthPanel';
import { PILOT_FLAGS } from '@/lib/pilot-flags';

export default function InternalPilotOpsPage() {
  return (
    <div className="space-y-8">
      <InternalPilotOpsConsole
        initialSnapshot={null}
        flags={[
          {
            key: 'Investigations',
            enabled: PILOT_FLAGS.enableInvestigations,
            description: 'Keeps the investigation workbench available for pilot operators.',
          },
          {
            key: 'Calibration',
            enabled: PILOT_FLAGS.enableCalibration,
            description: 'Shows or hides the non-critical calibration surface without reopening the launch path.',
          },
          {
            key: 'System Health',
            enabled: PILOT_FLAGS.enableSystemHealth,
            description: 'Shows or hides the optional system-health surface while preserving the core operator flow.',
          },
        ]}
      />
      <div className="mx-auto max-w-7xl px-6 space-y-6">
        <SourceHealthPanel />
        <PilotDiagnosticsPanel />
      </div>
    </div>
  );
}
