'use client';

import * as React from 'react';
import { CV_ALLOWED_MIME_TYPES, CV_MAX_FILE_SIZE_BYTES } from '@/lib/upload/cvFoundation';

const CV_ACCEPT = CV_ALLOWED_MIME_TYPES.join(',');
const CV_MAX_MB = CV_MAX_FILE_SIZE_BYTES / (1024 * 1024);

type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'uploading' }
  | { phase: 'success'; mimeType: string; sizeBytes: number }
  | { phase: 'error'; message: string };

function validateCvFile(file: File): string | null {
  if (file.size > CV_MAX_FILE_SIZE_BYTES) {
    return `File exceeds the ${CV_MAX_MB} MB limit.`;
  }
  if (!(CV_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PDF and DOCX files are accepted.';
  }
  return null;
}

export function CvUploadZone() {
  const [state, setState] = React.useState<UploadState>({ phase: 'idle' });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(async (file: File) => {
    const clientError = validateCvFile(file);
    if (clientError) {
      setState({ phase: 'error', message: clientError });
      return;
    }

    setState({ phase: 'uploading' });
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload/cv', { method: 'POST', body });
      if (res.status === 413) {
        setState({ phase: 'error', message: `File exceeds the ${CV_MAX_MB} MB limit.` });
        return;
      }
      if (res.status === 415) {
        setState({ phase: 'error', message: 'Only PDF and DOCX files are accepted.' });
        return;
      }
      if (!res.ok) {
        setState({ phase: 'error', message: 'Upload failed. Please try again.' });
        return;
      }
      const data = await res.json() as { mimeType: string; sizeBytes: number };
      setState({ phase: 'success', mimeType: data.mimeType, sizeBytes: data.sizeBytes });
    } catch {
      setState({ phase: 'error', message: 'Upload failed. Please try again.' });
    }
  }, []);

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void handleFile(files[0]);
    },
    [handleFile],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (state.phase !== 'uploading') setState({ phase: 'dragging' });
  };

  const onDragLeave = () => {
    if (state.phase === 'dragging') setState({ phase: 'idle' });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (state.phase !== 'uploading') {
      setState({ phase: 'idle' });
      handleFiles(e.dataTransfer.files);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const disabled = state.phase === 'uploading';
  const isDragging = state.phase === 'dragging';

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a CV or resume. Click or drag and drop a PDF or DOCX file."
        aria-disabled={disabled}
        aria-describedby="cv-dropzone-hint cv-dropzone-status"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={onKeyDown}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer select-none',
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-zinc-700 hover:border-zinc-500',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <svg
          aria-hidden
          className="h-8 w-8 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-300">
          {isDragging ? 'Drop to upload' : 'Click or drag a CV here'}
        </p>
        <p id="cv-dropzone-hint" className="text-xs text-zinc-500">
          PDF or DOCX · max {CV_MAX_MB} MB
        </p>
      </div>

      <div id="cv-dropzone-status">
        {state.phase === 'uploading' && (
          <p className="text-xs text-zinc-400" role="status">Uploading…</p>
        )}
        {state.phase === 'success' && (
          <p className="text-xs text-emerald-400" role="status">
            CV received. Recorded as user-entered — structured parsing is a separate step.
          </p>
        )}
        {state.phase === 'error' && (
          <p className="text-xs text-red-400" role="alert">{state.message}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={CV_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
