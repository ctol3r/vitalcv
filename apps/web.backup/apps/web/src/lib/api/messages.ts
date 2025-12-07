/**
 * Messages API Client
 * Client-side API for secure messaging
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export interface Conversation {
  id: string;
  recruiterId: string;
  clinicianId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  trustScoreRecruiter: number | null;
  trustScoreClinician: number | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderDid?: string;
  messageType: 'text' | 'system' | 'credential' | 'verification' | 'compliance';
  plaintext: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  sentAt: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  conversationId: string;
  senderId: string;
  senderDid?: string;
  plaintext: string;
  messageType?: 'text' | 'system' | 'credential' | 'verification' | 'compliance';
  metadata?: Record<string, unknown>;
}

/**
 * Initialize a conversation between recruiter and clinician
 */
export async function initiateConversation(
  recruiterId: string,
  clinicianId: string,
  recruiterDid?: string,
  clinicianDid?: string
): Promise<{ conversationId: string }> {
  const response = await fetch(`${API_BASE}/api/messages/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recruiterId,
      clinicianId,
      recruiterDid,
      clinicianDid,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to initiate conversation: ${response.status}`);
  }

  const data = await response.json();
  return { conversationId: data.conversationId };
}

/**
 * Send a message
 */
export async function sendMessage(request: SendMessageRequest): Promise<Message> {
  const response = await fetch(`${API_BASE}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to send message: ${response.status}`);
  }

  const data = await response.json();
  return data.message;
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  limit: number = 50,
  before?: Date
): Promise<Message[]> {
  const params = new URLSearchParams({
    userId,
    limit: limit.toString(),
  });

  if (before) {
    params.append('before', before.toISOString());
  }

  const response = await fetch(
    `${API_BASE}/api/messages/conversation/${conversationId}?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get messages: ${response.status}`);
  }

  const data = await response.json();
  return data.messages || [];
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/messages/${messageId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to mark message as read: ${response.status}`);
  }
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  const response = await fetch(`${API_BASE}/api/messages/conversations?userId=${userId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get conversations: ${response.status}`);
  }

  const data = await response.json();
  return data.conversations || [];
}

