import { Router } from 'express';

export const scim = Router();

// NOTE: Minimal SCIM endpoints; validate bearer upstream
scim.get('/scim/v2/Users', (_req, res) =>
  res.json({
    Resources: [],
    totalResults: 0,
    startIndex: 1,
    itemsPerPage: 0,
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse']
  })
);

scim.post('/scim/v2/Users', (req, res) =>
  res.status(201).json(
    Object.assign(
      { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'] },
      req.body
    )
  )
);

scim.get('/scim/v2/Groups', (_req, res) =>
  res.json({
    Resources: [],
    totalResults: 0,
    startIndex: 1,
    itemsPerPage: 0,
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse']
  })
);

