import { Router } from 'express';
import { lookupPsypactByNpi } from '../adapters/psypact_registry';
import { pool } from '../db';

export const psy=Router();

psy.get('/api/psych/psypact/status', async (req,res)=>{
  const npi=(req.query.npi||'').toString();
  if(!npi) return res.status(400).json({error:'missing npi'});
  const out=await lookupPsypactByNpi(npi);
  res.json(out);
});

psy.delete('/api/psych/psypact/cache/:npi', async (req,res)=>{
  await pool.query('DELETE FROM "PsychPsyPactStatus" WHERE npi=$1',[req.params.npi]);
  res.json({ok:true});
});
