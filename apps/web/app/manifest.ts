import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VitalCV Clinician Workspace',
    short_name: 'VitalCV',
    description: 'Live clinician readiness, applications, and credential passport for mobile.',
    start_url: '/holder/home',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050a14',
    theme_color: '#050a14',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
