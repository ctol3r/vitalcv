/**
 * B227B-DEV-008: SignatureVerificationService
 *
 * Verifies the digital signature of each module using a trusted CA:
 * - Rejects modules with invalid or missing signatures
 * - Integrates with ModuleUploadHandler
 */

import { PrismaClient } from '@prisma/client';
import crypto, { X509Certificate } from 'crypto';

export interface SignatureVerificationResult {
  moduleId: string;
  verified: boolean;
  signatureValid: boolean;
  certificateValid: boolean;
  certificateChainValid: boolean;
  issuer: string;
  subject: string;
  issuedAt: Date;
  expiresAt: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ModuleSignature {
  signature: string; // Base64 encoded signature
  certificate: string; // PEM encoded certificate
  certificateChain?: string[]; // Array of PEM encoded certificates (chain)
  algorithm?: string; // Signature algorithm (e.g., 'RSA-SHA256', 'ECDSA-SHA256')
}

export interface SignatureVerificationInput {
  moduleId: string;
  moduleContent: Buffer | string; // Module file content or hash
  signature: ModuleSignature;
}

export class SignatureVerificationService {
  constructor(
    private prisma: PrismaClient,
    private trustedCAs: string[] = [] // Array of trusted CA certificate PEM strings
  ) {}

  /**
   * Verify module signature
   */
  async verifySignature(input: SignatureVerificationInput): Promise<SignatureVerificationResult> {
    const result: SignatureVerificationResult = {
      moduleId: input.moduleId,
      verified: false,
      signatureValid: false,
      certificateValid: false,
      certificateChainValid: false,
      issuer: '',
      subject: '',
      issuedAt: new Date(),
      expiresAt: new Date(),
    };

    try {
      // Step 1: Parse certificate
      const certificate = this.parseCertificate(input.signature.certificate);
      if (!certificate) {
        result.error = 'Invalid certificate format';
        return result;
      }

      // Step 2: Verify certificate validity
      const certValid = this.verifyCertificate(certificate);
      if (!certValid.valid) {
        result.error = certValid.error || 'Certificate validation failed';
        result.certificateValid = false;
        return result;
      }
      result.certificateValid = true;

      // Step 3: Verify certificate chain (if provided)
      if (input.signature.certificateChain && input.signature.certificateChain.length > 0) {
        const chainValid = await this.verifyCertificateChain(
          certificate,
          input.signature.certificateChain
        );
        if (!chainValid.valid) {
          result.error = chainValid.error || 'Certificate chain validation failed';
          result.certificateChainValid = false;
          return result;
        }
        result.certificateChainValid = true;
      } else {
        // If no chain provided, check if certificate is issued by trusted CA
        const isTrusted = this.isCertificateTrusted(certificate);
        if (!isTrusted) {
          result.error = 'Certificate not issued by trusted CA';
          result.certificateChainValid = false;
          return result;
        }
        result.certificateChainValid = true;
      }

      // Step 4: Extract certificate information
      result.issuer = certificate.issuer.toString();
      result.subject = certificate.subject.toString();
      result.issuedAt = certificate.validity.notBefore;
      result.expiresAt = certificate.validity.notAfter;

      // Step 5: Verify signature
      const signatureValid = this.verifySignatureValue(
        input.moduleContent,
        input.signature.signature,
        certificate,
        input.signature.algorithm || 'RSA-SHA256'
      );
      result.signatureValid = signatureValid.valid;
      if (!signatureValid.valid) {
        result.error = signatureValid.error || 'Signature verification failed';
        return result;
      }

      // Step 6: All checks passed
      result.verified = true;
      return result;
    } catch (error: any) {
      result.error = error.message || 'Signature verification error';
      result.metadata = {
        stack: error.stack,
      };
      return result;
    }
  }

