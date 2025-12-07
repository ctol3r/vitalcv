/**
 * OpenAPI Documentation Routes
 *
 * Serves OpenAPI spec and Swagger UI
 */

import { Router, Request, Response } from 'express';
import { openApiSpec } from './spec';

const router = Router();

/**
 * GET /openapi.json
 *
 * Returns the OpenAPI specification as JSON
 */
router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

/**
 * GET /openapi.yaml
 *
 * Returns the OpenAPI specification as YAML
 */
router.get('/openapi.yaml', (req: Request, res: Response) => {
  // Simple JSON to YAML conversion for basic cases
  const yaml = jsonToYaml(openApiSpec);
  res.type('text/yaml').send(yaml);
});

/**
 * GET /docs
 *
 * Serves Swagger UI for interactive API documentation
 */
router.get('/docs', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VitalCV API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #1a56db; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        tryItOutEnabled: true,
        requestInterceptor: (req) => {
          // Add request ID to all requests
          req.headers['x-request-id'] = 'swagger-' + Date.now();
          return req;
        }
      });
    };
  </script>
</body>
</html>
  `.trim();

  res.type('text/html').send(html);
});

/**
 * Simple JSON to YAML converter
 * For production, use a proper YAML library
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return String(obj);
  }

  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (
      obj.includes('\n') ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ')
    ) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, value]) => {
        const valueStr = jsonToYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        if (Array.isArray(value)) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join('\n');
  }

  return String(obj);
}

export default router;
