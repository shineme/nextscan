import { NextResponse } from 'next/server';
import { configService } from '@/lib/config-service';

export async function GET() {
    try {
        const settings = configService.getAll();
        return NextResponse.json({ success: true, data: settings });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 批量更新配置
        configService.setMany(body);

        return NextResponse.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
