'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PrivilegeGraph } from '@/components/privileges/PrivilegeGraph';
import {
  PRIVILEGE_CONFLICTS,
  PRIVILEGE_NODES,
  getAllPrerequisites,
  getDownstreamPrivileges,
  getPrerequisiteEdges,
  type PrivilegeConflict,
  type PrivilegeNode,
} from '@/data/privileges';
import { cn } from '@/lib/utils';

const DEFAULT_NODE: Omit<PrivilegeNode, 'level' | 'lane'> & { level: number | ''; lane: number | '' } = {
  code: '',
  name: '',
  description: '',
  category: 'core',
  level: '',
  lane: '',
  risk: 'moderate',
  prerequisites: [],
  remediationActions: [],
};

export default function PrivilegeDependencyEditorPage() {
  const [nodes, setNodes] = useState<PrivilegeNode[]>(PRIVILEGE_NODES);
  const [conflicts, setConflicts] = useState<PrivilegeConflict[]>(PRIVILEGE_CONFLICTS);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [nodeForm, setNodeForm] = useState(() => ({ ...DEFAULT_NODE }));
  const [nodePrereqs, setNodePrereqs] = useState<string>('');
  const [dependencyForm, setDependencyForm] = useState({ prerequisite: '', target: '' });
  const [conflictForm, setConflictForm] = useState({ source: '', target: '', reason: '', severity: 'warning' as const });
  const [toast, setToast] = useState<string | null>(null);

  const highlightSet = useMemo(() => {
    if (!selectedCode) return undefined;
    const set = new Set<string>([selectedCode]);
    getAllPrerequisites(selectedCode, nodes).forEach((code) => set.add(code));
    getDownstreamPrivileges(selectedCode, nodes).forEach((code) => set.add(code));
    return set;
  }, [selectedCode, nodes]);

  const serializedSeed = useMemo(
    () =>
      JSON.stringify(
        {
          nodes,
          conflicts,
        },
        null,
        2,
      ),
    [nodes, conflicts],
  );

  const graphSummary = useMemo(() => {
    const edges = getPrerequisiteEdges(nodes);
    return {
      nodes: nodes.length,
      edges: edges.length,
    };
  }, [nodes]);

  const handleNodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nodeForm.code || !nodeForm.name) return;
    if (nodes.some((node) => node.code === nodeForm.code)) {
      setToast(`Node ${nodeForm.code} already exists.`);
      return;
    }
    const prerequisites = nodePrereqs
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const nextNode: PrivilegeNode = {
      ...nodeForm,
      code: nodeForm.code.toUpperCase(),
      prerequisites,
      level: Number(nodeForm.level) || 0,
      lane: Number(nodeForm.lane) || 0,
      remediationActions: [],
    };
    setNodes((current) => [...current, nextNode]);
    setNodeForm({ ...DEFAULT_NODE });
    setNodePrereqs('');
    setToast(`Added ${nextNode.code}`);
  };

  const handleDependencySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { prerequisite, target } = dependencyForm;
    if (!prerequisite || !target || prerequisite === target) return;
    if (!nodes.some((node) => node.code === prerequisite) || !nodes.some((node) => node.code === target)) {
      setToast('Both nodes must exist.');
      return;
    }
    if (wouldCreateCycle(nodes, prerequisite, target)) {
      setToast('Dependency rejected: would create a cycle.');
      return;
    }
    setNodes((current) =>
      current.map((node) =>
        node.code === target && !node.prerequisites.includes(prerequisite)
          ? { ...node, prerequisites: [...node.prerequisites, prerequisite] }
          : node,
      ),
    );
    setToast(`Linked ${prerequisite} → ${target}`);
  };

  const handleConflictSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { source, target, reason, severity } = conflictForm;
    if (!source || !target || !reason) return;
    const conflict: PrivilegeConflict = {
      id: `conflict-${source}-${target}-${conflicts.length + 1}`,
      privileges: [source, target],
      reason,
      source: 'Admin Console',
      severity,
    };
    setConflicts((current) => [...current, conflict]);
    setConflictForm({ source: '', target: '', reason: '', severity: 'warning' });
    setToast('Conflict saved.');
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Privileges</p>
        <h1 className="text-3xl font-bold">Privilege Dependency Editor</h1>
        <p className="text-muted-foreground max-w-3xl">
          Admin-only workspace to experiment with privilege seed data, enforce DAG constraints, and export updated graph
          JSON for pipelines.
        </p>
      </div>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{toast}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Graph preview</CardTitle>
              <CardDescription>{graphSummary.nodes} nodes · {graphSummary.edges} edges</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(serializedSeed)}>
                Copy seed JSON
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNodes(PRIVILEGE_NODES);
                  setConflicts(PRIVILEGE_CONFLICTS);
                  setSelectedCode(null);
                  setToast('Seed reset to defaults.');
                }}
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <PrivilegeGraph
              nodes={nodes}
              selectedCode={selectedCode ?? undefined}
              highlightedNodes={highlightSet}
              dimUnselected
              onSelect={(node) => setSelectedCode(node.code)}
            />
            {selectedCode && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-semibold">{selectedCode}</p>
                <p className="text-xs text-muted-foreground">
                  {getAllPrerequisites(selectedCode, nodes).length} prerequisites ·{' '}
                  {getDownstreamPrivileges(selectedCode, nodes).length} dependents
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add node</CardTitle>
              <CardDescription>Assign level/lanes to control DAG layout.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleNodeSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Code (e.g., NEW-001)"
                    value={nodeForm.code}
                    onChange={(event) => setNodeForm((prev) => ({ ...prev, code: event.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Name"
                    value={nodeForm.name}
                    onChange={(event) => setNodeForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <Input
                  placeholder="Description"
                  value={nodeForm.description}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    className="rounded-md border px-3 py-2 text-sm"
                    value={nodeForm.category}
                    onChange={(event) =>
                      setNodeForm((prev) => ({ ...prev, category: event.target.value as PrivilegeNode['category'] }))
                    }
                  >
                    {['baseline', 'core', 'sedation', 'imaging', 'cardiology', 'structural', 'robotics', 'pediatric'].map(
                      (category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ),
                    )}
                  </select>
                  <Input
                    type="number"
                    placeholder="Level"
                    value={nodeForm.level}
                    onChange={(event) =>
                      setNodeForm((prev) => ({
                        ...prev,
                        level: event.target.value === '' ? '' : Number(event.target.value),
                      }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Lane"
                    value={nodeForm.lane}
                    onChange={(event) =>
                      setNodeForm((prev) => ({
                        ...prev,
                        lane: event.target.value === '' ? '' : Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <Input
                  placeholder="Comma separated prerequisites"
                  value={nodePrereqs}
                  onChange={(event) => setNodePrereqs(event.target.value)}
                />
                <Button type="submit" className="w-full">
                  Add node
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add dependency</CardTitle>
              <CardDescription>Validates DAG before saving.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleDependencySubmit}>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={dependencyForm.prerequisite}
                  onChange={(event) =>
                    setDependencyForm((prev) => ({ ...prev, prerequisite: event.target.value }))
                  }
                >
                  <option value="">Select prerequisite</option>
                  {nodes.map((node) => (
                    <option key={node.code} value={node.code}>
                      {node.code}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={dependencyForm.target}
                  onChange={(event) => setDependencyForm((prev) => ({ ...prev, target: event.target.value }))}
                >
                  <option value="">Select dependent</option>
                  {nodes.map((node) => (
                    <option key={node.code} value={node.code}>
                      {node.code}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="w-full" variant="secondary">
                  Link nodes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conflict registry</CardTitle>
              <CardDescription>Mark mutually exclusive privileges.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleConflictSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="rounded-md border px-3 py-2 text-sm"
                    value={conflictForm.source}
                    onChange={(event) => setConflictForm((prev) => ({ ...prev, source: event.target.value }))}
                  >
                    <option value="">Privilege A</option>
                    {nodes.map((node) => (
                      <option key={node.code} value={node.code}>
                        {node.code}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border px-3 py-2 text-sm"
                    value={conflictForm.target}
                    onChange={(event) => setConflictForm((prev) => ({ ...prev, target: event.target.value }))}
                  >
                    <option value="">Privilege B</option>
                    {nodes.map((node) => (
                      <option key={node.code} value={node.code}>
                        {node.code}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  placeholder="Conflict reason"
                  value={conflictForm.reason}
                  onChange={(event) => setConflictForm((prev) => ({ ...prev, reason: event.target.value }))}
                />
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={conflictForm.severity}
                  onChange={(event) =>
                    setConflictForm((prev) => ({ ...prev, severity: event.target.value as PrivilegeConflict['severity'] }))
                  }
                >
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
                <Button type="submit" className="w-full" variant="destructive">
                  Save conflict
                </Button>
              </form>

              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-sm text-foreground">Active conflicts</p>
                <ul className="mt-2 space-y-1">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id} className="flex items-center justify-between gap-2">
                      <span>
                        {conflict.privileges.join(' ⟷ ')}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          conflict.severity === 'critical'
                            ? 'border-red-300 text-red-700'
                            : 'border-amber-300 text-amber-700',
                        )}
                      >
                        {conflict.severity}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seed preview</CardTitle>
          <CardDescription>Copy/paste into seed script after validation.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
            {serializedSeed}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function wouldCreateCycle(nodes: PrivilegeNode[], source: string, target: string) {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => {
    node.prerequisites.forEach((prereq) => {
      const list = adjacency.get(prereq) ?? [];
      list.push(node.code);
      adjacency.set(prereq, list);
    });
  });
  const list = adjacency.get(source) ?? [];
  list.push(target);
  adjacency.set(source, list);

  return hasPath(target, source, adjacency);
}

function hasPath(start: string, goal: string, adjacency: Map<string, string[]>) {
  const stack = [start];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === goal) return true;
    seen.add(current);
    (adjacency.get(current) ?? []).forEach((next) => stack.push(next));
  }
  return false;
}


