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
    <section className="space-y-8 sm:space-y-10">
      {heading && (
        <h2 className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
          {heading}
        </h2>
      )}
      <div>{children}</div>
    </section>
  );
}
