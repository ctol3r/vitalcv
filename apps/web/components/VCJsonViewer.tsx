'use client';

/**
 * VC JSON Viewer
 *
 * Display Verifiable Credential JSON with copy & collapse functionality
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface VCJsonViewerProps {
  credential: any;
  className?: string;
  maxHeight?: number;
}

export function VCJsonViewer({ credential, className, maxHeight = 600 }: VCJsonViewerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label || 'Content'} copied to clipboard`);
      setCopiedPath(label || 'root');
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadJson = () => {
    try {
      const jsonString = JSON.stringify(credential, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `credential-${credential.id || 'unknown'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('JSON downloaded');
    } catch (err) {
      toast.error('Failed to download JSON');
    }
  };

  const sanitizeValue = (value: any): any => {
    // Remove potentially sensitive fields
    const sensitiveKeys = ['privateKey', 'secret', 'password', 'token', 'apiKey'];

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }

      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitizeValue(val);
        }
      }
      return sanitized;
    }

    return value;
  };

  const sanitizedCredential = sanitizeValue(credential);
  const formattedJson = JSON.stringify(sanitizedCredential, null, 2);

  return (
    <Card className={cn('w-full', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Verifiable Credential JSON</CardTitle>
              <CardDescription>Raw credential data in JSON format</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(formattedJson, 'Full JSON')}
              >
                <Copy className="h-4 w-4 mr-2" />
                {copiedPath === 'Full JSON' ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadJson}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Expand
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <Separator />
          <CardContent className="pt-4">
            <ScrollArea className="w-full" style={{ maxHeight: `${maxHeight}px` }}>
              <pre className="text-sm font-mono bg-muted/30 p-4 rounded-lg overflow-x-auto">
                {formattedJson}
              </pre>
            </ScrollArea>

            {/* Key Fields Quick View */}
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold">Key Fields</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {credential.id && (
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">ID:</span>
                    <code className="text-xs">{String(credential.id).slice(0, 16)}...</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(credential.id, 'ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {credential.type && (
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Type:</span>
                    <code className="text-xs">
                      {Array.isArray(credential.type)
                        ? credential.type[credential.type.length - 1]
                        : credential.type}
                    </code>
                  </div>
                )}
                {credential.issuer && (
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded col-span-2">
                    <span className="text-muted-foreground">Issuer:</span>
                    <code className="text-xs">
                      {typeof credential.issuer === 'string'
                        ? credential.issuer.slice(0, 32) + '...'
                        : credential.issuer.id?.slice(0, 32) + '...' || 'Unknown'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        copyToClipboard(
                          typeof credential.issuer === 'string'
                            ? credential.issuer
                            : credential.issuer.id,
                          'Issuer',
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {credential.issuanceDate && (
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Issued:</span>
                    <code className="text-xs">
                      {new Date(credential.issuanceDate).toLocaleDateString()}
                    </code>
                  </div>
                )}
                {credential.expirationDate && (
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Expires:</span>
                    <code className="text-xs">
                      {new Date(credential.expirationDate).toLocaleDateString()}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
