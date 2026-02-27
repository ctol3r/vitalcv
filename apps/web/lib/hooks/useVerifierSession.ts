import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export interface VerifierSession {
  sessionId: string;
  status: "pending" | "verified" | "failed";
  verifiedAt: string | null;
  issuer: string | null;
  vct: string | null;
  auditHash: string | null;
  error: string | null;
}

export function useVerifierSession(): VerifierSession {
  const sessionIdRef = useRef<string>("");
  const [session, setSession] = useState<VerifierSession>({
    sessionId: "",
    status: "pending",
    verifiedAt: null,
    issuer: null,
    vct: null,
    auditHash: null,
    error: null,
  });

  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
      setSession((s) => ({ ...s, sessionId: sessionIdRef.current }));
    }

    let stopped = false;
    const intervalId = setInterval(async () => {
      if (stopped || !sessionIdRef.current) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/verifier/status/${sessionIdRef.current}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          verified_at: string | null;
          issuer: string | null;
          vct: string | null;
          audit_hash: string | null;
        };
        const newStatus =
          data.status === "verified" || data.status === "failed"
            ? data.status
            : "pending";
        setSession((s) => ({
          ...s,
          status: newStatus as VerifierSession["status"],
          verifiedAt: data.verified_at,
          issuer: data.issuer,
          vct: data.vct,
          auditHash: data.audit_hash,
          error: null,
        }));
        if (newStatus === "verified" || newStatus === "failed") {
          stopped = true;
          clearInterval(intervalId);
        }
      } catch (e) {
        setSession((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "poll failed",
        }));
      }
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, []);

  return session;
}
