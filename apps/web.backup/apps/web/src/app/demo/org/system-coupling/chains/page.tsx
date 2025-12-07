'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, ArrowRight } from 'lucide-react';
import { DependencyChain } from '../../../../../components/systemCoupling/DependencyChain';
import { CouplingAlerts } from '../../../../../components/systemCoupling/CouplingAlerts';

interface ChainExample {
  id: string;
  label: string;
  chain: Array<{
    id: string;
    type: 'credential' | 'department' | 'service';
    label: string;
    value?: string;
    impact?: 'high' | 'medium' | 'low';
  }>;
}

const CHAIN_EXAMPLES: ChainExample[] = [
  {
    id: 'credential-or',
    label: 'Credential → Department → Service',
    chain: [
      { id: '1', type: 'credential', label: 'DEA Registration', value: 'Expired', impact: 'high' },
      { id: '2', type: 'department', label: 'Anesthesia Dept', impact: 'high' },
      { id: '3', type: 'service', label: 'OR Throughput', value: '-40%', impact: 'high' },
    ],
  },
  {
    id: 'license-cardiology',
    label: 'License → Department → Service',
    chain: [
      { id: '1', type: 'credential', label: 'State License', value: 'Pending Renewal', impact: 'medium' },
      { id: '2', type: 'department', label: 'Cardiology Dept', impact: 'medium' },
      { id: '3', type: 'service', label: 'Cardiac Procedures', value: '-25%', impact: 'medium' },
    ],
  },
  {
    id: 'pecos-billing',
    label: 'PECOS → Department → Service',
    chain: [
      { id: '1', type: 'credential', label: 'PECOS Enrollment', value: 'Inactive', impact: 'high' },
      { id: '2', type: 'department', label: 'Credentialing Dept', impact: 'high' },
      { id: '3', type: 'service', label: 'Medicare Billing', value: 'Blocked', impact: 'high' },
    ],
  },
];

const MOCK_ALERTS = [
  {
    id: 'alert-1',
    title: 'OR Dependency on Anesthesia Credentials',
    description:
      'Operating Room has a 95% dependency on Anesthesia department credential status. Any credential expiration will immediately impact OR operations.',
    severity: 'critical' as const,
    affectedDepartments: ['Operating Room', 'Anesthesia'],
    riskType: 'propagation' as const,
    recommendation:
      'Implement credential expiration alerts 90 days in advance and establish backup credentialing processes.',
  },
  {
    id: 'alert-2',
    title: 'Cardiology-Radiology Data Dependency',
    description:
      'Cardiology department relies heavily on Radiology for imaging data. Any radiology system downtime cascades to cardiology procedures.',
    severity: 'high' as const,
    affectedDepartments: ['Cardiology', 'Radiology'],
    riskType: 'cascade' as const,
    recommendation: 'Establish redundant imaging pathways and local caching for critical cardiology workflows.',
  },
  {
    id: 'alert-3',
    title: 'Credentialing Department Bottleneck',
    description:
      'Credentialing department is a single point of failure for multiple clinical departments. High load score indicates risk of processing delays.',
    severity: 'high' as const,
    affectedDepartments: ['Anesthesia', 'Cardiology', 'Radiology', 'Pharmacy'],
    riskType: 'bottleneck' as const,
    recommendation: 'Consider distributed credentialing or automated renewal processes to reduce bottleneck risk.',
  },
  {
    id: 'alert-4',
    title: 'Pharmacy-Credentialing Weak Link',
    description:
      'Pharmacy has moderate dependency on credentialing, but credentialing backlog could delay pharmacy staff onboarding.',
    severity: 'medium' as const,
    affectedDepartments: ['Pharmacy', 'Credentialing'],
    riskType: 'propagation' as const,
    recommendation: 'Prioritize pharmacy credentialing during high-volume periods.',
  },
];

export default function DependencyChainsPage() {
  const [selectedChain, setSelectedChain] = useState<string>(CHAIN_EXAMPLES[0].id);

  const currentChain = CHAIN_EXAMPLES.find((c) => c.id === selectedChain);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • System Coupling</p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="h-8 w-8 text-primary" aria-hidden="true" />
            Dependency Chain Viewer
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Visualize dependency chains showing how credential variables impact departments and service line throughput.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dependency Chain Viewer */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Dependency Chain
              </CardTitle>
              <CardDescription>Select a chain to visualize the dependency path</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAIN_EXAMPLES.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentChain && <DependencyChain chain={currentChain.chain} />}
            </CardContent>
          </Card>
        </div>

        {/* Coupling Alerts */}
        <div>
          <CouplingAlerts alerts={MOCK_ALERTS} />
        </div>
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Understanding Dependency Chains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-2">Chain Components</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Credential Variable:</strong> The initial trigger (e.g., expired license, inactive enrollment)
              </li>
              <li>
                <strong>Department Impact:</strong> How the credential issue affects department operations
              </li>
              <li>
                <strong>Service Line Throughput:</strong> The ultimate impact on patient care delivery metrics
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-2">Impact Levels</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>High:</strong> Immediate operational disruption, significant service reduction
              </li>
              <li>
                <strong>Medium:</strong> Moderate impact, some service degradation
              </li>
              <li>
                <strong>Low:</strong> Minimal impact, manageable with existing resources
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

