import { describe, expect, it } from '@jest/globals';
import { PrivilegeGraphBuilder } from '../../privyDep/buildGraph';
import { buildPrivilegeNode } from '../../privyDep/models/PrivilegeNode';
import { buildPrivilegeDependency } from '../../privyDep/models/PrivilegeDependency';
import { RestrictionEngine } from '../restrictionEngine';
import { PrivilegeSafetyStateValue, SafetySignalSeverity } from '@prisma/client';

const nodes = [
  buildPrivilegeNode({
    privilegeCode: 'core sedation',
    name: 'Core Sedation',
    category: 'procedural',
    description: 'Performs moderate sedation.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'advanced airway',
    name: 'Advanced Airway',
    category: 'procedural',
    description: 'Manages difficult airways.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'vascular access advanced',
    name: 'Vascular Advanced',
    category: 'procedural',
    description: 'Advanced vascular access.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'conflict scope',
    name: 'Conflict Scope',
    category: 'diagnostic',
    description: 'Endoscopy variant',
    specialty: 'Gastroenterology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'conflict laser',
    name: 'Conflict Laser',
    category: 'diagnostic',
    description: 'Laser procedure',
    specialty: 'Gastroenterology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'solo procedure',
    name: 'Solo Procedure',
    category: 'diagnostic',
    description: 'Standalone procedure',
    specialty: 'Dermatology',
  }),
];

const dependencies = [
  buildPrivilegeDependency({
    parentPrivilegeCode: 'core sedation',
    childPrivilegeCode: 'advanced airway',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'advanced airway',
    childPrivilegeCode: 'vascular access advanced',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'core sedation',
    childPrivilegeCode: 'conflict scope',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'conflict scope',
    childPrivilegeCode: 'conflict laser',
    dependencyType: 'MUTUALLY_EXCLUSIVE',
  }),
];

const graph = new PrivilegeGraphBuilder(nodes, dependencies).build();

function evaluate(signals: Parameters<RestrictionEngine['evaluate']>[0]['signals'], overrides?: Partial<Parameters<RestrictionEngine['evaluate']>[0]>) {
  const engine = new RestrictionEngine();
  return engine.evaluate({
    graph,
    signals,
    ...(overrides ?? {}),
  });
}

