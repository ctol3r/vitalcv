"use client";
import { useState, useEffect } from 'react';
import { MapPin, Users, CheckCircle } from 'lucide-react';

const COMPACTS = [
  { id: 'imlc', name: 'IMLC (Physician)', profession: 'physician' },
  { id: 'nlc', name: 'NLC (Nurse)', profession: 'nurse' },
  { id: 'psypact', name: 'PSYPACT (Psychology)', profession: 'psychologist' },
  { id: 'aprn', name: 'APRN Compact', profession: 'aprn' },
  { id: 'pt', name: 'PT Compact', profession: 'pt' },
  { id: 'ot', name: 'OT Compact', profession: 'ot' },
];

export default function CompactTelehealthExplorer() {
  const [selectedCompacts, setSelectedCompacts] = useState<string[]>(['nlc']);
  const [compactData, setCompactData] = useState<Record<string, string[]>>({});
  const [sampleNPI, setSampleNPI] = useState('1234567890');
  const [authzPreview, setAuthzPreview] = useState<any>(null);

  useEffect(() => {
    // Fetch compact data
    const fetchCompacts = async () => {
      try {
        const res = await fetch('/api/compacts');
        const data = await res.json();
        setCompactData(data.compacts || {});
      } catch (err) {
        console.error(err);
      }
    };

    fetchCompacts();
  }, []);

  const toggleCompact = (id: string) => {
    setSelectedCompacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const previewAuthz = async (profession: string) => {
    try {
      const res = await fetch(
        `/api/telehealth/authz?npi=${sampleNPI}&profession=${profession}&patient=CA`
      );
      const data = await res.json();
      setAuthzPreview(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 bg-white border rounded-lg">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Compact & Telehealth Explorer
      </h2>

      {/* Compact toggles */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Select compacts to explore:
        </div>
        <div className="flex flex-wrap gap-2">
          {COMPACTS.map((compact) => (
            <button
              key={compact.id}
              onClick={() => toggleCompact(compact.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedCompacts.includes(compact.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {compact.name}
            </button>
          ))}
        </div>
      </div>

      {/* Compact details */}
      <div className="grid gap-4 mb-6">
        {selectedCompacts.map((compactId) => {
          const compact = COMPACTS.find((c) => c.id === compactId);
          const states = compactData[compactId] || [];

          return (
            <div key={compactId} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-900">{compact?.name}</h3>
                </div>
                <span className="text-sm text-gray-600">{states.length} states</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {states.slice(0, 15).map((state) => (
                  <span
                    key={state}
                    className="px-2 py-0.5 bg-white border rounded text-xs font-medium text-gray-700"
                  >
                    {state}
                  </span>
                ))}
                {states.length > 15 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">
                    +{states.length - 15} more
                  </span>
                )}
              </div>

              <button
                onClick={() => previewAuthz(compact?.profession || '')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Preview AuthZ for sample clinician →
              </button>
            </div>
          );
        })}
      </div>

      {/* AuthZ preview */}
      {authzPreview && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-blue-600" />
            <h4 className="font-semibold text-gray-900">AuthZ Preview</h4>
          </div>
          <div className="text-sm text-gray-700">
            <div className="mb-1">
              <strong>Profession:</strong> {authzPreview.profession}
            </div>
            <div className="mb-1">
              <strong>Patient State:</strong> {authzPreview.patientState}
            </div>
            <div className="mb-1">
              <strong>Authorized:</strong>{' '}
              <span
                className={
                  authzPreview.authorized ? 'text-green-700' : 'text-red-700'
                }
              >
                {authzPreview.authorized ? 'Yes' : 'No'}
              </span>
            </div>
            {authzPreview.reasons?.length > 0 && (
              <div className="mt-2 text-xs">
                <strong>Reasons:</strong>
                <ul className="ml-4 list-disc mt-1">
                  {authzPreview.reasons.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map placeholder */}
      <div className="mt-6 p-8 border-2 border-dashed rounded-lg bg-gray-50 text-center text-gray-500">
        <MapPin size={32} className="mx-auto mb-2 text-gray-400" />
        <div className="text-sm">Interactive US map coming soon</div>
      </div>
    </div>
  );
}

