import type { Metadata } from 'next';
import {
  Badge,
  Button,
  EvidenceTable,
  FindingCard,
  GraphLegend,
  InvestigationPanel,
  Panel,
  Timeline,
} from '@/src/ui/components';
import { MetricCluster, StatusBanner } from '@/src/ui/patterns';
import { designSystemDocs } from '@/design-system/docs/catalog';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'VitalCV Design System tokens, themes, components, layouts, and graph rules.',
};

export default function DesignSystemDocsPage() {
  return (
    <article className="max-w-5xl space-y-12">
      <header className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vt-text-muted)]">
          VitalCV Design System
        </p>
        <h1 className="text-[length:var(--vt-type-h1-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Single source of truth for product UI
        </h1>
        <p className="max-w-3xl text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
          VDS centralizes semantic tokens, runtime themes, structural layouts, and intelligence interaction patterns so product surfaces stay consistent, predictable, maintainable, and agent-safe.
        </p>
      </header>

      <StatusBanner tone="info">
        All new UI should consume `apps/web/design-system` directly or the mirrored facades under `apps/web/src/ui` and `apps/web/src/styles`.
      </StatusBanner>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Themes
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {designSystemDocs.themes.map((theme) => (
            <Panel key={theme.name} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[length:var(--vt-type-meta-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
                    {theme.label}
                  </p>
                  <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
                    {theme.name}
                  </p>
                </div>
                <Badge variant="outline">runtime</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(theme.preview).map(([label, color]) => (
                  <div key={label} className="space-y-1">
                    <div className="h-12 rounded-[var(--vt-radius-md)] border border-[var(--vt-border)]" style={{ backgroundColor: color }} />
                    <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Tokens
        </h2>
        <MetricCluster
          items={[
            {
              id: 'colors',
              label: 'Semantic colors',
              value: designSystemDocs.tokens.colors.length,
              detail: 'background, status, severity, risk, and graph semantics',
            },
            {
              id: 'type',
              label: 'Type sizes',
              value: Object.keys(designSystemDocs.tokens.typography.size).length,
              detail: 'display, headings, body, meta, and caption',
            },
            {
              id: 'space',
              label: 'Spacing scale',
              value: Object.keys(designSystemDocs.tokens.spacing).length,
              detail: '2 → 64 tokens for padding and margin',
            },
            {
              id: 'motion',
              label: 'Motion speeds',
              value: Object.keys(designSystemDocs.tokens.motion.duration).length,
              detail: 'fast, normal, and slow for controlled feedback',
            },
          ]}
        />
        <Panel className="space-y-4">
          <p className="text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
            Semantic colors are exposed through `--vt-*` variables. Layout and component sizing consume the typography and spacing variables, while graph rendering reads the dedicated node, edge, and hover tokens.
          </p>
          <div className="flex flex-wrap gap-2">
            {designSystemDocs.tokens.colors.map((token) => (
              <Badge key={token} variant="outline">
                {token}
              </Badge>
            ))}
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Components
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <FindingCard
            confidence={0.87}
            links={<Button size="sm" variant="secondary">Open evidence</Button>}
            metadata={<p className="text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)]">Investigator IDX-41 · synced 2m ago</p>}
            severity="high"
            status="investigating"
            summary="This example shows the VDS intelligence card language used across live finding, action, and storyline feeds."
            title="License renewal mismatch across state boards"
            typeLabel="credential integrity"
          />
          <InvestigationPanel
            actions={<Button size="sm" variant="secondary">Open queue</Button>}
            summary="Panels, banners, tables, and timelines use the same spacing, typography, and border variables."
            title="Investigation pattern"
          >
            <Timeline
              items={[
                { id: '1', title: 'Claim imported', detail: 'NPI registry snapshot attached.', time: '09:42', tone: 'accent' },
                { id: '2', title: 'Board mismatch detected', detail: 'Expiration date diverged from issuer copy.', time: '09:48', tone: 'warning' },
                { id: '3', title: 'Follow-up queued', detail: 'Manual verification required before resolution.', time: '09:52', tone: 'critical' },
              ]}
            />
          </InvestigationPanel>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Layout Patterns
        </h2>
        <Panel className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {designSystemDocs.layouts.map((layout) => (
              <Badge key={layout} variant="outline">
                {layout}
              </Badge>
            ))}
          </div>
          <p className="text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
            `IntelligenceConsoleLayout` is the main launch path for operational pages, with `ListLayout`, `DetailLayout`, and `SplitPanelLayout` handling dense evidence and side-panel workflows.
          </p>
        </Panel>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Graph Rules
        </h2>
        <GraphLegend
          description="The graph system uses semantic node and edge tokens with consistent sizing, relationship encoding, and hover behavior."
          sections={[
            {
              id: 'nodes',
              label: 'Nodes',
              items: [
                { id: 'provider', label: 'Provider', detail: 'largest', color: 'var(--vt-node-provider)' },
                { id: 'institution', label: 'Institution', detail: 'large', color: 'var(--vt-node-institution)' },
                { id: 'publication', label: 'Publication', detail: 'compact', color: 'var(--vt-node-publication)' },
                { id: 'trial', label: 'Trial', detail: 'compact', color: 'var(--vt-node-trial)' },
                { id: 'company', label: 'Company', detail: 'large', color: 'var(--vt-node-company)' },
                { id: 'alert', label: 'Alert', detail: 'emphasized', color: 'var(--vt-node-alert)' },
              ],
            },
            {
              id: 'edges',
              label: 'Edges',
              items: [
                { id: 'co-author', label: 'Co-author', detail: 'light', color: 'var(--vt-edge-co-author)', line: true },
                { id: 'co-investigator', label: 'Co-investigator', detail: 'medium', color: 'var(--vt-edge-co-investigator)', line: true },
                { id: 'co-grant', label: 'Co-grant', detail: 'medium', color: 'var(--vt-edge-co-grant)', line: true },
                { id: 'practice-group', label: 'Practice group', detail: 'medium', color: 'var(--vt-edge-practice-group)', line: true },
                { id: 'industry-payment', label: 'Industry payment', detail: 'heavy', color: 'var(--vt-edge-industry-payment)', line: true },
              ],
            },
          ]}
          title="Graph design system"
        />
        <Panel className="space-y-3">
          {designSystemDocs.graphRules.map((rule) => (
            <p key={rule} className="text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
              {rule}
            </p>
          ))}
        </Panel>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--vt-type-h2-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
          Usage Examples
        </h2>
        <EvidenceTable
          columns={[
            { key: 'source', label: 'Source', render: (row) => row.source },
            { key: 'field', label: 'Field', render: (row) => row.field },
            { key: 'value', label: 'Value', render: (row) => row.value },
          ]}
          rows={[
            { source: 'CAQH', field: 'expiration', value: '2026-10-03' },
            { source: 'State Board', field: 'expiration', value: '2026-08-29' },
          ]}
        />
        <Panel className="space-y-3">
          <p className="text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)]">
            Import from `@/src/ui/components`, `@/src/ui/layouts`, `@/src/ui/patterns`, and `@/src/styles`. Those facades mirror the canonical `apps/web/design-system` exports and keep future migrations stable.
          </p>
        </Panel>
      </section>
    </article>
  );
}
