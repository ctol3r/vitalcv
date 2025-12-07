import {
  buildPrivilegeNode,
  groupNodesBySpecialty,
  indexPrivilegeNodes,
  normalizePrivilegeCategory,
  normalizePrivilegeCode,
  PRIVILEGE_CATEGORIES,
} from '../PrivilegeNode';

describe('PrivilegeNode model', () => {
  const baseNode = {
    privilegeCode: ' art line placement ',
    name: 'Arterial Line Placement',
    category: 'procedural',
    description: 'Allows placement of arterial monitoring lines in major vessels.',
    specialty: 'Anesthesiology',
    tags: ['vascular', 'monitoring'],
  };

  it('normalizes privilege codes to uppercase kebab case', () => {
    expect(normalizePrivilegeCode('central line  placement')).toBe('CENTRAL-LINE-PLACEMENT');
  });

  it('accepts canonical categories and rejects invalid entries', () => {
    for (const category of PRIVILEGE_CATEGORIES) {
      expect(normalizePrivilegeCategory(category)).toBe(category);
    }

    expect(() => normalizePrivilegeCategory('research')).toThrow(/Invalid privilege category/);
  });

  it('builds a privilege node with normalized values', () => {
    const node = buildPrivilegeNode(baseNode);
    expect(node.privilegeCode).toBe('ART-LINE-PLACEMENT');
    expect(node.category).toBe('procedural');
    expect(node.tags).toEqual(['vascular', 'monitoring']);
  });

  it('throws when required fields are missing or invalid', () => {
    expect(() =>
      buildPrivilegeNode({
        ...baseNode,
        privilegeCode: 'x',
      }),
    ).toThrow(/privilegeCode/);
  });

  it('indexes nodes by privilege code and detects duplicates', () => {
    const node = buildPrivilegeNode(baseNode);
    const index = indexPrivilegeNodes([node]);
    expect(index.get('ART-LINE-PLACEMENT')).toEqual(node);
    expect(() => indexPrivilegeNodes([node, node])).toThrow(/Duplicate privilegeCode/);
  });

  it('groups nodes by specialty', () => {
    const anesthesiaNode = buildPrivilegeNode(baseNode);
    const generalSurgeryNode = buildPrivilegeNode({
      ...baseNode,
      privilegeCode: 'lap chole',
      name: 'Laparoscopic Cholecystectomy',
      specialty: 'General Surgery',
    });

    const grouped = groupNodesBySpecialty([anesthesiaNode, generalSurgeryNode]);
    expect(Object.keys(grouped)).toEqual(['Anesthesiology', 'General Surgery']);
    expect(grouped.Anesthesiology).toHaveLength(1);
  });
});

