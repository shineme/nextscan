/**
 * Application Startup
 * Initializes services and resumes unfinished tasks
 */

import scannerService from './scanner-service';
import { automationScheduler } from './automation-scheduler';
import logger from './logger-service';

let initialized = false;

/**
 * Initialize application services
 * This should be called when the application starts
 */
export function initializeApp(): void {
  if (initialized) {
    console.log('[Startup] Already initialized, skipping');
    return;
  }

  console.log('[Startup] Initializing application services...');
  logger.info('system', '🚀 Application starting up');

  try {
    // 1. Initialize scanner service (this will trigger task resume)
    console.log('[Startup] Initializing scanner service...');
    // Just importing scannerService will trigger its constructor
    const _ = scannerService;
    console.log('[Startup] Scanner service initialized');

    // 2. Start automation scheduler (always start, not just in production)
    // This ensures tasks can resume in development environment too
    console.log('[Startup] Starting automation scheduler...');
    automationScheduler.start();
    console.log('[Startup] Automation scheduler started');

    initialized = true;
    console.log('[Startup] Application initialization complete');
    logger.success('system', '✅ Application initialized successfully');
  } catch (error) {
    console.error('[Startup] Initialization failed:', error);
    logger.error('system', '❌ Application initialization failed', {
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Check if application is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}
