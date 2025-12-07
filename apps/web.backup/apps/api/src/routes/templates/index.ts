import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateTemplateSchema } from '../../services/templates/validate';

const router = Router();
const prisma = new PrismaClient();

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { issuerId, name, schema, metadata } = req.body ?? {};
    if (!issuerId || !name || !schema) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'issuerId, name, and schema are required',
      });
    }

    const validation = validateTemplateSchema(schema);
    if (!validation.valid) {
      return res.status(422).json({
        error: 'template_validation_failed',
        errors: validation.errors,
      });
    }

    const created = await prisma.credentialTemplate.create({
      data: {
        issuerId: String(issuerId),
        name: String(name),
        schema,
        metadata: metadata ?? {},
      },
    });

    await prisma.credentialTemplateVersion.create({
      data: {
        templateId: created.id,
        version: 1,
        name: created.name,
        schema: created.schema,
      },
    });

    const payload = await prisma.credentialTemplate.findUnique({
      where: { id: created.id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    return res.status(201).json({
      template: serializeTemplate(payload),
      validation,
    });
  } catch (error) {
    console.error('[templates] create failed', error);
    return res.status(500).json({
      error: 'template_create_failed',
      message: error instanceof Error ? error.message : 'Unable to save template',
    });
  }
});

router.get('/templates/:issuerId', async (req: Request, res: Response) => {
  try {
    const issuerId = String(req.params.issuerId).trim();
    if (!issuerId) {
      return res.status(400).json({ error: 'issuer_id_required' });
    }

    const templates = await prisma.credentialTemplate.findMany({
      where: { issuerId },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    return res.json({
      issuerId,
      templates: templates.map(serializeTemplate),
      total: templates.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[templates] list failed', error);
    return res.status(500).json({
      error: 'template_list_failed',
      message: error instanceof Error ? error.message : 'Unable to list templates',
    });
  }
});

router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    const { name, schema, metadata } = req.body ?? {};

    const existing = await prisma.credentialTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'template_not_found' });
    }

    let validationResult: ReturnType<typeof validateTemplateSchema> | undefined;
    let nextSchema = existing.schema as Record<string, any>;

    if (schema) {
      validationResult = validateTemplateSchema(schema);
      if (!validationResult.valid) {
        return res.status(422).json({
          error: 'template_validation_failed',
          errors: validationResult.errors,
        });
      }
      nextSchema = schema;
    }

    const nextVersion = (existing.currentVersion ?? 1) + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const template = await tx.credentialTemplate.update({
        where: { id: templateId },
        data: {
          name: typeof name === 'string' && name ? name : existing.name,
          schema: nextSchema,
          currentVersion: nextVersion,
          metadata: metadata ?? existing.metadata,
        },
      });

      await tx.credentialTemplateVersion.create({
        data: {
          templateId,
          version: nextVersion,
          name: template.name,
          schema: template.schema,
        },
      });

      return template;
    });

    const payload = await prisma.credentialTemplate.findUnique({
      where: { id: updated.id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    return res.json({
      template: serializeTemplate(payload),
      validation: validationResult,
    });
  } catch (error) {
    console.error('[templates] update failed', error);
    return res.status(500).json({
      error: 'template_update_failed',
      message: error instanceof Error ? error.message : 'Unable to update template',
    });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    await prisma.credentialTemplate.delete({
      where: { id: templateId },
    });
    return res.status(204).send('');
  } catch (error) {
    console.error('[templates] delete failed', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'template_not_found' });
    }
    return res.status(500).json({
      error: 'template_delete_failed',
      message: error instanceof Error ? error.message : 'Unable to delete template',
    });
  }
});

export default router;

function serializeTemplate(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    issuerId: record.issuerId,
    name: record.name,
    schema: record.schema,
    metadata: record.metadata ?? null,
    currentVersion: record.currentVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    versions: (record.versions ?? []).map((version: any) => ({
      id: version.id,
      version: version.version,
      name: version.name,
      schema: version.schema,
      createdAt: version.createdAt,
    })),
  };
}










