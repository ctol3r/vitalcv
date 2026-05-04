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
    screenshots: [
      {
        src: '/placeholder.jpg',
        sizes: '390x844',
        type: 'image/jpeg',
        // @ts-expect-error form_factor is valid in the Web App Manifest spec but not yet in Next.js types
        form_factor: 'narrow',
        label: 'Clinician credential passport on mobile',
      },
    ],
    // Shortcuts point at verified-existing routes only.
    // Route existence confirmed: /clinician/profile and /employer/dashboard.
    shortcuts: [
      {
        name: 'Clinician Profile',
        short_name: 'Profile',
        description: 'View your clinician credential profile and readiness status.',
        url: '/clinician/profile',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Employer Dashboard',
        short_name: 'Dashboard',
        description: 'Manage clinician verification requests and review readiness packets.',
        url: '/employer/dashboard',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
    ],
  };
}
