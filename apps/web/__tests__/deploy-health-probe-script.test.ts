/**
 * deploy-health-probe-script.test.ts
 *
 * Structural test for scripts/deploy-health-probe.sh and the
 * accompanying GitHub Actions workflow.
 *
 * Truth contracts:
 *   - Script asserts ≥ 4 snapshots returned
 *   - Script reads CRON_SECRET via env, never as a CLI argument; the
 *     secret is never written to stdout (no `echo $CRON_SECRET`)
 *   - Workflow runs on push to main + workflow_dispatch
 *   - Workflow passes CRON_SECRET via env, not as a shell argument
 *   - Failure surfaces as workflow status (no auto-rollback step)
 */
import { describe, expect, it } from 'vitest';
import { accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '../../../scripts/deploy-health-probe.sh');
const WORKFLOW_PATH = resolve(__dirname, '../../../.github/workflows/deploy-health-probe.yml');

describe('deploy-health-probe', () => {
  it('script exists, is executable, and meets truth contracts', () => {
    accessSync(SCRIPT_PATH, constants.X_OK);
    const script = readFileSync(SCRIPT_PATH, 'utf-8');

    // Asserts ≥ 4 snapshots
    expect(script).toMatch(/lt\s+4/);
    expect(script).toContain('NPPES');
    expect(script).toContain('OIG');
    expect(script).toContain('PECOS');
    expect(script).toContain('state-board');

    // Reads CRON_SECRET from env (not as CLI arg)
    expect(script).toMatch(/\$\{?CRON_SECRET\b/);
    // Authorization header uses Bearer scheme
    expect(script).toContain('Authorization: Bearer');
    // The snapshots URL remains an argument to curl. In a continued shell
    // command, an inline comment after a trailing backslash would swallow it.
    expect(script).toMatch(/--max-time 15 \\\n\s+"\$URL"/);
    // Never echo the secret to stdout
    expect(script).not.toMatch(/echo\s+["'$]?\$\{?CRON_SECRET\b/);
    // No SMTP / mailer / notifier wired in (failure surfaces as workflow status only)
    expect(script).not.toMatch(/sendmail|nodemailer|curl.*slack/i);

    // Workflow file
    const workflow = readFileSync(WORKFLOW_PATH, 'utf-8');
    // Runs on push to main + workflow_dispatch
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toContain('workflow_dispatch');
    // CRON_SECRET passed via env, not as CLI argument
    expect(workflow).toMatch(/CRON_SECRET:\s*\$\{\{\s*secrets\.CRON_SECRET\s*\}\}/);
    expect(workflow).not.toMatch(/deploy-health-probe\.sh\s+\S+\s+\$\{\{\s*secrets\.CRON_SECRET/);
    // No auto-rollback (probe surfaces failure; cutover is operator-driven)
    expect(workflow).not.toMatch(/rollback|revert/i);
  });
});
