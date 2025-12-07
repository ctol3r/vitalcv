import type { FHIRSubscription } from '@prisma/client';

export interface PractitionerCriteriaContext {
  resourceId: string;
  npi?: string | null;
  specialty?: string | null;
}

function extractQuery(criteria: string, resourceType: string): string | null {
  const trimmed = criteria.trim();

  if (trimmed === '' || trimmed === '*' || trimmed === resourceType) {
    return '';
  }

  if (trimmed.startsWith('?')) {
    return trimmed.slice(1);
  }

  if (trimmed.startsWith(`${resourceType}/`)) {
    return null;
  }

  if (!trimmed.startsWith(`${resourceType}?`)) {
    return null;
  }

  return trimmed.slice(resourceType.length + 1);
}

function matchesIdentifier(target: string | null | undefined, value: string): boolean {
  if (!target) {
    return false;
  }

  const [, identifierValue = value] = value.split('|');
  return target === identifierValue;
}

export function matchesPractitionerCriteria(
  subscription: Pick<FHIRSubscription, 'criteria' | 'resourceType'>,
  context: PractitionerCriteriaContext
): boolean {
  const trimmed = subscription.criteria.trim();
  if (trimmed === '' || trimmed === '*' || trimmed === subscription.resourceType) {
    return true;
  }

  if (trimmed.startsWith(`${subscription.resourceType}/`)) {
    const targetId = trimmed.slice(subscription.resourceType.length + 1);
    return targetId === context.resourceId;
  }

  const query = extractQuery(trimmed, subscription.resourceType);
  if (query === null) {
    return false;
  }

  if (query === '') {
    return true;
  }

  const params = new URLSearchParams(query);
  for (const [key, value] of params.entries()) {
    if (!value) {
      continue;
    }

    switch (key) {
      case '_id':
      case 'id':
        if (value !== context.resourceId) {
          return false;
        }
        break;
      case 'identifier':
      case 'npi':
        if (!matchesIdentifier(context.npi, value)) {
          return false;
        }
        break;
      case 'specialty':
        if (!context.specialty || context.specialty !== value) {
          return false;
        }
        break;
      default:
        // Unsupported filters currently treated as non-match for safety
        return false;
    }
  }

  return true;
}

