// src/metrics/prom.ts — Prometheus /metrics endpoint for SLOs

import express from 'express';

import client from 'prom-client';

export const metricsRouter = express.Router();



const collectDefault = client.collectDefaultMetrics;

collectDefault();

export const m = {

  psvSuccess: new client.Counter({ name: "vitalcv_psv_success_total", help: "Primary Source Verification successes" }),

  psvFail:    new client.Counter({ name: "vitalcv_psv_failure_total", help: "PSV failures" }),

  ttpSeconds: new client.Histogram({ name: "vitalcv_ttp_seconds", help: "Time to privilege in seconds", buckets:[86400,604800,1209600,2592000] }),

  evidenceComplete: new client.Gauge({ name: "vitalcv_evidence_complete_ratio", help: "Apps with complete evidence ratio" })

};



metricsRouter.get("/", async (_req, res) => {

  res.set("Content-Type", client.register.contentType);

  res.end(await client.register.metrics());

});

