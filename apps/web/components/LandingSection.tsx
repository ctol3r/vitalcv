import type { ReactNode } from 'react';

type LandingSectionProps = {
  heading?: string;
  children: ReactNode;
};

export default function LandingSection({
  heading,
  children,
}: LandingSectionProps) {
  return (
    <section className="space-y-6 sm:space-y-8">
      {heading && (
        <h2 className="text-sm font-semibold tracking-wide text-neutral-600">
          {heading}
        </h2>
      )}
      <div className="text-base leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}
