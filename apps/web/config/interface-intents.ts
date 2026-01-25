export type InterfaceIntentKey = 'clinician' | 'employer_verifier' | 'issuer_authority';

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
    intent: 'STUB: Clinician interface intent documentation placeholder.',
    status: 'STUB',
  },
  {
    interface: 'employer_verifier',
    intent: 'STUB: Employer/verifier interface intent documentation placeholder.',
    status: 'STUB',
  },
  {
    interface: 'issuer_authority',
    intent: 'STUB: Issuer/authority interface intent documentation placeholder.',
    status: 'STUB',
  },
];
