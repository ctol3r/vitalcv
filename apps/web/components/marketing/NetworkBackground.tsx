'use client';

import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

export default function NetworkBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        number: { value: 50, density: { enable: true } },
        color: { value: ['#6B9AC4', '#5BA3A3', '#9CA3AF'] },
        opacity: { value: { min: 0.15, max: 0.35 } },
        size: { value: { min: 1.5, max: 3 } },
        move: {
          enable: true,
          speed: 0.4,
          direction: 'none' as const,
          outModes: { default: 'bounce' as const },
        },
        links: {
          enable: true,
          distance: 160,
          color: '#6B9AC4',
          opacity: 0.12,
          width: 1,
        },
      },
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
        },
        modes: {
          grab: { distance: 180, links: { opacity: 0.3 } },
        },
      },
      detectRetina: true,
    }),
    [],
  );

  if (!ready) return null;

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none">
      <Particles id="trust-network" options={options} />
    </div>
  );
}
