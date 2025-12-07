import type { PrismaClient } from '@prisma/client';

export interface RuntimePointerVelocity {
  samples: number;
  average: number;
  stdDev: number;
  min: number;
  max: number;
  curve?: number[];
}

export interface RuntimeTimingJitter {
  samples: number;
  average: number;
  stdDev: number;
  min: number;
  max: number;
  deltas?: number[];
}

export interface RuntimeCanvasEntropy {
  hash: string | null;
  entropy: number;
  width: number;
  height: number;
}

export interface RuntimeWebglFingerprint {
  vendor: string | null;
  renderer: string | null;
  shadingLanguage: string | null;
  extensionsHash: string | null;
  antialias: boolean | null;
  maxTextureSize: number | null;
}

export interface RuntimeSignalPayload {
  capturedAt?: string;
  pointerVelocity?: RuntimePointerVelocity;
  timingJitter?: RuntimeTimingJitter;
  canvasEntropy?: RuntimeCanvasEntropy;
  webglFingerprint?: RuntimeWebglFingerprint;
}

export interface BotDetectorInput {
  deviceSig?: string | null;
  ipAddress?: string | null;
  forwardedFor?: string | null;
  userAgent?: string | null;
  runtimeSignals?: RuntimeSignalPayload | null;
}

export interface BotDetectionResult {
  riskScore: number;
  flags: string[];
  navigation: {
    samples: number;
    averageSpeed: number;
    maxSpeed: number;
    impossible: boolean;
  };
  fingerprint: {
    deviceSig: string | null;
    uniqueIpCount: number;
    identicalAcrossIps: boolean;
    recentIps: string[];
  };
  runtime: RuntimeSignalPayload | null;
  network: {
    ipChain: string[];
    residentialProxyHop: boolean;
    torSuspected: boolean;
    vpnSuspected: boolean;
  };
}

const MAX_IP_MEMORY = 10;
const pointerIpMemory = new Map<string, Set<string>>();

const DATACENTER_PREFIXES = ['34.', '35.', '52.', '54.', '104.', '141.'];
const TOR_HINTS = [/torbrowser/i, /tor project/i, /tbb/i];
const VPN_HINTS = [/vpn/i, /anonym/i, /proxy/i];
const IMPOSSIBLE_SPEED_THRESHOLD = 8_000; // px/sec
const QUIET_VARIANCE_THRESHOLD = 2; // px/sec stddev

export async function runBotDetector(
  input: BotDetectorInput,
  deps: { prisma?: PrismaClient } = {},
): Promise<BotDetectionResult> {
  const pointerStats = input.runtimeSignals?.pointerVelocity;
  const impossibleNavigation =
    Boolean(pointerStats?.samples && pointerStats.max > IMPOSSIBLE_SPEED_THRESHOLD) ||
    Boolean(pointerStats?.samples && pointerStats.stdDev < QUIET_VARIANCE_THRESHOLD && (pointerStats.max ?? 0) > 4_000);

  const navigationRisk = pointerStats
    ? clamp(
        (Math.max(0, pointerStats.max - 4_500) / 10_000) +
          (pointerStats.stdDev < QUIET_VARIANCE_THRESHOLD ? 0.25 : 0),
      )
    : 0;

  const recentIpCount = rememberFingerprintIp(input.deviceSig, input.ipAddress);
  const identicalAcrossIps = recentIpCount > 1;
  const fingerprintRisk = identicalAcrossIps ? clamp(0.35 * (recentIpCount - 1)) : 0;
  const networkAnalysis = analyzeNetwork(input.forwardedFor, input.userAgent);
  const networkRisk = clamp(
    (networkAnalysis.residentialProxyHop ? 0.35 : 0) +
      (networkAnalysis.torSuspected ? 0.2 : 0) +
      (networkAnalysis.vpnSuspected ? 0.15 : 0),
  );

  const riskScore = clamp(navigationRisk * 0.45 + fingerprintRisk * 0.4 + networkRisk * 0.3);

  await persistFingerprintRisk(input.deviceSig, riskScore, deps.prisma);

  const flags: string[] = [];
  if (impossibleNavigation) {
    flags.push('navigation:impossible_speed');
  }
  if (identicalAcrossIps) {
    flags.push('fingerprint:multi_ip');
  }
  if (networkAnalysis.residentialProxyHop) {
    flags.push('network:residential_proxy_hop');
  }
  if (networkAnalysis.torSuspected) {
    flags.push('network:tor_suspected');
  }
  if (networkAnalysis.vpnSuspected) {
    flags.push('network:vpn_or_proxy');
  }

  return {
    riskScore,
    flags,
    navigation: {
      samples: pointerStats?.samples ?? 0,
      averageSpeed: pointerStats?.average ?? 0,
      maxSpeed: pointerStats?.max ?? 0,
      impossible: impossibleNavigation,
    },
    fingerprint: {
      deviceSig: input.deviceSig ?? null,
      uniqueIpCount: recentIpCount,
      identicalAcrossIps,
      recentIps: gatherRecentIps(input.deviceSig),
    },
    runtime: input.runtimeSignals ?? null,
    network: networkAnalysis,
  };
}

