import type { Request, Response, NextFunction } from 'express'; import { pool } from '../db';
export async function requireOrgRole(role:'admin'|'viewer'|'member'='admin'){ return async (req:Request,res:Response,next:NextFunction)=>{ const org=String(req.headers['x-org-id']||'default'); const user=String((req as any).user?.id||'demo'); const { rows }=await pool.query('SELECT role FROM "OrgUser" WHERE org_id=$1 AND user_id=$2',[org,user]); const r=rows[0]?.role||'viewer'; if(role==='admin' && r!=='admin') return res.status(403).json({error:'forbidden'}); next(); }; }

