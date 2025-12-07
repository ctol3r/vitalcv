import { Request } from 'express';
import { UserAalStatus } from '../aal-policy';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number | string;
    email: string;
    roles: string[];
    claimLevel?: number;
    did?: string;
  };
  aalStatus?: UserAalStatus;
}

