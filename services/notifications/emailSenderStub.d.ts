/**
 * B148A-NOTIF-009: Demo Email Sender Stub
 *
 * Background job that processes PENDING emails from the queue.
 * Logs to console instead of actually sending via SMTP.
 */
/**
 * Process pending email deliveries
 *
 * Loads PENDING EmailDelivery rows, logs 'would send' messages,
 * and marks status as SENT.
 *
 * This is a stub implementation - in production, this would
 * actually send emails via SMTP.
 */
export declare function processPendingEmails(batchSize?: number): Promise<{
    processed: number;
    failed: number;
}>;
/**
 * Run email sender job (can be called from a cron job or queue worker)
 */
export declare function runEmailSenderJob(): Promise<void>;
