"use strict";
/**
 * B148A-NOTIF-009: Demo Email Sender Stub
 *
 * Background job that processes PENDING emails from the queue.
 * Logs to console instead of actually sending via SMTP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPendingEmails = processPendingEmails;
exports.runEmailSenderJob = runEmailSenderJob;
const client_1 = require("@prisma/client");
const EmailDelivery_js_1 = require("./models/EmailDelivery.js");
const prisma = new client_1.PrismaClient();
/**
 * Process pending email deliveries
 *
 * Loads PENDING EmailDelivery rows, logs 'would send' messages,
 * and marks status as SENT.
 *
 * This is a stub implementation - in production, this would
 * actually send emails via SMTP.
 */
async function processPendingEmails(batchSize = 10) {
    // Load PENDING email deliveries
    const pendingEmails = await prisma.emailDelivery.findMany({
        where: {
            status: EmailDelivery_js_1.EmailDeliveryStatus.PENDING,
        },
        take: batchSize,
        orderBy: {
            createdAt: 'asc', // Process oldest first
        },
    });
    if (pendingEmails.length === 0) {
        return { processed: 0, failed: 0 };
    }
    let processed = 0;
    let failed = 0;
    for (const email of pendingEmails) {
        try {
            // Stub: Log instead of sending
            console.log(`[EmailSender] [STUB] Would send email:\n` +
                `  To: ${email.to}\n` +
                `  Subject: ${email.subject}\n` +
                `  TemplateId: ${email.templateId || 'none'}\n` +
                `  Payload: ${JSON.stringify(email.payload)}`);
            // Mark as SENT
            await prisma.emailDelivery.update({
                where: { id: email.id },
                data: {
                    status: EmailDelivery_js_1.EmailDeliveryStatus.SENT,
                    sentAt: new Date(),
                },
            });
            processed++;
        }
        catch (error) {
            console.error(`[EmailSender] Failed to process email ${email.id}:`, error);
            // Mark as FAILED
            await prisma.emailDelivery.update({
                where: { id: email.id },
                data: {
                    status: EmailDelivery_js_1.EmailDeliveryStatus.FAILED,
                    lastError: error instanceof Error ? error.message : 'Unknown error',
                },
            });
            failed++;
        }
    }
    return { processed, failed };
}
/**
 * Run email sender job (can be called from a cron job or queue worker)
 */
async function runEmailSenderJob() {
    console.log('[EmailSender] Starting email sender job...');
    const result = await processPendingEmails(10);
    console.log(`[EmailSender] Job complete: ${result.processed} processed, ${result.failed} failed`);
}
