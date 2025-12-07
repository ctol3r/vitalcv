import { matchesPractitionerCriteria } from '../criteria';

describe('matchesPractitionerCriteria', () => {
  const baseSubscription = {
    id: 'sub-1',
    resourceType: 'Practitioner',
    criteria: 'Practitioner/*',
    callbackUrl: 'https://example.com',
    status: 'ACTIVE',
    lastHandshakeAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('matches wildcard criteria', () => {
    expect(
      matchesPractitionerCriteria(baseSubscription, {
        resourceId: 'user-1',
        npi: '1234567890',
        specialty: '207Q00000X',
      })
    ).toBe(true);
  });

  it('matches resource specific criteria', () => {
    const subscription = {
      ...baseSubscription,
      criteria: 'Practitioner/user-1',
    };

    expect(
      matchesPractitionerCriteria(subscription, {
        resourceId: 'user-1',
      })
    ).toBe(true);
  });

  it('filters by NPI identifier', () => {
    const subscription = {
      ...baseSubscription,
      criteria: 'Practitioner?identifier=1234567890',
    };

    expect(
      matchesPractitionerCriteria(subscription, {
        resourceId: 'user-1',
        npi: '1234567890',
      })
    ).toBe(true);

    expect(
      matchesPractitionerCriteria(subscription, {
        resourceId: 'user-1',
        npi: '0000000000',
      })
    ).toBe(false);
  });

  it('filters by specialty', () => {
    const subscription = {
      ...baseSubscription,
      criteria: 'Practitioner?specialty=207Q00000X',
    };

    expect(
      matchesPractitionerCriteria(subscription, {
        resourceId: 'user-1',
        specialty: '207Q00000X',
      })
    ).toBe(true);

    expect(
      matchesPractitionerCriteria(subscription, {
        resourceId: 'user-1',
        specialty: '207R00000X',
      })
    ).toBe(false);
  });
});

