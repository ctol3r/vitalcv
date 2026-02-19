import { useState, type FormEvent } from 'react';

export default function PrimarySourceVerificationWidget() {
  const [id, setId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const statusId = 'psv-status';
  const invalidProps = status === 'error' ? { 'aria-invalid': 'true' as const } : {};

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loading && id) {
      verify();
    }
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
      <h3>Primary Source Verification</h3>
      <form onSubmit={handleSubmit}>
        <input
          id="credential-id"
          name="credentialId"
          type="text"
          placeholder="Credential ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          aria-label="Credential ID"
          aria-describedby={loading || status ? statusId : undefined}
          {...invalidProps}
        />
        <button type="submit" disabled={loading || !id} style={{ marginLeft: '0.5rem' }}>
          Verify
        </button>
      </form>
      {loading && (
        <p id={statusId} role="status" aria-live="polite">
          Verifying...
        </p>
      )}
      {status && !loading && (
        <p id={statusId} role="status" aria-live="polite">
          Result: {status}
        </p>
      )}
    </div>
  );
}
