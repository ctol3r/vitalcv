'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Label } from '@/components/ui/label';
import { AlertCircle, FileText, Loader2, Upload, XCircle } from 'lucide-react';
import type { DataState, ExtractedField } from './intake-types';
import { LABELS } from './intake-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface Step2Props {
  files: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  fileValidationError: string | null;
  uploadState: DataState;
  uploadApiError: string | null;
  uploadAuditRef: string | null;
  extractedFields: ExtractedField[];
  onUpload: () => void;
  hasNpi: boolean;
}

/* ------------------------------------------------------------------ */
/*  Step2_DocumentIntelligence                                         */
/* ------------------------------------------------------------------ */

export function Step2_DocumentIntelligence({
  files,
  onFileChange,
  onRemoveFile,
  fileValidationError,
  uploadState,
  uploadApiError,
  uploadAuditRef,
  extractedFields,
  onUpload,
  hasNpi,
}: Step2Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold font-heading">
          2
        </div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Document Intelligence
        </h2>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Resume &amp; Credential Upload
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {/* Drop zone */}
          <div className="space-y-2">
            <Label htmlFor="file-upload" className="text-sm">
              Upload PDF or DOCX
            </Label>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 px-6 py-8 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Drag files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60">
                PDF, DOC, DOCX up to 10 MB
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            {fileValidationError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {fileValidationError}
              </p>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                    aria-label={`Remove ${file.name}`}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <Button
                onClick={onUpload}
                disabled={uploadState === 'loading'}
                className="w-full"
              >
                {uploadState === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Processing…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span className="ml-2">
                      Upload {files.length} file{files.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Upload error */}
          {uploadState === 'error' && uploadApiError && (
            <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{uploadApiError}</p>
            </div>
          )}

          {/* Extracted fields */}
          {uploadState === 'success' && extractedFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Extracted Credentials
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {LABELS.UNVERIFIED}
                </Badge>
              </div>

              {uploadAuditRef && (
                <p className="text-[10px] font-mono text-muted-foreground/60">
                  Audit ref: {uploadAuditRef}
                </p>
              )}

              <div className="rounded-xl border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Field
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Extracted Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {extractedFields.map((field) => (
                      <tr key={field.label}>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {field.label}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {field.value ?? (
                            <span className="text-muted-foreground/50 italic">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </section>
  );
}
