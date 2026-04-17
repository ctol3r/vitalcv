import DailyUtilityLoop from '../../../components/holder/DailyUtilityLoop';
import { generateOutputLayer } from '../../../../api/backend/src/services/trust/trustArtifactEngine';

export default function ClinicianDashboard() {
  const mockApplication = {
    progress: { identity: 'complete', sanctions: 'complete', licensure: 'missing' },
    artifacts: []
  };

  const output = generateOutputLayer(mockApplication);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Clinician Command Center</h1>
      <DailyUtilityLoop score={output.trust_score} blockers={output.blockers} />
      
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="p-6 border rounded-xl shadow-sm">
          <h2 className="font-bold mb-2">Career Salvage Map</h2>
          <p className="text-sm text-muted-foreground mb-4">Export your verified credentials anywhere.</p>
          <button className="w-full py-2 bg-secondary text-secondary-foreground rounded">Download Proof Pack</button>
        </div>
        <div className="p-6 border rounded-xl shadow-sm">
          <h2 className="font-bold mb-2">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mb-4">Get alerted when state boards update.</p>
          <button className="w-full py-2 bg-secondary text-secondary-foreground rounded">Manage Alerts</button>
        </div>
      </div>
    </div>
  );
}
