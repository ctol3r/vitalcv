"use client";
import { useState, useEffect } from 'react';
import { Calendar, MessageSquare, Download, CheckCircle } from 'lucide-react';

interface Revalidation {
  id: string;
  npi: string;
  cycle: string;
  dueDate: string;
  completed: boolean;
}

export default function PECOSRevalidationControls() {
  const [slackWebhook, setSlackWebhook] = useState('');
  const [icsEnabled, setIcsEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Revalidation[]>([]);

  useEffect(() => {
    // Fetch next 3 revalidations for preview
    const mockPreview: Revalidation[] = [
      { id: '1', npi: '1234567890', cycle: '5year', dueDate: '2026-01-15', completed: false },
      { id: '2', npi: '9876543210', cycle: '3year', dueDate: '2026-03-22', completed: false },
      { id: '3', npi: '5555555555', cycle: '5year', dueDate: '2026-06-10', completed: false },
    ];
    setPreview(mockPreview);
  }, []);

  const handleSave = async () => {
    // Save settings to backend
    try {
      // await fetch('/api/settings/pecos', { method: 'POST', body: JSON.stringify({ slackWebhook, icsEnabled }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadICS = () => {
    window.open('/api/pecos/calendar.ics', '_blank');
  };

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        PECOS Revalidation Settings
      </h2>

      <div className="space-y-4 mb-6">
        {/* Slack webhook */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <MessageSquare size={16} />
            Slack Webhook URL
          </label>
          <input
            type="text"
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-600 mt-1">
            Receive alerts at 90/60/30/7 days before revalidation due
          </p>
        </div>

        {/* ICS toggle */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={icsEnabled}
              onChange={(e) => setIcsEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Enable ICS calendar export
            </span>
          </label>
        </div>

        {icsEnabled && (
          <button
            onClick={downloadICS}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            <Download size={16} />
            Download PECOS Calendar (.ics)
          </button>
        )}
      </div>

      <button
        onClick={handleSave}
        className={`px-4 py-2 rounded transition-colors ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {saved ? (
          <span className="flex items-center gap-2">
            <CheckCircle size={16} />
            Saved
          </span>
        ) : (
          'Save Settings'
        )}
      </button>

      {/* Preview of next 3 revalidations */}
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar size={16} />
          Next 3 Revalidations
        </h3>
        <div className="space-y-2">
          {preview.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <div>
                <span className="font-medium">NPI {r.npi}</span>
                <span className="text-gray-600 ml-2">({r.cycle})</span>
              </div>
              <div className="text-gray-700">
                {new Date(r.dueDate).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

