'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// ── Types ────────────────────────────────────────────────

interface VerificationReceipt {
  requestId: string;
  clinicianName: string;
  credentialsVerified: string[];
  readinessScore: number;
  verifiedAt: string;
  signature: string;
}

interface CrossOriginBridgeAPI {
  sendVerified: (receipt: VerificationReceipt) => void;
  sendError: (error: { code: string; message: string }) => void;
  sendClose: () => void;
  sendResize: () => void;
}

// ── Context ──────────────────────────────────────────────

const CrossOriginBridgeContext = createContext<CrossOriginBridgeAPI | null>(
  null
);

// ── Hook ─────────────────────────────────────────────────

export function useCrossOriginBridge(): CrossOriginBridgeAPI {
  const ctx = useContext(CrossOriginBridgeContext);
  if (!ctx) {
    throw new Error(
      'useCrossOriginBridge must be used within a <CrossOriginBridge>'
    );
  }
  return ctx;
}

// ── Component ────────────────────────────────────────────

interface CrossOriginBridgeProps {
  parentOrigin: string;
  children: ReactNode;
}

export default function CrossOriginBridge({
  parentOrigin,
  children,
}: CrossOriginBridgeProps) {
  const targetOrigin = parentOrigin || '*';
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postToParent = useCallback(
    (data: Record<string, unknown>) => {
      try {
        if (window.self !== window.top) {
          window.parent.postMessage(data, targetOrigin);
        }
      } catch {
        // Swallow cross-origin access errors
      }
    },
    [targetOrigin]
  );

  const sendVerified = useCallback(
    (receipt: VerificationReceipt) => {
      postToParent({ type: 'vitalcv:verified', payload: receipt });
    },
    [postToParent]
  );

  const sendError = useCallback(
    (error: { code: string; message: string }) => {
      postToParent({ type: 'vitalcv:error', payload: error });
    },
    [postToParent]
  );

  const sendClose = useCallback(() => {
    postToParent({ type: 'vitalcv:close' });
  }, [postToParent]);

  const sendResize = useCallback(() => {
    const height = document.body.scrollHeight;
    postToParent({ type: 'vitalcv:resize', height });
  }, [postToParent]);

  // Send ready signal on mount
  useEffect(() => {
    postToParent({ type: 'vitalcv:ready' });
    // Send initial resize
    sendResize();
  }, [postToParent, sendResize]);

  // Auto-resize on window resize (debounced)
  useEffect(() => {
    function handleResize() {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = setTimeout(sendResize, 150);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, [sendResize]);

  const api: CrossOriginBridgeAPI = {
    sendVerified,
    sendError,
    sendClose,
    sendResize,
  };

  return (
    <CrossOriginBridgeContext.Provider value={api}>
      {children}
    </CrossOriginBridgeContext.Provider>
  );
}
