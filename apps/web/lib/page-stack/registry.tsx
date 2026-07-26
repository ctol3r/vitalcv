/**
 * The pane registry: the one place a PaneType is bound to a component.
 *
 * Kept injectable — `usePaneStack`/`PageStack` accept a registry, defaulting to
 * this one — so tests can supply a trivial pane instead of mounting the real
 * product surfaces (and their data providers).
 */

import { OpportunityPane } from '@/components/page-stack/panes/OpportunityPane';
import { StubPane } from '@/components/page-stack/panes/StubPane';

import { PANE_GRAPH_NODE, type PaneRegistry } from './types';

export const PANE_REGISTRY: PaneRegistry = {
  opportunity: {
    type: 'opportunity',
    graphNodeType: PANE_GRAPH_NODE.opportunity,
    Component: OpportunityPane,
    fallbackLabel: 'Opportunity',
  },
  // Employer and evidence panes are stubbed this slice — the shell resolves and
  // stacks them, and a later PR swaps in the real surfaces behind the same
  // descriptor. Stubbing (not omitting) keeps their tokens navigable now.
  employer: {
    type: 'employer',
    graphNodeType: PANE_GRAPH_NODE.employer,
    Component: (props) => <StubPane label="Employer" id={props.id} />,
    fallbackLabel: 'Employer',
  },
  evidence_claim: {
    type: 'evidence_claim',
    graphNodeType: PANE_GRAPH_NODE.evidence_claim,
    Component: (props) => <StubPane label="Evidence claim" id={props.id} />,
    fallbackLabel: 'Evidence claim',
  },
};
