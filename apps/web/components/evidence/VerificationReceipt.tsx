'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FileCode2, Fingerprint, Lock, ShieldCheck } from 'lucide-react';

export interface ReceiptData {
  transactionHash: string;
  merkleRoot: string;
  timestamp: string;
  issuerDid: string;
  subjectDid: string;
  signature: string;
}

export interface VerificationReceiptProps {
  data: ReceiptData;
  className?: string;
}

export function VerificationReceipt({ data, className }: VerificationReceiptProps) {
  return (
    <div className={cn("bg-black text-foreground font-mono p-1 rounded-sm shadow-xl max-w-2xl w-full", className)}>
      <div className="border border-border p-6">
        <header className="flex justify-between items-center border-b border-border pb-4 mb-6">
          <div className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold">Cryptographic Receipt</h3>
          </div>
          <div className="text-[10px] text-neutral-500">
            VitalCV Protocol v3.0
          </div>
        </header>

        <div className="space-y-6 text-sm">
          {/* Hashes Section */}
          <div className="space-y-3">
            <ReceiptRow 
              icon={<Fingerprint className="w-4 h-4" />} 
              label="Transaction Hash" 
              value={data.transactionHash} 
            />
            <ReceiptRow 
              icon={<FileCode2 className="w-4 h-4" />} 
              label="Merkle Root" 
              value={data.merkleRoot} 
            />
          </div>

          <div className="h-px bg-muted w-full" />

          {/* DIDs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-widest">Issuer DID</span>
              <div className="text-xs text-neutral-300 break-all bg-muted p-2 border border-border">
                {data.issuerDid}
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-widest">Subject DID</span>
              <div className="text-xs text-neutral-300 break-all bg-muted p-2 border border-border">
                {data.subjectDid}
              </div>
            </div>
          </div>

          <div className="h-px bg-muted w-full" />

          {/* Signature & Timing */}
          <div className="space-y-3">
            <ReceiptRow 
              icon={<Lock className="w-4 h-4" />} 
              label="Signature Validation" 
              value={data.signature} 
              isHighlight
            />
            <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-4">
              <span>Verified at: {data.timestamp}</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                NETWORK CONFIRMED
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OmissionText({ text }: { text: string }) {
  if (text.length <= 24) return <>{text}</>;
  return (
    <span title={text}>
      {text.substring(0, 12)}...{text.substring(text.length - 12)}
    </span>
  );
}

function ReceiptRow({ icon, label, value, isHighlight }: { icon: React.ReactNode, label: string, value: string, isHighlight?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 text-neutral-400">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        "text-xs break-all sm:max-w-[60%] sm:text-right",
        isHighlight ? "text-emerald-400 font-bold" : "text-neutral-200"
      )}>
        <OmissionText text={value} />
      </div>
    </div>
  );
}
