"use client";
import { useState } from 'react';
import BoardsMap from '../../../components/BoardsMap';

export default function BoardsPage() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [boardInfo, setBoardInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleStateSelect = async (state: string) => {
    setSelectedState(state);
    setLoading(true);
    setError(null);
    setBoardInfo(null);
    setVerificationStatus(null);
    setLicenseNumber('');

    try {
      // Assuming GET /api/boards/:state returns board info
      // In a real app, you might need to handle the base URL or proxy setup.
      // Next.js app/api routes usually map to backend if configured, or this fetch might need full URL if backend is separate.
      // Assuming standard Next.js proxy or same-origin /api setup.
      const res = await fetch(`/api/boards/${state}`);
      if (!res.ok) {
        if (res.status === 404) {
            setBoardInfo({ state, notFound: true });
        } else {
            // If backend is not reachable or other error, handle gracefully
            console.error('Board info fetch failed', res.status);
            setBoardInfo({ state, notFound: true }); // Fallback
        }
      } else {
        const data = await res.json();
        setBoardInfo(data);
      }
    } catch (err: any) {
      console.error(err);
      setError('Could not load board information.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedState || !licenseNumber) return;
    setVerifying(true);
    setVerificationStatus(null);

    try {
      const res = await fetch('/api/boards/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: selectedState, licenseNumber })
      });

      const data = await res.json();
      setVerificationStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">State Licensing Boards</h1>
        <p className="text-slate-500 mt-2">
          Select a state to view licensing board requirements and verify your status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <BoardsMap selectedState={selectedState} onStateSelect={handleStateSelect} />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 h-fit min-h-[400px]">
          {!selectedState ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
              <span className="text-4xl mb-4">🗺️</span>
              <p>Select a state on the map to view details</p>
            </div>
          ) : loading ? (
             <div className="h-full flex items-center justify-center text-slate-500">Loading board info...</div>
          ) : error ? (
             <div className="text-red-500">{error}</div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">
                    {boardInfo?.board?.state || selectedState} State Board
                    </h2>
                    <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-mono font-bold">
                        {selectedState}
                    </div>
                </div>

                {boardInfo?.board?.boardUrl ? (
                    <a
                      href={boardInfo.board.boardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Visit Official Website &rarr;
                    </a>
                ) : (
                    <p className="mt-2 text-sm text-slate-400">Official website not available</p>
                )}
              </div>

              {boardInfo?.requirements && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">License Requirements</h3>
                    <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-600 overflow-auto max-h-48 font-mono">
                        {JSON.stringify(boardInfo.requirements, null, 2)}
                    </div>
                  </div>
              )}

              {boardInfo?.notFound && (
                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded text-sm border border-yellow-100">
                      We don't have detailed requirements for this board yet.
                  </div>
              )}

              {/* License Status Verification */}
              <div className="border-t border-slate-200 pt-6">
                 <h3 className="text-sm font-semibold text-slate-700 mb-3">Verify License Status</h3>
                 <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="License Number"
                        className="flex-1 text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleVerify}
                        disabled={!licenseNumber || verifying}
                        className="bg-slate-900 text-white px-4 py-2 text-sm rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {verifying ? '...' : 'Check'}
                    </button>
                 </div>

                 {verificationStatus && (
                     <div className={`mt-3 p-3 rounded border text-sm flex justify-between items-center ${
                         verificationStatus.status === 'active' ? 'bg-green-50 border-green-200 text-green-800' :
                         verificationStatus.status === 'expired' ? 'bg-red-50 border-red-200 text-red-800' :
                         'bg-slate-100 border-slate-200 text-slate-700'
                     }`}>
                         <div>
                             <span className="font-bold capitalize">{verificationStatus.status}</span>
                             <div className="text-xs opacity-75">Last updated: {new Date(verificationStatus.lastUpdated).toLocaleDateString()}</div>
                         </div>
                         <div className="text-2xl">
                             {verificationStatus.status === 'active' ? '✅' :
                              verificationStatus.status === 'expired' ? '⚠️' : '❔'}
                         </div>
                     </div>
                 )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}














