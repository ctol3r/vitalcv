/**
 * B252B-I18N-020: i18nAPI endpoints
 *
 * REST endpoints:
 * - List languages
 * - List translation keys
 * - Update translations
 * - Upload language packs
 * - Enforce RBAC
 * - Input validation
 * - Returns data in paginated results
 */

import { Request, Response, Router } from 'express';
import { PrismaClient, TranslationValueStatus } from '@prisma/client';
import { TranslationService } from '../services/translationService';
import { LanguageDetectionService } from '../services/languageDetectionService';
import { LanguagePackImportExportService } from '../services/languagePackImportExportService';
import { LocalizationMetricsService } from '../analytics/localizationMetricsService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions?: string[];
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * i18nAPI
 *
 * REST API endpoints for i18n management
 */
export class I18nAPI {
  private router: Router;
  private translationService: TranslationService;
  private languageDetection: LanguageDetectionService;
  private languagePackService: LanguagePackImportExportService;
  private metricsService: LocalizationMetricsService;

  constructor(private prisma: PrismaClient) {
    this.router = Router();
    this.translationService = new TranslationService(prisma);
    this.languageDetection = new LanguageDetectionService(prisma);
    this.languagePackService = new LanguagePackImportExportService(prisma);
    this.metricsService = new LocalizationMetricsService(prisma);

    this.setupRoutes();
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // Languages
    this.router.get('/languages', this.listLanguages.bind(this));
    this.router.get('/languages/:code', this.getLanguage.bind(this));

    // Translation keys
    this.router.get('/keys', this.listTranslationKeys.bind(this));
    this.router.get('/keys/:key', this.getTranslationKey.bind(this));
    this.router.post('/keys', this.createTranslationKey.bind(this));

    // Translations
    this.router.get('/translations', this.listTranslations.bind(this));
    this.router.get('/translations/:key/:languageCode', this.getTranslation.bind(this));
    this.router.post('/translations', this.addTranslation.bind(this));
    this.router.put('/translations/:key/:languageCode', this.updateTranslation.bind(this));

    // Language packs
    this.router.get('/language-packs/:languageCode/export', this.exportLanguagePack.bind(this));
    this.router.post('/language-packs/import', this.importLanguagePack.bind(this));

    // Metrics
    this.router.get('/metrics', this.getMetrics.bind(this));
    this.router.get('/metrics/languages', this.getLanguageMetrics.bind(this));
    this.router.get('/metrics/keys', this.getKeyMetrics.bind(this));
    this.router.get('/metrics/untranslated', this.getUntranslatedKeys.bind(this));
  }

  /**
   * Get router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * RBAC check
   */
  private checkPermission(req: AuthRequest, permission: string): boolean {
    const user = req.user;
    if (!user) {
      return false;
    }

    // Check permissions
    if (user.permissions?.includes(permission)) {
      return true;
    }

    // Check admin roles
    if (user.roles.includes('admin') || user.roles.includes('superadmin')) {
      return true;
    }

    return false;
  }

  /**
   * Require authentication
   */
  private requireAuth(req: AuthRequest, res: Response, next: () => void): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  /**
   * Require permission
   */
  private requirePermission(permission: string) {
    return (req: AuthRequest, res: Response, next: () => void) => {
      if (!this.checkPermission(req, permission)) {
        res.status(403).json({ error: 'Forbidden: Missing permission', permission });
        return;
      }
      next();
    };
  }

  /**
   * Pagination helper
   */
  private getPaginationParams(req: Request): { page: number; pageSize: number; skip: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const skip = (page - 1) * pageSize;

    return { page, pageSize, skip };
  }

  /**
   * GET /languages - List all languages
   */
  private async listLanguages(req: Request, res: Response): Promise<void> {
    try {
      const { page, pageSize, skip } = this.getPaginationParams(req);
      const enabled = req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined;

      const where = enabled !== undefined ? { enabled } : {};

      const [languages, total] = await Promise.all([
        this.prisma.translationLanguage.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { name: 'asc' },
        }),
        this.prisma.translationLanguage.count({ where }),
      ]);