  /**
   * Parse PEM certificate
   */
  private parseCertificate(pem: string): X509Certificate | null {
    try {
      return new X509Certificate(pem);
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify certificate validity (not expired, proper format)
   */
  private verifyCertificate(certificate: X509Certificate): { valid: boolean; error?: string } {
    const now = new Date();
    const notBefore = certificate.validity.notBefore;
    const notAfter = certificate.validity.notAfter;

    if (now < notBefore) {
      return { valid: false, error: 'Certificate not yet valid' };
    }

    if (now > notAfter) {
      return { valid: false, error: 'Certificate expired' };
    }

    // Check if certificate has required extensions (e.g., code signing)
    // This is a simplified check - in production, verify extended key usage

    return { valid: true };
  }

  /**
   * Verify certificate chain
   */
  private async verifyCertificateChain(
    certificate: X509Certificate,
    chain: string[]
  ): Promise<{ valid: boolean; error?: string }> {
    // Mock implementation - in production, this would:
    // 1. Build certificate chain
    // 2. Verify each certificate in chain
    // 3. Check that chain leads to trusted root CA
    // 4. Verify signature of each certificate by its issuer

    // Simplified check: verify that chain certificates are valid
    for (const certPem of chain) {
      const cert = this.parseCertificate(certPem);
      if (!cert) {
        return { valid: false, error: 'Invalid certificate in chain' };
      }

      const certValid = this.verifyCertificate(cert);
      if (!certValid.valid) {
        return { valid: false, error: `Invalid certificate in chain: ${certValid.error}` };
      }
    }

    // Check if root CA is trusted
    const rootCA = chain[chain.length - 1];
    const rootCert = this.parseCertificate(rootCA);
    if (rootCert && !this.isCertificateTrusted(rootCert)) {
      return { valid: false, error: 'Root CA not trusted' };
    }

    return { valid: true };
  }

  /**
   * Check if certificate is issued by trusted CA
   */
  private isCertificateTrusted(certificate: X509Certificate): boolean {
    // Mock implementation - in production, this would:
    // 1. Check certificate issuer against trusted CA list
    // 2. Verify certificate signature using CA public key
    // 3. Check certificate revocation list (CRL) or OCSP

    // For now, check if issuer matches any trusted CA
    const issuer = certificate.issuer.toString();
    return this.trustedCAs.some((caPem) => {
      const caCert = this.parseCertificate(caPem);
      if (!caCert) return false;
      return caCert.subject.toString() === issuer;
    });
  }

  /**
   * Verify signature value
   */
  private verifySignatureValue(
    content: Buffer | string,
    signature: string,
    certificate: X509Certificate,
    algorithm: string
  ): { valid: boolean; error?: string } {
    try {
      // Convert content to buffer if needed
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

      // Decode signature from base64
      const signatureBuffer = Buffer.from(signature, 'base64');

      // Get public key from certificate
      const publicKey = certificate.publicKey.export({ type: 'spki', format: 'pem' });

      // Create verify object
      const verify = crypto.createVerify(algorithm);
      verify.update(contentBuffer);
      verify.end();

      // Verify signature
      const isValid = verify.verify(publicKey, signatureBuffer);

      return { valid: isValid, error: isValid ? undefined : 'Signature mismatch' };
    } catch (error: any) {
      return { valid: false, error: `Signature verification error: ${error.message}` };
    }
  }

  /**
   * Add trusted CA certificate
   */
  addTrustedCA(caPem: string): void {
    // Validate certificate format
    const cert = this.parseCertificate(caPem);
    if (!cert) {
      throw new Error('Invalid CA certificate format');
    }

    // Check if already added
    if (!this.trustedCAs.includes(caPem)) {
      this.trustedCAs.push(caPem);
    }
  }

  /**
   * Remove trusted CA certificate
   */
  removeTrustedCA(caPem: string): void {
    const index = this.trustedCAs.indexOf(caPem);
    if (index > -1) {
      this.trustedCAs.splice(index, 1);
    }
  }

  /**
   * Get list of trusted CAs
   */
  getTrustedCAs(): string[] {
    return [...this.trustedCAs];
  }
}

