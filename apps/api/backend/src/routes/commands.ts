import { CommandName, CommandSchemas } from '@vitalcv/command-registry';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { log } from '../obs/logger';
import { parseCommandIntent } from '../services/ai/commandParser';

export function registerCommandRoutes(app: Express): void {
  app.post('/api/command/parse', async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Missing or invalid "text" parameter.' });
        return;
      }

      const parsed = await parseCommandIntent(text);
      if (!parsed) {
        res.status(404).json({ error: 'Could not resolve to a known command.' });
        return;
      }

      const schema = CommandSchemas[parsed.commandName];

      // Validate payload partially. We want to return what is valid and what's missing
      const validation = schema.safeParse(parsed.payload);

      let requiredFields: Record<string, any> = {};
      if (schema instanceof z.ZodObject) {
         // Naive extraction of schema shape for dynamic front-end form generation
         requiredFields = extractZodShapeInfo(schema);
      }

      res.json({
        command: parsed.commandName,
        payload: parsed.payload,
        isValid: validation.success,
        diagnostics: validation.success ? [] : validation.error.issues,
        schemaInfo: requiredFields,
      });

    } catch (e) {
      log('error', 'Failed to parse command', { error: String(e) });
      res.status(500).json({ error: 'Failed to parse command.' });
    }
  });

  app.post('/api/command/execute', async (req: Request, res: Response): Promise<void> => {
    try {
      const { command, payload } = req.body;
      if (!command || !payload) {
        res.status(400).json({ error: 'Missing command or payload.' });
        return;
      }

      const schema = CommandSchemas[command as CommandName];
      if (!schema) {
        res.status(400).json({ error: 'Unknown command type.' });
        return;
      }

      const validation = schema.safeParse(payload);
      if (!validation.success) {
        res.status(400).json({ error: 'Invalid parameters for command.', issues: validation.error.issues });
        return;
      }

      // In production, dispatch to specific domain handlers based on `command`
      // For now, mock a successful execution response.
      res.json({
        success: true,
        message: `Successfully executed ${command}`,
        result: {
          transactionId: `cmd-${Date.now()}`,
          payload: validation.data
        }
      });
    } catch (e) {
      log('error', 'Failed to execute command', { error: String(e) });
      res.status(500).json({ error: 'Failed to execute command.' });
    }
  });
}

function extractZodShapeInfo(schema: z.ZodObject<any>): Record<string, any> {
  const shape = schema.shape;
  const fields: Record<string, any> = {};

  for (const [key, val] of Object.entries(shape)) {
    let type = 'string'; // Default simplified type
    let description = '';

    // basic reflection
    if (val instanceof z.ZodString) {
      type = 'string';
      description = val.description || '';
    } else if (val instanceof z.ZodNumber) {
      type = 'number';
      description = val.description || '';
    } else if (val instanceof z.ZodOptional) {
      const inner = val._def.innerType;
      type = inner instanceof z.ZodNumber ? 'number' : 'string';
      description = (inner as any).description || '';
    }

    fields[key] = {
      type,
      description,
      isOptional: val instanceof z.ZodOptional
    };
  }
  return fields;
}
