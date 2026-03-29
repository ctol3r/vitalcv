import { describe, expect, it } from 'vitest';
import {
  getBillingPlan,
  summarizePricingAccess,
} from '@vitalcv/shared/pricing';

describe('pricing model', () => {
  it('keeps tier facts centralized for UI and billing services', () => {
    const growth = getBillingPlan('GROWTH');

    expect(growth.name).toBe('Growth');
    expect(growth.priceMonthly).toBe(299);
    expect(growth.apiRequestsPerHour).toBe(1000);
    expect(growth.checkoutMode).toBe('self-serve');
  });

  it('does not double bill repeat access inside the same freshness band', () => {
    const summary = summarizePricingAccess([
      {
        activity: 'credential_access',
        organizationId: 'org-1',
        credentialKey: 'npi:1234567890',
        freshnessBand: 'static',
      },
      {
        activity: 'credential_access',
        organizationId: 'org-1',
        credentialKey: 'npi:1234567890',
        freshnessBand: 'static',
      },
      {
        activity: 'credential_access',
        organizationId: 'org-1',
        credentialKey: 'npi:1234567890',
        freshnessBand: 'monthly-monitoring',
      },
      {
        activity: 'monitoring_refresh',
        organizationId: 'org-1',
        count: 3,
      },
      {
        activity: 'export_run',
        organizationId: 'org-1',
      },
    ]);

    expect(summary.billableCredentialPulls).toBe(2);
    expect(summary.includedRepeatViews).toBe(1);
    expect(summary.billablePullsByFreshnessBand).toEqual({
      static: 1,
      'monthly-monitoring': 1,
      'continuous-monitoring': 0,
    });
    expect(summary.monitoringRefreshes).toBe(3);
    expect(summary.exportRuns).toBe(1);
  });

  it('keeps repeat-access protection scoped to the same organization', () => {
    const summary = summarizePricingAccess([
      {
        activity: 'credential_access',
        organizationId: 'org-1',
        credentialKey: 'npi:1234567890',
        freshnessBand: 'static',
      },
      {
        activity: 'credential_access',
        organizationId: 'org-2',
        credentialKey: 'npi:1234567890',
        freshnessBand: 'static',
      },
    ]);

    expect(summary.billableCredentialPulls).toBe(2);
    expect(summary.includedRepeatViews).toBe(0);
    expect(summary.billablePullsByFreshnessBand.static).toBe(2);
  });
});
