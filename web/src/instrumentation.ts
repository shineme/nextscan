/**
 * Next.js Instrumentation
 * This file runs when the Next.js server starts
 * Perfect for initializing services and resuming tasks
 */

export async function register() {
  // Only run on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting, initializing application...');
    
    // Dynamically import to avoid issues with client-side code
    const { initializeApp } = await import('./lib/startup');
    
    // Initialize the application
    initializeApp();
    
    console.log('[Instrumentation] Application initialization triggered');
  }
}
