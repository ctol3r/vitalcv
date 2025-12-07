"use client";
import { useEffect, useState } from 'react';

export default function Latest() {
  const [d, setD] = useState<any>();
  const [sending, setSending] = useState(false);
  const [sendResult, setSetResult] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/digests/weekly/last');
      setD(await r.json());
    })();
  }, []);

  const handleSendEmail = async () => {
    setSending(true);
    setSetResult('');
    try {
      const r = await fetch('/api/digests/weekly/send');
      const result = await r.text();
      setSetResult(result);
      alert('Email sent successfully!');
    } catch (err) {
      alert('Failed to send email: ' + err);
    } finally {
      setSending(false);
    }
  };

  const y = (v: boolean) => (
    <span className={'px-2 py-0.5 rounded text-xs ' + (v ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
      {v ? 'YES' : 'no'}
    </span>
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(d, null, 2));
    alert('Copied to clipboard!');
  };

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold'>Weekly Changes</h1>
        <div className='flex gap-2'>
          <button
            onClick={handleSendEmail}
            disabled={sending || !d}
            className='px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'
          >
            {sending ? 'Sending...' : 'Send Email'}
          </button>
          {d && (
            <button
              onClick={copyToClipboard}
              className='px-3 py-1.5 text-sm border rounded hover:bg-gray-50'
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {d ? (
        <div className='text-sm space-y-3'>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>Compacts:</span>
            {y(!!d.deltas?.compacts)}
          </div>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>Telehealth rules:</span>
            {y(!!d.deltas?.state_rules)}
          </div>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>Uniform MPJE:</span>
            {y(!!d.deltas?.mpje)}
          </div>

          {d.generated_at && (
            <div className='text-xs text-gray-500 mt-2'>
              Generated: {new Date(d.generated_at).toLocaleString()}
            </div>
          )}

          <pre className='text-xs bg-gray-50 p-3 rounded mt-3 overflow-auto max-h-[500px]'>
            {JSON.stringify(d, null, 2)}
          </pre>

          {sendResult && (
            <div className='text-xs bg-blue-50 p-3 rounded mt-3'>
              <div className='font-semibold mb-1'>Send Result:</div>
              <pre className='whitespace-pre-wrap'>{sendResult}</pre>
            </div>
          )}
        </div>
      ) : (
        'Generating…'
      )}
    </div>
  );
}

