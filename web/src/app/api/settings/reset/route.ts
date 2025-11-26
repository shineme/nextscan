import { NextResponse } from 'next/server';
import { configService } from '@/lib/config-service';

export async function PUT() {
    try {
        configService.reset();
        return NextResponse.json({ success: true, message: 'Settings reset to defaults' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
