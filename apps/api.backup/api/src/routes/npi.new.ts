// src/routes/npi.ts — NPPES v2.1 proxy + Redis cache + deactivation/replacement flags

import express from 'express';

import fetch from 'node-fetch';

import type { Request, Response } from 'express';

import { redis } from '../services/redis';



export const npiRouter = express.Router();



npiRouter.get('/lookup', async (req: Request, res: Response) => {

  const npi = String(req.query.number || req.query.npi || "");

  if (!/^[12]\d{9}$/.test(npi)) return res.status(400).json({ error: "bad_npi" });



  const cacheKey = `npi:${npi}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
  } catch (err) {
    console.warn('Redis cache miss, fetching from NPPES:', err);
  }



  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "nppes_upstream" });
    const j = await r.json();
    if (!j.result_count) return res.status(404).json({ error: "not_found" });

    const result = j.results[0] || {};
    const basic = result.basic || {};
    const entityTypeCode = (result.enumeration_type === "NPI-1" || basic.enumeration_type === "1") ? 1 : 2;

    const out = {
      npi,
      entityTypeCode,
      name: entityTypeCode === 1 ? `${basic.first_name || ""} ${basic.last_name || ""}`.trim() : basic.organization_name,
      deactivationDate: basic.deactivation_date || null,
      replacementNpi: basic.replacement_npi || null,
      lastVerified: new Date().toISOString()
    };

    try {
      await redis.set(cacheKey, JSON.stringify(out), { EX: 86400 }); // 24h TTL
    } catch (err) {
      console.warn('Redis cache set failed, continuing:', err);
    }

    return res.json(out);
  } catch (err: any) {
    console.error('NPPES lookup error:', err);
    return res.status(500).json({ error: "nppes_error", message: err.message });
  }
});

