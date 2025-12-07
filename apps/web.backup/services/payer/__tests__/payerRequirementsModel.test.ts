import { describe, expect, it } from '@jest/globals';
import {
  parseRequirementDefinitions,
  RequirementDefinitionSchema,
} from '../models/PayerRequirements.js';

describe('Payer requirements model', () => {
  const baseRequirement = {
    id: 'state-license',
    type: 'STATE_LICENSE',
    label: 'CA License',
    severity: 'critical',
    metadata: { state: 'CA' },
  } as const;

  it('parses single requirement object', () => {
    const [parsed] = parseRequirementDefinitions(baseRequirement);
    expect(parsed.label).toBe('CA License');
    expect(parsed.optional).toBe(false);
  });

  it('parses array of requirements', () => {
    const parsed = parseRequirementDefinitions([
      baseRequirement,
      { ...baseRequirement, id: 'dea', type: 'DEA_REGISTRATION', label: 'DEA' },
    ]);
    expect(parsed).toHaveLength(2);
  });

  it('validates severity + type enums', () => {
    const result = RequirementDefinitionSchema.safeParse({
      ...baseRequirement,
      severity: 'low',
    });
    expect(result.success).toBe(true);
  });

  it('throws on malformed payload', () => {
    expect(() =>
      parseRequirementDefinitions({
        id: '',
        type: 'UNKNOWN',
        label: '',
      })
    ).toThrow();
  });
});

import { describe, expect, it } from '@jest/globals';
import {
  parseRequirementDefinitions,
  REQUIREMENT_TYPES,
  type RequirementDefinition,
} from '../../payer/models/PayerRequirements.js';

describe('Payer requirement templates', () => {
  const baseDefinition: RequirementDefinition = {
    id: 'state-license',
    type: 'STATE_LICENSE',
    label: 'California License',
    severity: 'critical',
    metadata: { state: 'CA' },
  };

  it('parses an array of definitions', () => {
    const parsed = parseRequirementDefinitions([baseDefinition]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe('California License');
  });

  it('wraps single objects to maintain backwards compatibility', () => {
    const parsed = parseRequirementDefinitions(baseDefinition);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('state-license');
  });

  it('validates requirement types and throws on invalid payloads', () => {
    const invalidDefinition = { ...baseDefinition, type: 'FOO_BAR' };
    expect(() => parseRequirementDefinitions([invalidDefinition as any])).toThrow();
  });

  it('documents all supported requirement types', () => {
    expect(REQUIREMENT_TYPES).toEqual([
      'STATE_LICENSE',
      'DEA_REGISTRATION',
      'BOARD_CERTIFICATION',
      'PECOS_ENROLLMENT',
      'MALPRACTICE',
    ]);
  });
});

