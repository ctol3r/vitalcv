import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ status: 'missing id' });
    return;
  }

  // Stubbed verification logic - randomly succeed or fail
  const verified = Math.random() > 0.5;
  const status = verified ? 'verified' : 'unverified';
  res.status(200).json({ status });
}
