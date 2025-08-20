import React, { useState } from 'react';
import { isValidNPI } from '../../utils/validateNpi';

const CredentialPage = () => {
  const [npi, setNpi] = useState('');
  const valid = npi ? isValidNPI(npi) : null;

  return (
    <div>
      <h1>Credential</h1>
      <input
        type="text"
        value={npi}
        onChange={(e) => setNpi(e.target.value)}
        placeholder="Enter NPI"
      />
      {valid !== null && (
        <p>{valid ? 'NPI is valid' : 'NPI is invalid'}</p>
      )}
    </div>
  );
};

export default CredentialPage;
