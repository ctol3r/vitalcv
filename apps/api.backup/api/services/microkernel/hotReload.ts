/**
 * Module Hot-Reload (dev-mode)
 *
 * Supports reloading module code in dev without restarting server.
 * Triggers registry recalculation.
 */

import { moduleRegistry } from './registry.js';
import { createLogger } from '@chai-vc/logging-core';
import type { ModuleRecord } from './registry.js';

const log = createLogger({ service: 'microkernel-hotreload' });

// Only enable in development
const isDev = process.env.NODE_ENV === 'development';

export interface HotReloadOptions {
  /** Whether to clear existing module before reload */
  clearExisting?: boolean;
  /** Whether to validate module after reload */
  validate?: boolean;
}

/**
 * Hot reload a module
 */
export async function hotReloadModule(
  moduleId: string,
  moduleDefinition: Omit<ModuleRecord, 'registeredAt' | 'updatedAt'>,
  options: HotReloadOptions = {}
): Promise<ModuleRecord> {
  if (!isDev) {
    throw new Error('Hot reload is only available in development mode');
  }

  log.info('Hot reloading module', { moduleId, options });

  try {
    // Clear existing if requested
    if (options.clearExisting) {
      const existing = moduleRegistry.get(moduleId);
      if (existing) {
        // Mark as disabled during reload
        moduleRegistry.setEnabled(moduleId, false);
        log.debug('Disabled module during reload', { moduleId });
      }
    }

    // Register/update module
    const existing = moduleRegistry.get(moduleId);
    let module: ModuleRecord;

    if (existing) {
      // Update existing
      module = moduleRegistry.update(moduleId, {
        ...moduleDefinition,
        enabled: existing.enabled, // Preserve enabled state unless explicitly set
      });
    } else {
      // Register new
      module = moduleRegistry.register(moduleDefinition);
    }

    // Validate if requested
    if (options.validate !== false) {
      await validateModule(module);
    }

    // Re-enable if it was disabled for reload
    if (options.clearExisting && !module.enabled) {
      moduleRegistry.setEnabled(moduleId, true);
    }

    log.info('Module hot reloaded successfully', {
      moduleId,
      capabilityCount: module.capabilities.length,
    });

    return module;
  } catch (error) {
    log.error('Hot reload failed', { moduleId, error });
    throw error;
  }
}

/**
 * Hot reload multiple modules
 */
export async function hotReloadModules(
  modules: Array<{ id: string; definition: Omit<ModuleRecord, 'registeredAt' | 'updatedAt'> }>,
  options: HotReloadOptions = {}
): Promise<ModuleRecord[]> {
  const results: ModuleRecord[] = [];

  for (const { id, definition } of modules) {
    try {
      const module = await hotReloadModule(id, definition, options);
      results.push(module);
    } catch (error) {
      log.error('Failed to hot reload module in batch', { moduleId: id, error });
      // Continue with other modules
    }
  }

  log.info('Batch hot reload completed', {
    total: modules.length,
    successful: results.length,
    failed: modules.length - results.length,
  });

  return results;
}

/**
 * Validate a module
 */
async function validateModule(module: ModuleRecord): Promise<void> {
  // Check that module has at least one capability
  if (module.capabilities.length === 0) {
    throw new Error(`Module ${module.id} has no capabilities`);
  }

  // Check that all capabilities have required fields
  for (const capability of module.capabilities) {
    if (!capability.id || !capability.type || !capability.name) {
      throw new Error(
        `Module ${module.id} has invalid capability: missing id, type, or name`
      );
    }
  }

  // Check dependencies exist
  if (module.metadata?.moduleDependencies) {
    for (const depId of module.metadata.moduleDependencies) {
      if (!moduleRegistry.get(depId)) {
        log.warn('Module dependency not found', {
          moduleId: module.id,
          dependencyId: depId,
        });
      }
    }
  }
}

/**
 * Check if hot reload is enabled
 */
export function isHotReloadEnabled(): boolean {
  return isDev;
}

/**
 * Watch for file changes and auto-reload modules (dev only)
 */
export function watchModules(
  watchPaths: string[],
  loader: (path: string) => Promise<Omit<ModuleRecord, 'registeredAt' | 'updatedAt'>>,
  options: HotReloadOptions = {}
): void {
  if (!isDev) {
    log.warn('Module watching is only available in development mode');
    return;
  }

  // In a real implementation, this would use chokidar or similar
  // For now, we'll just log that watching would be enabled
  log.info('Module watching enabled (stub)', {
    watchPaths,
    note: 'File watching not implemented - use hotReloadModule() directly',
  });

  // TODO: Implement file watching with chokidar
  // import chokidar from 'chokidar';
  // const watcher = chokidar.watch(watchPaths, { ignored: /node_modules/ });
  // watcher.on('change', async (path) => {
  //   try {
  //     const definition = await loader(path);
  //     await hotReloadModule(definition.id, definition, options);
  //   } catch (error) {
  //     log.error('Failed to reload module from file change', { path, error });
  //   }
  // });
}

