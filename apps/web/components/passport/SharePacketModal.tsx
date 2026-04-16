'use client';

/**
 * SharePacketModal — Generate an ephemeral share link for a readiness packet.
 *
 * Assimilated from vitalcv-ai-sandbox. Distinct from PassportShareActions
 * (which copies existing URLs) — this modal generates ephemeral links with
 * audit trail logging via the EMPLOYER_PACKET_SHARED event type.
 *
 * Truth Doctrine: All fake employer/org IDs stripped. Overclaiming labels
 * ("Link Active & Secure", "Secure Transmission Protocol") replaced with
 * factual language. No animate-pulse on status text.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePostHog } from 'posthog-js/react';
import {
  Check,
  Clock,
  Copy,
  Info,
  Loader2,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── Types ────────────────────────────────────────────────────────

interface SharePacketModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicianName: string;
  npi: string;
  /** Entity ID for audit logging. Obtained from auth context. */
  entityId: string;
  /** Custom share link generator. Falls back to POST /api/employer-review/:entityId/share-packet. */
  onGenerateLink?: (npi: string) => Promise<{ shareUrl: string }>;
}

// ── Component ────────────────────────────────────────────────────

export function SharePacketModal({
  isOpen,
  onClose,
  clinicianName,
  npi,
  entityId,
  onGenerateLink,
}: SharePacketModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const posthog = usePostHog();

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      if (onGenerateLink) {
        const result = await onGenerateLink(npi);
        setShareUrl(result.shareUrl);
        posthog?.capture('Passport_Generated', { npi, entityId });
      } else {
        const res = await fetch(
          `/api/employer-review/${entityId}/share-packet`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npi }),
          },
        );
        if (!res.ok) throw new Error('Failed to generate share link');
        const data = await res.json();
        setShareUrl(data.shareUrl);
        posthog?.capture('Passport_Generated', { npi, entityId });
      }
    } catch (error) {
      console.error('Failed to generate share link:', error);
      toast.error('Could not generate share link. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Share readiness packet for ${clinicianName}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary p-2 text-primary-foreground">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">
                    Share Readiness Packet
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-tighter text-muted-foreground">
                    Share via link
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="space-y-8 p-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-md border border-border bg-muted/30 p-4">
                  <Info
                    className="mt-0.5 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-tight">
                      What is being shared?
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Identity data, OIG/LEIE status, state licensure, and the
                      readiness synthesis for{' '}
                      <span className="font-semibold">{clinicianName}</span>{' '}
                      (NPI: {npi}) will be visible to the recipient.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    <span>Source-backed data</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    <span>24h expiration</span>
                  </div>
                </div>
              </div>

              {!shareUrl ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className="w-full py-4 font-bold uppercase tracking-widest"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating link...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      <span>Generate Share Link</span>
                    </>
                  )}
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-4 font-mono text-xs">
                    <span className="break-all text-muted-foreground">
                      {shareUrl}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopy}
                      aria-label="Copy link to clipboard"
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-center font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Link generated
                  </p>

                  <Button
                    variant="outline"
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full text-[10px] font-bold uppercase tracking-widest"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Share2 className="h-3 w-3" />
                    )}
                    Regenerate Link
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Footer / Disclaimer */}
            <div className="border-t border-border bg-muted/30 p-6">
              <div className="flex items-start gap-3 text-muted-foreground">
                <ShieldCheck
                  className="mt-0.5 h-3 w-3 shrink-0"
                  aria-hidden="true"
                />
                <p className="font-mono text-[9px] uppercase leading-relaxed tracking-tight">
                  Link expires in 24 hours. Only checked sources are included in
                  the shared packet.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
