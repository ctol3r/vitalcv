import React, { useState, useEffect } from 'react';

interface VerifiableCredential {
  id: string;
  type: string;
  issuedBy: string;
  issuedAt: string;
  claimId?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
}

interface DisclosureOptions {
  [key: string]: boolean; // attribute key -> whether to reveal
}

interface SelectiveDisclosureResult {
  vcId: string;
  revealedAttributes: string[];
  concealedAttributes: string[];
  disclosureToken?: string; // Placeholder for future SD-JWT token
}

interface WalletViewProps {
  onDisclosureRequest?: (result: SelectiveDisclosureResult) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onDisclosureRequest }) => {
  const [vcs, setVcs] = useState<VerifiableCredential[]>([]);
  const [selectedVc, setSelectedVc] = useState<VerifiableCredential | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [disclosureOptions, setDisclosureOptions] = useState<DisclosureOptions>({});

  // Load VCs from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedVcs = localStorage.getItem('wallet_vcs');
      if (storedVcs) {
        try {
          const parsed = JSON.parse(storedVcs);
          setVcs(Array.isArray(parsed) ? parsed : []);
        } catch (err) {
          console.error('Error parsing stored VCs:', err);
          setVcs([]);
        }
      }
    }
  }, []);

  // Save VCs to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_vcs', JSON.stringify(vcs));
    }
  }, [vcs]);

  const openDisclosureModal = (vc: VerifiableCredential) => {
    setSelectedVc(vc);
    
    // Initialize disclosure options - all attributes unchecked by default
    const options: DisclosureOptions = {};
    const subject = vc.credentialSubject || {};
    Object.keys(subject).forEach((key) => {
      if (key !== 'id') {
        options[key] = false;
      }
    });
    setDisclosureOptions(options);
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVc(null);
    setDisclosureOptions({});
  };

  const handleToggleDisclosure = (attribute: string) => {
    setDisclosureOptions((prev) => ({
      ...prev,
      [attribute]: !prev[attribute],
    }));
  };

  const handleGenerateDisclosure = () => {
    if (!selectedVc) return;

    const revealedAttributes: string[] = [];
    const concealedAttributes: string[] = [];

    Object.entries(disclosureOptions).forEach(([key, shouldReveal]) => {
      if (shouldReveal) {
        revealedAttributes.push(key);
      } else {
        concealedAttributes.push(key);
      }
    });

    const result: SelectiveDisclosureResult = {
      vcId: selectedVc.id,
      revealedAttributes,
      concealedAttributes,
      disclosureToken: `sdjwt.pilot.${selectedVc.id}.${Date.now()}`, // Placeholder
    };

    // Callback to parent component
    if (onDisclosureRequest) {
      onDisclosureRequest(result);
    }

    console.log('Selective Disclosure Result:', result);

    closeModal();
  };

  const addVc = (vc: VerifiableCredential) => {
    setVcs((prev) => {
      // Check if VC already exists
      if (prev.some((existing) => existing.id === vc.id)) {
        return prev;
      }
      return [...prev, vc];
    });
  };

  // Expose addVc method for external use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).WalletView = { addVc };
    }
  }, [vcs]); // Include vcs in deps so addVc always has latest state

  return (
    <div className="wallet-view" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Your Verifiable Credentials</h1>

      {vcs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <p>No credentials in your wallet yet.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Credentials will appear here after successful attestation.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {vcs.map((vc) => (
            <div
              key={vc.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>{vc.type}</h3>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    Issued by: {vc.issuedBy}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    Issued at: {new Date(vc.issuedAt).toLocaleString()}
                  </p>
                  {vc.claimId && (
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#999' }}>
                      Claim ID: {vc.claimId}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openDisclosureModal(vc)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selective Disclosure Modal */}
      {isModalOpen && selectedVc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Selective Disclosure</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Choose which attributes to share from: <strong>{selectedVc.type}</strong>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Select Attributes to Reveal:</h3>
              {Object.keys(disclosureOptions).map((attribute) => {
                const value = selectedVc.credentialSubject[attribute];
                return (
                  <label
                    key={attribute}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      backgroundColor: disclosureOptions[attribute] ? '#e3f2fd' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={disclosureOptions[attribute] || false}
                      onChange={() => handleToggleDisclosure(attribute)}
                      style={{ marginRight: '12px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ fontSize: '14px' }}>{attribute}:</strong>
                      <span style={{ marginLeft: '8px', fontSize: '14px', color: '#666' }}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateDisclosure}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Generate Disclosure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
