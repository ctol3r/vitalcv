import { rotateKeys } from '../security/jwks';
import { auditLog } from '../controllers/audit';

(async () => {
  try {
    const out = await rotateKeys();
    await auditLog('system', 'issuer.keys.rotated', { kid: out.kid });
    console.log('ROTATE_OK', out.kid);
    process.exit(0);
  } catch (error) {
    console.error('ROTATE_FAILED', error);
    process.exit(1);
  }
})();

