'use client';

/**
 * VitalCV — Wave 1505 · System Pages & Governance (design reference)
 *
 * Ported from the wave1505 Claude Design handoff (standalone React-18 + Babel
 * bundle) into a scoped client island, following the wave1400 →
 * /operations-engine precedent. The prototype's hash router runs against this
 * route's #hash; all tokens and element styles are scoped under the `.w1505`
 * root so the paper theme cannot leak into the app shell.
 *
 * Handoff source (verbatim, in-repo):
 *   design-handoff/claude-design-2026-07-12-wave1505/
 *
 * Deliberate port adaptations — every one is marked at its site:
 *   - cross-wave prototype links → real app routes ('/', '/status',
 *     '/get-ready');
 *   - a DesignRefNote strip labels all content as illustrative fixtures;
 *   - the contact/feedback success states say plainly that the prototype
 *     transmits nothing (no fabricated receipts);
 *   - audit rows use the Re-checked label, never the banned bare
 *     Verified status label.
 */

import * as React from 'react';
import { WAVE1505_CSS } from './styles';
import { DesignRefNote, FeedbackWidget, S5Footer, S5Nav, useRoute5 } from './shared';
import {
  AuthRoute, ContactRoute, IndexRoute, LegalRoute, PricingRoute, Sys404, SysError, SystemRoute,
} from './views-core';
import { AuditRoute, DevDesignRoute, GovernanceRoute } from './views-governance';

export default function Wave1505Client() {
  const route = useRoute5();
  const authFull = route.name === 'auth' && route.sub !== 'overview';
  const chromeless = authFull || route.name === '404' || route.name === 'error';

  return (
    <div className="w1505">
      <style dangerouslySetInnerHTML={{ __html: WAVE1505_CSS }} />
      {chromeless ? (
        route.name === '404' ? <Sys404 requested={route.requested} />
          : route.name === 'error' ? <SysError />
            : <AuthRoute route={route} />
      ) : (
        <React.Fragment>
          <a className="skip-link" href="#main">Skip to content</a>
          <S5Nav route={route} />
          <DesignRefNote />
          <main id="main" className="s5-main">
            {route.name === 'index' ? <IndexRoute /> : null}
            {route.name === 'auth' ? <AuthRoute route={route} /> : null}
            {route.name === 'system' ? <SystemRoute /> : null}
            {route.name === 'legal' ? <LegalRoute doc={route.doc} /> : null}
            {route.name === 'contact' ? <ContactRoute /> : null}
            {route.name === 'pricing' ? <PricingRoute /> : null}
            {route.name === 'audit' ? <AuditRoute /> : null}
            {route.name === 'devdesign' ? <DevDesignRoute /> : null}
            {route.name === 'governance' ? <GovernanceRoute /> : null}
          </main>
          <FeedbackWidget />
          <S5Footer />
        </React.Fragment>
      )}
    </div>
  );
}
