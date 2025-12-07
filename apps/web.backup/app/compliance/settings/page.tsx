"use client";
import { useState, useEffect } from 'react';

export default function ComplianceSettingsPage() {
  const [email, setEmail] = useState('');
  const [daily, setDaily] = useState(70);
  const [weekly, setWeekly] = useState(80);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/compliance/psv-alerts?tenant=default');
        const data = await r.json();
        setEmail(data.email || '');
        setDaily(data.daily_threshold || 70);
        setWeekly(data.weekly_threshold || 80);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/compliance/psv-alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'default',
          email,
          daily_threshold: daily,
          weekly_threshold: weekly,
        }),
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="text-center py-12 text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Compliance Alert Settings</h1>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alert Email Address
          </label>
          <input
            type="email"
            className="w-full p-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="alerts@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Email address to receive PSV compliance alerts
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Alert Threshold (%)
          </label>
          <input
            type="number"
            className="w-full p-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="70"
            min="0"
            max="100"
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Send daily alerts when a provider's PSV score drops below this threshold
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Weekly Alert Threshold (%)
          </label>
          <input
            type="number"
            className="w-full p-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="80"
            min="0"
            max="100"
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Send weekly alerts when average PSV score drops below this threshold
          </p>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50 transition-colors"
            onClick={async () => {
              try {
                const r = await fetch('/api/compliance/alerts/weekly/send', { method: 'POST' });
                const text = await r.text();
                alert(text);
              } catch (error) {
                alert('Failed to send weekly alerts: ' + String(error));
              }
            }}
          >
            Send Weekly Now
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">About PSV Scoring</h3>
        <p className="text-sm text-blue-800">
          PSV scores are weighted by source importance. Higher-weight sources like license, board,
          and DEA verification carry more impact on the overall score. Grades: A (≥90%), B (75-89%),
          C (&lt;75%).
        </p>
      </div>
    </div>
  );
}

