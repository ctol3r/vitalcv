import type React from 'react';
import {
  IntelligenceConsoleLayout,
  type IntelligenceConsoleLayoutProps,
} from '@/src/ui/layouts';

export interface OperationsBreadcrumb {
  label: string;
  href?: string;
}

interface OperationsShellProps extends IntelligenceConsoleLayoutProps {}

export function OperationsShell(props: OperationsShellProps) {
  return <IntelligenceConsoleLayout {...props} />;
}
