'use client';

import { AlertTriangle } from 'lucide-react';
import { ReactNode } from 'react';
import { UniversalActionBar } from './UniversalActionBar';
import { NotificationCenter } from './NotificationCenter';
import { HelpDrawer } from './HelpDrawer';
import { RoleGlossary } from './RoleGlossary';
import { useRoleUX } from '@/contexts/RoleUXContext';
import { Card, CardContent } from '@/components/ui/card';

export function RoleUXShell({ children }: { children: ReactNode }) {
  const { loading, restrictedPath, formatError } = useRoleUX();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UniversalActionBar />
      <main className="flex-1 space-y-4 pb-10">
        <NotificationCenter />
        <section className="mx-auto w-full max-w-6xl px-4">
          {restrictedPath ? (
            <Card className="border-amber-200 bg-amber-50 text-amber-900">
              <CardContent className="flex items-center gap-3 py-6">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Navigation restricted</p>
                  <p className="text-sm">{formatError('cross_role_access', 'This route is limited for your role.')}</p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Preparing shared UX config for this role…
              </CardContent>
            </Card>
          ) : (
            children
          )}
        </section>
      </main>
      <HelpDrawer glossary={<RoleGlossary />} />
    </div>
  );
}

