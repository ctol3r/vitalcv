/**
 * B119C-ROI-024: ROI endpoint tests
 *
 * Unit tests for ROI calculation endpoint
 */

import request from 'supertest';
import express from 'express';
import roiRouter from '../index';

const app = express();
app.use(express.json());
app.use('/api/roi', roiRouter);

describe('ROI Calculation Endpoint', () => {
  describe('POST /api/roi/calculate', () => {
    it('should calculate ROI with valid inputs', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 200,
          clinician_hourly_rate: 150,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.roi).toBeDefined();
      expect(response.body.roi.minutes_saved.per_visit).toBe(5);
      expect(response.body.roi.minutes_saved.per_month).toBe(1000);
      expect(response.body.roi.minutes_saved.per_year).toBe(12000);
      expect(response.body.roi.dollar_projection.per_month).toBe(2500);
      expect(response.body.roi.dollar_projection.per_year).toBe(30000);
    });

    it('should use default hourly rate if not provided', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 200,
        });

      expect(response.status).toBe(200);
      expect(response.body.roi.dollar_projection.hourly_rate_used).toBe(150);
    });

    it('should calculate break-even months if implementation cost provided', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 200,
          clinician_hourly_rate: 150,
          implementation_cost: 10000,
        });

      expect(response.status).toBe(200);
      expect(response.body.roi.roi_metrics.break_even_months).toBe(4); // 10000 / 2500 = 4 months
    });

    it('should return error for invalid minutes_saved', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: -5,
          visits_per_month: 200,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_input');
    });

    it('should return error for invalid visits_per_month', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_input');
    });

    it('should calculate time savings percentage correctly', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 200,
        });

      expect(response.status).toBe(200);
      // 5 minutes saved out of 15 baseline = 33.33%
      expect(response.body.roi.roi_metrics.time_savings_percentage).toBeCloseTo(33.33, 1);
    });

    it('should include evidence reference', async () => {
      const response = await request(app)
        .post('/api/roi/calculate')
        .send({
          minutes_saved: 5,
          visits_per_month: 200,
        });

      expect(response.status).toBe(200);
      expect(response.body.roi.evidence_reference).toBeDefined();
      expect(response.body.roi.evidence_reference.study).toContain('Ambient');
      expect(response.body.roi.evidence_reference.doi).toBe('10.1001/jamanetworkopen.2025.34976');
    });
  });

  describe('GET /api/roi/example', () => {
    it('should return example calculation', async () => {
      const response = await request(app)
        .get('/api/roi/example');

      expect(response.status).toBe(200);
      expect(response.body.example_request).toBeDefined();
      expect(response.body.example_response).toBeDefined();
    });
  });
});

