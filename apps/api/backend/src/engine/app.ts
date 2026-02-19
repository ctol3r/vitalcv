import express from 'express';
import cors from 'cors';
import { NppesAdapter } from './adapters/nppesAdapter';
import { AdapterRegistry } from './adapters/types';
import { buildPsvArtifact } from './services/artifactBuilder';
import { signArtifact, getJwks } from './services/signingService';

const app = express();

app.use(cors());
app.use(express.json());

// ── Adapter Registry ─────────────────────────────────────────

const registry = new AdapterRegistry();
registry.register(new NppesAdapter());

// ── Routes ───────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'psv', version: '1.0' });
});

app.get('/.well-known/jwks.json', (_req, res) => {
  try {
    const jwks = getJwks();
    res.json(jwks);
  } catch (err) {
    res.status(500).json({ error: 'JWKS unavailable — signing keys not configured' });
  }
});

app.post('/verify', async (req, res) => {
  try {
    const { npi } = req.body as { npi?: string };

    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI. Must be a 10-digit number.' });
      return;
    }

    // Step 1: Select adapter (NPPES for now — all individual NPI lookups)
    const adapter = registry.getAdapter('INDIVIDUAL', 'NPI_ENROLLMENT');
    if (!adapter) {
      res.status(500).json({ error: 'No adapter registered for INDIVIDUAL:NPI_ENROLLMENT' });
      return;
    }

    // Step 2: Run adapter verification against primary source
    const payload = await adapter.verify(npi);

    // Step 3: Build cryptographically signed artifact
    const { artifact } = await buildPsvArtifact(payload, signArtifact);

    // Step 4: Return artifact
    res.json(artifact);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

export default app;
