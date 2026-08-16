/**
 * TrustSpec 0.1 validation fixtures (PTC Wave P1).
 *
 * Everything in this file is SYNTHETIC: organizations, specs, requirements,
 * and source IDs describe no real institution, person, or capability. The
 * fixtures exist to prove the validator's rules, red and green:
 *
 * - `INVALID_TRUST_SPEC_FIXTURES` carries at least one fixture per validation
 *   error code, and each fixture's `expectedErrorCodes` is the EXACT set of
 *   distinct codes the validator must emit for it — the test suite asserts
 *   set equality, so a silently retired rule turns its fixture red.
 * - `VALID_TRUST_SPEC_FIXTURES` must validate with zero errors.
 *
 * Fixture field names follow the golden-fixture contract in
 * docs/trust-computing/PTC_DEMO1_EXECUTION_PLAN.md (fixtureId, description,
 * inputTrustSpec).
 */

import type {
  TrustSpec,
  TrustSpecCondition,
  TrustSpecValidationErrorCode,
} from '../trustSpec';

export interface TrustSpecValidationFixture {
  readonly fixtureId: string;
  readonly description: string;
  readonly inputTrustSpec: unknown;
  /** Exact set of distinct error codes the validator must produce. */
  readonly expectedErrorCodes: readonly TrustSpecValidationErrorCode[];
}

// ---------------------------------------------------------------------------
// Builders (plain data; no clock, no randomness)
// ---------------------------------------------------------------------------

function baseSpec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '0.1',
    specId: 'spec-synthetic-hospital-a',
    specVersion: 1,
    organizationKey: 'org-synthetic-a',
    title: 'Synthetic Hospital A registered-nurse policy',
    requirements: [
      {
        requirementId: 'req-license',
        label: 'Active state license on file',
        necessity: 'mandatory',
        condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'licensure' },
        dependsOn: [],
      },
    ],
    ...overrides,
  };
}

function requirement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requirementId: 'req-license',
    label: 'Active state license on file',
    necessity: 'mandatory',
    condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'licensure' },
    dependsOn: [],
    ...overrides,
  };
}

function nestNot(inner: Record<string, unknown>, times: number): Record<string, unknown> {
  let node = inner;
  for (let i = 0; i < times; i += 1) {
    node = { operator: 'NOT', condition: node };
  }
  return node;
}

/** A NOT node whose child is itself — an in-memory object cycle. */
function selfReferentialCondition(): Record<string, unknown> {
  const node: Record<string, unknown> = { operator: 'NOT' };
  node['condition'] = node;
  return node;
}

// ---------------------------------------------------------------------------
// Valid fixtures
// ---------------------------------------------------------------------------

