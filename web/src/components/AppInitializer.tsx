'use client';

import { useEffect, useRef } from 'react';

/**
 * Client component that ensures app initialization on mount
 * This triggers task resume and starts automation scheduler
 */
export function AppInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        console.log('[AppInitializer] Triggering app initialization...');
        const res = await fetch('/api/init');
        const data = await res.json();
        
        if (data.success) {
          console.log('[AppInitializer] App initialized successfully');
        } else {
          console.error('[AppInitializer] Initialization failed:', data.message);
        }
      } catch (error) {
        console.error('[AppInitializer] Failed to initialize app:', error);
      }
    };

    // Initialize immediately
    initializeApp();
  }, []);

  // This component doesn't render anything
  return null;
}
