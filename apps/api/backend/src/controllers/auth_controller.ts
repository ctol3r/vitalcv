import { Request, Response } from 'express';
import { generateToken } from '../auth/jwt';

// In a real application, you would validate the user's credentials against a database.
// This controller is a simplified placeholder to demonstrate JWT issuance.
export const login = (req: Request, res: Response) => {
  const { userId, role } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ message: 'userId and role are required' });
  }
  const token = generateToken({ userId, role });
  res.json({ token });
};
