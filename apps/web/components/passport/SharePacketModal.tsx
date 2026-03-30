'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import { Button } from '@/components/ui/button';
import {
  GlassModal,
  GlassModalHeader,
  GlassModalTitle,
  GlassModalBody,
  GlassModalFooter,
} from '@/components/ui/glass-modal';
import { CLERK_PROVIDER_ENABLED, CLERK_SIGN_IN_URL } from '@/lib/auth/clerkConfig';

type SharePhase = 'pre' | 'generating' | 'done' | 'error';

const EXPIRY_HOURS = 24;
const EXPIRY_MS = EXPIRY_HOURS * 60 * 60 * 1000;

interface SharePacketModalProps {
  open: boolean;
  onClose: () => void;
  npi: string;
  displayName: string;
}

export function SharePacketModal({ open, onClose, npi, displayName }: SharePacketModalProps) {
  const [phase, setPhase] = useState<SharePhase>('pre');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { isLoaded, isSignedIn } = useRoleContext();
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase('pre');
      setShareUrl(null);
      setExpiresAt(null);
      setCountdown('');
      setErrorMessage(null);
      setCopied(false);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setCountdown('Expired');
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${hours}h ${minutes}m remaining`);
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleShare = useCallback(async () => {
    setPhase('generating');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/apply/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to generate a shareable passport link.');
        if (res.status === 404) throw new Error('Passport data not found. Run an NPI lookup first.');
        throw new Error('Could not generate share link. Try again.');
      }

      const data = await res.json() as { bundleId?: string; bundleUrl?: string; error?: string };
      if (!data.bundleId) throw new Error(data.error ?? 'Share link generation failed.');

      const url = data.bundleUrl ?? `${window.location.origin}/apply/${data.bundleId}`;

      if (!mountedRef.current) return;

      setShareUrl(url);
      setExpiresAt(Date.now() + EXPIRY_MS);
      setPhase('done');

      // Auto-copy
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Share failed.');
      setPhase('error');
    }
  }, [npi]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [shareUrl]);

  const requiresAuth = CLERK_PROVIDER_ENABLED && isLoaded && !isSignedIn;

  return (
    <GlassModal open={open} onClose={onClose}>
      <GlassModalHeader>
        <GlassModalTitle>
          {phase === 'done' ? 'Link ready' : 'Share credential packet'}
        </GlassModalTitle>
        <p className="text-sm text-white/40 mt-1">{displayName}</p>
      </GlassModalHeader>

      <GlassModalBody>
        {/* Pre-share state */}
        {phase === 'pre' && (
          <div className="space-y-4">
            {requiresAuth && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-200/80 font-medium">Authentication required</p>
                <p className="text-[11px] text-amber-200/50 mt-1 leading-relaxed">
                  Sign in to generate a shareable link.{' '}
                  <a href={CLERK_SIGN_IN_URL} className="underline underline-offset-2 hover:text-amber-200/70 transition-colors">
                    Sign in
                  </a>
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Packet contents</span>
                <span className="text-white/55">Readiness snapshot + source evidence</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Link expiry</span>
                <span className="text-white/55">{EXPIRY_HOURS} hours</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Recipient</span>
                <span className="text-white/55">Anyone with the link</span>
              </div>
            </div>

            <p className="text-[11px] text-white/30 leading-relaxed">
              The generated link gives read-only access to the credential snapshot for {EXPIRY_HOURS} hours.
              The employer opens it to view the review surface.
            </p>
          </div>
        )}

        {/* Generating state */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            <p className="text-sm text-white/50">Generating shareable link…</p>
          </div>
        )}

        {/* Done state */}
        {phase === 'done' && shareUrl && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs text-emerald-200/80 font-medium">
                {copied ? 'Link copied to clipboard' : 'Link generated'}
              </p>
              <p className="text-[11px] text-emerald-200/50 mt-1">
                Send this link to an employer to open the review surface.
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
              <p className="text-[11px] font-mono text-white/40 break-all leading-relaxed">{shareUrl}</p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/30">Expires</span>
              <span className="text-white/50 font-mono">{countdown}</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <p className="text-xs text-rose-200/80 font-medium">Share failed</p>
              <p className="text-[11px] text-rose-200/50 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}
      </GlassModalBody>

      <GlassModalFooter>
        {phase === 'pre' && (
          <>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white/40 hover:text-white/60"
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleShare}
              disabled={requiresAuth}
              className="rounded-xl px-5"
            >
              Generate share link
            </Button>
          </>
        )}

        {phase === 'generating' && (
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
        )}

        {phase === 'done' && (
          <>
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white/40 hover:text-white/60"
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="rounded-xl border-white/10 px-5"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </>
        )}

        {phase === 'error' && (
          <>
            <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => setPhase('pre')}
              className="rounded-xl border-white/10 px-5"
            >
              Try again
            </Button>
          </>
        )}
      </GlassModalFooter>
    </GlassModal>
  );
}
