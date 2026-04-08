import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Updates',
  description: 'Track readiness changes, blocker alerts, and live application status.',
};

export default function ApplicationsLayout({ children }: { children: ReactNode }) {
  return children;
}
