import { Router } from 'express';
import { load, save } from '../revocation/status_persist';
import { StatusList } from '../../backend/src/services/revocation/statusList';

export const statusListRouter = Router();

// Global status list instance (simplified for demo)
let statusList: StatusList | null = null;

statusListRouter.get('/status/:id', async (req, res) => {
  try {
    // Try to load saved status list
    const saved = load();
    if (saved) {
      return res.json(saved);
    }

    // Create fresh status list
    if (!statusList) {
      statusList = new StatusList();
    }

    const fresh = await statusList.toCredential();
    save(fresh);

    return res.json(fresh);
  } catch (error) {
    console.error('StatusList error:', error);
    return res.status(500).json({ error: 'Failed to retrieve status list' });
  }
});

// Revoke a credential by setting bit at index
statusListRouter.post('/status/:id/revoke', async (req, res) => {
  try {
    const { index } = req.body;

    if (!statusList) {
      statusList = new StatusList();
    }

    statusList.setBit(parseInt(index, 10), true);
    const updated = await statusList.toCredential();
    save(updated);

    return res.json({ ok: true, index });
  } catch (error: any) {
    console.error('Revocation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

