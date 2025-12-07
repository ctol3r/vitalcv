/**
 * EvidenceSection Component
 * Displays evidence files with thumbnails and viewer
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, File, ExternalLink, Download, Eye } from 'lucide-react';
import { useState } from 'react';
import type { Evidence } from '@/lib/repositories/evidence-repository';
import { EvidenceViewer } from './EvidenceViewer';
import { cn } from '@/lib/utils';

interface EvidenceSectionProps {
  evidence: Evidence[];
  credentialId: string;
  className?: string;
}

export function EvidenceSection({ evidence, credentialId, className }: EvidenceSectionProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const getFileIcon = (type: Evidence['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5" />;
      case 'image':
        return <Image className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const shortHash = (hash?: string, length = 12) => {
    if (!hash) return '—';
    if (hash.length <= length + 4) return hash;
    return `${hash.slice(0, length)}…${hash.slice(-4)}`;
  };

  const openViewer = (ev: Evidence) => {
    setSelectedEvidence(ev);
    setViewerOpen(true);
  };

  if (evidence.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Evidence Available</h3>
          <p className="text-muted-foreground">
            No evidence files have been attached to this credential.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={cn('space-y-4', className)}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {evidence.map((ev) => (
            <Card key={ev.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(ev.type)}
                    <CardTitle className="text-sm font-medium truncate">{ev.filename}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {ev.type.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {ev.thumbnailUrl && (
                  <div
                    className="relative w-full h-32 bg-muted rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => openViewer(ev)}
                  >
                    <img
                      src={ev.thumbnailUrl}
                      alt={ev.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">{formatFileSize(ev.size)}</span>
                  </div>
                  {ev.version && (
                    <div className="flex justify-between">
                      <span>Version:</span>
                      <span className="font-medium">v{ev.version}</span>
                    </div>
                  )}
                  {ev.fetchedAt && (
                    <div className="flex justify-between">
                      <span>Fetched:</span>
                      <span className="font-medium">
                        {new Date(ev.fetchedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {ev.sha256 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">SHA256:</div>
                    <code className="text-[10px] font-mono bg-muted px-2 py-1 rounded block truncate">
                      {shortHash(ev.sha256)}
                    </code>
                  </div>
                )}

                {ev.sourceUrl && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Source:</div>
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View source
                    </a>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openViewer(ev)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.open(ev.url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {evidence.length > 1 && (
          <Card>
            <CardContent className="p-4">
              <Button variant="outline" className="w-full">
                Compare Evidence Versions
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Evidence Viewer Modal */}
      {selectedEvidence && (
        <EvidenceViewer
          evidence={selectedEvidence}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
        />
      )}
    </>
  );
}

