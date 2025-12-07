import {
  buildPrivilegeDependency,
  dedupeDependencies,
  dependencyKey,
  PRIVILEGE_DEPENDENCY_TYPES,
} from '../PrivilegeDependency';

describe('PrivilegeDependency model', () => {
  const baseEdge = {
    parentPrivilegeCode: 'basic sedation',
    childPrivilegeCode: 'arterial line placement',
    dependencyType: 'REQUIRES',
    rationale: 'Sedation competence is required prior to invasive monitoring procedures.',
  };

  it('normalizes privilege codes when building dependencies', () => {
    const dependency = buildPrivilegeDependency(baseEdge);
    expect(dependency.parentPrivilegeCode).toBe('BASIC-SEDATION');
    expect(dependency.childPrivilegeCode).toBe('ARTERIAL-LINE-PLACEMENT');
  });

  it('rejects dependencies where parent equals child', () => {
    expect(() =>
      buildPrivilegeDependency({
        ...baseEdge,
        childPrivilegeCode: 'basic sedation',
      }),
    ).toThrow(/cannot depend on itself/);
  });

  it('validates dependency types', () => {
    expect(PRIVILEGE_DEPENDENCY_TYPES).toContain('CONFLICTS_WITH');
  });

  it('dedupes dependencies using keys', () => {
    const first = buildPrivilegeDependency(baseEdge);
    const duplicate = buildPrivilegeDependency({
      ...baseEdge,
      rationale: 'updated',
    });

    const deduped = dedupeDependencies([first, duplicate]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].rationale).toBe('updated');
    expect(dependencyKey(first)).toContain('BASIC-SEDATION');
  });
});

