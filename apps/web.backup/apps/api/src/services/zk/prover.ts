import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import path from 'path';
import { promises as fs } from 'fs';
import { recordZkMetric } from './metrics';

const BN254_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const DEFAULT_DEPTH = Number(process.env.ZK_MERKLE_DEPTH ?? 16);
const DEFAULT_ARTIFACT_DIR =
  process.env.ZK_ARTIFACT_DIR ??
  path.resolve(process.cwd(), 'chain/zk/artifacts');
const WASM_FILE = process.env.ZK_WASM ?? 'event-ledger.wasm';
const ZKEY_FILE = process.env.ZK_ZKEY ?? 'event-ledger.zkey';
const VKEY_FILE = process.env.ZK_VKEY ?? 'event-ledger.vkey.json';

type Groth16Binding = {
  fullProve: (
    inputs: Record<string, unknown>,
    wasmPath: string,
    zkeyPath: string,
  ) => Promise<{ proof: any; publicSignals: string[] }>;
  verify: (vkey: any, publicSignals: string[], proof: any) => Promise<boolean>;
};

let cachedGroth16: Groth16Binding | null | undefined;

async function loadGroth16(): Promise<Groth16Binding | null> {
  if (cachedGroth16 !== undefined) {
    return cachedGroth16;
  }

  try {
    const snarkjs = await import('snarkjs');
    if (snarkjs?.groth16?.fullProve && snarkjs?.groth16?.verify) {
      cachedGroth16 = {
        fullProve: snarkjs.groth16.fullProve,
        verify: snarkjs.groth16.verify,
      };
      return cachedGroth16;
    }
  } catch (error) {
    console.warn('[zk][prover] snarkjs unavailable, using mock proofs', error);
  }

  cachedGroth16 = null;
  return cachedGroth16;
}

export interface EventLedgerProverInput {
  /**
   * Raw block hash / event hash as hex string (with or without 0x prefix)
   */
  eventHashHex: string;
  /**
   * Array of hex siblings pulled from the persisted block proof.
   */
  merklePath?: string[];
  /**
   * Optional override for the circuit depth. Defaults to 16.
   */
  depth?: number;
}

export interface ProofMetrics {
  mode: 'snark' | 'mock';
  provingTimeMs: number;
  circuitSize: number;
  constraintCount: number;
  depth: number;
}

export interface EventLedgerProofEnvelope {
  proof: any;
  publicSignals: string[];
  circuitInput: CircuitInput;
  rootHex: string;
  pathCommitmentHex: string;
  metrics: ProofMetrics;
}

interface CircuitInput {
  leaf: string;
  root: string;
  siblings: string[];
  pathPositions: string[];
}

