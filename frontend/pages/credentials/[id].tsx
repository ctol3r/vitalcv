import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { isValidNPI } from '../../utils/validateNpi';

/**
 * Credential detail page.
 *
 * This implementation demonstrates a "share only status" toggle for privacy-preserving
 * credential sharing, and includes NPI validation functionality.
 */
export default function CredentialDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [shareStatusOnly, setShareStatusOnly] = useState(false);
  const [shareOutput, setShareOutput] = useState<string | null>(null);
  const [npi, setNpi] = useState('');
  
  const npiValid = npi ? isValidNPI(npi) : null;

  function generateStatusProof(vcId: string | string[] | undefined) {
    // Placeholder: real implementation would produce a cryptographic proof.
    return `Proof of status for VC ${vcId}`;
  }

  function generateFullVC(vcId: string | string[] | undefined) {
    // Placeholder representing the full credential payload.
    return `Full VC data for ${vcId}`;
  }

  function handleShare() {
    const output = shareStatusOnly ? generateStatusProof(id) : generateFullVC(id);
    setShareOutput(output);
  }

  return (
    <div>
      <h1>Credential {id}</h1>
      
      {/* NPI Validation Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2>NPI Validation</h2>
        <input
          type="text"
          value={npi}
          onChange={(e) => setNpi(e.target.value)}
          placeholder="Enter NPI"
        />
        {npiValid !== null && (
          <p>{npiValid ? 'NPI is valid' : 'NPI is invalid'}</p>
        )}
      </div>

      {/* Share Only Status Section */}
      <div>
        <h2>Share Credential</h2>
        <label>
          <input
            type="checkbox"
            checked={shareStatusOnly}
            onChange={(e) => setShareStatusOnly(e.target.checked)}
          />
          Share only status
        </label>
        <br />
        <button onClick={handleShare}>Share</button>
        {shareOutput && (
          <pre data-testid="share-output">{shareOutput}</pre>
        )}
      </div>
    </div>
  );
}
