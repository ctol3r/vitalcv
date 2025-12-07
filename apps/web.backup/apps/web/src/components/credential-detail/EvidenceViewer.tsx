/**
 * EvidenceViewer Component
 * Full-screen evidence viewer with zoom and PDF support
 */

'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Evidence } from '@/lib/repositories/evidence-repository';
import { cn } from '@/lib/utils';

interface EvidenceViewerProps {
  evidence: Evidence;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvidenceViewer({ evidence, open, onOpenChange }: EvidenceViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setRotation(0);
    }
  }, [open]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const shortHash = (hash?: string, length = 16) => {
    if (!hash) return '—';
    if (hash.length <= length + 4) return hash;
    return `${hash.slice(0, length)}…${hash.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{evidence.filename}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{evidence.type.toUpperCase()}</Badge>
                {evidence.version && (
                  <Badge variant="secondary">Version {evidence.version}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {(zoom * 100).toFixed(0)}%
              </span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(evidence.url, '_blank')}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center p-4"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
            }
          }}
        >
          {evidence.type === 'pdf' ? (
            <iframe
              src={evidence.url}
              className="w-full h-full border-0"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            />
          ) : (
            <img
              ref={imageRef}
              src={evidence.url}
              alt={evidence.filename}
              className="max-w-full max-h-full object-contain cursor-zoom-in"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
              }}
              onDoubleClick={handleDoubleClick}
              draggable={false}
            />
          )}
        </div>

        {/* Metadata Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 space-y-2 text-xs">
          {evidence.sourceUrl && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Source:</span>
              <a
                href={evidence.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {evidence.sourceUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {evidence.fetchedAt && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Fetched:</span>
              <span className="font-medium">
                {new Date(evidence.fetchedAt).toLocaleString()}
              </span>
            </div>
          )}
          {evidence.sha256 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">SHA256:</span>
              <code className="font-mono bg-muted px-2 py-1 rounded">
                {shortHash(evidence.sha256)}
              </code>
            </div>
          )}
          {evidence.metadata?.device && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Device:</span>
              <span className="font-medium">{evidence.metadata.device}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

