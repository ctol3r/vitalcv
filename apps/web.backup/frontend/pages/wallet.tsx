import React from 'react';
import WalletView from '../components/WalletView';

const WalletPage: React.FC = () => {
  const handleDisclosureRequest = (result: any) => {
    console.log('Disclosure requested:', result);
    // In production, this would send the disclosure to a verifier or save it
    alert(`Selective disclosure generated:\nRevealed: ${result.revealedAttributes.join(', ')}\nConcealed: ${result.concealedAttributes.join(', ')}`);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <WalletView onDisclosureRequest={handleDisclosureRequest} />
    </div>
  );
};

export default WalletPage;
