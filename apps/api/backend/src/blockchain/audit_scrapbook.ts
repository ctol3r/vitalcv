import { PolkadotService, AuditRecord } from './polkadot_service';

export class AuditScrapbook {
    constructor(private polkadot: PolkadotService) {}

    async recordIdentityAction(userId: string, action: string): Promise<void> {
        const record: AuditRecord = {
            userId,
            action,
            timestamp: Date.now(),
        };
        await this.polkadot.storeAuditRecord(record);
    }
}