      const response: PaginatedResponse<any> = {
        data: languages,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /languages/:code - Get language by code
   */
  private async getLanguage(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;

      const language = await this.prisma.translationLanguage.findUnique({
        where: { languageCode: code },
      });

      if (!language) {
        res.status(404).json({ error: 'Language not found' });
        return;
      }

      res.json(language);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /keys - List translation keys
   */
  private async listTranslationKeys(req: Request, res: Response): Promise<void> {
    try {
      const { page, pageSize, skip } = this.getPaginationParams(req);
      const search = req.query.search as string | undefined;

      const where = search
        ? {
            OR: [
              { key: { contains: search, mode: 'insensitive' as const } },
              { defaultMessage: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [keys, total] = await Promise.all([
        this.prisma.translationKeyB252A.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { key: 'asc' },
        }),
        this.prisma.translationKeyB252A.count({ where }),
      ]);

      const response: PaginatedResponse<any> = {
        data: keys,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /keys/:key - Get translation key
   */
  private async getTranslationKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      const translationKey = await this.prisma.translationKeyB252A.findUnique({
        where: { key },
        include: {
          values: {
            include: {
              language: true,
            },
          },
        },
      });

      if (!translationKey) {
        res.status(404).json({ error: 'Translation key not found' });
        return;
      }

      res.json(translationKey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /keys - Create translation key
   */
  private createTranslationKey = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:write'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { key, defaultMessage, description } = req.body;

        // Validation
        if (!key || !defaultMessage) {
          res.status(400).json({ error: 'key and defaultMessage are required' });
          return;
        }

        const translationKey = await this.prisma.translationKeyB252A.create({
          data: {
            key,
            defaultMessage,
            description,
          },
        });

        res.status(201).json(translationKey);
      } catch (error: any) {
        if (error.code === 'P2002') {
          res.status(409).json({ error: 'Translation key already exists' });
          return;
        }
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /translations - List translations
   */
  private async listTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { page, pageSize, skip } = this.getPaginationParams(req);
      const languageCode = req.query.languageCode as string | undefined;
      const status = req.query.status as string | undefined;

      const where: any = {};
      if (languageCode) {
        const language = await this.prisma.translationLanguage.findUnique({
          where: { languageCode },
        });
        if (language) {
          where.languageId = language.id;
        }
      }
      if (status) {
        where.status = status;
      }

      const [translations, total] = await Promise.all([
        this.prisma.translationValue.findMany({
          where,
          skip,
          take: pageSize,
          include: {
            translationKey: true,
            language: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.translationValue.count({ where }),
      ]);

      const response: PaginatedResponse<any> = {
        data: translations,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /translations/:key/:languageCode - Get translation
   */
  private async getTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { key, languageCode } = req.params;

      const translation = await this.translationService.getTranslation(key, languageCode);

      res.json({
        key,
        languageCode,
        value: translation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /translations - Add translation
   */
  private addTranslation = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:write'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { key, languageCode, value, status } = req.body;

        // Validation
        if (!key || !languageCode || !value) {
          res.status(400).json({ error: 'key, languageCode, and value are required' });
          return;
        }

        await this.translationService.addTranslation({
          key,
          languageCode,
          value,
          status: status || TranslationValueStatus.DRAFT,
        });

        res.status(201).json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * PUT /translations/:key/:languageCode - Update translation
   */
  private updateTranslation = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:write'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { key, languageCode } = req.params;
        const { value, status } = req.body;

        // Validation
        if (!value && !status) {
          res.status(400).json({ error: 'value or status is required' });
          return;
        }

        await this.translationService.updateTranslation(key, languageCode, {
          value,
          status,
        });

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /language-packs/:languageCode/export - Export language pack
   */
  private exportLanguagePack = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:read'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { languageCode } = req.params;
        const format = req.query.format as string || 'json';
        const version = req.query.version as string || '1.0.0';

        if (format === 'csv') {
          const csv = await this.languagePackService.exportToCSV(languageCode, version);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${languageCode}-${version}.csv"`);
          res.send(csv);
        } else {
          const json = await this.languagePackService.exportToJSON(languageCode, version);
          res.json(json);
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * POST /language-packs/import - Import language pack
   */
  private importLanguagePack = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:write'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { languageCode, format, data } = req.body;

        // Validation
        if (!languageCode || !format || !data) {
          res.status(400).json({ error: 'languageCode, format, and data are required' });
          return;
        }

        let result;
        if (format === 'csv') {
          result = await this.languagePackService.importFromCSV(data, languageCode, req.user?.id);
        } else {
          result = await this.languagePackService.importFromJSON(data, req.user?.id);
        }

        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /metrics - Get comprehensive metrics
   */
  private getMetrics = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:read'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const report = await this.metricsService.generateReport();
        res.json(report);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /metrics/languages - Get language metrics
   */
  private getLanguageMetrics = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:read'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const metrics = await this.metricsService.getLanguageMetrics();
        res.json(metrics);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /metrics/keys - Get key metrics
   */
  private getKeyMetrics = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:read'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const metrics = await this.metricsService.getKeyMetrics();
        res.json(metrics);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];

  /**
   * GET /metrics/untranslated - Get untranslated keys
   */
  private getUntranslatedKeys = [
    this.requireAuth.bind(this),
    this.requirePermission('i18n:read'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const languageCode = req.query.languageCode as string | undefined;
        const keys = await this.metricsService.getUntranslatedKeys(languageCode);
        res.json(keys);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    },
  ];
}

/**
 * Factory function to create i18n API router
 */
export function createI18nAPI(prisma: PrismaClient): Router {
  const api = new I18nAPI(prisma);
  return api.getRouter();
}

