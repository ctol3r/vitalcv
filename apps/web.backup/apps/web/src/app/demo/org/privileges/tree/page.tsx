'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeGraph, PrivilegeGraphLegend } from '@/components/privileges/PrivilegeGraph';
import {
  PRIVILEGE_NODES,
  PRIVILEGE_NODE_MAP,
  getAllPrerequisites,
  getDownstreamPrivileges,
  getPrivilegeByCode,
} from '@/data/privileges';

export default function PrivilegeTreeViewerPage() {
  const [selectedCode, setSelectedCode] = useState<string>('CARD-320');
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const selectedNode = useMemo(() => getPrivilegeByCode(selectedCode), [selectedCode]);
  const hoveredNode = useMemo(() => (hoveredCode ? getPrivilegeByCode(hoveredCode) : null), [hoveredCode]);

  const hoveredPrereqs = useMemo(() => (hoveredNode ? getAllPrerequisites(hoveredNode.code) : []), [hoveredNode]);

  const highlightSet = useMemo(() => {
    const set = new Set<string>();
    if (selectedNode) {
      set.add(selectedNode.code);
      getAllPrerequisites(selectedNode.code).forEach((code) => set.add(code));
      getDownstreamPrivileges(selectedNode.code).forEach((code) => set.add(code));
    }
    if (hoveredNode) {
      set.add(hoveredNode.code);
      hoveredPrereqs.forEach((code) => set.add(code));
    }
    return set;
  }, [selectedNode, hoveredNode, hoveredPrereqs]);

  const dependentCount = selectedNode ? getDownstreamPrivileges(selectedNode.code).length : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Privileges</p>
        <h1 className="text-3xl font-bold">Privilege Dependency Tree</h1>
        <p className="text-muted-foreground max-w-3xl">
          Interactive DAG showing seeded privileges, prerequisite chains, and downstream impact. Hover a node to reveal
          required steps; click to pin details for committee packets or remediation planners.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Privilege Map</CardTitle>
            <CardDescription>Directed edges represent prerequisite relationships.</CardDescription>
          </div>
          <PrivilegeGraphLegend />
        </CardHeader>
        <CardContent className="space-y-4">
          <PrivilegeGraph
            nodes={PRIVILEGE_NODES}
            selectedCode={selectedNode?.code}
            highlightedNodes={highlightSet}
            dimUnselected
            onSelect={(node) => setSelectedCode(node.code)}
            onHover={(node) => setHoveredCode(node?.code ?? null)}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Quick select:</span>
            {['CARD-320', 'STRUCT-410', 'ROBOT-500', 'PED-260', 'HYBRID-720'].map((code) => (
              <Button
                key={code}
                variant={selectedCode === code ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCode(code)}
              >
                {code}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {selectedNode ? (
                <>
                  <span className="text-muted-foreground">Selected</span>
                  <Badge variant="secondary">{selectedNode.code}</Badge>
                </>
              ) : (
                'Select a privilege'
              )}
            </CardTitle>
            {selectedNode && <CardDescription>{selectedNode.name}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedNode ? (
              <p className="text-sm text-muted-foreground">
                Choose any node on the graph to inspect its prerequisites, remediation links, and impact radius.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Risk: {selectedNode.risk.toUpperCase()}</Badge>
                  <Badge variant="outline">Prereqs: {selectedNode.prerequisites.length}</Badge>
                  <Badge variant="outline">Dependents: {dependentCount}</Badge>
                </div>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Prerequisites</h3>
                  {selectedNode.prerequisites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upstream requirements recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedNode.prerequisites.map((code) => (
                        <li key={code} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{code}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCode(code)}
                            >
                              Drill into chain
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {PRIVILEGE_NODE_MAP.get(code)?.description || 'Refer to matrix entry'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Remediation actions</h3>
                  {selectedNode.remediationActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No remediation shortcuts configured.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.remediationActions.map((action) => (
                        <Button
                          key={action.label}
                          asChild
                          size="sm"
                          variant={action.intent === 'training' ? 'default' : 'outline'}
                        >
                          <a href={action.href}>{action.label}</a>
                        </Button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hover focus</CardTitle>
            <CardDescription>Upstream prerequisites highlight as you explore nodes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hoveredNode ? (
              <p className="text-sm text-muted-foreground">
                Move your cursor over any node to preview prerequisite summaries.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{hoveredNode.code}</Badge>
                  <div>
                    <p className="font-medium leading-tight">{hoveredNode.name}</p>
                    <p className="text-xs text-muted-foreground">Requires {hoveredPrereqs.length} upstream steps</p>
                  </div>
                </div>
                {hoveredPrereqs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prerequisites.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {hoveredPrereqs.map((code) => (
                      <li key={code}>{PRIVILEGE_NODE_MAP.get(code)?.name ?? code}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


