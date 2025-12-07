import dynamic from 'next/dynamic';

const PrimarySourceVerificationWidget = dynamic(() => import('../components/PrimarySourceVerificationWidget'), { ssr: false });

export default function VerifyPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Credential Verification</h1>
      <PrimarySourceVerificationWidget />
    </main>
  );
}
