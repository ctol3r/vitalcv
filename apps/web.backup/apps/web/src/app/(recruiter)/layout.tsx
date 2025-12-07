'use client';

/**
 * Recruiter Layout - Provides recruiter context and theme
 * Phase 1: Foundation & Navigation
 */

import { RecruiterProvider } from '@/contexts/RecruiterContext';
import { RoleGuard } from '@/components/RoleGuard';
import { useEffect } from 'react';

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  // Apply recruiter theme (slate + trust-accent)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-recruiter');

    // Set recruiter-specific CSS variables
    root.style.setProperty('--recruiter-primary', '215 28% 17%'); // slate-800
    root.style.setProperty('--recruiter-accent', '217 91% 60%'); // trust-blue
    root.style.setProperty('--recruiter-secondary', '215 20% 65%'); // slate-400
    root.style.setProperty('--recruiter-background', '210 40% 98%'); // slate-50

    return () => {
      root.classList.remove('theme-recruiter');
    };
  }, []);

  return (
    <RoleGuard requiredRole="recruiter">
      <RecruiterProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          {children}
        </div>
      </RecruiterProvider>
    </RoleGuard>
  );
}




