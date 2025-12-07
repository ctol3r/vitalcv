import { useState } from 'react';

export default function PrimarySourceVerificationWidget() {
  const [id, setId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/verify?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setStatus(data.status);
    } catch (err) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
      <h3>Primary Source Verification</h3>
      <input
        type="text"
        placeholder="Credential ID"
        value={id}
        onChange={e => setId(e.target.value)}
      />
      <button onClick={verify} disabled={loading || !id} style={{ marginLeft: '0.5rem' }}>
        Verify
      </button>
      {loading && <p>Verifying...</p>}
      {status && !loading && <p>Result: {status}</p>}
    </div>
  );
}
