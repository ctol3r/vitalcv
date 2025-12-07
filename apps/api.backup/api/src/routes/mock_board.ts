import { Router } from 'express';

export const mockBoard = Router();

mockBoard.get('/mock/board/:state/:number', (req, res) => {
  const { state, number } = req.params;

  // Return realistic board certification data
  res.json({
    name: 'Demo Physician',
    status: 'active',
    license_number: number,
    state: state.toUpperCase(),
    board: 'ABMS',
    specialty: 'Internal Medicine',
    certification_date: '2018-01-01',
    issued: '2018-01-01',
    expires: '2026-12-31',
    last_verified: new Date().toISOString()
  });
});

