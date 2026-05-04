'use client';

import * as React from 'react';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/upload/documentFoundation';

const ALLOWED_ACCEPT = ALLOWED_MIME_TYPES.join(',');
const MAX_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

type DropZoneState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'error'; message: string };

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds the ${MAX_MB} MB limit.`;
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PDF, JPEG, PNG, and HEIC files are accepted.';
  }
  return null;
}

export function DropZone({ onFile, disabled = false, className = '' }: DropZoneProps) {
  const [state, setState] = React.useState<DropZoneState>({ phase: 'idle' });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const zoneRef = React.useRef<HTMLDivElement>(null);

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const error = validateFile(file);
      if (error) {
        setState({ phase: 'error', message: error });
        return;
      }
      setState({ phase: 'idle' });
      onFile(file);
    },
    [onFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setState({ phase: 'dragging' });
  };

  const onDragLeave = () => setState({ phase: 'idle' });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setState({ phase: 'idle' });
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const isDragging = state.phase === 'dragging';
  const hasError = state.phase === 'error';

  return (
    <div className={className}>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a document. Click or drag and drop a PDF, JPEG, PNG, or HEIC file."
        aria-disabled={disabled}
        aria-describedby="dropzone-hint dropzone-error"
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
          hasError ? 'border-red-700' : '',
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-300">
          {isDragging ? 'Drop to upload' : 'Click or drag a document here'}
        </p>
        <p id="dropzone-hint" className="text-xs text-zinc-500">
          PDF, JPEG, PNG, or HEIC · max {MAX_MB} MB
        </p>
      </div>

      {hasError && (
        <p id="dropzone-error" role="alert" className="mt-2 text-xs text-red-400">
          {state.message}
        </p>
      )}
      {!hasError && <span id="dropzone-error" aria-hidden />}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
