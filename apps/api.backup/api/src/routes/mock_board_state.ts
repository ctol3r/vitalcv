import { Router } from 'express';

export const mockStates = Router();

mockStates.get('/mock/board/ca/:number', (req, res) => {
  const n = req.params.number;
  res.json({
    name: 'CA Physician',
    status: 'active',
    license: n,
    state: 'CA',
    issued: '2017-03-15',
    expires: '2027-03-15',
    disciplinary: false
  });
});

mockStates.get('/mock/board/fl/:number', (req, res) => {
  const n = req.params.number;
  res.json({
    name: 'FL Physician',
    status: 'active',
    license: n,
    state: 'FL',
    issued: '2019-09-10',
    expires: '2029-09-10',
    disciplinary: false
  });
});

