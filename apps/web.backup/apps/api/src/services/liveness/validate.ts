import { createHash } from 'crypto';

export interface LivenessFrame {
  timestamp: string | number;
  blinkProbability: number;
  gazeYaw?: number;
  gazePitch?: number;
  depthScore?: number;
  illumination?: number;
  mouthOpenProbability?: number;
}

export type LivenessChallengePrompt = 'blink' | 'turn_left' | 'turn_right' | 'smile' | 'speak_passcode';

export interface LivenessChallenge {
  prompt: LivenessChallengePrompt;
  issuedAt?: string;
  respondedAt?: string;
  latencyMs?: number;
  success: boolean;
}

export interface LivenessCapture {
  sessionId: string;
  clinicianId: string;
  frames: LivenessFrame[];
  challengeScript?: LivenessChallenge[];
  deviceInfo?: {
    model?: string;
    os?: string;
    browser?: string;
  };
  networkStats?: {
    jitterMs?: number;
    fps?: number;
  };
}

export interface LivenessValidationResult {
  sessionId: string;
  clinicianId: string;
  score: number;
  verdict: 'pass' | 'review';
  spoofLikelihood: number;
  signals: {
    blink: number;
    motion: number;
    depth: number;
    challenge: number;
    illumination: number;
  };
  frameCount: number;
  evaluatedAt: string;
  challengeBreakdown: Array<{
    prompt: LivenessChallengePrompt;
    success: boolean;
    latencyMs: number;
  }>;
  riskFactors: string[];
  entropy: number;
}

export function validateLivenessCapture(input: LivenessCapture): LivenessValidationResult {
  if (!input.sessionId) {
    throw new Error('sessionId is required for liveness validation');
  }
  if (!input.clinicianId) {
    throw new Error('clinicianId is required for liveness validation');
  }
  if (!input.frames?.length) {
    throw new Error('frames are required for liveness validation');
  }

  const frames = [...input.frames].sort(
    (a, b) => normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp),
  );

  const blinkSignal = computeBlinkScore(frames);
  const motionSignal = computeMotionScore(frames);
  const depthSignal = computeDepthScore(frames);
  const illuminationSignal = computeIlluminationScore(frames);
  const challengeSignal = computeChallengeScore(input.challengeScript ?? []);

  const aggregate = clamp01(
    blinkSignal * 0.25 +
      motionSignal * 0.2 +
      depthSignal * 0.25 +
      challengeSignal * 0.2 +
      illuminationSignal * 0.1,
  );

  const jitterPenalty = clamp01((input.networkStats?.jitterMs ?? 0) / 450);
  const spoofLikelihood = clamp01(1 - aggregate + jitterPenalty * 0.35);
  const verdict: 'pass' | 'review' =
    aggregate >= 0.72 && spoofLikelihood < 0.4 ? 'pass' : 'review';

  return {
    sessionId: input.sessionId,
    clinicianId: input.clinicianId,
    score: Number(aggregate.toFixed(4)),
    verdict,
    spoofLikelihood: Number(spoofLikelihood.toFixed(4)),
    signals: {
      blink: Number(blinkSignal.toFixed(4)),
      motion: Number(motionSignal.toFixed(4)),
      depth: Number(depthSignal.toFixed(4)),
      challenge: Number(challengeSignal.toFixed(4)),
      illumination: Number(illuminationSignal.toFixed(4)),
    },
    frameCount: frames.length,
    evaluatedAt: new Date().toISOString(),
    challengeBreakdown: (input.challengeScript ?? []).map((item) => ({
      prompt: item.prompt,
      success: Boolean(item.success),
      latencyMs: Math.round(resolveLatency(item)),
    })),
    riskFactors: buildRiskFactors(motionSignal, challengeSignal, illuminationSignal, spoofLikelihood),
    entropy: Number(computeEntropy(frames).toFixed(4)),
  };
}

function computeBlinkScore(frames: LivenessFrame[]): number {
  const blinkEvents = frames.filter((frame) => frame.blinkProbability > 0.65).length;
  const blinkRatio = blinkEvents / frames.length;
  return clamp01(blinkRatio / 0.25); // Expect ~25% frames demonstrating blink
}

function computeMotionScore(frames: LivenessFrame[]): number {
  if (frames.length < 3) {
    return 0.3;
  }
  const yawValues = frames.map((frame) => frame.gazeYaw ?? 0);
  const pitchValues = frames.map((frame) => frame.gazePitch ?? 0);
  const yawVariance = variance(yawValues);
  const pitchVariance = variance(pitchValues);
  const combined = Math.sqrt(yawVariance ** 2 + pitchVariance ** 2);
  return clamp01(combined / 15);
}

function computeDepthScore(frames: LivenessFrame[]): number {
  const depthSamples = frames
    .map((frame) => (typeof frame.depthScore === 'number' ? frame.depthScore : null))
    .filter((value): value is number => value !== null);
  if (!depthSamples.length) {
    return 0.5;
  }
  const average = depthSamples.reduce((sum, value) => sum + value, 0) / depthSamples.length;
  return clamp01(average);
}

function computeIlluminationScore(frames: LivenessFrame[]): number {
  const samples = frames
    .map((frame) => (typeof frame.illumination === 'number' ? frame.illumination : null))
    .filter((value): value is number => value !== null);
  if (!samples.length) {
    return 0.6;
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const spread = variance(samples);
  const balanced = clamp01(average);
  return clamp01(balanced - Math.max(0, 0.4 - spread));
}

function computeChallengeScore(challenges: LivenessChallenge[]): number {
  if (!challenges.length) {
    return 0.5;
  }
  const successes = challenges.filter((challenge) => challenge.success).length;
  const baseScore = successes / challenges.length;
  const latencyPenalty =
    challenges.reduce((sum, challenge) => sum + resolveLatency(challenge), 0) /
    challenges.length /
    4000;
  return clamp01(baseScore - latencyPenalty);
}

function resolveLatency(challenge: LivenessChallenge): number {
  if (typeof challenge.latencyMs === 'number') {
    return challenge.latencyMs;
  }
  if (challenge.issuedAt && challenge.respondedAt) {
    const issued = Date.parse(challenge.issuedAt);
    const responded = Date.parse(challenge.respondedAt);
    if (Number.isFinite(issued) && Number.isFinite(responded)) {
      return Math.max(0, responded - issued);
    }
  }
  return 2000;
}

function buildRiskFactors(
  motionSignal: number,
  challengeSignal: number,
  illuminationSignal: number,
  spoofLikelihood: number,
): string[] {
  const factors: string[] = [];
  if (motionSignal < 0.45) {
    factors.push('Insufficient head movement detected');
  }
  if (challengeSignal < 0.6) {
    factors.push('Challenge-response drift observed');
  }
  if (illuminationSignal < 0.4) {
    factors.push('Poor illumination or overexposed capture');
  }
  if (spoofLikelihood > 0.5) {
    factors.push('Spoof probability exceeds safe threshold');
  }
  return factors;
}

function computeEntropy(frames: LivenessFrame[]): number {
  const hash = createHash('sha256');
  frames.forEach((frame) => {
    hash.update(
      JSON.stringify({
        b: Number(frame.blinkProbability.toFixed(3)),
        y: frame.gazeYaw ?? 0,
        p: frame.gazePitch ?? 0,
        d: frame.depthScore ?? 0,
      }),
    );
  });
  const digest = hash.digest();
  const uniqueBytes = new Set(digest);
  return uniqueBytes.size / digest.length;
}

function variance(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sumSq = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return sumSq / values.length;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeTimestamp(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

