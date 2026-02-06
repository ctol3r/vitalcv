import { AuditEvent, type AuditEventInput } from './AuditEvent';

type StoredAuditEvent = Readonly<{
  sequence: number;
  event: AuditEvent;
}>;

function assertClinicianId(clinician_id: unknown): asserts clinician_id is string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function sortByTimeThenSequence(events: readonly StoredAuditEvent[]): readonly StoredAuditEvent[] {
  return [...events].sort((left, right) => {
    const leftTs = Date.parse(left.event.occurred_at);
    const rightTs = Date.parse(right.event.occurred_at);

    if (leftTs !== rightTs) return leftTs - rightTs;
    return left.sequence - right.sequence;
  });
}

export class AuditLedger {
  private readonly events: StoredAuditEvent[] = [];
  private sequence = 0;

  append(input: AuditEventInput | AuditEvent): AuditEvent {
    const event = input instanceof AuditEvent ? input : AuditEvent.create(input);

    this.events.push(
      Object.freeze({
        sequence: this.sequence,
        event,
      }),
    );
    this.sequence += 1;

    return event;
  }

  listByClinician(clinician_id: string): readonly AuditEvent[] {
    assertClinicianId(clinician_id);

    const ordered = sortByTimeThenSequence(
      this.events.filter((storedEvent) => storedEvent.event.clinician_id === clinician_id),
    );

    return Object.freeze(ordered.map((storedEvent) => storedEvent.event));
  }

  sizeForClinician(clinician_id: string): number {
    return this.listByClinician(clinician_id).length;
  }
}
