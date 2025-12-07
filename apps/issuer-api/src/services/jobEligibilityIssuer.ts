/**
 * B132A-VC-012: Generate JobEligibility VC on application (backfill pipeline)
 *
 * VC produced after PSV completed; hash anchored; ID stored in Application
 */

import * as ed25519 from '@noble/ed25519';
import { createHash } from 'crypto';

export interface LicenseData {
  state: string;
  licenseNumber: string;
  status: 'active' | 'inactive' | 'suspended';
  issueDate?: string;
  expirationDate?: string;
  verificationDate: string;
}

export interface BoardCertificationData {
  specialty: string;
  board: string;
  status: 'certified' | 'eligible' | 'expired';
  certificationDate?: string;
  expirationDate?: string;
}

export interface TelehealthEligibilityData {
  eligible: boolean;
  method: 'direct' | 'imlc' | 'multi-state' | 'not-eligible';
  imlcMember?: boolean;
  coveredStates: string[];
}

export interface JobEligibilityInput {
  clinicianDid: string;
  jobId: string;
  specialty: {
    code: string;
    system: string;
    display?: string;
  };
  licenses: LicenseData[];
  boardCertifications?: BoardCertificationData[];
  telehealthEligibility: TelehealthEligibilityData;
  eligibilityStatus: 'eligible' | 'partially-eligible' | 'not-eligible';
  eligibilityScore: number;
  matchReasons?: string[];
  evidenceReferences?: string[];
}

export interface JobEligibilityVC {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    jobId: string;
    specialty: {
      code: string;
      system: string;
      display?: string;
    };
    licenses: LicenseData[];
    boardCertifications?: BoardCertificationData[];
    telehealthEligibility: TelehealthEligibilityData;
    eligibilityStatus: string;
    eligibilityScore: number;
    matchReasons?: string[];
    verificationDate: string;
    evidenceReferences?: string[];
  };
  proof: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    proofValue?: string;
    jws?: string;
  };
}

/**
 * JobEligibility VC Issuer
 */
export class JobEligibilityIssuer {
  private issuerDid: string;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;

  constructor(issuerDid?: string, privateKeyHex?: string) {
    this.issuerDid = issuerDid || 'did:key:z6MkExample123'; // Default issuer DID

    // Generate or use provided key
    if (privateKeyHex) {
      this.privateKey = Buffer.from(privateKeyHex, 'hex');
      this.publicKey = ed25519.getPublicKey(this.privateKey);
    } else {
      // Generate new key pair (in production, use key from vault)
      this.privateKey = ed25519.utils.randomPrivateKey();
      this.publicKey = ed25519.getPublicKey(this.privateKey);
    }
  }

  /**
   * Issue a JobEligibility VC
   */
  async issueJobEligibilityVC(input: JobEligibilityInput): Promise<JobEligibilityVC> {
    const now = new Date().toISOString();
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 6); // Valid for 6 months

    // Build credential
    const credential: Omit<JobEligibilityVC, 'proof'> = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://vitalcv.com/contexts/JobEligibility/v1',
      ],
      type: ['VerifiableCredential', 'JobEligibilityCredential'],
      issuer: this.issuerDid,
      issuanceDate: now,
      expirationDate: expirationDate.toISOString(),
      credentialSubject: {
        id: input.clinicianDid,
        jobId: input.jobId,
        specialty: input.specialty,
        licenses: input.licenses,
        boardCertifications: input.boardCertifications,
        telehealthEligibility: input.telehealthEligibility,
        eligibilityStatus: input.eligibilityStatus,
        eligibilityScore: input.eligibilityScore,
        matchReasons: input.matchReasons,
        verificationDate: now,
        evidenceReferences: input.evidenceReferences,
      },
    };

    // Create proof
    const proof = await this.createProof(credential);

    // Complete credential
    const vc: JobEligibilityVC = {
      ...credential,
      proof,
    };

    console.log(`[jobEligibilityIssuer] Issued VC for ${input.clinicianDid} / ${input.jobId}`);

    return vc;
  }

  /**
   * Create proof for credential
   */
  private async createProof(credential: Omit<JobEligibilityVC, 'proof'>): Promise<JobEligibilityVC['proof']> {
    const now = new Date().toISOString();

    // Canonicalize credential (simplified - in production use proper JSON-LD canonicalization)
    const canonicalJson = JSON.stringify(credential, Object.keys(credential).sort());
    const message = Buffer.from(canonicalJson, 'utf-8');

    // Sign
    const signature = await ed25519.sign(message, this.privateKey);
    const proofValue = Buffer.from(signature).toString('base64');

    return {
      type: 'Ed25519Signature2020',
      created: now,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${this.issuerDid}#key-1`,
      proofValue,
    };
  }

  /**
   * Anchor credential hash to blockchain/ledger
   */
  async anchorCredentialHash(vc: JobEligibilityVC): Promise<{ txHash: string; blockHeight: number }> {
    // Calculate credential hash
    const credentialJson = JSON.stringify(vc);
    const hash = createHash('sha256').update(credentialJson).digest('hex');

    console.log(`[jobEligibilityIssuer] Anchoring hash: ${hash}`);

    // TODO: Implement actual blockchain anchoring
    // - Submit to Ethereum/Polygon
    // - Or submit to Hyperledger
    // - Or use timestamping service

    // Simulate anchoring
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      txHash: `0x${hash.substring(0, 40)}`,
      blockHeight: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Batch issue multiple JobEligibility VCs
   */
  async batchIssue(inputs: JobEligibilityInput[]): Promise<JobEligibilityVC[]> {
    console.log(`[jobEligibilityIssuer] Batch issuing ${inputs.length} VCs`);

    const vcs = await Promise.all(
      inputs.map(input => this.issueJobEligibilityVC(input))
    );

    return vcs;
  }

  /**
   * Verify a JobEligibility VC
   */
  async verifyJobEligibilityVC(vc: JobEligibilityVC): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check expiration
      if (new Date(vc.expirationDate) < new Date()) {
        return { valid: false, error: 'Credential expired' };
      }

      // Check issuer
      if (vc.issuer !== this.issuerDid) {
        return { valid: false, error: 'Invalid issuer' };
      }

      // Verify signature
      const { proof, ...credentialWithoutProof } = vc;
      const canonicalJson = JSON.stringify(credentialWithoutProof, Object.keys(credentialWithoutProof).sort());
      const message = Buffer.from(canonicalJson, 'utf-8');

      if (!proof.proofValue) {
        return { valid: false, error: 'Missing proof value' };
      }

      const signature = Buffer.from(proof.proofValue, 'base64');
      const isValid = await ed25519.verify(signature, message, this.publicKey);

      if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get issuer DID
   */
  getIssuerDid(): string {
    return this.issuerDid;
  }

  /**
   * Get public key (for verification)
   */
  getPublicKeyHex(): string {
    return Buffer.from(this.publicKey).toString('hex');
  }
}

// Singleton instance
let issuerInstance: JobEligibilityIssuer | null = null;

/**
 * Get or create issuer instance
 */
export function getJobEligibilityIssuer(): JobEligibilityIssuer {
  if (!issuerInstance) {
    const issuerDid = process.env.JOB_ELIGIBILITY_ISSUER_DID;
    const privateKeyHex = process.env.JOB_ELIGIBILITY_ISSUER_KEY;
    issuerInstance = new JobEligibilityIssuer(issuerDid, privateKeyHex);
  }
  return issuerInstance;
}

/**
 * Reset issuer instance (for testing)
 */
export function resetJobEligibilityIssuer(): void {
  issuerInstance = null;
}

