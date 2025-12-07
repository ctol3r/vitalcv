import React, { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import CommandPalette from '../components/CommandPalette';
import '../styles/globals.css';

// Define AppProps if not available (for compatibility)
interface MyAppProps {
  Component: React.ComponentType<any>;
  pageProps: any;
}

function MyApp({ Component, pageProps }: MyAppProps) {
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiUrl}/api/agent/full`);
        if (!res.ok) {
          setIsDegraded(true);
          return;
        }
        const data = await res.json();
        const allOk = Object.values(data).every((s) => s === 'OK');
        if (!allOk) setIsDegraded(true);
      } catch (e) {
        console.warn('Health check failed:', e);
        setIsDegraded(true);
      }
    };
    checkHealth();
  }, []);

  return (
    <>
      {isDegraded && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-3 text-center text-sm">
          <span className="font-bold">⚠️ Degraded Mode:</span> Some system components are experiencing issues.
        </div>
      )}
      <Component {...pageProps} />
      <CommandPalette />
    </>
  );
}

export default MyApp;
