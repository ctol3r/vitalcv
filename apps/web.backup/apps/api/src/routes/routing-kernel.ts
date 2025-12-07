import { Router, type Request, type Response } from 'express';
import {
  getOrCreateRoutingKernel,
  exportRoutingKernel,
  anchorRoutingKernelSnapshot,
  integrateMultiRegionRouting,
} from '../services/routing/kernel';

const router = Router();

router.get('/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const kernel = await getOrCreateRoutingKernel(region);
    return res.json(kernel);
  } catch (error) {
    console.error('[routing-kernel] failed', error);
    return res.status(500).json({
      error: 'kernel_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:region/build', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const kernel = await getOrCreateRoutingKernel(region);
    return res.json(kernel);
  } catch (error) {
    console.error('[routing-kernel] build failed', error);
    return res.status(500).json({
      error: 'kernel_build_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:region/anchor', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    await anchorRoutingKernelSnapshot(region);
    return res.json({ success: true, message: 'Routing kernel anchored' });
  } catch (error) {
    console.error('[routing-kernel] anchor failed', error);
    return res.status(500).json({
      error: 'kernel_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:region/export', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const exportData = await exportRoutingKernel(region);
    return res.json(exportData);
  } catch (error) {
    console.error('[routing-kernel] export failed', error);
    return res.status(500).json({
      error: 'kernel_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/multi-region', async (req: Request, res: Response) => {
  try {
    const { regions } = req.body as { regions: string[] };
    if (!Array.isArray(regions)) {
      return res.status(400).json({ error: 'regions must be an array' });
    }
    const kernels = await integrateMultiRegionRouting(regions);
    return res.json(kernels);
  } catch (error) {
    console.error('[routing-kernel] multi-region failed', error);
    return res.status(500).json({
      error: 'multi_region_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

