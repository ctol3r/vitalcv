import { Router, type Request, type Response } from 'express';
import {
  getVerificationState,
  transitionState,
  getStateTransitions,
  optimizeVerificationPath,
  exportStateMachineLogs,
  anchorStateMachineSnapshot,
} from '@/services/verification/stateMachine';

const router = Router();

/**
 * Task 363.5 — Verification machine UI endpoint
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const state = await getVerificationState(sessionId);
    return res.json(state);
  } catch (error) {
    console.error('[VerificationStateMachine] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.get('/:sessionId/transitions', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const state = await getVerificationState(sessionId);
    const transitions = getStateTransitions(state.proofType, state.currentState);
    return res.json({ transitions });
  } catch (error) {
    console.error('[VerificationStateMachine] Transitions failed', error);
    return res.status(500).json({ error: 'transitions_failed' });
  }
});

router.post('/:sessionId/transition', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { newState, reason } = req.body;
    const state = await transitionState(sessionId, newState, reason);
    return res.json(state);
  } catch (error) {
    console.error('[VerificationStateMachine] Transition failed', error);
    return res.status(500).json({ error: 'transition_failed' });
  }
});

router.post('/:sessionId/optimize', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { proofType, verifierPrivilege } = req.body;
    const state = await getVerificationState(sessionId);
    const path = await optimizeVerificationPath(
      proofType || state.proofType,
      state.chainHealth,
      verifierPrivilege || state.verifierPrivilege,
    );
    return res.json({ path });
  } catch (error) {
    console.error('[VerificationStateMachine] Optimize failed', error);
    return res.status(500).json({ error: 'optimize_failed' });
  }
});

router.get('/:sessionId/export', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const logs = await exportStateMachineLogs(sessionId);
    return res.json(logs);
  } catch (error) {
    console.error('[VerificationStateMachine] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:sessionId/anchor', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const txHash = await anchorStateMachineSnapshot(sessionId);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[VerificationStateMachine] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

