import { VerifierHero } from '../../components/verifier/VerifierHero';
import { ProblemSection } from '../../components/verifier/ProblemSection';
import { SolutionSection } from '../../components/verifier/SolutionSection';
import { EvidenceBundlePreview } from '../../components/verifier/EvidenceBundlePreview';
import { IntegrationSection } from '../../components/verifier/IntegrationSection';
import { SecurityGuarantees } from '../../components/verifier/SecurityGuarantees';
import { CTASection } from '../../components/verifier/CTASection';

export default function VerifierPage() {
  return (
    <main>
      <VerifierHero />
      <ProblemSection />
      <SolutionSection />
      <EvidenceBundlePreview />
      <IntegrationSection />
      <SecurityGuarantees />
      <CTASection />
    </main>
  );
}
