'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';

import type { ImportRow, ImportRowStatus } from './issuer-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface BulkImportPanelProps {
  onImport: (file: File) => void;
  importing?: boolean;
  importRows: ImportRow[];
}

/* ------------------------------------------------------------------ */
/*  BulkImportPanel — CSV upload + progress                            */
/* ------------------------------------------------------------------ */

export function BulkImportPanel({ onImport, importing, importRows }: BulkImportPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleStart = () => {
    if (selectedFile) onImport(selectedFile);
  };

  const successCount = importRows.filter((r) => r.status === 'SUCCESS').length;
  const errorCount = importRows.filter((r) => r.status === 'ERROR').length;
  const totalCount = importRows.length;

  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-[var(--accent)]" />
          <GlassCardTitle>Bulk Import</GlassCardTitle>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--glass-border)] hover:border-[var(--accent)]/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                Drop a CSV file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Required columns: subject_npi, credential_type, subject_name, issued_at
              </p>
            </div>
          )}
        </div>

        {/* Start button */}
        {selectedFile && importRows.length === 0 && (
          <Button onClick={handleStart} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" />
                Start Import
              </>
            )}
          </Button>
        )}

        {/* Progress */}
        {importRows.length > 0 && (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--trust-green)] transition-all duration-300"
                  style={{
                    width: `${((successCount + errorCount) / Math.max(totalCount, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {successCount + errorCount}/{totalCount}
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-[var(--trust-green)]">
                <CheckCircle2 className="h-3 w-3" />
                {successCount} success
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {errorCount} errors
                </span>
              )}
            </div>

            {/* Error rows */}
            {errorCount > 0 && (
              <div className="space-y-1.5 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Import Errors
                </p>
                {importRows
                  .filter((r) => r.status === 'ERROR')
                  .map((row) => (
                    <div
                      key={row.rowNumber}
                      className="text-xs text-destructive/80 flex gap-2"
                    >
                      <span className="font-mono shrink-0">Row {row.rowNumber}:</span>
                      <span>{row.error || 'Unknown error'}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
