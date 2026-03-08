/**
 * Wave 189 — Prequalification Routes
 *
 * POST /api/interview/start
 * POST /api/interview/turn
 * GET  /api/assessments/modules
 * POST /api/assessments/start
 * POST /api/assessments/submit
 * GET  /api/prequalification/status/:npi
 * POST /api/prequalification/step
 */

import type { Express, Request, Response } from 'express';
import {
  getPrequalificationStatus,
  updatePrequalificationStep,
  startInterview,
  addInterviewTurn,
  getAssessmentModules,
  submitAssessment,
} from '../services/prequalification/prequalificationService';
import type { PreqStep, InterviewRole } from '../services/prequalification/prequalificationService';

export function registerPrequalificationRoutes(app: Express): void {

  /** POST /api/interview/start — { npi, role } */
  app.post('/api/interview/start', (req: Request, res: Response) => {
    const { npi, role } = req.body ?? {};
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const session = startInterview(npi, (role as InterviewRole) ?? 'clinician');
    res.status(201).json({ session });
  });

  /** POST /api/interview/turn — { sessionId, message } */
  app.post('/api/interview/turn', (req: Request, res: Response) => {
    const { sessionId, message } = req.body ?? {};
    if (!sessionId || !message) {
      res.status(400).json({ error: 'sessionId and message required' });
      return;
    }
    const session = addInterviewTurn(sessionId, message);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session });
  });

  /** GET /api/assessments/modules?specialty= */
  app.get('/api/assessments/modules', (req: Request, res: Response) => {
    const specialty = req.query.specialty as string | undefined;
    const modules = getAssessmentModules(specialty);
    res.json({ modules });
  });

  /** POST /api/assessments/start — { moduleId } (stub: just returns module) */
  app.post('/api/assessments/start', (req: Request, res: Response) => {
    const { moduleId } = req.body ?? {};
    if (!moduleId) { res.status(400).json({ error: 'moduleId required' }); return; }
    const modules = getAssessmentModules();
    const module = modules.find(m => m.id === moduleId);
    if (!module) { res.status(404).json({ error: 'Module not found' }); return; }
    res.json({ module });
  });

  /** POST /api/assessments/submit — { npi, moduleId, answers } */
  app.post('/api/assessments/submit', (req: Request, res: Response) => {
    const { npi, moduleId, answers } = req.body ?? {};
    if (!npi || !moduleId) {
      res.status(400).json({ error: 'npi and moduleId required' });
      return;
    }
    try {
      const result = submitAssessment(npi, moduleId, answers ?? {});
      res.json({ result });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  /** GET /api/prequalification/status/:npi */
  app.get('/api/prequalification/status/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    const status = getPrequalificationStatus(npi);
    res.json({ status });
  });

  /** POST /api/prequalification/step — { npi, step } */
  app.post('/api/prequalification/step', (req: Request, res: Response) => {
    const { npi, step } = req.body ?? {};
    if (!npi || !step) {
      res.status(400).json({ error: 'npi and step required' });
      return;
    }
    const status = updatePrequalificationStep(npi, step as PreqStep);
    res.json({ status });
  });
}
