import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  role: 'user' | 'clinician';
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
