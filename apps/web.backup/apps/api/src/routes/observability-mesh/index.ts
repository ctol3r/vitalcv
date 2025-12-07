import { Router } from 'express';
import {
  probeValidatorHealthV3,
  trackBlockPropagation,
  inspectTransactionQueue,
  monitorIndexingPerformance,
  detectAnomaliesAndAlert,
  detectValidatorDrift,
} from '@/services/observability-mesh';
import { anchorMeshSnapshot } from '@/services/observability-mesh/anchor';

const router = Router();

// Get mesh health
router.get('/health', async (req, res) => {
  try {
    const validators = await probeValidatorHealthV3();
    res.json({ validators });
  } catch (error) {
    console.error('[observability-mesh] health error', error);
    res.status(500).json({ error: 'Failed to get mesh health' });
  }
});

// Get block propagation
router.get('/propagation/:blockNumber', async (req, res) => {
  try {
    const blockNumber = parseInt(req.params.blockNumber);
    const metrics = await trackBlockPropagation(blockNumber);
    res.json(metrics);
  } catch (error) {
    console.error('[observability-mesh] propagation error', error);
    res.status(500).json({ error: 'Failed to track block propagation' });
  }
});

// Get transaction queue
router.get('/queue', async (req, res) => {
  try {
    const metrics = inspectTransactionQueue();
    res.json(metrics);
  } catch (error) {
    console.error('[observability-mesh] queue error', error);
    res.status(500).json({ error: 'Failed to inspect transaction queue' });
  }
});

// Get indexing performance
router.get('/indexing', async (req, res) => {
  try {
    const metrics = monitorIndexingPerformance();
    res.json(metrics);
  } catch (error) {
    console.error('[observability-mesh] indexing error', error);
    res.status(500).json({ error: 'Failed to monitor indexing performance' });
  }
});

// Get anomalies
router.get('/anomalies', async (req, res) => {
  try {
    const validators = await probeValidatorHealthV3();
    const queue = inspectTransactionQueue();
    const indexing = monitorIndexingPerformance();

    const alerts = await detectAnomaliesAndAlert(
      validators[0] ?? {},
      queue,
      indexing,
    );

    res.json({ alerts });
  } catch (error) {
    console.error('[observability-mesh] anomalies error', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// Get validator drift
router.get('/drift', async (req, res) => {
  try {
    const drifts = await detectValidatorDrift();
    res.json({ drifts });
  } catch (error) {
    console.error('[observability-mesh] drift error', error);
    res.status(500).json({ error: 'Failed to detect validator drift' });
  }
});

// Snapshot and anchor
router.post('/snapshot', async (req, res) => {
  try {
    const validators = await probeValidatorHealthV3();
    const queue = inspectTransactionQueue();
    const indexing = monitorIndexingPerformance();
    const alerts = await detectAnomaliesAndAlert(validators[0] ?? {}, queue, indexing);

    const metrics = {
      queue,
      indexing,
      validatorCount: validators.length,
    };

    anchorMeshSnapshot(validators, metrics, alerts);

    res.json({ validators, metrics, alerts, snapshotAt: new Date().toISOString() });
  } catch (error) {
    console.error('[observability-mesh] snapshot error', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

export default router;

