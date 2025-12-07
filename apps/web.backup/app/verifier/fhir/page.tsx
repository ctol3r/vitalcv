'use client';
import { useState } from 'react';

export default function FHIRVerifier() {
  const [res, setRes] = useState<any>();
  const [loading, setLoading] = useState(false);
  const [resourceTypes, setResourceTypes] = useState<string[]>(['Practitioner', 'License']);
  const [minimumNecessary, setMinimumNecessary] = useState(true);

  async function verify() {
    setLoading(true);
    try {
      const policy = {
        resourceTypes,
        minimumNecessary,
      };
      const r = await fetch(`/api/verifier/fhir?policy=${encodeURIComponent(JSON.stringify(policy))}`);
      const data = await r.json();
      setRes(data);
    } catch (error) {
      console.error('Verification error:', error);
      setRes({ error: String(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">FHIR Verifier</h1>

      <div className="mb-4 space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Resource Types</label>
          <div className="flex flex-wrap gap-2">
            {['Practitioner', 'License', 'PractitionerQualification', 'Endpoint'].map((type) => (
              <label key={type} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={resourceTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setResourceTypes([...resourceTypes, type]);
                    } else {
                      setResourceTypes(resourceTypes.filter((t) => t !== type));
                    }
                  }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={minimumNecessary}
              onChange={(e) => setMinimumNecessary(e.target.checked)}
            />
            Minimum Necessary (redaction)
          </label>
        </div>
      </div>

      <button
        onClick={verify}
        disabled={loading}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Run Verification'}
      </button>

      {res && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Verification Result</h2>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(res, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

