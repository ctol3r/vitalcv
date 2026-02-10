import Footer from '@/components/Footer';
import LandingHero from '@/components/LandingHero';
import LandingSection from '@/components/LandingSection';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
      <LandingHero />

      <div className="mt-24 sm:mt-32">
        <LandingSection heading="Lifecycle">
          <p className="text-lg font-medium tracking-tight text-neutral-950 sm:text-xl">
            issued &rarr; held &rarr; presented &rarr; verified
          </p>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg sm:leading-relaxed">
            A credential is a signed assertion from an issuing authority.
            The holder accepts it; it becomes portable.
            Verification occurs once&nbsp;&mdash; the result persists across
            relying parties. Revocation propagates at any point.
          </p>
        </LandingSection>
      </div>

      <Footer />
    </main>
  );
}
