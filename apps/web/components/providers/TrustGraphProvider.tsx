'use client';

/**
 * TrustGraphProvider — React context provider for TrustGraph graph queries.
 *
 * Wraps the application so that downstream components can access the
 * TrustGraph socket connection and query context graphs as needed.
 *
 * Environment variables consumed (must be NEXT_PUBLIC_ prefixed for client use):
 *   NEXT_PUBLIC_TRUSTGRAPH_USER    — TrustGraph user identifier
 *   NEXT_PUBLIC_TRUSTGRAPH_API_KEY — Optional API key for authentication
 *
 * Usage: wrap your root layout (or a subtree) with this provider.
 *
 * @example
 * // In apps/web/app/layout.tsx:
 * import { TrustGraphProvider } from '@/components/providers/TrustGraphProvider';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <TrustGraphProvider>
 *       {children}
 *     </TrustGraphProvider>
 *   );
 * }
 */

import { SocketProvider } from '@trustgraph/react-provider';

interface TrustGraphProviderProps {
  children: React.ReactNode;
}

export function TrustGraphProvider({ children }: TrustGraphProviderProps) {
  const user   = process.env.NEXT_PUBLIC_TRUSTGRAPH_USER ?? '';
  const apiKey = process.env.NEXT_PUBLIC_TRUSTGRAPH_API_KEY;

  if (!user) {
    // Not configured — render children directly without wrapping.
    // Keeps dev environments that don't run TrustGraph fully functional.
    return <>{children}</>;
  }

  return (
    <SocketProvider user={user} apiKey={apiKey}>
      {children}
    </SocketProvider>
  );
}
