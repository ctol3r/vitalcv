export type InterfaceIntentKey = 'clinician' | 'employer' | 'issuer';

export interface InterfaceIntentStub {
  interface: InterfaceIntentKey;
  intent: string;
  status: 'STUB';
}

/**
 * STUB: Interface intent descriptions only. Replace with canonical intent definitions.
 */
export const INTERFACE_INTENT_STUBS: ReadonlyArray<InterfaceIntentStub> = [
  {
    interface: 'clinician',
    intent: 'STUB: Document clinician interface intent and required workflows.',
    status: 'STUB',
  },
  {
    interface: 'employer',
    intent: 'STUB: Document employer interface intent and verification expectations.',
    status: 'STUB',
  },
  {
    interface: 'issuer',
    intent: 'STUB: Document issuer interface intent and issuance operations.',
    status: 'STUB',
  },
];
