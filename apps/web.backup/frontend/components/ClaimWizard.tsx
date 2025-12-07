import React, { useState } from 'react';

interface ClaimWizardProps {
  onComplete?: (claimId: string) => void;
}

export const ClaimWizard: React.FC<ClaimWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [npi, setNpi] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate NPI
      const response = await fetch('/api/npi/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'NPI lookup failed');
      }

      const data = await response.json();
      if (data.verified) {
        setStep(2);
      } else {
        setError('NPI not verified. Please check and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('npi', npi);
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/claim/doc', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setClaimId(data.claimId);
      setStep(3);

      // Submit basic claim
      await submitBasicClaim(data.claimId);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const submitBasicClaim = async (id: string) => {
    try {
      const response = await fetch('/api/claim/basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: id, npi }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit claim');
      }

      const data = await response.json();
      
      // Poll for status updates
      pollStatus(data.statusId);
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    }
  };

  const pollStatus = async (statusId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/claim/status?statusId=${statusId}`);
        if (response.ok) {
          const status = await response.json();
          if (status.level >= 3) {
            clearInterval(interval);
            if (onComplete) {
              onComplete(claimId || '');
            }
          }
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }, 2000);

    // Clear after 30 seconds
    setTimeout(() => clearInterval(interval), 30000);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1>Claim Verification Wizard</h1>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleNpiSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="npi">National Provider Identifier (NPI)</label>
            <input
              id="npi"
              type="text"
              value={npi}
              onChange={(e) => setNpi(e.target.value)}
              placeholder="Enter 10-digit NPI"
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Validating...' : 'Validate NPI'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="files">Upload Documents</label>
            <input
              id="files"
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
            {files.length > 0 && (
              <p style={{ marginTop: '0.5rem' }}>
                {files.length} file(s) selected
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="submit" disabled={loading || files.length === 0}>
              {loading ? 'Uploading...' : 'Upload & Submit'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div>
          <h2>Claim Submitted Successfully</h2>
          {claimId && (
            <div style={{ marginTop: '1rem' }}>
              <p>Claim ID: <code>{claimId}</code></p>
              <p>Your claim is being processed. You will be notified when verification is complete.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimWizard;
