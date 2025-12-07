import type { Request, Response, NextFunction } from 'express';

let inflight = 0;
const MAX_INFLIGHT = Number(process.env.SURGE_MAX_INFLIGHT || 50);
const Q: Function[] = [];
let tripped = false;
const FAIL_P95_MS = Number(process.env.SURGE_TRIP_P95_MS || 2500);

export function surgeGate(req: Request, res: Response, next: NextFunction) {
  if (tripped) {
    return res.status(503).json({ error: 'circuit_open' });
  }

  if (inflight >= MAX_INFLIGHT) {
    res.setHeader('retry-after', '3');
    return res.status(429).json({ error: 'surge_queue_full' });
  }

  inflight++;

  const done = () => {
    inflight = Math.max(0, inflight - 1);
    const fn = Q.shift();
    if (fn) setImmediate(() => fn());
  };

  res.on('finish', done);
  res.on('close', done);
  next();
}

// naive breaker hook you can call with recent p95
export function breakerCheck(p95: number) {
  if (p95 > FAIL_P95_MS) {
    tripped = true;
    setTimeout(() => {
      tripped = false;
    }, Number(process.env.SURGE_RESET_MS || 15000));
  }
}

