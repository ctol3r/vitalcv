'use client';

/**
 * Conversations List Page
 * Shows all conversations for the recruiter
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Plus, AlertCircle, ShieldCheck } from 'lucide-react';
import { getConversations, type Conversation } from '@/lib/api/messages';
import { cn } from '@/lib/utils';

// Mock user ID - in production, get from auth context
const MOCK_USER_ID = 'recruiter-1';

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const data = await getConversations(MOCK_USER_ID);
      setConversations(data);
    } catch (err) {
      console.error('[Messages] Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      // Use mock data for development
      setConversations([
        {
          id: 'conv-1',
          recruiterId: MOCK_USER_ID,
          clinicianId: 'clinician-1',
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: 'Thanks for your interest! I can start next week.',
          unreadCount: 2,
          trustScoreRecruiter: 0.85,
          trustScoreClinician: 0.92,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateString: string | null): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Secure messaging with clinicians
          </p>
        </div>
        <Button onClick={() => router.push('/recruiter/messages/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations
          </CardTitle>
          <CardDescription>
            {conversations.length} active conversation{conversations.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm mt-2">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/recruiter/messages/${conv.id}`)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border transition-colors',
                  'hover:bg-accent hover:border-accent-foreground/20',
                  conv.unreadCount > 0 && 'bg-accent/50 border-primary/20'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        Clinician {conv.clinicianId.slice(-6)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                      {conv.trustScoreClinician !== null && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" />
                          Trust {(conv.trustScoreClinician * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessagePreview || 'No messages yet'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(conv.lastMessageAt)}
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

