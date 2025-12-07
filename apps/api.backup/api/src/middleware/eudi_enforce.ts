import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export function eudiEnforce(req: Request, res: Response, next: NextFunction) {
  // Dev bypass: skip enforcement if DEV_EUDI_ENFORCE is explicitly set to '0'
  if (process.env.DEV_EUDI_ENFORCE === '0') {
    return next();
  }

  try {
    // Read trusted list snapshot from the project root or configured path
    const snapshotPath =
      process.env.TRUSTED_LIST_PATH || path.join(__dirname, '../../trusted_list_snapshot.json');

    const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

    // Check if trusted list is stale (>7 days)
    const age = (Date.now() - Date.parse(snap.fetched_at)) / 86400000;

    if (age > 7) {
      return res.status(412).json({
        error: 'trusted_list_stale',
        days: Math.floor(age),
        message: 'Trusted list is stale. EUDI issuance blocked.',
      });
    }

    // TODO: Check profile assurance requirements
    // if (snap.min_assurance && !meetsAssurance(req, snap.min_assurance)) {
    //   return res.status(412).json({error: 'assurance_unmet'});
    // }

    return next();
  } catch (err) {
    return res.status(412).json({
      error: 'no_trusted_list',
      message: 'Trusted list snapshot not found or invalid.',
    });
  }
}
