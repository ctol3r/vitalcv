import { Request, Response } from "express";

export const login = (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Auth not implemented in MVP"
  });
};