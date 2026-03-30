import { HeroSection } from '../components/marketing/HeroSection';
import { HowItWorks } from '../components/marketing/HowItWorks';
import { GraphPreview } from '../components/marketing/GraphPreview';
import { SecurityStandards } from '../components/marketing/SecurityStandards';
import { VerifierSection } from '../components/marketing/VerifierSection';

/* ─── Page ─── */
export default function Home() {
  return (
    <>
      <main>
        <HeroSection />
        <HowItWorks />
        <GraphPreview />
        <SecurityStandards />
        <VerifierSection />
      </main>
    </>
  );
}
