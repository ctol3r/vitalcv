import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Copy, Check, Loader2, ShieldCheck, Clock, Info } from "lucide-react";
import axios from "axios";
import { cn } from "@/components/sandbox/lib/utils";
import { DecisionType } from "@/components/sandbox/types/audit";

interface SharePacketModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicianName: string;
  npi: string;
}

export default function SharePacketModal({ isOpen, onClose, clinicianName, npi }: SharePacketModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const generatedUrl = `vitalcv.com/review/chk_${Math.random().toString(36).substring(2, 9)}`;
      setShareUrl(generatedUrl);

      const payload = {
        npi,
        employerId: "EMP-MOCK-001", // Mocked as requested
        decision: DecisionType.AUDIT_PACKET_SHARED,
        packetHash: `sha256:${Math.random().toString(36).substring(2, 15)}`, // Mocked hash
        shareUrl: generatedUrl,
      };

      if (auditId) {
        // Update existing audit log entry
        await axios.put(`/api/audit/decision/${auditId}`, payload, {
          headers: { "x-organization-id": "ORG-SUTTER-001" }
        });
      } else {
        // Create new audit log entry
        const response = await axios.post("/api/audit/decision", payload, {
          headers: { "x-organization-id": "ORG-SUTTER-001" }
        });
        setAuditId(response.data.data.auditId);
      }
    } catch (error) {
      console.error("Failed to process audit event:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
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
            onClick={onClose}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-bg border border-line shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ink text-bg">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Share Readiness Packet</h3>
                  <p className="text-[10px] font-mono opacity-40 uppercase tracking-tighter">Secure Transmission Protocol</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-ink/5 transition-colors opacity-40 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-ink/[0.02] border border-line/10">
                  <Info className="w-4 h-4 mt-0.5 opacity-40" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-tight">What is being shared?</p>
                    <p className="text-xs opacity-60 leading-relaxed">
                      Your federal-source identity resolution, OIG/LEIE status, state licensure data, and the operator-reviewed MSP Auditor synthesis will be visible to the employer.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-40 uppercase">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Source-Backed Data</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-40 uppercase">
                    <Clock className="w-3 h-3" />
                    <span>24h Expiration</span>
                  </div>
                </div>
              </div>

              {!shareUrl ? (
                <button
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className="w-full bg-ink text-bg py-4 font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Secure Link...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Generate Secure Link</span>
                    </>
                  )}
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-ink/5 border border-line font-mono text-xs break-all flex items-center justify-between gap-4">
                    <span className="opacity-80">{shareUrl}</span>
                    <button
                      onClick={handleCopy}
                      className="p-2 hover:bg-ink/10 transition-colors shrink-0"
                      title="Copy to clipboard"
                    >
                      {isCopied ? (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: [1, 1.4, 1], opacity: 1 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </motion.div>
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-green-600 font-bold uppercase tracking-widest animate-pulse">
                    Link Active & Secure
                  </p>
                  
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full border border-line py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-bg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Share2 className="w-3 h-3" />
                    )}
                    Regenerate Link
                  </button>
                </motion.div>
              )}
            </div>

            {/* Footer / Disclaimer */}
            <div className="p-6 bg-ink/[0.02] border-t border-line">
              <div className="flex items-start gap-3 opacity-40">
                <div className="mt-1">
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <p className="text-[9px] font-mono leading-relaxed uppercase tracking-tight">
                  Honesty Guardrail: Link expires in 24 hours. Only explicitly checked sources are shared. 
                  Transmission is encrypted using SD-JWT standards.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
