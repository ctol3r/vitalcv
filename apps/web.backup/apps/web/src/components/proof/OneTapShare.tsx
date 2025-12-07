'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { confirmProofHaptic } from '@/lib/haptic';

interface OneTapShareProps {
  credentialId: string;
  onShare?: (link: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export function OneTapShare({ credentialId, onShare }: OneTapShareProps) {
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const handleShare = async () => {
    setSharing(true);
    try {
      // Auto-compose VC/SD-JWT bundle
      const response = await fetch(`${API_BASE}/api/proof/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      setShareLink(data.shareLink);
      setShared(true);

      // Haptic feedback on mobile
      confirmProofHaptic();

      // Copy to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.shareLink);
      }

      if (onShare) {
        onShare(data.shareLink);
      }
    } catch (err) {
      console.error('Failed to share credential', err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <Button
          onClick={handleShare}
          disabled={sharing || shared}
          className="w-full"
          variant={shared ? 'outline' : 'default'}
        >
          {shared ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Shared! Link copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 mr-2" />
              {sharing ? 'Sharing...' : 'Share My Credential'}
            </>
          )}
        </Button>
        {shareLink && (
          <div className="mt-2 text-xs text-muted-foreground break-all">
            {shareLink}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

