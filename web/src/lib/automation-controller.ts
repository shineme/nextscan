/**
 * Automation Controller
 * Controls the global automation state (pause/resume)
 */

import { configService } from './config-service';

export interface AutomationStatus {
  enabled: boolean;
  lastPaused?: string;
  uptime?: number;
}

class AutomationController {
  private static readonly AUTOMATION_KEY = 'automation_enabled';
  private static readonly LAST_PAUSE_KEY = 'automation_last_paused';

  /**
   * Check if automation is enabled
   */
  isEnabled(): boolean {
    const enabled = configService.get(AutomationController.AUTOMATION_KEY);
    return enabled === null ? true : enabled === 'true'; // Default to enabled
  }

  /**
   * Enable automation
   */
  enable(): void {
    configService.set(AutomationController.AUTOMATION_KEY, 'true');
    console.log('[AutomationController] Automation enabled');
  }

  /**
   * Disable automation
   */
  disable(): void {
    configService.set(AutomationController.AUTOMATION_KEY, 'false');
    configService.set(AutomationController.LAST_PAUSE_KEY, new Date().toISOString());
    console.log('[AutomationController] Automation disabled');
  }

  /**
   * Toggle automation state
   */
  toggle(): boolean {
    const currentState = this.isEnabled();
    if (currentState) {
      this.disable();
    } else {
      this.enable();
    }
    return !currentState;
  }

  /**
   * Get automation status with metadata
   */
  getStatus(): AutomationStatus {
    const enabled = this.isEnabled();
    const lastPaused = configService.get(AutomationController.LAST_PAUSE_KEY);

    let uptime: number | undefined;
    if (enabled && lastPaused) {
      uptime = Date.now() - new Date(lastPaused).getTime();
    }

    return {
      enabled,
      lastPaused: lastPaused || undefined,
      uptime,
    };
  }

  /**
   * Check if automation should run (used by scanner service)
   */
  shouldRun(): boolean {
    return this.isEnabled();
  }
}

// Export singleton instance
export const automationController = new AutomationController();
