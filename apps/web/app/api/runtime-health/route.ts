import { NextResponse } from 'next/server';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';

export const runtime = 'nodejs';

type RuntimeHealthState = 'operational' | 'degraded' | 'unavailable';
type DeploymentSummaryState = 'ready' | 'stale' | 'unavailable';

function deploymentIdentity() {
  const edgeDeploymentId = process.env.CF_PAGES_BRANCH ?? null;
  const edgeCommitSha = process.env.CF_PAGES_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA_SHORT ?? null;

  return {
    platform: process.env.CF_PAGES === '1' ? 'cloudflare' : 'local',
    deployedAt: process.env.NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP ?? null,
    deploymentId: edgeDeploymentId,
    commitSha: edgeCommitSha ? edgeCommitSha.slice(0, 12) : null,
    commitRef: process.env.CF_PAGES_BRANCH ?? process.env.GIT_BRANCH ?? null,
    projectName: process.env.CF_PAGES_PROJECT_NAME ?? null,
  };
}

function buildDeploymentSummary(input: {
  deploymentId: string | null;
  commitSha: string | null;
  projectName: string | null;
  platform: string | null;
  passportState: RuntimeHealthState;
  sourceState: RuntimeHealthState;
}): {
  live: boolean;
  stale: boolean;
  productionReady: boolean;
  status: DeploymentSummaryState;
  label: string;
  detail: string;
  canonicalProject: string;
  legacyProject: string;
  projectName: string | null;
  projectStatus: 'canonical' | 'legacy' | 'unknown';
} {
  const live = Boolean(input.deploymentId || input.commitSha);
  const canonicalProject = 'vcv-web';
  const legacyProject = 'vitalcv';
  const isCanonicalProject = input.projectName === canonicalProject;
  const isLegacyProject = input.projectName === legacyProject;
  const projectStatus = input.projectName === canonicalProject
    ? 'canonical'
    : input.projectName === legacyProject
      ? 'legacy'
      : 'unknown';
  const productionReady = live
    && input.passportState === 'operational'
    && input.sourceState === 'operational';
  const stale = live && !productionReady;

  if (productionReady) {
    return {
      live,
      stale,
      productionReady: true,
      status: 'ready',
      label: 'Live canonical',
      detail: 'vcv-web is live.',
      canonicalProject,
      legacyProject,
      projectName: input.projectName,
      projectStatus,
    };
  }

  if (live) {
    const label = isCanonicalProject
      ? 'Canonical live'
      : isLegacyProject
        ? 'Legacy stale'
        : 'Live unresolved';
    const detail = isCanonicalProject
      ? 'vcv-web live.'
      : isLegacyProject
        ? 'vitalcv stale.'
        : 'Live deployment not canonical.';

    return {
      live,
      stale: true,
      productionReady: false,
      status: 'stale',
      label,
      detail,
      canonicalProject,
      legacyProject,
      projectName: input.projectName,
      projectStatus,
    };
  }

  return {
    live: false,
    stale: false,
    productionReady: false,
    status: 'unavailable',
    label: 'Deployment unavailable',
    detail: 'No deployment identity.',
    canonicalProject,
    legacyProject,
    projectName: input.projectName,
    projectStatus,
  };
}

async function probeNppes(): Promise<{
  reachability: RuntimeHealthState;
  httpStatus: number | null;
  latencyMs: number;
}> {
  const startedAt = performance.now();

  try {
    const response = await fetch(
      'https://npiregistry.cms.hhs.gov/api/?number=1346053246&version=2.1&limit=1',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      },
    );

    return {
      reachability: response.ok ? 'operational' : 'degraded',
      httpStatus: response.status,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  } catch {
    return {
      reachability: 'unavailable',
      httpStatus: null,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const nppes = await probeNppes();

  let passportHydration: {
    state: RuntimeHealthState;
    degradedFallbackAvailable: boolean;
    runtimeContract: string;
  };

  try {
    const passport = await resolvePassportRuntimePassport('__runtime_health__');
    passportHydration = {
      state: passport.checkedAt && passport.replayPosture && passport.continuityPosture
        ? 'operational'
        : 'degraded',
      degradedFallbackAvailable: Boolean(passport._degraded),
      runtimeContract: 'self-contained App Router passport JSON',
    };
  } catch {
    passportHydration = {
      state: 'unavailable',
      degradedFallbackAvailable: false,
      runtimeContract: 'self-contained App Router passport JSON',
    };
  }

  const degradedModeActive = passportHydration.state !== 'operational'
    || nppes.reachability !== 'operational';
  const deployment = deploymentIdentity();
  const deploymentSummary = buildDeploymentSummary({
    deploymentId: deployment.deploymentId,
    commitSha: deployment.commitSha,
    projectName: deployment.projectName,
    platform: deployment.platform,
    passportState: passportHydration.state,
    sourceState: nppes.reachability,
  });

  return NextResponse.json(
    {
      status: passportHydration.state === 'unavailable' ? 'degraded' : 'ok',
      checkedAt,
      runtime: {
        mode: deployment.platform,
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
      },
      passportHydration,
      sources: {
        nppes,
      },
      degradedMode: {
        active: degradedModeActive,
        structuredFallbackAvailable: passportHydration.degradedFallbackAvailable,
        reason: degradedModeActive
          ? 'One or more checks are degraded.'
          : 'Checks are operational.',
      },
      deployment,
      deploymentSummary,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
