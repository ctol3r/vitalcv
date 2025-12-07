/**
 * Compliance EP Matrix - Batch 54
 * NCQA CR1-CR5 + Joint Commission 2025 requirements mapped
 */

"use client";

export default function ComplianceEP() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Compliance EP Matrix</h1>
      <p className="text-sm text-gray-600 mb-6">
        Evidence Package mapping for NCQA 2025 (CR1–CR5) and Joint Commission standards
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* NCQA Section */}
        <div className="border border-gray-300 rounded-lg p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-3 text-blue-700">
            NCQA 2025 (CR1–CR5)
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            API-first primary source verification with ≤120-day windows (≤90d for CVO)
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Source Name & URL:</strong> Verifiable registry identifier
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Date Pulled:</strong> Timestamp within monitoring window
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Method:</strong> API (preferred) or Manual with documentation
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Reviewer:</strong> Staff member ID for manual verifications
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Outcome:</strong> Pass/Fail with supporting data
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Evidence Hash:</strong> SHA-256 of verification payload
              </div>
            </li>
          </ul>
        </div>

        {/* Joint Commission Section */}
        <div className="border border-gray-300 rounded-lg p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-3 text-green-700">
            Joint Commission 2025
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            "Every verification now traceable" — click-through evidence with blockchain anchors
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>PSV Evidence Log:</strong> Complete audit trail per provider
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>NPDB/OIG Cadence:</strong> Monthly monitoring (configurable)
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Temporary Privileges:</strong> ≤120-day window enforcement
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Monthly Anchor Proof:</strong> Blockchain commitment for tamper-evidence
              </div>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1.5 mr-2"></span>
              <div>
                <strong>Survey Packet Export:</strong> One-click PDF/JSON bundle
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          Export NCQA Evidence (CSV)
        </button>
        <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium">
          Generate JC Survey Packet
        </button>
        <a
          href="/api/verify/events"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
        >
          View PSV Events API →
        </a>
      </div>
    </div>
  );
}

