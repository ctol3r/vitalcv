/**
 * Express Middleware Example (Node.js)
 * Tagged: run: next-batch-20251031-2
 *
 * Demonstrates how to integrate credential verification into Express routes
 */

const express = require('express');
const { verifyCredential } = require('@vitalcv/partner-sdk');

const app = express();
app.use(express.json());

/**
 * Middleware to verify VitalCV credentials
 */
function requireVerifiedCredential(options = {}) {
  return async (req, res, next) => {
    try {
      // Extract proof from request (various methods)
      const proof = req.body.proof ||
                    req.headers['x-vitalcv-proof'] ||
                    req.query.proof;

      if (!proof) {
        return res.status(401).json({
          error: 'Missing credential proof',
          message: 'Please provide a VitalCV credential in the request'
        });
      }

      // Parse if string
      const parsedProof = typeof proof === 'string' ? JSON.parse(proof) : proof;

      // Verify the credential
      const result = await verifyCredential(parsedProof, {
        checkRevocation: true,
        verifierDid: options.verifierDid || 'did:vitalcv:your-org',
      });

      if (!result.valid) {
        return res.status(401).json({
          error: 'Invalid credential',
          message: result.error,
          code: result.errorCode
        });
      }

      if (result.revoked) {
        return res.status(403).json({
          error: 'Credential revoked',
          message: 'This credential has been revoked',
          revokedAt: result.revokedAt,
          reason: result.revocationReason
        });
      }

      // Optional: Check credential type requirements
      if (options.requiredType) {
        const credentialType = result.claims?.type;
        if (credentialType !== options.requiredType) {
          return res.status(403).json({
            error: 'Wrong credential type',
            message: `This endpoint requires a ${options.requiredType} credential`,
            provided: credentialType
          });
        }
      }

      // Optional: Check NPI specialty requirements
      if (options.requiredSpecialty) {
        const specialty = result.claims?.specialty;
        if (!options.requiredSpecialty.includes(specialty)) {
          return res.status(403).json({
            error: 'Specialty not authorized',
            message: `This endpoint requires specialty: ${options.requiredSpecialty.join(', ')}`,
            provided: specialty
          });
        }
      }

      // Attach verified credential to request
      req.vitalcv = {
        verified: true,
        holderDid: result.holderDid,
        credentialId: result.credentialId,
        claims: result.claims,
        issuedAt: result.issuedAt,
        auditRef: result.auditRef,
      };

      // Log verification for audit
      console.log('[VitalCV] Verified credential:', {
        credentialId: result.credentialId,
        holderDid: result.holderDid,
        auditRef: result.auditRef,
        timestamp: new Date().toISOString(),
      });

      next();

    } catch (error) {
      console.error('[VitalCV] Verification error:', error);
      return res.status(500).json({
        error: 'Verification failed',
        message: error.message
      });
    }
  };
}

// Example routes

/**
 * Public endpoint (no credential required)
 */
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint - no credential required' });
});

/**
 * Protected endpoint (any valid credential)
 */
app.get('/api/protected', requireVerifiedCredential(), (req, res) => {
  res.json({
    message: 'You are authenticated!',
    holder: req.vitalcv.holderDid,
    claims: req.vitalcv.claims
  });
});

/**
 * Medical license required
 */
app.post('/api/submit-claim',
  requireVerifiedCredential({ requiredType: 'MedicalLicense' }),
  (req, res) => {
    const { npi, licenseNumber } = req.vitalcv.claims;

    // Process claim with verified provider credentials
    res.json({
      message: 'Claim submitted',
      provider: {
        npi,
        licenseNumber,
        verifiedAt: new Date().toISOString()
      }
    });
  }
);

/**
 * Specialty-restricted endpoint
 */
app.post('/api/prescribe',
  requireVerifiedCredential({
    requiredType: 'MedicalLicense',
    requiredSpecialty: ['Internal Medicine', 'Family Medicine', 'Cardiology']
  }),
  (req, res) => {
    const { name, specialty } = req.vitalcv.claims;

    res.json({
      message: 'Prescription authorized',
      prescriber: {
        name,
        specialty,
        npi: req.vitalcv.claims.npi
      }
    });
  }
);

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  GET  /api/public         - Public (no credential)');
  console.log('  GET  /api/protected      - Any valid credential');
  console.log('  POST /api/submit-claim   - Medical license required');
  console.log('  POST /api/prescribe      - Specific specialties only');
  console.log('\nExample request:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/protected \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"proof": {...}}\'');
});

