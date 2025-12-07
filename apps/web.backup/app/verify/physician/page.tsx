"use client";
import { useState } from 'react';

type VerificationStage = 'idle' | 'uploaded' | 'ocr' | 'verify' | 'result';

export default function PhysicianInstant() {
  const [state, setState] = useState('CA');
  const [fileId, setFileId] = useState('file_demo');
  const [out, setOut] = useState<any>();
  const [stage, setStage] = useState<VerificationStage>('idle');
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const base = process.env.NEXT_PUBLIC_AGENT_BASE || '';

  async function run() {
    setLoading(true);
    setStage('uploaded');
    setShowAuthPrompt(false);

    // Simulate stage progression
    setTimeout(() => setStage('ocr'), 500);
    setTimeout(() => setStage('verify'), 1500);

    try {
      // Get auth headers if token exists
      const headers: any = { 'content-type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('vitalcv_jwt');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const r = await fetch(base + '/solve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task: 'physician instant verify',
          input: { state, licensePdfId: fileId },
          scopeHints: ['global', 'domain:physician']
        })
      });

      const data = await r.json();

      // Check for auth required error
      if (r.status === 401 && data?.error === 'auth_required_for_sensitive') {
        setShowAuthPrompt(true);
        setOut({ error: 'Authentication required for this sensitive operation' });
      } else {
        setOut(data);
      }

      setStage('result');
    } catch (error) {
      setOut({ error: String(error) });
      setStage('result');
    } finally {
      setLoading(false);
    }
  }

  const getStageColor = (s: VerificationStage) => {
    if (stage === 'idle') return 'bg-gray-100 text-gray-400';
    const stages = ['uploaded', 'ocr', 'verify', 'result'];
    const currentIdx = stages.indexOf(stage);
    const stageIdx = stages.indexOf(s);

    if (stageIdx < currentIdx) return 'bg-green-100 text-green-700';
    if (stageIdx === currentIdx) return 'bg-blue-100 text-blue-700 animate-pulse';
    return 'bg-gray-100 text-gray-400';
  };

  const getResultColor = () => {
    if (!out) return 'bg-gray-50';
    return out.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold'>Physician • Instant Verify</h1>
      <p className='text-sm text-gray-600 mt-1'>Upload license PDF and get instant verification</p>

      {/* Auth Prompt */}
      {showAuthPrompt && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Authentication Required</h3>
          <p className="text-xs text-yellow-700 mb-3">This verification requires authentication. Paste your JWT token below:</p>
          <input
            type="text"
            className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm font-mono mb-2"
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
            onChange={(e) => {
              if (e.target.value) {
                localStorage.setItem('vitalcv_jwt', e.target.value);
              }
            }}
          />
          <button
            onClick={run}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
          >
            Retry with Token
          </button>
        </div>
      )}

      {/* Input Section */}
      <div className='mt-6 p-6 border-2 border-dashed rounded-lg bg-gray-50'>
        <div className='flex gap-3 flex-wrap'>
          <input
            className='flex-1 min-w-[200px] p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            value={fileId}
            onChange={e => setFileId(e.target.value)}
            placeholder='License File ID (e.g., file_demo)'
            disabled={loading}
          />
          <input
            className='w-24 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            value={state}
            onChange={e => setState(e.target.value.toUpperCase())}
            placeholder='State'
            maxLength={2}
            disabled={loading}
          />
          <button
            className='px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            onClick={run}
            disabled={loading || !fileId || !state}
          >
            {loading ? 'Verifying...' : 'Verify License'}
          </button>
        </div>
      </div>

      {/* Timeline */}
      {stage !== 'idle' && (
        <div className='mt-8'>
          <h2 className='text-sm font-semibold text-gray-700 mb-3'>Verification Progress</h2>
          <div className='flex items-center gap-2'>
            <div className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${getStageColor('uploaded')}`}>
              1. Uploaded
            </div>
            <div className='flex-1 h-1 bg-gray-200 rounded'></div>
            <div className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${getStageColor('ocr')}`}>
              2. OCR Processing
            </div>
            <div className='flex-1 h-1 bg-gray-200 rounded'></div>
            <div className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${getStageColor('verify')}`}>
              3. State Verification
            </div>
            <div className='flex-1 h-1 bg-gray-200 rounded'></div>
            <div className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${getStageColor('result')}`}>
              4. Complete
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {out && (
        <div className={`mt-6 p-6 border-2 rounded-lg ${getResultColor()}`}>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              {out.success ? (
                <>
                  <span className='text-2xl'>✅</span>
                  <h2 className='text-lg font-bold text-green-800'>Verification Successful</h2>
                </>
              ) : (
                <>
                  <span className='text-2xl'>❌</span>
                  <h2 className='text-lg font-bold text-red-800'>Verification Failed</h2>
                </>
              )}
            </div>
            <button
              className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors'
              onClick={async () => {
                try {
                  const r = await fetch(base + '/audit-chain/anchor', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ root: JSON.stringify(out?.output || {}) })
                  });
                  const data = await r.json();
                  alert(data.ok ? `✓ Anchored: ${data.note}` : '✗ Anchor failed');
                } catch (error) {
                  alert(`✗ Anchor error: ${error}`);
                }
              }}
            >
              Anchor Result
            </button>
          </div>

          {out.result && (
            <div className='mb-4 space-y-2 text-sm'>
              <div><span className='font-semibold'>Status:</span> {out.result.status || 'N/A'}</div>
              <div><span className='font-semibold'>License Number:</span> {out.result.licenseNumber || 'N/A'}</div>
              <div><span className='font-semibold'>State:</span> {out.result.state || state}</div>
            </div>
          )}

          <details className='mt-4'>
            <summary className='cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900'>
              View Raw Response
            </summary>
            <pre className='mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-96'>
              {JSON.stringify(out, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

