import { DecisionPanel } from '@/components/verifier/DecisionPanel';
import type { WorklistItem } from '@/lib/verifier/worklist';
import type { ReactElement } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { PageFrame } from '@/components/layout/PageFrame';

const MOCK_DECISION_ITEM: WorklistItem = {
  clinicianNpi: '1999999984',
  submittedAt: '2026-04-26T14:35:00.000Z',
  status: 'info_requested',
  proofTier: 'self_attested',
};

export default async function EmployerDecisionPage(props: {
  params: Promise<{ applicationId: string }>;
}): Promise<ReactElement> {
  const { applicationId } = await props.params;

  return (
    <PageFrame
      as="main"
      mode="workflow"
      aria-label="Employer decision shell"
      className="mz mz-paper mz-persona-employer min-h-screen"
    >
      <div className="mz-ambient grid gap-6">
        <Reveal variant="fade">
          <div className="flex flex-col gap-3">
            <p className="mz-eyebrow">
              Employer workflow foundation
            </p>
            <h1 className="mz-h1">
              Decision shell
            </h1>
            <p className="max-w-2xl mz-lede">
              Decision recording is planned for the production workflow.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mz-card mz-card-pad text-sm text-[var(--ink-700)]">
            <p className="font-semibold text-[var(--ink-900)]">Read-only outcome area</p>
            <p className="mt-1">
              Application <span className="mz-mono">{applicationId}</span> has
              no persisted decision outcome in this shell.
            </p>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <DecisionPanel item={MOCK_DECISION_ITEM} />
        </Reveal>
      </div>
    </PageFrame>
  );
}
