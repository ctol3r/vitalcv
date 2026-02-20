import type { ReactNode } from 'react';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export default function SiteChrome({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-background">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
