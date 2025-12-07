/**
 * B148A-NOTIF-005: EmailDelivery Model
 *
 * Model for email delivery queue tracking.
 */
import { z } from 'zod';
/**
 * Valid email delivery statuses
 */
export declare const EmailDeliveryStatus: {
    readonly PENDING: "PENDING";
    readonly SENT: "SENT";
    readonly FAILED: "FAILED";
};
export type EmailDeliveryStatusType = (typeof EmailDeliveryStatus)[keyof typeof EmailDeliveryStatus];
/**
 * Schema for enqueuing an email
 */
export declare const EnqueueEmailSchema: any;
export type EnqueueEmailInput = z.infer<typeof EnqueueEmailSchema>;
/**
 * Serialize email delivery for API response
 */
export declare function serializeEmailDelivery(emailDelivery: {
    id: string;
    to: string;
    subject: string;
    templateId: string | null;
    payload: any;
    status: string;
    lastError: string | null;
    createdAt: Date;
    sentAt: Date | null;
}): {
    id: string;
    to: string;
    subject: string;
    templateId: string | null;
    payload: any;
    status: string;
    lastError: string | null;
    createdAt: string;
    sentAt: string | null;
};
