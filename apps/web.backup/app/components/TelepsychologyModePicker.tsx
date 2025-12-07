"use client";
import { useState } from 'react';
import { Monitor, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

interface PSYPACTVerdict {
  authorized: boolean;
  reasons: string[];
  missing: string[];
}

export default function TelepsychologyModePicker({
  npi,
  patientState,
}: {
  npi: string;
  patientState: string;
}) {
  const [mode, setMode] = useState<'tele' | 'temp_in_person'>('tele');
  const [verdict, setVerdict] = useState<PSYPACTVerdict | null>(null);
  const [checking, setChecking] = useState(false);

  const checkPSYPACT = async () => {
    setChecking(true);
    try {
      const res = await fetch(
        `/api/telehealth/authz?npi=${npi}&profession=psychologist&patient=${patientState}&mode=${mode}`
      );
      const data = await res.json();
      setVerdict({
        authorized: data.authorized || false,
        reasons: data.reasons || [],
        missing: data.missing || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-gray-900 mb-3">
        Telepsychology Service Mode
      </h3>

      <div className="space-y-3 mb-4">
        <label className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="mode"
            value="tele"
            checked={mode === 'tele'}
            onChange={() => setMode('tele')}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 font-medium text-gray-900">
              <Monitor size={18} />
              <span>Telepsychology (Remote)</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Requires APIT (Authority for Psych Interjurisdictional
              Telepsychology)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="mode"
            value="temp_in_person"
            checked={mode === 'temp_in_person'}
            onChange={() => setMode('temp_in_person')}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 font-medium text-gray-900">
              <MapPin size={18} />
              <span>Temporary In-Person Authority</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Requires TAP (Temporary Authorization to Practice) + E.Passport
            </p>
          </div>
        </label>
      </div>

      <button
        onClick={checkPSYPACT}
        disabled={checking}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {checking ? 'Checking...' : 'Check PSYPACT Eligibility'}
      </button>

      {verdict && (
        <div
          className={`mt-4 p-3 rounded border ${
            verdict.authorized
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {verdict.authorized ? (
              <>
                <CheckCircle size={18} className="text-green-600" />
                <span className="font-semibold text-green-900">Authorized</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} className="text-red-600" />
                <span className="font-semibold text-red-900">
                  Not Authorized
                </span>
              </>
            )}
          </div>

          {verdict.reasons.length > 0 && (
            <div className="text-xs text-gray-700 mb-2">
              <strong>Reasons:</strong>
              <ul className="ml-4 mt-1 list-disc">
                {verdict.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {verdict.missing.length > 0 && (
            <div className="text-xs text-red-800">
              <strong>Missing requirements:</strong>
              <ul className="ml-4 mt-1 list-disc">
                {verdict.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

