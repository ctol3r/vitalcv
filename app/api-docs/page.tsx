'use client';

import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

const spec = {
  openapi: '3.0.0',
  info: { title: 'VitalCV API', version: '0.1.0' },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health',
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};

export default function ApiDocsPage() {
  return (
    <main style={{ padding: 24 }}>
      <SwaggerUI spec={spec} />
    </main>
  );
}
