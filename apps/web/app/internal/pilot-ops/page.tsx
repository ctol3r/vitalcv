import { InternalPilotOpsConsole } from '@/components/pilot-ops/InternalPilotOpsConsole';
import { PILOT_FLAGS } from '@/lib/pilot-flags';

export default function InternalPilotOpsPage() {
  return (
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
  );
}
