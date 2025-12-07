/**
 * B148B-NOTIF-002: Email service stub for enqueueing emails
 */

export interface EmailPayload {
  to: string;
  templateId: string;
  payload: Record<string, any>;
}

/**
 * Enqueue an email to be sent
 * Stub implementation - logs the email instead of actually sending
 */
export async function enqueueEmail(
  to: string,
  templateId: string,
  payload: Record<string, any>
): Promise<void> {
  // Stub: Log the email instead of actually sending
  console.log(`[Email Service] Enqueued email:`, {
    to,
    templateId,
    payload,
    timestamp: new Date().toISOString(),
  });

  // TODO: In production, integrate with actual email service (SendGrid, SES, etc.)
  // This would enqueue to a job queue (Bull, AWS SQS, etc.) for async processing
}