describe('RestrictionEngine', () => {
  it('applies severity mapping for direct signals', () => {
    const [decision] = evaluate([
      {
        id: 'sig-1',
        privilegeCodes: ['core sedation'],
        severity: SafetySignalSeverity.CRITICAL,
        reasonCode: 'SAFETY:CRIT',
        source: 'autoHold',
      },
    ]);

    expect(decision.state).toBe(PrivilegeSafetyStateValue.HOLD);
    expect(decision.triggeredBy).toBe('DIRECT');
  });

  it('cascades along REQUIRES dependencies with recorded scope', () => {
    const decisions = evaluate([
      {
        id: 'sig-2',
        privilegeCodes: ['advanced airway'],
        severity: SafetySignalSeverity.HIGH,
        reasonCode: 'SAFETY:HIGH',
        source: 'autoHold',
      },
    ]);

    const vascular = decisions.find((entry) => entry.privilegeCode === 'VASCULAR-ACCESS-ADVANCED');
    expect(vascular).toBeDefined();
    expect(vascular?.triggeredBy).toBe('CASCADE');
    expect(vascular?.cascadeScope?.[0].path).toEqual([
      'ADVANCED-AIRWAY',
      'VASCULAR-ACCESS-ADVANCED',
    ]);
  });

  it('respects existing states and avoids downgrades', () => {
    const decisions = evaluate(
      [
        {
          id: 'sig-3',
          privilegeCodes: ['core sedation'],
          severity: SafetySignalSeverity.MEDIUM,
          reasonCode: 'SAFETY:MED',
          source: 'drift',
        },
      ],
      {
        existingStates: {
          'core sedation': PrivilegeSafetyStateValue.SUSPENDED,
        },
      },
    );

    expect(decisions.length).toBe(0);
  });

  it('merges multiple signals and keeps highest severity', () => {
    const decisions = evaluate([
      {
        id: 'sig-4a',
        privilegeCodes: ['solo procedure'],
        severity: SafetySignalSeverity.MEDIUM,
        reasonCode: 'SAFETY:WARN',
        source: 'engine',
      },
      {
        id: 'sig-4b',
        privilegeCodes: ['solo procedure'],
        severity: SafetySignalSeverity.HIGH,
        reasonCode: 'SAFETY:HIGH',
        source: 'engine',
      },
    ]);

    expect(decisions[0].state).toBe(PrivilegeSafetyStateValue.RESTRICTED);
    expect(decisions[0].signalIds).toEqual(expect.arrayContaining(['sig-4a', 'sig-4b']));
  });

  it('downgrades conflicts into pending review states', () => {
    const decisions = evaluate([
      {
        id: 'sig-5',
        privilegeCodes: ['conflict scope'],
        severity: SafetySignalSeverity.HIGH,
        reasonCode: 'SAFETY:CONFLICT',
        source: 'engine',
      },
    ]);

    const peer = decisions.find((entry) => entry.privilegeCode === 'CONFLICT-LASER');
    expect(peer?.state).toBe(PrivilegeSafetyStateValue.PENDING_REVIEW);
    expect(peer?.triggeredBy).toBe('CONFLICT');
  });

  it('supports severity override configuration', () => {
    const engine = new RestrictionEngine({
      severityToState: {
        HIGH: PrivilegeSafetyStateValue.SUSPENDED,
      },
    });

    const decisions = engine.evaluate({
      graph,
      signals: [
        {
          id: 'sig-6',
          privilegeCodes: ['solo procedure'],
          severity: SafetySignalSeverity.HIGH,
          reasonCode: 'SAFETY:OVERRIDE',
          source: 'engine',
        },
      ],
    });

    expect(decisions[0].state).toBe(PrivilegeSafetyStateValue.SUSPENDED);
  });

  it('ignores signals that resolve to FULL state', () => {
    const decisions = evaluate([
      {
        id: 'sig-7',
        privilegeCodes: ['solo procedure'],
        severity: SafetySignalSeverity.LOW,
        reasonCode: 'SAFETY:INFO',
        source: 'engine',
      },
    ]);

    expect(decisions).toHaveLength(0);
  });

  it('handles privileges missing from graph gracefully', () => {
    const decisions = evaluate([
      {
        id: 'sig-8',
        privilegeCodes: ['untracked privilege'],
        severity: SafetySignalSeverity.CRITICAL,
        reasonCode: 'SAFETY:CRIT',
        source: 'engine',
      },
    ]);

    expect(decisions[0].privilegeCode).toBe('UNTRACKED-PRIVILEGE');
  });

  it('preserves metadata from signals', () => {
    const decisions = evaluate([
      {
        id: 'sig-9',
        privilegeCodes: ['solo procedure'],
        severity: SafetySignalSeverity.HIGH,
        reasonCode: 'SAFETY:HIGH',
        source: 'engine',
        metadata: { pattern: 'low-volume' },
        summary: 'Low volume trend detected',
      },
    ]);

    expect(decisions[0].metadata).toMatchObject({ pattern: 'low-volume', summary: 'Low volume trend detected' });
  });

  it('sorts decisions by severity weight', () => {
    const decisions = evaluate([
      {
        id: 'sig-10a',
        privilegeCodes: ['core sedation'],
        severity: SafetySignalSeverity.MEDIUM,
        reasonCode: 'SAFETY:MED',
        source: 'engine',
      },
      {
        id: 'sig-10b',
        privilegeCodes: ['solo procedure'],
        severity: SafetySignalSeverity.CRITICAL,
        reasonCode: 'SAFETY:CRIT',
        source: 'engine',
      },
    ]);

    expect(decisions[0].privilegeCode).toBe('SOLO-PROCEDURE');
  });

  it('propagates conflicts symmetrically between peers', () => {
    const decisions = evaluate([
      {
        id: 'sig-11',
        privilegeCodes: ['conflict laser'],
        severity: SafetySignalSeverity.HIGH,
        reasonCode: 'SAFETY:HIGH',
        source: 'engine',
      },
    ]);

    const peer = decisions.find((entry) => entry.privilegeCode === 'CONFLICT-SCOPE');
    expect(peer).toBeDefined();
    expect(peer?.triggeredBy).toBe('CONFLICT');
  });

  it('propagates cascades through multi-hop chains', () => {
    const decisions = evaluate([
      {
        id: 'sig-12',
        privilegeCodes: ['core sedation'],
        severity: SafetySignalSeverity.CRITICAL,
        reasonCode: 'SAFETY:CRIT',
        source: 'engine',
      },
    ]);

    const downstream = decisions.find((entry) => entry.privilegeCode === 'VASCULAR-ACCESS-ADVANCED');
    expect(downstream).toBeDefined();
    expect(downstream?.cascadeScope?.[0].path).toEqual([
      'CORE-SEDATION',
      'ADVANCED-AIRWAY',
      'VASCULAR-ACCESS-ADVANCED',
    ]);
  });
});