function rememberFingerprintIp(deviceSig?: string | null, ip?: string | null): number {
  if (!deviceSig || !ip) {
    return pointerIpMemory.get(deviceSig ?? '')?.size ?? 0;
  }

  const normalizedIp = ip.trim();
  const set = pointerIpMemory.get(deviceSig) ?? new Set<string>();
  set.add(normalizedIp);
  if (set.size > MAX_IP_MEMORY) {
    const iterator = set.values();
    const first = iterator.next().value;
    if (first) {
      set.delete(first);
    }
  }
  pointerIpMemory.set(deviceSig, set);
  return set.size;
}

function gatherRecentIps(deviceSig?: string | null): string[] {
  if (!deviceSig) {
    return [];
  }
  return Array.from(pointerIpMemory.get(deviceSig) ?? []);
}

async function persistFingerprintRisk(deviceSig: string | null | undefined, risk: number, prisma?: PrismaClient) {
  if (!deviceSig || !prisma) {
    return;
  }

  const botDelegate = (prisma as PrismaClient & { botFingerprint?: { upsert?: Function } }).botFingerprint;
  if (typeof botDelegate?.upsert !== 'function') {
    return;
  }

  try {
    await botDelegate.upsert({
      where: { deviceSig },
      update: { risk, lastSeen: new Date() },
      create: { deviceSig, risk },
    });
  } catch (error) {
    console.warn('[bot][detector] failed to persist fingerprint risk', error);
  }
}

function analyzeNetwork(forwardedFor?: string | null, userAgent?: string | null) {
  const ipChain = parseIpChain(forwardedFor);
  const residentialProxyHop = detectResidentialProxyHop(ipChain);
  const torSuspected = detectTor(userAgent, ipChain);
  const vpnSuspected = detectVpn(userAgent, ipChain);

  return {
    ipChain,
    residentialProxyHop,
    torSuspected,
    vpnSuspected,
  };
}

function parseIpChain(header?: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
}

function detectResidentialProxyHop(ipChain: string[]): boolean {
  if (ipChain.length < 2) {
    return false;
  }
  const clientIp = ipChain[0];
  const egressIp = ipChain[ipChain.length - 1];
  return isPrivateOrResidential(clientIp) && DATACENTER_PREFIXES.some((prefix) => egressIp.startsWith(prefix));
}

function detectTor(userAgent?: string | null, ipChain: string[] = []): boolean {
  if (userAgent && TOR_HINTS.some((pattern) => pattern.test(userAgent))) {
    return true;
  }
  return ipChain.some((ip) => ip.startsWith('185.220.') || ip.startsWith('171.25.'));
}

function detectVpn(userAgent?: string | null, ipChain: string[] = []): boolean {
  if (userAgent && VPN_HINTS.some((pattern) => pattern.test(userAgent))) {
    return true;
  }
  return ipChain.some((ip) => ip.startsWith('45.12.') || ip.startsWith('104.254.'));
}

function isPrivateOrResidential(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') // catch 172.2x ranges
  );
}

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value.toFixed(4))));
}


