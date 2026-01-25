import type { InterfaceIntentKey } from './interface-intents';

export interface InterfaceRouteIndexStub {
  interface: InterfaceIntentKey;
  intent: string;
  routes: ReadonlyArray<{
    id: string;
    path?: string;
    description: string;
    status: 'STUB';
  }>;
  status: 'STUB';
}

/**
 * STUB: Route index placeholders for interface routing ownership.
 * Populate with canonical routes when the interfaces are formalized.
 */
export const INTERFACE_ROUTE_INDEX: ReadonlyArray<InterfaceRouteIndexStub> = [
  {
    interface: 'clinician',
    intent: 'STUB: Clinician interface route index not yet defined.',
    routes: [],
    status: 'STUB',
  },
  {
    interface: 'employer_verifier',
    intent: 'STUB: Employer/verifier interface route index not yet defined.',
    routes: [],
    status: 'STUB',
  },
  {
    interface: 'issuer_authority',
    intent: 'STUB: Issuer/authority interface route index not yet defined.',
    routes: [],
    status: 'STUB',
  },
];
