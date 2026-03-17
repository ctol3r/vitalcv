import type React from 'react';
import {
  IntelligenceConsoleLayout,
  type IntelligenceConsoleLayoutProps,
} from '@/src/ui/layouts';
import type { IntelligenceNavKey } from '@/lib/intelligence/routes';

export interface OperationsBreadcrumb {
  label: string;
  href?: string;
}

interface OperationsShellProps extends IntelligenceConsoleLayoutProps {}

export function resolveOperationsNavKey(
  activeHref: string,
  activeNavKey?: IntelligenceNavKey,
): IntelligenceNavKey | undefined {
  if (activeHref.startsWith('/graph') && (!activeNavKey || activeNavKey === 'dashboard')) {
    return 'graph';
  }

  return activeNavKey;
}

export function OperationsShell(props: OperationsShellProps) {
  const activeNavKey = resolveOperationsNavKey(props.activeHref, props.activeNavKey);
  return <IntelligenceConsoleLayout {...props} activeNavKey={activeNavKey} />;
}
