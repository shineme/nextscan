import { NextResponse } from 'next/server';
import { syncDomains } from '@/lib/sync-domains';

export async function POST() {
    try {
        const result = await syncDomains();
        return NextResponse.json({ success: true, message: `Synced ${result.count} domains`, count: result.count });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
