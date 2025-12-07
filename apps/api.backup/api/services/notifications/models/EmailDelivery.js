"use strict";
/**
 * B148A-NOTIF-005: EmailDelivery Model
 *
 * Model for email delivery queue tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnqueueEmailSchema = exports.EmailDeliveryStatus = void 0;
exports.serializeEmailDelivery = serializeEmailDelivery;
const zod_1 = require("zod");
/**
 * Valid email delivery statuses
 */
exports.EmailDeliveryStatus = {
    PENDING: 'PENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
};
/**
 * Schema for enqueuing an email
 */
exports.EnqueueEmailSchema = zod_1.z.object({
    to: zod_1.z.string().email('Invalid email address'),
    subject: zod_1.z.string().min(1, 'Subject is required'),
    templateId: zod_1.z.string().optional(),
    payload: zod_1.z.any(), // Template payload/variables
});
/**
 * Serialize email delivery for API response
 */
function serializeEmailDelivery(emailDelivery) {
    return {
        id: emailDelivery.id,
        to: emailDelivery.to,
        subject: emailDelivery.subject,
        templateId: emailDelivery.templateId,
        payload: emailDelivery.payload,
        status: emailDelivery.status,
        lastError: emailDelivery.lastError,
        createdAt: emailDelivery.createdAt.toISOString(),
        sentAt: emailDelivery.sentAt?.toISOString() || null,
    };
}
