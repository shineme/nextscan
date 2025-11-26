import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * DELETE /api/domains/clear-all
 * Clear all domains from the database
 */
export async function DELETE() {
  try {
    // Use transaction to ensure atomicity
    const clearAll = db.transaction(() => {
      const result = db.prepare('DELETE FROM domains').run();
      return result.changes;
    });

    const deletedCount = clearAll();

    console.log(`[API] Cleared ${deletedCount} domains from database`);

    return NextResponse.json({
      success: true,
      message: `Successfully cleared ${deletedCount} domains`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('[API] Failed to clear all domains:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