interface WitnessComputation {
  circuitInput: CircuitInput;
  root: bigint;
  pathCommitment: bigint;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class EventLedgerGroth16Prover {
  private readonly depth: number;
  private readonly artifactDir: string;
  private readonly circuitLabel: string;
  private verificationKey: any | null = null;

  constructor(options: { depth?: number; artifactsDir?: string; circuitLabel?: string } = {}) {
    this.depth = Math.max(1, options.depth ?? DEFAULT_DEPTH);
    this.artifactDir = options.artifactsDir ?? DEFAULT_ARTIFACT_DIR;
    this.circuitLabel = options.circuitLabel ?? 'event-ledger.v1';
  }

  async prove(input: EventLedgerProverInput): Promise<EventLedgerProofEnvelope> {
    const depth = Math.min(Math.max(1, input.depth ?? this.depth), this.depth);
    const witness = this.buildWitness(input, depth);
    const groth16 = await loadGroth16();
    const wasmPath = path.join(this.artifactDir, WASM_FILE);
    const zkeyPath = path.join(this.artifactDir, ZKEY_FILE);
    const hasArtifacts = await fileExists(wasmPath);
    const hasKey = await fileExists(zkeyPath);

    if (groth16 && hasArtifacts && hasKey) {
      const startedAt = performance.now();
      try {
        const { proof, publicSignals } = await groth16.fullProve(
          witness.circuitInput,
          wasmPath,
          zkeyPath,
        );
        const provingTimeMs = performance.now() - startedAt;
        const envelope: EventLedgerProofEnvelope = {
          proof,
          publicSignals,
          circuitInput: witness.circuitInput,
          rootHex: toHex(witness.root),
          pathCommitmentHex: toHex(witness.pathCommitment),
          metrics: this.buildMetrics('snark', depth, provingTimeMs),
        };
        this.recordMetric(envelope);
        return envelope;
      } catch (error) {
        console.warn('[zk][prover] groth16.fullProve failed, emitting mock', error);
      }
    }

    return this.buildMockProof(witness, depth);
  }

  async verifyProof(publicSignals: string[], proof: any): Promise<boolean> {
    const groth16 = await loadGroth16();
    if (!groth16) return false;

    if (!this.verificationKey) {
      const vkeyPath = path.join(this.artifactDir, VKEY_FILE);
      if (!(await fileExists(vkeyPath))) {
        return false;
      }
      const raw = await fs.readFile(vkeyPath, 'utf8');
      this.verificationKey = JSON.parse(raw);
    }

    try {
      return await groth16.verify(this.verificationKey, publicSignals, proof);
    } catch (error) {
      console.warn('[zk][prover] verify failed', error);
      return false;
    }
  }

  private buildWitness(input: EventLedgerProverInput, depth: number): WitnessComputation {
    const leaf = hexToField(input.eventHashHex);
    const siblings = padSiblings(input.merklePath ?? [], depth);
    const pathPositions = derivePathPositions(input.eventHashHex, depth);
    const { root, pathCommitment } = rollUpMerklePath(leaf, siblings, pathPositions);

    const circuitInput: CircuitInput = {
      leaf: fieldToDecimal(leaf),
      root: fieldToDecimal(root),
      siblings: siblings.map(fieldToDecimal),
      pathPositions: pathPositions.map((bit) => bit.toString()),
    };

    return {
      circuitInput,
      root,
      pathCommitment,
    };
  }

  private buildMockProof(witness: WitnessComputation, depth: number): EventLedgerProofEnvelope {
    const digest = createHash('sha256')
      .update(JSON.stringify(witness.circuitInput))
      .digest('hex');

    const mockProof = {
      type: 'mock',
      digest,
      issuedAt: new Date().toISOString(),
    };

    const envelope: EventLedgerProofEnvelope = {
      proof: mockProof,
      publicSignals: [
      witness.circuitInput.root,
      fieldToDecimal(witness.pathCommitment),
      '1',
      ],
      circuitInput: witness.circuitInput,
      rootHex: toHex(witness.root),
      pathCommitmentHex: toHex(witness.pathCommitment),
      metrics: this.buildMetrics('mock', depth, 0),
    };
    this.recordMetric(envelope);
    return envelope;
  }

  private buildMetrics(mode: ProofMetrics['mode'], depth: number, provingTimeMs: number): ProofMetrics {
    // Constraint estimate: hash (10 mults) + selector (2 mults) per level.
    const constraintCount = depth * 12 + 6;
    const circuitSize = depth * 2 + 8;
    return {
      mode,
      provingTimeMs: Math.round(provingTimeMs),
      circuitSize,
      constraintCount,
      depth,
    };
  }

  private recordMetric(envelope: EventLedgerProofEnvelope) {
    recordZkMetric({
      circuitType: this.circuitLabel,
      mode: envelope.metrics.mode,
      provingTimeMs: envelope.metrics.provingTimeMs,
      circuitSize: envelope.metrics.circuitSize,
      constraintCount: envelope.metrics.constraintCount,
      depth: envelope.metrics.depth,
      recordedAt: new Date().toISOString(),
    });
  }
}

function padSiblings(values: string[], depth: number): bigint[] {
  const siblings = values.map((value) => hexToField(value));
  while (siblings.length < depth) {
    siblings.push(0n);
  }
  if (siblings.length > depth) {
    return siblings.slice(0, depth);
  }
  return siblings;
}

function derivePathPositions(eventHashHex: string, depth: number): number[] {
  const normalized = hexToField(eventHashHex);
  const positions: number[] = [];
  for (let i = 0; i < depth; i++) {
    const bit = Number((normalized >> BigInt(i)) & 1n);
    positions.push(bit);
  }
  return positions;
}

function rollUpMerklePath(
  leaf: bigint,
  siblings: bigint[],
  pathPositions: number[],
): { root: bigint; pathCommitment: bigint } {
  let current = leaf;
  let commitment = leaf;

  for (let i = 0; i < siblings.length; i++) {
    const bit = pathPositions[i] ?? 0;
    const sibling = siblings[i] ?? 0n;
    const left = bit === 0 ? current : sibling;
    const right = bit === 0 ? sibling : current;
    current = mimcHash(left, right);
    commitment = modField(commitment + sibling);
  }

  return { root: current, pathCommitment: commitment };
}

function mimcHash(left: bigint, right: bigint): bigint {
  const leftPow = pow7(left + 3n);
  const rightPow = pow7(right + 5n);
  return modField(leftPow + rightPow + 1337n);
}

function pow7(value: bigint): bigint {
  const v2 = modField(value * value);
  const v4 = modField(v2 * v2);
  const v6 = modField(v4 * v2);
  return modField(v6 * value);
}

function modField(value: bigint): bigint {
  let result = value % BN254_FIELD;
  if (result < 0) {
    result += BN254_FIELD;
  }
  return result;
}

function hexToField(value: string): bigint {
  if (!value) return 0n;
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  try {
    const parsed = BigInt(normalized);
    return modField(parsed);
  } catch {
    return 0n;
  }
}

function fieldToDecimal(value: bigint): string {
  return value.toString(10);
}

function toHex(value: bigint): string {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

export const groth16Prover = new EventLedgerGroth16Prover();


