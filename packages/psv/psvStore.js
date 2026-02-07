"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsvStore = void 0;
const PSVReceipt_1 = require("./PSVReceipt");
function assertClinicianId(clinician_id) {
    if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
        throw new Error('clinician_id is required');
    }
}
function toReceiptInstance(receipt) {
    if (receipt instanceof PSVReceipt_1.PSVReceipt) {
        return receipt;
    }
    return PSVReceipt_1.PSVReceipt.create(receipt);
}
class PsvStore {
    receiptById = new Map();
    receiptIdsByClinician = new Map();
    append(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('append input is required');
        }
        assertClinicianId(input.clinician_id);
        const receipt = toReceiptInstance(input.receipt);
        if (this.receiptById.has(receipt.receipt_id)) {
            throw new Error(`PSV receipt already exists: ${receipt.receipt_id}`);
        }
        this.receiptById.set(receipt.receipt_id, {
            clinician_id: input.clinician_id,
            receipt,
        });
        const priorIds = this.receiptIdsByClinician.get(input.clinician_id) ?? [];
        this.receiptIdsByClinician.set(input.clinician_id, [...priorIds, receipt.receipt_id]);
        return receipt;
    }
    getById(receipt_id) {
        const record = this.receiptById.get(receipt_id);
        return record?.receipt ?? null;
    }
    listByIds(receipt_ids) {
        if (!Array.isArray(receipt_ids) || receipt_ids.length === 0) {
            return Object.freeze([]);
        }
        const receipts = [];
        for (const receipt_id of receipt_ids) {
            const record = this.receiptById.get(receipt_id);
            if (!record) {
                throw new Error(`Missing PSV receipt: ${receipt_id}`);
            }
            receipts.push(record.receipt);
        }
        return Object.freeze(receipts);
    }
    listSnapshotsByClinician(clinician_id) {
        assertClinicianId(clinician_id);
        const ids = this.receiptIdsByClinician.get(clinician_id) ?? [];
        const snapshots = ids
            .map((id) => this.receiptById.get(id)?.receipt)
            .filter((receipt) => Boolean(receipt))
            .map((receipt) => receipt.toJSON());
        return Object.freeze(snapshots);
    }
    listByClinician(clinician_id) {
        const snapshots = this.listSnapshotsByClinician(clinician_id);
        return Object.freeze(snapshots.map((receipt) => Object.freeze({
            receipt_id: receipt.receipt_id,
            fetched_at: receipt.fetched_at,
            ttl_seconds: receipt.ttl_seconds,
            revoked: receipt.revoked,
        })));
    }
    listReceiptIdsByClinician(clinician_id) {
        assertClinicianId(clinician_id);
        return Object.freeze([...(this.receiptIdsByClinician.get(clinician_id) ?? [])]);
    }
}
exports.PsvStore = PsvStore;
