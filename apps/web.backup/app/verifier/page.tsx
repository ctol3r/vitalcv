"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ResultCard } from '../components/verifier/ResultCard';
import { Scan, KeyRound, ShieldCheck, Clock } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function VerifierLanding() {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode) return;
    setLoading(true);
    try {
        // Using the check-status endpoint
        // Assuming the route is /api/verifier/status/:credentialId based on verifyController
        const res = await fetch(`${BASE}/api/verifier/status/${manualCode}`);
        const data = await res.json();

        if (res.ok) {
            setResult({
                status: data.status,
                credentialType: 'Status Check',
                auditRef: data.auditRef,
                disclosureLevel: 'N/A',
                reason: data.reason,
                ...data
            });
        } else {
             setResult({
                status: 'unknown',
                reason: data.error || 'Failed to verify',
                credentialType: 'Error'
            });
        }
    } catch (error: any) {
        setResult({
            status: 'unknown',
            credentialType: 'Error',
            reason: error.message
        });
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
        <header className="mb-12 text-center">
            <h1 className="text-3xl font-bold mb-4">Verifier Portal</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
                Verify credentials securely with privacy-preserving technology.
                Only the necessary data is disclosed.
            </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Large Scan Button */}
            <Link href="/verifier/scan" className="group relative flex flex-col items-center justify-center p-8 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all shadow-xl">
                <Scan className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
                <span className="text-xl font-bold">Scan Credential</span>
                <span className="text-sm text-gray-400 mt-2">Use camera to scan QR code</span>
            </Link>

            {/* Manual Entry */}
            <div className="p-8 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <KeyRound className="w-6 h-6 text-gray-700" />
                    <h2 className="text-xl font-bold text-gray-900">Manual Entry</h2>
                </div>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Credential ID</label>
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Enter credential ID..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:outline-none transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !manualCode}
                        className="w-full py-3 bg-white border-2 border-black text-black font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Checking...' : 'Check Status'}
                    </button>
                </form>
            </div>
        </div>

        {/* Result Area */}
        {result && (
            <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-4">Verification Result</h2>
                <ResultCard result={result} />

                <div className="mt-4 text-right">
                    <button
                        onClick={() => { setResult(null); setManualCode(''); }}
                        className="text-sm text-gray-500 hover:text-black underline"
                    >
                        Clear Result
                    </button>
                </div>
            </div>
        )}

        {/* Timeline Placeholder */}
        <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-700">Recent Activity</h3>
            </div>
            <div className="border-l-2 border-gray-200 ml-2 space-y-6 pl-6 py-2">
                {/* Placeholder Items */}
                <div className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-green-500 border-4 border-white shadow-sm"></div>
                    <p className="text-sm font-medium">Verified Credential #8821</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                </div>
                <div className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-gray-300 border-4 border-white shadow-sm"></div>
                    <p className="text-sm font-medium">Session Started</p>
                    <p className="text-xs text-gray-500">5 minutes ago</p>
                </div>
            </div>
        </div>

        {/* Data Minimization Explanation */}
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl flex gap-4 items-start">
            <ShieldCheck className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
                <h4 className="font-bold text-blue-900 mb-1">Privacy & Data Minimization</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                    This verifier uses <strong>Selective Disclosure</strong> (SD-JWT) to ensure only requested data is shared.
                    We verify the authenticity of credentials without storing personal information unnecessarily.
                    Audit logs contain only cryptographic proofs, not PII.
                </p>
            </div>
        </div>
    </div>
  );
}
