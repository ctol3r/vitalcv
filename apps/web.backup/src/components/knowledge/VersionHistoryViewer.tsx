'use client';

/**
 * B243C-KMS-029: VersionHistoryViewer UI
 * Shows list of article versions with metadata (editor, date, change summary); allows diff view
 * between versions; provides restore option (with confirmation); responsive layout
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  User,
  Calendar,
  FileText,
  GitCompare,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Version {
  id: string;
  version: number;
  editor: string;
  date: string;
  changeSummary: string;
  content: string;
  isCurrent?: boolean;
}

interface VersionHistoryViewerProps {
  articleId: string;
  versions?: Version[];
  onRestore?: (versionId: string) => void;
  className?: string;
}

// Mock data - replace with API call
const mockVersions: Version[] = [
  {
    id: '1',
    version: 3,
    editor: 'John Doe',
    date: '2024-01-20T14:30:00Z',
    changeSummary: 'Updated authentication section with new examples',
    content: 'Current version content...',
    isCurrent: true,
  },
  {
    id: '2',
    version: 2,
    editor: 'John Doe',
    date: '2024-01-18T10:15:00Z',
    changeSummary: 'Added code examples and improved formatting',
    content: 'Previous version content...',
  },
  {
    id: '3',
    version: 1,
    editor: 'John Doe',
    date: '2024-01-15T09:00:00Z',
    changeSummary: 'Initial version',
    content: 'Original content...',
  },
];

export function VersionHistoryViewer({
  articleId,
  versions = mockVersions,
  onRestore,
  className,
}: VersionHistoryViewerProps) {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareVersion, setCompareVersion] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<Version | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return formatDate(dateString);
  };

  const handleViewVersion = (version: Version) => {
    setSelectedVersion(version);
    setShowDiff(false);
    setCompareVersion('');
  };

  const handleCompareVersions = () => {
    if (selectedVersion && compareVersion) {
      setShowDiff(true);
    }
  };

  const handleRestore = (version: Version) => {
    setRestoreVersion(version);
    setIsRestoreDialogOpen(true);
  };

  const confirmRestore = () => {
    if (restoreVersion) {
      onRestore?.(restoreVersion.id);
      setIsRestoreDialogOpen(false);
      setRestoreVersion(null);
    }
  };

  // Simple diff renderer (in production, use a proper diff library)
  const renderDiff = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    const diff: React.ReactNode[] = [];

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine !== newLine) {
        if (oldLine) {
          diff.push(
            <div key={`old-${i}`} className="bg-red-100 dark:bg-red-900/20 p-2 border-l-4 border-red-500">
              <span className="text-red-600 dark:text-red-400">- {oldLine}</span>
            </div>
          );
        }
        if (newLine) {
          diff.push(
            <div key={`new-${i}`} className="bg-green-100 dark:bg-green-900/20 p-2 border-l-4 border-green-500">
              <span className="text-green-600 dark:text-green-400">+ {newLine}</span>
            </div>
          );
        }
      } else if (oldLine) {
        diff.push(
          <div key={`same-${i}`} className="p-2 text-muted-foreground">
            {oldLine}
          </div>
        );
      }
    }

    return diff;
  };

  const currentVersion = versions.find((v) => v.isCurrent);
  const compareVersionData = versions.find((v) => v.id === compareVersion);

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <CardTitle>Version History</CardTitle>
          </div>
          <CardDescription>
            View and compare different versions of this article
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versions List */}
          <div className="space-y-3">
            {versions.map((version) => (
              <div
                key={version.id}
                className={cn(
                  'border rounded-lg p-4 cursor-pointer transition-colors',
                  selectedVersion?.id === version.id && 'border-primary bg-primary/5',
                  'hover:bg-muted/50'
                )}
                onClick={() => handleViewVersion(version)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">Version {version.version}</span>
                        {version.isCurrent && (
                          <Badge variant="default" className="ml-2">
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {version.changeSummary}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {version.editor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatRelativeTime(version.date)}
                      </span>
                    </div>
                  </div>
                  {!version.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(version);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version Viewer */}
      {selectedVersion && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Version {selectedVersion.version}</CardTitle>
                <CardDescription>
                  Edited by {selectedVersion.editor} • {formatDate(selectedVersion.date)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={compareVersion} onValueChange={setCompareVersion}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Compare with..." />
                  </SelectTrigger>
                  <SelectContent>
                    {versions
                      .filter((v) => v.id !== selectedVersion.id)
                      .map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          Version {version.version}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {compareVersion && (
                  <Button onClick={handleCompareVersions}>
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showDiff && compareVersionData ? (
              <div className="space-y-2 font-mono text-sm">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-sm">Version {compareVersionData.version}</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm">Version {selectedVersion.version}</span>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {renderDiff(compareVersionData.content, selectedVersion.content)}
                </div>
              </div>
            ) : (
              <div className="prose prose-slate dark:prose-invert max-w-none p-4 border rounded-lg bg-muted/30">
                <pre className="whitespace-pre-wrap font-sans">{selectedVersion.content}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore version {restoreVersion?.version}? This will
              replace the current version and create a new version entry.
            </DialogDescription>
          </DialogHeader>
          {restoreVersion && (
            <div className="py-4">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Version:</strong> {restoreVersion.version}
                </div>
                <div>
                  <strong>Editor:</strong> {restoreVersion.editor}
                </div>
                <div>
                  <strong>Date:</strong> {formatDate(restoreVersion.date)}
                </div>
                <div>
                  <strong>Changes:</strong> {restoreVersion.changeSummary}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRestore}>Restore Version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

