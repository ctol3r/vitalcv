import { PrivilegeGraphBuilder, exportAdjacencyLists } from '../buildGraph';
import { buildPrivilegeNode } from '../models/PrivilegeNode';
import { buildPrivilegeDependency } from '../models/PrivilegeDependency';

const nodes = [
  buildPrivilegeNode({
    privilegeCode: 'basic sedation',
    name: 'Basic Sedation',
    category: 'procedural',
    description: 'Performs moderate sedation with standard monitoring.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'airway management',
    name: 'Advanced Airway Management',
    category: 'procedural',
    description: 'Manages difficult airways including video laryngoscopy.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'arterial line placement',
    name: 'Arterial Line Placement',
    category: 'diagnostic',
    description: 'Places radial or femoral arterial lines for hemodynamic monitoring.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'central line',
    name: 'Central Venous Catheterization',
    category: 'procedural',
    description: 'Places internal jugular or subclavian central venous catheters.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'vascular access advanced',
    name: 'Advanced Vascular Access',
    category: 'surgical',
    description: 'Performs tunneled or advanced access procedures.',
    specialty: 'Anesthesiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'cardiac cath adult',
    name: 'Adult Cardiac Catheterization',
    category: 'diagnostic',
    description: 'Performs diagnostic cardiac cath procedures.',
    specialty: 'Cardiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'ep study',
    name: 'Electrophysiology Study',
    category: 'diagnostic',
    description: 'Performs invasive EP studies.',
    specialty: 'Cardiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'pacemaker implant',
    name: 'Pacemaker Implantation',
    category: 'procedural',
    description: 'Implants single and dual-chamber pacemakers.',
    specialty: 'Cardiology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'upper endoscopy',
    name: 'Upper Endoscopy',
    category: 'diagnostic',
    description: 'Performs EGD with biopsy.',
    specialty: 'Gastroenterology',
  }),
  buildPrivilegeNode({
    privilegeCode: 'colonoscopy',
    name: 'Colonoscopy',
    category: 'diagnostic',
    description: 'Performs colonoscopy with polypectomy.',
    specialty: 'Gastroenterology',
  }),
];

const dependencies = [
  buildPrivilegeDependency({
    parentPrivilegeCode: 'basic sedation',
    childPrivilegeCode: 'airway management',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'airway management',
    childPrivilegeCode: 'arterial line placement',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'arterial line placement',
    childPrivilegeCode: 'central line',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'central line',
    childPrivilegeCode: 'vascular access advanced',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'basic sedation',
    childPrivilegeCode: 'cardiac cath adult',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'cardiac cath adult',
    childPrivilegeCode: 'ep study',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'ep study',
    childPrivilegeCode: 'pacemaker implant',
    dependencyType: 'ENHANCES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'basic sedation',
    childPrivilegeCode: 'upper endoscopy',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'upper endoscopy',
    childPrivilegeCode: 'colonoscopy',
    dependencyType: 'REQUIRES',
  }),
  buildPrivilegeDependency({
    parentPrivilegeCode: 'airway management',
    childPrivilegeCode: 'cardiac cath adult',
    dependencyType: 'ENHANCES',
  }),
];

describe('PrivilegeGraphBuilder', () => {
  it('builds adjacency lists and topological order for multi-specialty graph', () => {
    const builder = new PrivilegeGraphBuilder(nodes, dependencies);
    const graph = builder.build();
    const exportResult = exportAdjacencyLists(graph);

    expect(exportResult.unlocks['BASIC-SEDATION']).toHaveLength(3);
    expect(exportResult.prerequisites['PACEMAKER-IMPLANT'].map((edge) => edge.code)).toContain('EP-STUDY');
    expect(graph.topologicalOrder).toHaveLength(nodes.length);
    expect(graph.topologicalOrder[0]).toBe('BASIC-SEDATION');
  });

  it('throws when a cycle is introduced', () => {
    const cyclicBuilder = new PrivilegeGraphBuilder(nodes, [
      ...dependencies,
      buildPrivilegeDependency({
        parentPrivilegeCode: 'vascular access advanced',
        childPrivilegeCode: 'basic sedation',
        dependencyType: 'REQUIRES',
      }),
    ]);

    expect(() => cyclicBuilder.build()).toThrow(/cycle/);
  });

  it('throws when dependency references unknown nodes', () => {
    const invalidBuilder = new PrivilegeGraphBuilder(nodes, [
      ...dependencies,
      buildPrivilegeDependency({
        parentPrivilegeCode: 'nonexistent',
        childPrivilegeCode: 'colonoscopy',
        dependencyType: 'REQUIRES',
      }),
    ]);

    expect(() => invalidBuilder.build()).toThrow(/unknown privilege code/);
  });
});

