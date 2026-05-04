'use client';

import * as React from 'react';
import { DropZone } from './DropZone';

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'success'; mimeType: string; sizeBytes: number }
  | { phase: 'error'; message: string };

export function DocumentUploadZone() {
  const [state, setState] = React.useState<UploadState>({ phase: 'idle' });

  const handleFile = React.useCallback(async (file: File) => {
    setState({ phase: 'uploading' });
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload/document', { method: 'POST', body });
      if (res.status === 413) {
        setState({ phase: 'error', message: 'File exceeds the 10 MB limit.' });
        return;
      }
      if (res.status === 415) {
        setState({ phase: 'error', message: 'Only PDF, JPEG, PNG, and HEIC files are accepted.' });
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

  return (
    <div className="space-y-3">
      <DropZone onFile={handleFile} disabled={state.phase === 'uploading'} />
      {state.phase === 'uploading' && (
        <p className="text-xs text-zinc-400" role="status">Uploading…</p>
      )}
      {state.phase === 'success' && (
        <p className="text-xs text-emerald-400" role="status">
          Document received. Recorded as user-entered — source-backed verification is a separate step.
        </p>
      )}
      {state.phase === 'error' && (
        <p className="text-xs text-red-400" role="alert">{state.message}</p>
      )}
    </div>
  );
}
