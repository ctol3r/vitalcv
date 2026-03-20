import type React from 'react';
import {
  IntelligenceConsoleLayout,
  type IntelligenceConsoleLayoutProps,
} from '@/src/ui/layouts';
import type { IntelligenceNavKey } from '@/lib/intelligence/routes';
import { LiveSignalsIndicator } from './live-signals-indicator';

export interface OperationsBreadcrumb {
  label: string;
  href?: string;
}

interface OperationsShellProps extends IntelligenceConsoleLayoutProps {}

export function resolveOperationsNavKey(
  activeHref: string,
  activeNavKey?: IntelligenceNavKey,
): IntelligenceNavKey | undefined {
  const activeUrl = new URL(activeHref, 'https://vitalcv.local');
  const requestedView = activeUrl.searchParams.get('view');
  const requestedFocus = activeUrl.searchParams.get('focus');

  if (
    (
      activeHref.startsWith('/intelligence/graph')
      || activeHref.startsWith('/graph')
      || requestedView === 'graph'
      || requestedFocus === 'graph'
    )
    && (!activeNavKey || activeNavKey === 'dashboard')
  ) {
    return 'graph';
  }

  return activeNavKey;
}

export function OperationsShell(props: OperationsShellProps) {
  const activeNavKey = resolveOperationsNavKey(props.activeHref, props.activeNavKey);
  const isIntelligenceArea =
    props.activeHref === '/intelligence'
    || props.activeHref.startsWith('/intelligence/')
    || (activeNavKey !== undefined && activeNavKey !== 'graph');
  const mergedMeta = isIntelligenceArea ? (
    <div className="space-y-2">
      <LiveSignalsIndicator />
      {props.meta}
    </div>
  ) : (
    props.meta
  );

  return (
    <IntelligenceConsoleLayout
      {...props}
      activeNavKey={activeNavKey}
      meta={mergedMeta}
    />
  );
}
