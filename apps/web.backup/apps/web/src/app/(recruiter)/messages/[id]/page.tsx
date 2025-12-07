'use client';

/**
 * Conversation View Page
 * Individual conversation with message bubbles, typing indicators, etc.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  AlertCircle,
  Check,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import {
  getMessages,
  sendMessage,
  markMessageAsRead,
  type Message,
  type SendMessageRequest,
} from '@/lib/api/messages';
import { cn } from '@/lib/utils';

// Mock user ID - in production, get from auth context
const MOCK_USER_ID = 'recruiter-1';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function loadMessages(before?: Date) {
    setLoading(true);
    setError(null);
    try {
      const data = await getMessages(conversationId, MOCK_USER_ID, 50, before);
      if (before) {
        setMessages((prev) => [...data, ...prev]);
      } else {
        setMessages(data);
      }
      setHasMore(data.length === 50);
    } catch (err) {
      console.error('[Messages] Failed to load messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: MOCK_USER_ID,
      messageType: 'text',
      plaintext: text,
      deliveryStatus: 'sent',
      sentAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      const request: SendMessageRequest = {
        conversationId,
        senderId: MOCK_USER_ID,
        plaintext: text,
        messageType: 'text',
      };

      const sentMessage = await sendMessage(request);

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? sentMessage : msg))
      );

      // Mark as read if we're the sender (immediate read receipt)
      if (sentMessage.senderId === MOCK_USER_ID) {
        await markMessageAsRead(sentMessage.id, MOCK_USER_ID);
      }
    } catch (err) {
      console.error('[Messages] Failed to send message:', err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleLoadMore() {
    if (messages.length === 0) return;
    const oldestMessage = messages[0];
    const before = new Date(oldestMessage.sentAt);
    await loadMessages(before);
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleString();
  }

  function getDeliveryIcon(status: string) {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">Conversation</h1>
              <Badge variant="outline" className="gap-1 text-xs">
                <ShieldCheck className="h-3 w-3" />
                Secure
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">End-to-end encrypted</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {loading && messages.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-3/4" />
            ))}
          </div>
        ) : error && messages.length === 0 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Load older messages'
                  )}
                </Button>
              </div>
            )}

            {messages.map((message) => {
              const isOwn = message.senderId === MOCK_USER_ID;
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-4 py-2',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.plaintext}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                      <span>{formatTime(message.sentAt)}</span>
                      {isOwn && getDeliveryIcon(message.deliveryStatus)}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        {error && (
          <Alert variant="destructive" className="mb-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!inputText.trim() || sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