const EVERY_OPERATOR_CONDITION: TrustSpecCondition = {
  operator: 'ALL_OF',
  conditions: [
    { operator: 'EVIDENCE_EXISTS', evidenceClass: 'licensure' },
    { operator: 'JURISDICTION_EQUALS', jurisdiction: 'CA' },
    { operator: 'FRESH_WITHIN', maxAgeHours: 720 },
    { operator: 'SOURCE_IN', sourceIds: ['synthetic-board.primary', 'synthetic-board.mirror'] },
    {
      operator: 'ANY_OF',
      conditions: [
        { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
        { operator: 'VALUE_IN', fieldPath: 'status', allowed: ['active_with_conditions'] },
      ],
    },
    { operator: 'NOT', condition: { operator: 'VALUE_EQUALS', fieldPath: 'restriction', expected: true } },
  ],
};

export const VALID_TRUST_SPEC_FIXTURES: readonly TrustSpecValidationFixture[] = [
  {
    fixtureId: 'V001_MINIMAL',
    description: 'smallest valid spec: one mandatory EVIDENCE_EXISTS requirement',
    inputTrustSpec: baseSpec(),
    expectedErrorCodes: [],
  },
  {
    fixtureId: 'V002_EVERY_OPERATOR',
    description: 'every TrustSpec 0.1 operator appears in a valid spec, with an acyclic dependency chain',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          requirementId: 'req-license-current',
          label: 'Current unrestricted CA license',
          condition: EVERY_OPERATOR_CONDITION,
          dependsOn: [],
        }),
        requirement({
          requirementId: 'req-experience',
          label: 'Two decision-grade employment records',
          necessity: 'preferred',
          condition: { operator: 'COUNT_AT_LEAST', evidenceClass: 'employment', minimumCount: 2 },
          dependsOn: ['req-license-current'],
        }),
        requirement({
          requirementId: 'req-committee-review',
          label: 'Institution committee review',
          condition: { operator: 'MANUAL_REVIEW', note: 'Synthetic committee must review the packet' },
          dependsOn: ['req-license-current', 'req-experience'],
        }),
      ],
    }),
    expectedErrorCodes: [],
  },
  {
    fixtureId: 'V003_DEEP_BUT_LEGAL',
    description: 'condition nested to exactly the maximum depth is accepted',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: nestNot({ operator: 'EVIDENCE_EXISTS', evidenceClass: 'identity' }, 31),
        }),
      ],
    }),
    expectedErrorCodes: [],
  },
  {
    fixtureId: 'V004_NOT_WITHOUT_CONTRADICTION',
    description: 'NOT alongside predicates on other fields is not a contradiction',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              { operator: 'NOT', condition: { operator: 'VALUE_EQUALS', fieldPath: 'restriction', expected: true } },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: [],
  },
  {
    fixtureId: 'V005_P_AND_NOT_P_UNDER_ANY_OF',
    description: 'P and NOT(P) as ANY_OF children is a tautology, not a contradiction',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ANY_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              { operator: 'NOT', condition: { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' } },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: [],
  },
  {
    fixtureId: 'V006_VALUE_IN_CONTAINING_EQUALS',
    description: 'VALUE_EQUALS whose literal IS in the sibling VALUE_IN set is consistent',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              { operator: 'VALUE_IN', fieldPath: 'status', allowed: ['active', 'active_with_conditions'] },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: [],
  },
];

// A typed valid spec, proving the contract types compile as authored values.
export const TYPED_VALID_SPEC: TrustSpec = {
  schemaVersion: '0.1',
  specId: 'spec-synthetic-hospital-b',
  specVersion: 2,
  organizationKey: 'org-synthetic-b',
  title: 'Synthetic Hospital B typed policy',
  requirements: [
    {
      requirementId: 'req-identity',
      label: 'Identity evidence exists',
      necessity: 'mandatory',
      condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'identity' },
      dependsOn: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Invalid fixtures — one (or more) per validation error code.
// expectedErrorCodes is the EXACT distinct-code set for the fixture.
// ---------------------------------------------------------------------------

export const INVALID_TRUST_SPEC_FIXTURES: readonly TrustSpecValidationFixture[] = [
  {
    fixtureId: 'I001_SPEC_NOT_AN_OBJECT',
    description: 'candidate is not an object at all',
    inputTrustSpec: 'not-a-trust-spec',
    expectedErrorCodes: ['SPEC_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I002_SPEC_UNEXPECTED_KEY',
    description: 'unknown top-level key is fail-closed rejected',
    inputTrustSpec: baseSpec({ acceptanceGuarantee: true }),
    expectedErrorCodes: ['SPEC_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I003_SCHEMA_VERSION_UNKNOWN',
    description: 'unknown schema version fails closed',
    inputTrustSpec: baseSpec({ schemaVersion: '0.2' }),
    expectedErrorCodes: ['SCHEMA_VERSION_UNSUPPORTED'],
  },
  {
    fixtureId: 'I004_SPEC_ID_MALFORMED',
    description: 'spec ID with whitespace is malformed',
    inputTrustSpec: baseSpec({ specId: 'spec with spaces' }),
    expectedErrorCodes: ['SPEC_ID_MALFORMED'],
  },
  {
    fixtureId: 'I005_SPEC_VERSION_ZERO',
    description: 'non-positive spec version rejects',
    inputTrustSpec: baseSpec({ specVersion: 0 }),
    expectedErrorCodes: ['SPEC_VERSION_NOT_POSITIVE_INTEGER'],
  },
  {
    fixtureId: 'I006_SPEC_VERSION_FRACTIONAL',
    description: 'fractional spec version rejects',
    inputTrustSpec: baseSpec({ specVersion: 1.5 }),
    expectedErrorCodes: ['SPEC_VERSION_NOT_POSITIVE_INTEGER'],
  },
  {
    fixtureId: 'I007_ORGANIZATION_KEY_EMPTY',
    description: 'empty organization key rejects',
    inputTrustSpec: baseSpec({ organizationKey: '' }),
    expectedErrorCodes: ['ORGANIZATION_KEY_MALFORMED'],
  },
  {
    fixtureId: 'I008_TITLE_BLANK',
    description: 'whitespace-only title rejects',
    inputTrustSpec: baseSpec({ title: '   ' }),
    expectedErrorCodes: ['TITLE_EMPTY'],
  },
  {
    fixtureId: 'I009_REQUIREMENTS_EMPTY',
    description: 'a spec with zero requirements rejects',
    inputTrustSpec: baseSpec({ requirements: [] }),
    expectedErrorCodes: ['REQUIREMENTS_EMPTY'],
  },
  {
    fixtureId: 'I010_REQUIREMENT_NOT_AN_OBJECT',
    description: 'requirement entry is null',
    inputTrustSpec: baseSpec({ requirements: [null] }),
    expectedErrorCodes: ['REQUIREMENT_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I011_REQUIREMENT_UNEXPECTED_KEY',
    description: 'unknown requirement key is fail-closed rejected',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ autoAccept: true })],
    }),
    expectedErrorCodes: ['REQUIREMENT_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I012_REQUIREMENT_ID_MALFORMED',
    description: 'requirement ID starting with a separator is malformed',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ requirementId: '-req-license' })],
    }),
    expectedErrorCodes: ['REQUIREMENT_ID_MALFORMED'],
  },
  {
    fixtureId: 'I013_REQUIREMENT_ID_DUPLICATE',
    description: 'two requirements share an ID',
    inputTrustSpec: baseSpec({
      requirements: [requirement(), requirement()],
    }),
    expectedErrorCodes: ['REQUIREMENT_ID_DUPLICATE'],
  },
  {
    fixtureId: 'I014_REQUIREMENT_LABEL_EMPTY',
    description: 'empty requirement label rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ label: '' })],
    }),
    expectedErrorCodes: ['REQUIREMENT_LABEL_EMPTY'],
  },
  {
    fixtureId: 'I015_NECESSITY_UNKNOWN',
    description: 'necessity outside mandatory/preferred fails closed',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ necessity: 'optional' })],
    }),
    expectedErrorCodes: ['NECESSITY_UNKNOWN'],
  },
  {
    fixtureId: 'I016_DEPENDS_ON_NOT_ARRAY',
    description: 'dependsOn as a bare string is malformed',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ dependsOn: 'req-license' })],
    }),
    expectedErrorCodes: ['DEPENDENCY_MALFORMED'],
  },
  {
    fixtureId: 'I017_DEPENDENCY_MEMBER_MALFORMED',
    description: 'a dependency entry that is not a well-formed ID rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ dependsOn: [42] })],
    }),
    expectedErrorCodes: ['DEPENDENCY_MALFORMED'],
  },
  {
    fixtureId: 'I018_DEPENDENCY_DUPLICATE',
    description: 'the same dependency listed twice rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          requirementId: 'req-a',
          dependsOn: ['req-license', 'req-license'],
        }),
        requirement(),
      ],
    }),
    expectedErrorCodes: ['DEPENDENCY_DUPLICATE'],
  },
  {
    fixtureId: 'I019_DEPENDENCY_SELF',
    description: 'a requirement depending on itself rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ dependsOn: ['req-license'] })],
    }),
    expectedErrorCodes: ['DEPENDENCY_SELF'],
  },
  {
    fixtureId: 'I020_DEPENDENCY_UNRESOLVED',
    description: 'a dependency naming no requirement in the spec rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ dependsOn: ['req-ghost'] })],
    }),
    expectedErrorCodes: ['DEPENDENCY_UNRESOLVED'],
  },
  {
    fixtureId: 'I021_DEPENDENCY_CYCLE_PAIR',
    description: 'req-a -> req-b -> req-a is a cycle',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ requirementId: 'req-a', dependsOn: ['req-b'] }),
        requirement({ requirementId: 'req-b', dependsOn: ['req-a'] }),
      ],
    }),
    expectedErrorCodes: ['DEPENDENCY_CYCLE'],
  },
  {
    fixtureId: 'I022_DEPENDENCY_CYCLE_TRIANGLE',
    description: 'three-member dependency cycle rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ requirementId: 'req-a', dependsOn: ['req-b'] }),
        requirement({ requirementId: 'req-b', dependsOn: ['req-c'] }),
        requirement({ requirementId: 'req-c', dependsOn: ['req-a'] }),
      ],
    }),
    expectedErrorCodes: ['DEPENDENCY_CYCLE'],
  },
  {
    fixtureId: 'I023_CONDITION_NOT_AN_OBJECT',
    description: 'condition that is a number rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ condition: 42 })],
    }),
    expectedErrorCodes: ['CONDITION_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I024_CONDITION_UNEXPECTED_KEY',
    description: 'unknown key on a condition is fail-closed rejected',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'EVIDENCE_EXISTS',
            evidenceClass: 'licensure',
            autoVerify: true,
          },
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_SHAPE_INVALID'],
  },
  {
    fixtureId: 'I025_OPERATOR_UNKNOWN',
    description: 'an operator outside the 0.1 union fails closed',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'EVIDENCE_FRESH', evidenceClass: 'licensure' } }),
      ],
    }),
    expectedErrorCodes: ['OPERATOR_UNKNOWN'],
  },
  {
    fixtureId: 'I026_EVIDENCE_CLASS_UNKNOWN',
    description: 'an evidence class outside the canonical list rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'astrology' } }),
      ],
    }),
    expectedErrorCodes: ['EVIDENCE_CLASS_UNKNOWN'],
  },
  {
    fixtureId: 'I027_FIELD_PATH_MALFORMED',
    description: 'a field path with empty segments rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: { operator: 'VALUE_EQUALS', fieldPath: 'status..bad', expected: 'active' },
        }),
      ],
    }),
    expectedErrorCodes: ['FIELD_PATH_MALFORMED'],
  },
  {
    fixtureId: 'I028_VALUE_LITERAL_INVALID',
    description: 'an object as an expected literal rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: { nested: true } },
        }),
      ],
    }),
    expectedErrorCodes: ['VALUE_LITERAL_INVALID'],
  },
  {
    fixtureId: 'I029_VALUE_SET_EMPTY',
    description: 'VALUE_IN with an empty allowed set rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: { operator: 'VALUE_IN', fieldPath: 'status', allowed: [] },
        }),
      ],
    }),
    expectedErrorCodes: ['VALUE_SET_EMPTY'],
  },
  {
    fixtureId: 'I030_COUNT_ZERO',
    description: 'COUNT_AT_LEAST with a zero minimum rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: { operator: 'COUNT_AT_LEAST', evidenceClass: 'employment', minimumCount: 0 },
        }),
      ],
    }),
    expectedErrorCodes: ['COUNT_NOT_POSITIVE_INTEGER'],
  },
  {
    fixtureId: 'I031_SOURCE_SET_EMPTY',
    description: 'SOURCE_IN with no source IDs rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'SOURCE_IN', sourceIds: [] } }),
      ],
    }),
    expectedErrorCodes: ['SOURCE_SET_EMPTY'],
  },
  {
    fixtureId: 'I032_SOURCE_ID_MALFORMED',
    description: 'a source ID with surrounding whitespace rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'SOURCE_IN', sourceIds: [' synthetic-board '] } }),
      ],
    }),
    expectedErrorCodes: ['SOURCE_ID_MALFORMED'],
  },
  {
    fixtureId: 'I033_FRESHNESS_NEGATIVE',
    description: 'a negative freshness window rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'FRESH_WITHIN', maxAgeHours: -24 } }),
      ],
    }),
    expectedErrorCodes: ['FRESHNESS_WINDOW_INVALID'],
  },
  {
    fixtureId: 'I034_FRESHNESS_NOT_FINITE',
    description: 'an infinite freshness window rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'FRESH_WITHIN', maxAgeHours: Number.POSITIVE_INFINITY } }),
      ],
    }),
    expectedErrorCodes: ['FRESHNESS_WINDOW_INVALID'],
  },
  {
    fixtureId: 'I035_JURISDICTION_UNTRIMMED',
    description: 'a jurisdiction with surrounding whitespace rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({ condition: { operator: 'JURISDICTION_EQUALS', jurisdiction: ' CA ' } }),
      ],
    }),
    expectedErrorCodes: ['JURISDICTION_MALFORMED'],
  },
  {
    fixtureId: 'I036_ALL_OF_EMPTY',
    description: 'ALL_OF with zero children rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ condition: { operator: 'ALL_OF', conditions: [] } })],
    }),
    expectedErrorCodes: ['COMPOSITE_CHILDREN_EMPTY'],
  },
  {
    fixtureId: 'I037_ANY_OF_EMPTY',
    description: 'ANY_OF with zero children rejects',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ condition: { operator: 'ANY_OF', conditions: [] } })],
    }),
    expectedErrorCodes: ['COMPOSITE_CHILDREN_EMPTY'],
  },
  {
    fixtureId: 'I038_CONDITION_TOO_DEEP',
    description: 'condition nesting past the maximum depth rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: nestNot({ operator: 'EVIDENCE_EXISTS', evidenceClass: 'identity' }, 40),
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_DEPTH_EXCEEDED'],
  },
  {
    fixtureId: 'I039_CONDITION_OBJECT_CYCLE',
    description: 'a self-referential in-memory condition object rejects instead of recursing forever',
    inputTrustSpec: baseSpec({
      requirements: [requirement({ condition: selfReferentialCondition() })],
    }),
    expectedErrorCodes: ['CONDITION_CYCLE'],
  },
  {
    fixtureId: 'I040_CONTRADICTION_P_AND_NOT_P',
    description: 'VALUE_EQUALS x AND NOT(VALUE_EQUALS x) in one ALL_OF rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              { operator: 'NOT', condition: { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' } },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_CONTRADICTION'],
  },
  {
    fixtureId: 'I041_CONTRADICTION_TWO_EQUALS',
    description: 'VALUE_EQUALS with two different literals on one field in one ALL_OF rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'inactive' },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_CONTRADICTION'],
  },
  {
    fixtureId: 'I042_CONTRADICTION_EQUALS_EXCLUDED_BY_IN',
    description: 'VALUE_EQUALS literal excluded by a sibling VALUE_IN on the same field rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'revoked' },
              { operator: 'VALUE_IN', fieldPath: 'status', allowed: ['active', 'active_with_conditions'] },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_CONTRADICTION'],
  },
  {
    fixtureId: 'I043_CONTRADICTION_THROUGH_NESTED_ALL_OF',
    description: 'contradiction across nested ALL_OF conjunctive flattening rejects',
    inputTrustSpec: baseSpec({
      requirements: [
        requirement({
          condition: {
            operator: 'ALL_OF',
            conditions: [
              { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' },
              {
                operator: 'ALL_OF',
                conditions: [
                  { operator: 'EVIDENCE_EXISTS', evidenceClass: 'licensure' },
                  { operator: 'NOT', condition: { operator: 'VALUE_EQUALS', fieldPath: 'status', expected: 'active' } },
                ],
              },
            ],
          },
        }),
      ],
    }),
    expectedErrorCodes: ['CONDITION_CONTRADICTION'],
  },
];

/**
 * A structurally scattered multi-error fixture used by the deterministic-
 * ordering tests: errors appear in requirements 2 and 11 so numeric-aware
 * path ordering (2 before 11) is observable.
 */
export const MULTI_ERROR_ORDERING_FIXTURE: TrustSpecValidationFixture = {
  fixtureId: 'ORD001_SCATTERED_ERRORS',
  description: 'twelve requirements; defects at indexes 2 and 11 plus a bad title',
  inputTrustSpec: baseSpec({
    title: '',
    requirements: [
      ...Array.from({ length: 12 }, (_, i) =>
        requirement({ requirementId: `req-${String(i).padStart(2, '0')}` }),
      ),
    ].map((entry, i) => {
      if (i === 2) return { ...entry, necessity: 'optional' };
      if (i === 11) {
        return {
          ...entry,
          condition: { operator: 'FRESH_WITHIN', maxAgeHours: 0 },
        };
      }
      return entry;
    }),
  }),
  expectedErrorCodes: ['TITLE_EMPTY', 'NECESSITY_UNKNOWN', 'FRESHNESS_WINDOW_INVALID'],
};
