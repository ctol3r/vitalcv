import { useState, useEffect } from 'react';

export function usePresentationPolling(sessionId: string | null) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/verifier/session/${sessionId}`);
        if (res.ok) {
            const result = await res.json();
            setData(result);
            // Stop polling if final status reached
            if (result.status === 'verified' || result.status === 'failed' || result.status === 'revoked') {
                return true; // Stop
            }
        }
      } catch (error) {
        console.error("Polling error", error);
      }
      return false;
    };

    // Initial check
    poll();

    const intervalId = setInterval(async () => {
      const shouldStop = await poll();
      if (shouldStop) {
        clearInterval(intervalId);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [sessionId]);

  return data;
}



















