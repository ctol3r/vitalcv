import { Suspense } from 'react';
import AuthorizeContent from './AuthorizeContent';

export const metadata = {
  title: 'Apply with VitalCV',
  robots: { index: false },
};

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--cloud-dancer)]">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-[var(--trust-green)] border-t-transparent" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
